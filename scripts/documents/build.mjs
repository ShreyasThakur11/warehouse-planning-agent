// Build the guide, the deck and the poster from the replay's evidence and the built dashboard.
//
//   warehouse-planner site
//   DOCS_TOOLS=<folder with node_modules>  DOCS_BROWSER=<path to Chrome>  node scripts/documents/build.mjs [guide deck poster]
//
// The tools stay outside the repository: puppeteer-core, pptxgenjs and qrcode. Every page is
// measured before it is written, and the build stops if anything overflows, so a broken
// layout cannot reach the deliverables folder.

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { MARK, OUTPUT, SITE_URL, load } from "./brand.mjs";

const tools = process.env.DOCS_TOOLS;
const executablePath = process.env.DOCS_BROWSER;
if (!tools || !executablePath) throw new Error("Set DOCS_TOOLS and DOCS_BROWSER.");
const require = createRequire(path.join(tools, "package.json"));
const puppeteer = require("puppeteer-core");
const QRCode = require("qrcode");

const wanted = process.argv.slice(2);
const want = (name) => wanted.length === 0 || wanted.includes(name);
const preview = process.env.DOCS_PREVIEW || path.join(tools, "preview");
mkdirSync(OUTPUT, { recursive: true });
mkdirSync(preview, { recursive: true });

const data = load();
const qrSvg = await QRCode.toString(SITE_URL, {
  type: "svg",
  errorCorrectionLevel: "M",
  margin: 0,
  color: { dark: "#12161b", light: "#ffffff" },
});
const qrPng = await QRCode.toDataURL(SITE_URL, { errorCorrectionLevel: "M", margin: 1, width: 600, color: { dark: "#12161b", light: "#ffffff" } });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir: path.join(tools, "profile"),
  args: ["--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check"],
});

// PowerPoint needs the icon as a picture, so draw it once from the same drawing the site uses.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 256, height: 256 });
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">${MARK(256)}</body>`);
  const shot = await page.screenshot({ encoding: "base64", omitBackground: true });
  data.markPng = `data:image/png;base64,${shot}`;
  await page.close();
}

// Every page must hold its content: nothing past its own edges, and nothing over the footer.
const AUDIT = () => {
  const problems = [];
  document.querySelectorAll("section.page").forEach((section, index) => {
    const box = section.getBoundingClientRect();
    const foot = section.querySelector(".foot");
    const limit = foot ? foot.getBoundingClientRect().top - 2 : box.bottom;
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest(".foot")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.right > box.right + 0.5 || r.left < box.left - 0.5 || r.bottom > limit + 0.5) {
          problems.push(`page ${index + 1}: "${node.textContent.trim().slice(0, 48)}" runs past the edge`);
          break;
        }
      }
    }
    section.querySelectorAll("table, .tiles, .cols, .grid2, svg, pre").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > box.right + 0.5 || r.bottom > limit + 0.5)) {
        problems.push(`page ${index + 1}: <${el.tagName.toLowerCase()}.${el.className.baseVal ?? el.className}> runs past the edge`);
      }
    });
  });
  document.querySelectorAll("td, th, .tile, .card, .step, .issue, .brief").forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1) problems.push(`"${el.textContent.trim().slice(0, 48)}" is clipped`);
  });
  if (/NaN|undefined|\[object|null/.test(document.body.textContent)) problems.push("A missing value reached the page.");
  const free = [...document.querySelectorAll("section.page")].map((section) => {
    const foot = section.querySelector(".foot");
    const bottom = foot ? foot.getBoundingClientRect().top : section.getBoundingClientRect().bottom;
    let last = section.getBoundingClientRect().top;
    section.querySelectorAll(":scope > *:not(.foot)").forEach((el) => {
      last = Math.max(last, el.getBoundingClientRect().bottom);
    });
    return Math.round(((bottom - last) / 96) * 25.4);
  });
  return { problems, free };
};

async function renderPdf(html, name, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width: Math.round((width / 25.4) * 96), height: Math.round((height / 25.4) * 96) });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const { problems, free } = await page.evaluate(AUDIT);
  console.log(`${name}: ${free.length} page(s), free space at the foot in mm: ${free.join(" ")}`);
  const shots = await page.$$("section.page");
  for (const [i, section] of shots.entries()) {
    await section.screenshot({ path: path.join(preview, `${name.replace(/\.pdf$/, "")}-${String(i + 1).padStart(2, "0")}.png`) });
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    await browser.close();
    process.exit(1);
  }
  await page.pdf({ path: path.join(OUTPUT, name), width: `${width}mm`, height: `${height}mm`, printBackground: true, preferCSSPageSize: true, tagged: true });
  await page.close();
}

if (want("guide")) {
  const { guideHtml } = await import("./guide.mjs");
  await renderPdf(guideHtml(data, qrSvg), "Warehouse_Planning_Agent_Guide.pdf", 210, 297);
}
if (want("poster")) {
  const { posterHtml } = await import("./poster.mjs");
  await renderPdf(posterHtml(data, qrSvg), "Warehouse_Planning_Agent_Poster.pdf", 594, 841);
}
if (want("deck")) {
  const { deckSlides, writeDeck } = await import("./deck.mjs");
  const slides = deckSlides(data);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  let failed = false;
  for (const [index, slide] of slides.entries()) {
    await page.setContent(slide.previewHtml(qrPng), { waitUntil: "load" });
    const problems = await page.evaluate(slide.audit);
    if (problems.length) {
      failed = true;
      console.error(`slide ${index + 1}: ${problems.join("; ")}`);
    }
    await page.screenshot({ path: path.join(preview, `slide-${String(index + 1).padStart(2, "0")}.png`) });
  }
  await page.close();
  if (failed) {
    await browser.close();
    process.exit(1);
  }
  const file = await writeDeck(slides, require("pptxgenjs"), qrPng, path.join(OUTPUT, "Warehouse_Planning_Agent_Deck.pptx"), data.markPng);
  console.log(`deck: ${slides.length} slides, ${path.basename(file)}`);
}

await browser.close();
