// Open the built dashboard in a real browser and check every page does its job.
//
//   npm install --prefix scripts
//   node scripts/check_site.mjs [_site]
//
// The site is served under /warehouse-planning-agent/, as on GitHub Pages, so the
// 404 page's absolute links are tested too. Any console error, a failed request or a
// content-policy violation fails the check.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const ROOT = resolve(process.argv[2] || "_site");
const BASE = "/warehouse-planning-agent/";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (!path.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
    path = normalize(path.slice(BASE.length)).replace(/^([/\\])+/, "");
    let file = join(ROOT, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      res.end(readFileSync(join(ROOT, "404.html")));
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

function chrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error("Chrome not found: set CHROME_PATH");
  return found;
}

const failures = [];
function check(ok, message) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
}

async function open(browser, url, width = 1280) {
  const page = await browser.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("requestfailed", (r) => problems.push(`request failed ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/missing-page")) problems.push(`${r.status()} ${r.url()}`);
  });
  await page.setViewport({ width, height: 900 });
  await page.goto(url, { waitUntil: "networkidle0" });
  return { page, problems };
}

async function run() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}${BASE}`;
  const index = JSON.parse(readFileSync(join(ROOT, "data", "index.json"), "utf-8"));
  const n = index.days.length;
  const browser = await puppeteer.launch({
    executablePath: chrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    console.log("Today");
    let { page, problems } = await open(browser, origin);
    await page.waitForSelector("#page:not(.hidden)", { timeout: 15000 });
    const today = await page.evaluate(() => ({
      day: document.getElementById("day").value,
      pairs: document.getElementById("k-pairs").textContent,
      steps: document.querySelectorAll("#run li").length,
      kinds: [...document.querySelectorAll("#run .chip")].map((c) => c.textContent),
      skus: document.querySelectorAll("#skus tr").length,
      charts: document.querySelectorAll(".chart svg").length,
      brief: document.getElementById("brief").textContent,
    }));
    const offset = Math.round((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - Date.parse(`${index.replay_start}T00:00:00Z`)) / 86400000);
    const expected = index.days[((offset % n) + n) % n].date;
    check(today.day === expected, `opens on today's replay day (${today.day})`);
    check(/\d/.test(today.pairs), `shows the pairs expected (${today.pairs})`);
    check(today.steps >= 8, `lists the agent's ${today.steps} steps`);
    check(today.kinds.includes("DECIDE") && today.kinds.includes("BRIEF"), "the run has decisions and a brief");
    check(today.skus === 15, `lists ${today.skus} SKUs in demand`);
    check(today.charts === 2, "draws the forecast and the workers charts");
    check(today.brief.length > 40, "shows the brief");
    check(problems.length === 0, `no errors (${problems.join("; ") || "none"})`);
    await page.close();

    console.log("A day in the records");
    const past = index.days.find((d) => d.actual && d.boxes > 0 && d.date !== expected).date;
    ({ page, problems } = await open(browser, `${origin}#${past}`));
    await page.waitForSelector("#page:not(.hidden)", { timeout: 15000 });
    const day = await page.evaluate(() => ({
      title: document.getElementById("title").textContent,
      moves: document.querySelectorAll("#moves tr").length,
      results: document.querySelectorAll("#results .result").length,
    }));
    check(day.title.includes(past.slice(0, 4)), `opens ${past} from the address`);
    check(day.moves > 0, `lists ${day.moves} SKU sizes to bring down`);
    check(day.results === 4, "shows how the plan did");
    const after = index.days[index.days.findIndex((d) => d.date === past) + 1].date;
    await page.click("#next");
    await page.waitForFunction((d) => document.getElementById("day").value !== d, {}, past);
    const moved = await page.$eval("#day", (e) => e.value);
    check(moved === after, `Next moves to ${after}`);
    check(problems.length === 0, `no errors (${problems.join("; ") || "none"})`);
    await page.close();

    console.log("The day after the records");
    const last = index.days[n - 1].date;
    ({ page, problems } = await open(browser, `${origin}#${last}`));
    await page.waitForSelector("#page:not(.hidden)", { timeout: 15000 });
    const note = await page.$eval("#result-note", (e) => e.textContent);
    check(/nothing to check/.test(note), "says it cannot be checked yet");
    check(problems.length === 0, `no errors (${problems.join("; ") || "none"})`);
    await page.close();

    console.log("Track record");
    ({ page, problems } = await open(browser, `${origin}history.html`));
    await page.waitForSelector("#page:not(.hidden)", { timeout: 15000 });
    const record = await page.evaluate(() => ({
      charts: document.querySelectorAll(".chart svg").length,
      rows: document.querySelectorAll("#days tr").length,
      miss: document.getElementById("s-miss").textContent,
    }));
    check(record.charts === 3, "draws three charts");
    check(record.rows === n, `lists all ${n} days`);
    check(record.miss === `${index.scores.forecast.miss_pct}%`, `shows the forecast miss (${record.miss})`);
    check(problems.length === 0, `no errors (${problems.join("; ") || "none"})`);
    await page.close();

    console.log("How it works");
    ({ page, problems } = await open(browser, `${origin}how.html`));
    await page.waitForFunction(() => document.querySelectorAll("#settings tr").length > 0, { timeout: 15000 });
    const how = await page.evaluate(() => ({
      settings: document.querySelectorAll("#settings tr").length,
      records: document.querySelectorAll("#records dt").length,
      filled: [...document.querySelectorAll("[data-setting]")].every((e) => e.textContent.trim() !== ""),
    }));
    check(how.settings >= 10, `lists ${how.settings} settings`);
    check(how.records >= 5, "describes the records");
    check(how.filled, "fills every setting named in the text");
    check(problems.length === 0, `no errors (${problems.join("; ") || "none"})`);
    await page.close();

    console.log("A missing page");
    ({ page, problems } = await open(browser, `${origin}missing-page`));
    const lost = await page.evaluate(() => ({
      heading: document.querySelector("h1").textContent,
      styled: getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)",
    }));
    check(/empty/.test(lost.heading), "shows the 404 page");
    check(lost.styled, "the 404 page is styled");
    // The page itself answers 404 on purpose; any other failed request is still caught above.
    problems = problems.filter((p) => !/status of 404/.test(p));
    check(problems.length === 0, `no errors (${problems.join("; ") || "none"})`);
    await page.close();

    console.log("Phone width and dark theme");
    for (const path of ["", "history.html", "how.html"]) {
      ({ page, problems } = await open(browser, origin + path, 375));
      await new Promise((r) => setTimeout(r, 400));
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(wide <= 0, `${path || "index.html"} fits a phone (${wide}px over)`);
      await page.close();
    }
    ({ page, problems } = await open(browser, origin));
    await page.click(".theme");
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check(theme === "dark" || theme === "light", `the theme switch works (${theme})`);
    check(problems.length === 0, `no errors (${problems.join("; ") || "none"})`);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nEvery check passed");
  process.exit(failures.length ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
