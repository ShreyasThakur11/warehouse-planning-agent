// The guide: a handbook for the person who reads the plan each morning. It walks through
// one real plan, panel by panel, then says how far each part can be trusted.

import {
  AUTHOR,
  C,
  CHIP,
  FONT,
  LOOP,
  MARK,
  REPO_URL,
  SITE_SHORT,
  SITE_URL,
  TITLE,
  TOOLS,
  cap,
  escape,
  longDate,
  n,
  niceTicks,
  pct,
  plural,
  rackSvg,
  shortDate,
  signed,
} from "./brand.mjs";

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font: 11pt/1.5 ${FONT}, Helvetica, sans-serif; color: ${C.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 210mm; height: 297mm; padding: 20mm 20mm 20mm; overflow: hidden; break-after: page; background: ${C.surface}; }
.page:last-child { break-after: auto; }
.foot { position: absolute; left: 20mm; right: 20mm; bottom: 10mm; display: flex; justify-content: space-between; font-size: 8.5pt; color: ${C.ink3}; }
.kicker { margin: 0 0 2.5mm; color: ${C.accent}; font-size: 9.5pt; font-weight: bold; }
h1 { margin: 0; font-size: 25pt; line-height: 1.15; letter-spacing: -0.2pt; }
.lead { margin: 3.5mm 0 0; font-size: 12.5pt; line-height: 1.5; color: ${C.ink2}; }
h2 { margin: 7mm 0 2.5mm; font-size: 13.5pt; line-height: 1.25; }
h2.first { margin-top: 0; }
p { margin: 0 0 2.5mm; }
.muted { color: ${C.ink2}; }
.small { font-size: 9.5pt; line-height: 1.45; color: ${C.ink3}; }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 6mm; }
.tiles.three { grid-template-columns: repeat(3, 1fr); }
.tile { padding: 3.5mm 4mm; border: 0.3mm solid ${C.line}; border-radius: 1.5mm; }
.tile b { display: block; font-size: 18pt; line-height: 1.2; }
.tile span { display: block; margin-top: 1mm; font-size: 9.5pt; line-height: 1.4; color: ${C.ink2}; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.card { padding: 4mm 4.5mm; border-radius: 1.5mm; background: ${C.sunken}; }
.card h3 { margin: 0 0 1.5mm; font-size: 11.5pt; }
.card p { margin: 0; font-size: 10pt; line-height: 1.45; color: ${C.ink2}; }
.card.hot { background: ${C.wash}; }
.card .q { display: block; margin-bottom: 1mm; color: ${C.accent}; font-size: 9pt; font-weight: bold; }
ul { margin: 0; padding: 0 0 0 4.5mm; }
li { margin: 0 0 1.5mm; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; line-height: 1.4; }
th { padding: 1.5mm 2mm; border-bottom: 0.4mm solid ${C.ink}; text-align: left; font-weight: bold; vertical-align: bottom; }
td { padding: 1.5mm 2mm; border-bottom: 0.2mm solid ${C.line}; vertical-align: top; }
.num { text-align: right; white-space: nowrap; }
tr.hot td { background: ${C.wash}; font-weight: bold; }
code, .code { font: 9.5pt Consolas, Menlo, monospace; }
.loop { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; }
.step { padding: 3mm; border-radius: 1.5mm; background: ${C.sunken}; }
.step b { display: block; color: ${C.accent}; font-size: 11.5pt; }
.step span { display: block; margin-top: 1mm; font-size: 9.5pt; line-height: 1.35; color: ${C.ink2}; }
.brief { padding: 4mm 5mm; border-left: 1mm solid ${C.accent}; background: ${C.wash}; font-size: 11pt; line-height: 1.5; }
.brief b { display: block; margin-bottom: 1mm; font-size: 9pt; color: ${C.accent}; }
.note { padding: 4mm 4.5mm; border-left: 1mm solid ${C.accent}; background: ${C.wash}; font-size: 10.5pt; line-height: 1.5; }
.note b { display: block; margin-bottom: 1mm; }
.issue .tag { align-self: start; }
.issue { display: grid; grid-template-columns: 19mm 1fr; gap: 3mm; padding: 2.2mm 0; border-bottom: 0.2mm solid ${C.line}; font-size: 10pt; line-height: 1.45; }
.tag { display: inline-block; padding: 0.4mm 1.8mm; border-radius: 1mm; background: ${C.sunken}; color: ${C.ink2}; font-size: 8pt; font-weight: bold; letter-spacing: 0.2pt; white-space: nowrap; text-align: center; }
.tag.ask { background: ${C.criticalWash}; color: ${C.critical}; }
.tag.check { background: ${C.cautionWash}; color: ${C.caution}; }
.legend { display: flex; flex-wrap: wrap; gap: 1mm 6mm; margin: 0 0 2mm; font-size: 9.5pt; color: ${C.ink2}; }
.legend span { display: inline-flex; align-items: center; gap: 2mm; }
.swatch { display: inline-block; width: 3.2mm; height: 3.2mm; border-radius: 0.6mm; }
.stroke { display: inline-block; width: 7mm; height: 0; border-top: 0.6mm solid; }
.dash { display: inline-block; width: 7mm; height: 0; border-top: 0.4mm dashed ${C.ink}; }
figure { margin: 0; }
figcaption { margin-top: 1.5mm; font-size: 9pt; color: ${C.ink3}; }
pre { margin: 0; padding: 3mm 4mm; border-radius: 1.5mm; background: ${C.night}; color: ${C.nightInk}; font: 9pt/1.65 Consolas, Menlo, monospace; white-space: pre-wrap; }
a { color: ${C.accent}; text-decoration: none; }
.contents { display: grid; grid-template-columns: 1fr 8mm; gap: 1mm 3mm; font-size: 10pt; }
.contents span:nth-child(even) { text-align: right; color: ${C.ink3}; }
.cover { padding: 0; background: ${C.night}; color: ${C.nightInk}; }
.cover .inner { position: absolute; left: 22mm; right: 22mm; top: 30mm; }
.cover .label { margin-top: 12mm; color: ${C.nightAccent}; font-size: 11pt; font-weight: bold; }
.cover h1 { margin-top: 3mm; font-size: 40pt; line-height: 1.08; letter-spacing: -0.5pt; }
.cover .sub { margin: 7mm 0 0; font-size: 14.5pt; line-height: 1.45; color: ${C.nightInk2}; max-width: 150mm; }
.cover .art { position: absolute; left: 22mm; right: 22mm; bottom: 46mm; }
.cover .levels { display: flex; justify-content: space-between; margin-top: 3mm; font-size: 9.5pt; color: ${C.nightInk2}; }
.cover .by { position: absolute; left: 22mm; right: 22mm; bottom: 20mm; display: flex; justify-content: space-between; font-size: 10pt; color: ${C.nightInk2}; }
.try { display: grid; grid-template-columns: 38mm 1fr; gap: 6mm; align-items: center; }
.try svg { display: block; width: 38mm; height: 38mm; }
`;

const nbsp = (s) => String(s).replace(/ /g, "&nbsp;");

// Recent days shipped, then the forecast with its likely range.
function forecastChart(plan) {
  const W = 500;
  const H = 168;
  const left = 34;
  const right = 16;
  const top = 8;
  const bottom = 22;
  const recent = plan.recent;
  const ahead = plan.forecast.days;
  const points = recent.length + ahead.length;
  const step = (W - left - right) / (points - 1);
  const x = (i) => left + i * step;
  const { top: max, ticks } = niceTicks(Math.max(...recent.map((d) => d.pairs), ...ahead.map((d) => d.high)));
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const grid = ticks
    .map((v) => `<line x1="${left}" x2="${W - right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${C.line}" stroke-width="0.6"/><text x="${left - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="${C.ink3}">${n(v)}</text>`)
    .join("");
  const start = recent.length;
  const band = [
    ...ahead.map((d, i) => `${x(start + i).toFixed(1)},${y(d.high).toFixed(1)}`),
    ...ahead.map((d, i) => `${x(start + i).toFixed(1)},${y(d.low).toFixed(1)}`).reverse(),
  ].join(" ");
  const shipped = recent.map((d, i) => `${x(i).toFixed(1)},${y(d.pairs).toFixed(1)}`).join(" ");
  const forecast = [`${x(start - 1).toFixed(1)},${y(recent[start - 1].pairs).toFixed(1)}`, ...ahead.map((d, i) => `${x(start + i).toFixed(1)},${y(d.pairs).toFixed(1)}`)];
  const dots = ahead.map((d, i) => `<circle cx="${x(start + i).toFixed(1)}" cy="${y(d.pairs).toFixed(1)}" r="2.6" fill="${C.accent}" stroke="${C.surface}" stroke-width="1"/>`).join("");
  const labels = [0, 5, 10, 15]
    .filter((i) => i < recent.length)
    .map((i) => `<text x="${x(i).toFixed(1)}" y="${H - 7}" font-size="8" fill="${C.ink3}" text-anchor="middle">${shortDate(recent[i].date)}</text>`)
    .concat(ahead.map((d, i) => `<text x="${x(start + i).toFixed(1)}" y="${H - 7}" font-size="8" fill="${C.accent}" font-weight="bold" text-anchor="middle">${d.weekday}</text>`))
    .join("");
  const divider = `<line x1="${(x(start) - step / 2).toFixed(1)}" x2="${(x(start) - step / 2).toFixed(1)}" y1="${top}" y2="${H - bottom}" stroke="${C.rack}" stroke-width="0.8" stroke-dasharray="2 2"/>`;
  return `<div class="legend"><span><i class="stroke" style="border-color:${C.neutral}"></i>Pairs shipped, last ${recent.length} working days</span><span><i class="stroke" style="border-color:${C.accent}"></i>Forecast</span><span><i class="swatch" style="background:${C.soft}"></i>Likely range</span></div>
  <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Pairs shipped on recent working days and the forecast for the next ${ahead.length}">
    ${grid}${divider}<polygon points="${band}" fill="${C.soft}"/>
    <polyline points="${shipped}" fill="none" stroke="${C.neutral}" stroke-width="1.6" stroke-linejoin="round"/>
    <polyline points="${forecast.join(" ")}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round"/>${dots}${labels}
  </svg>`;
}

// One bar per forecast day: the plan, the extra if the day runs high, and the roster.
function workersChart(plan, roster) {
  const days = plan.workers.days;
  const W = 500;
  const H = 118;
  const left = 26;
  const top = 14;
  const bottom = 24;
  const { top: max, ticks } = niceTicks(Math.max(roster, ...days.map((d) => d.workers_if_high)), 3);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const slot = (W - left) / days.length;
  const barW = slot * 0.42;
  const grid = ticks
    .map((v) => `<line x1="${left}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${C.line}" stroke-width="0.6"/><text x="${left - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="${C.ink3}">${v}</text>`)
    .join("");
  const bars = days
    .map((d, i) => {
      const cx = left + slot * (i + 0.5);
      const x0 = (cx - barW / 2).toFixed(1);
      const high = d.workers_if_high > d.workers ? `<rect x="${x0}" y="${y(d.workers_if_high).toFixed(1)}" width="${barW.toFixed(1)}" height="${(y(d.workers) - y(d.workers_if_high)).toFixed(1)}" rx="1.5" fill="${C.soft}"/>` : "";
      return `${high}<rect x="${x0}" y="${y(d.workers).toFixed(1)}" width="${barW.toFixed(1)}" height="${(y(0) - y(d.workers)).toFixed(1)}" rx="1.5" fill="${C.accent}"/>
        <text x="${cx.toFixed(1)}" y="${(y(d.workers_if_high) - 3).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${C.ink}">${d.workers}${d.workers_if_high > d.workers ? ` (${d.workers_if_high})` : ""}</text>
        <text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="${C.ink3}">${shortDate(d.date)}</text>`;
    })
    .join("");
  return `<div class="legend"><span><i class="swatch" style="background:${C.accent}"></i>Workers planned</span><span><i class="swatch" style="background:${C.soft}"></i>Extra if the day runs high (in brackets)</span><span><i class="dash"></i>Crew on the roster: ${roster}</span></div>
  <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Workers planned for each forecast day">${grid}${bars}
    <line x1="${left}" x2="${W}" y1="${y(roster).toFixed(1)}" y2="${y(roster).toFixed(1)}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="4 3"/></svg>`;
}

// Every graded day: what shipped against what was forecast that morning.
function replayChart(index) {
  const days = index.days.filter((d) => d.actual);
  const W = 500;
  const H = 128;
  const left = 34;
  const top = 8;
  const bottom = 20;
  const { top: max, ticks } = niceTicks(Math.max(...days.map((d) => Math.max(d.actual.pairs, d.pairs))));
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const step = (W - left) / days.length;
  const grid = ticks
    .map((v) => `<line x1="${left}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${C.line}" stroke-width="0.6"/><text x="${left - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="${C.ink3}">${n(v)}</text>`)
    .join("");
  const bars = days
    .map((d, i) => `<rect x="${(left + i * step + 0.4).toFixed(2)}" y="${y(d.actual.pairs).toFixed(1)}" width="${Math.max(step - 0.8, 0.6).toFixed(2)}" height="${(y(0) - y(d.actual.pairs)).toFixed(1)}" fill="${C.rack}"/>`)
    .join("");
  const line = days.map((d, i) => `${(left + (i + 0.5) * step).toFixed(1)},${y(d.pairs).toFixed(1)}`).join(" ");
  const months = [];
  let last = "";
  days.forEach((d, i) => {
    const m = d.date.slice(0, 7);
    if (m !== last) {
      last = m;
      const name = new Date(`${d.date}T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
      months.push(`<text x="${(left + i * step).toFixed(1)}" y="${H - 6}" font-size="8" fill="${C.ink3}">${name}</text>`);
    }
  });
  return `<div class="legend"><span><i class="swatch" style="background:${C.rack}"></i>Pairs shipped</span><span><i class="stroke" style="border-color:${C.accent}"></i>Forecast made that morning</span></div>
  <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Pairs shipped and forecast on every graded day">${grid}${bars}
    <polyline points="${line}" fill="none" stroke="${C.accent}" stroke-width="1.2" stroke-linejoin="round"/>${months.join("")}</svg>`;
}

const tag = (kind) => {
  const label = CHIP[kind === "crew" || kind === "short" ? "escalate" : "check"];
  return `<span class="tag ${kind === "crew" || kind === "short" ? "ask" : "check"}">${label}</span>`;
};

export function guideHtml(d, qr) {
  const { replay: r, split, settings: s, records: rec, forward: fw, example: ex, groups, methods } = d;
  const f = r.forecast;
  const w = r.workers;
  const rep = r.replenishment;
  const today = fw.forecast.today;
  const wt = fw.workers.today;
  const fr = fw.replenishment;
  const exF = ex.forecast.today;
  const exA = ex.actual;
  const pages = [];
  const page = (kicker, title, lead, body) => {
    const number = pages.length + 2;
    pages.push(`<section class="page"><p class="kicker">${kicker}</p><h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}${body}<div class="foot"><span>${TITLE}</span><span>${number}</span></div></section>`);
  };

  // 2. The short version.
  page(
    "Start here",
    "Four answers before picking starts",
    `Every morning a warehouse needs to know how much will ship, which SKUs will sell, which boxes to bring within reach and how many people to bring in. This agent works out all four from the order history, checks its own plan and writes a brief for the supervisor. This guide shows how to read that plan and how far to trust it.`,
    `<div class="grid2" style="margin-top:6mm">
      <div class="card"><span class="q">1. Demand</span><h3>How much will ship?</h3><p>Pairs, order lines and orders for each of the next ${s.horizon_days} working days, with a likely range.</p></div>
      <div class="card"><span class="q">2. SKUs</span><h3>Which SKUs are in demand?</h3><p>The ${fw.skus.skus.length} SKUs expected to sell most, with their trend and where their stock sits.</p></div>
      <div class="card"><span class="q">3. Replenishment</span><h3>What comes down from levels 3-4?</h3><p>Every box to move down to levels 1-2, so pickers can reach enough stock for the next ${s.cover_days} working days.</p></div>
      <div class="card"><span class="q">4. Workers</span><h3>How many workers each day?</h3><p>Hours of picking and moving, turned into workers, with the number to bring in if the day runs high.</p></div>
    </div>
    <div class="cols" style="margin-top:7mm">
      <div><h2 class="first">What it is</h2><ul>
        <li>An AI agent that runs the morning's planning on its own and shows every step it took.</li>
        <li>Tested on ${r.days} working days of real records, each planned from earlier orders only.</li>
        <li>A live dashboard that anyone can open in a browser.</li>
      </ul></div>
      <div><h2 class="first">What it is not</h2><ul>
        <li>It does not run the warehouse. A person carries out the plan.</li>
        <li>It is not connected to a live system. It replays records that end on ${longDate(rec.last_day).replace(/^\w+ /, "")}.</li>
        <li>It never makes up a number. Every figure comes from a tool.</li>
      </ul></div>
    </div>
    <h2>In this guide</h2>
    <div class="contents">
      <span>What makes it an agent</span><span>3</span>
      <span>Reading a plan: demand</span><span>4</span>
      <span>Reading a plan: SKUs, and the boxes to bring down</span><span>5</span>
      <span>Reading a plan: workers, and the supervisor's list</span><span>6</span>
      <span>How a day went, and the track record</span><span>7</span>
      <span>How far to trust each part</span><span>8</span>
      <span>Run it yourself, and the records behind it</span><span>9</span>
    </div>`,
  );

  // 3. The agent.
  page(
    "The idea",
    "What makes it an agent",
    "An ordinary program runs the same steps every time. An agent is given a goal and a set of tools. It decides which tool to use next, reads the answer and decides what to do with it, until the goal is met. It also knows when to stop and ask a person.",
    `<h2>It works in a loop</h2>
    <div class="loop">${LOOP.map(([a, b]) => `<div class="step"><b>${a}</b><span>${b}</span></div>`).join("")}</div>
    <h2>Its ${TOOLS.length} tools</h2>
    <table><tr><th style="width:62mm">Tool</th><th>What it returns</th></tr>
      ${TOOLS.map(([name, what]) => `<tr><td class="code">${name}</td><td>${what}</td></tr>`).join("")}
    </table>
    <h2>Two brains, one set of tools</h2>
    <div class="cols">
      <div class="card"><h3>The built-in rules</h3><p>Run the loop with no key and no cost. Every score in this guide comes from them.</p></div>
      <div class="card"><h3>Claude</h3><p>With an Anthropic API key, Claude runs the same loop through the same tools. The dashboard says which brain made each plan.</p></div>
    </div>
    <div class="note" style="margin-top:5mm"><b>The language model never calculates a number</b>Tools do every sum. A brief that states a number no tool produced is rejected, and the brief is written from the tools' answers instead.</div>`,
  );

  // 4. Demand.
  page(
    "Reading a plan, 1 of 3",
    "How much will ship",
    `The worked example is the plan for ${longDate(fw.day)}, the first working day after the records end. Like every plan on the dashboard, it opens with the agent's brief.`,
    `<div class="brief" style="margin-top:5mm"><b>THE AGENT'S BRIEF</b>${escape(fw.brief)}</div>
    <div class="tiles">
      <div class="tile"><b>${n(today.pairs)}</b><span>pairs expected, likely ${nbsp(`${n(today.low)} to ${n(today.high)}`)}</span></div>
      <div class="tile"><b>${n(today.lines)}</b><span>order lines, in about ${n(today.orders)} orders</span></div>
      <div class="tile"><b>${wt.workers}</b><span>${wt.workers === 1 ? "worker" : "workers"}, ${wt.workers_if_high} if the day runs high</span></div>
      <div class="tile"><b>${n(fr.boxes)}</b><span>boxes to bring down from levels 3-4 to 1-2</span></div>
    </div>
    <h2>The forecast</h2>
    <figure>${forecastChart(fw)}</figure>
    <h2>How it chose the method</h2>
    <p>Before forecasting, it scores three methods on the last ${fw.methods.scored_days} working days and uses the one that missed least.</p>
    <table><tr><th>Method</th><th class="num">Missed by, last ${fw.methods.scored_days} days</th></tr>
      ${fw.methods.methods.map((m) => `<tr class="${m.method === fw.methods.best ? "hot" : ""}"><td>${m.name}</td><td class="num">${pct(m.miss_pct)}</td></tr>`).join("")}
    </table>
    <p class="small" style="margin-top:2.5mm">The range spans the middle 80% of this method's misses over those days. A wide range means volume has been swinging, not that the arithmetic is unsure.</p>`,
  );

  // 5. SKUs and boxes.
  const topSkus = fw.skus.skus.slice(0, 6);
  page(
    "Reading a plan, 2 of 3",
    "SKUs, and the boxes to bring down",
    `It shares the forecast out across SKUs by their sales over the last ${fr.unsold_on_l1_l2.days} working days, then checks that each has enough boxes within a picker's reach.`,
    `<h2>SKUs in demand</h2>
    <table><tr><th>SKU</th><th class="num">Pairs, next ${fw.skus.horizon_days} days</th><th class="num">Share</th><th>Lately</th><th class="num">Boxes, levels 1-2</th><th class="num">Levels 3-4</th><th class="num">Days levels 1-2 last</th></tr>
      ${topSkus.map((k) => `<tr><td class="code">${k.sku}</td><td class="num">${n(k.expected_pairs)}</td><td class="num">${pct(k.share_pct)}</td><td>${cap(k.trend)}</td><td class="num">${n(k.boxes_l1_l2)}</td><td class="num">${n(k.boxes_l3_l4)}</td><td class="num">${k.days_on_l1_l2 === null ? "n/a" : n(k.days_on_l1_l2, 1)}</td></tr>`).join("")}
    </table>
    <p class="small" style="margin-top:2mm">The top ${fw.skus.skus.length} take ${pct(fw.skus.top_share_pct)} of the forecast. Lately compares the last 10 days with the SKU's usual rate.</p>
    <h2>Bring down from levels 3-4 to 1-2</h2>
    <p>For each SKU size, it compares what levels 1-2 hold with what the next ${s.cover_days} working days need, and lists the boxes to bring down, the ones about to run out first. Below are the first three on the list, then the three largest top-ups.</p>
    <div class="tiles" style="margin-top:3mm">
      <div class="tile"><b>${n(fr.boxes)}</b><span>boxes to bring down</span></div>
      <div class="tile"><b>${n(fr.skus)}</b><span>SKU sizes</span></div>
      <div class="tile"><b>${n(fr.new_faces)}</b><span>new pick faces</span></div>
      <div class="tile"><b>${shortDate(fr.cover_until).slice(4)}</b><span>covered until, ${longDate(fr.cover_until).split(" ")[0]}</span></div>
    </div>
    <table style="margin-top:4mm"><tr><th style="width:36mm">SKU size</th><th class="num" style="width:14mm">Boxes</th><th>From</th><th style="width:24mm">To</th><th style="width:38mm">Why</th></tr>
      ${[...groups.slice(0, 3), ...groups.filter((g) => !g.newFace).sort((a, b) => b.boxes - a.boxes).slice(0, 3)].map((g) => `<tr><td class="code" style="white-space:nowrap">${g.sku} size ${g.size}</td><td class="num">${g.boxes}</td><td>${g.from.length > 1 ? `${g.from[0]} and ${g.from.length - 1} more` : g.from[0]}</td><td class="num" style="text-align:left">${g.to} L${g.toLevel}</td><td>${g.newFace ? "New pick face" : `${n(g.on)} on L1-2, ${n(g.needed)} needed`}</td></tr>`).join("")}
    </table>
    <p class="small" style="margin-top:2mm">A new pick face needs a free slot, so it sends ${plural(fr.swaps.length, "idle box", "idle boxes")} up to levels 3-4 to make room. It also notes what it cannot fix: ${plural(fr.short.skus, "SKU size")} will run short by about ${plural(fr.short.pairs, "pair")}, and ${plural(fr.not_in_racks.skus, "SKU size")} expected to sell have no box in the racks.</p>`,
  );

  // 6. Workers and the supervisor's list.
  page(
    "Reading a plan, 3 of 3",
    "Workers, and the supervisor's list",
    `It turns each day's forecast into hours of work, then workers. It staffs to the top of the range when 4 of the last 5 days ran above forecast. Here ${fw.yesterday.days_above_forecast_of_last_5} did, so it staffed to the expected volume.`,
    `<h2>Workers each day</h2>
    <figure>${workersChart(fw, s.crew_on_roster)}</figure>
    <table style="margin-top:3mm"><tr><th>Day</th><th class="num">Picking hours</th><th class="num">Moving boxes</th><th class="num">Total hours</th><th class="num">Workers</th><th class="num">If the day runs high</th></tr>
      ${fw.workers.days.map((x) => `<tr><td>${shortDate(x.date)}</td><td class="num">${n(x.picking_hours, 1)}</td><td class="num">${n(x.moving_hours, 1)}</td><td class="num">${n(x.hours, 1)}</td><td class="num">${x.workers}</td><td class="num">${x.workers_if_high}</td></tr>`).join("")}
    </table>
    <p class="small" style="margin-top:2mm">The time standard: ${s.seconds_per_stop} seconds a stop, ${s.seconds_per_pair} seconds a pair, ${s.seconds_per_run_setup} seconds to set up each trolley run and ${s.seconds_per_box_moved} seconds to bring a box down, plus a ${s.allowance_pct}% allowance. A worker gives ${n(s.productive_hours, 1)} productive hours of an ${s.shift_hours}-hour shift.</p>
    <h2>The supervisor's list</h2>
    <p>The last tool checks the plan. Anything it finds goes to the supervisor. Two kinds need a decision before the plan is settled.</p>
    <table><tr><th style="width:21mm">Mark</th><th>What it found</th><th style="width:55mm">What to do</th></tr>
      <tr><td>${tag("crew")}</td><td>More workers needed than the ${s.crew_on_roster} on the roster</td><td>Arrange cover</td></tr>
      <tr><td>${tag("short")}</td><td>Demand the racks cannot cover</td><td>Call stock in from production</td></tr>
      <tr><td>${tag("spike")}</td><td>A SKU selling at 3 times its usual rate</td><td>Look for one large order</td></tr>
      <tr><td>${tag("missing")}</td><td>Weekly: SKU sizes to sell with no box in the racks</td><td>Give them a slot</td></tr>
      <tr><td>${tag("reslot")}</td><td>Weekly: boxes on levels 1-2 unsold for ${fr.unsold_on_l1_l2.days} days</td><td>Move them up to levels 3-4</td></tr>
    </table>
    <p class="small" style="margin-top:2mm">The plan for ${shortDate(fw.day)} raised nothing. The next page shows a day that did.</p>`,
  );

  // 7. How a day went, and the track record.
  page(
    "Checking the plan",
    "How a day went, and the track record",
    `For every day in the records, the dashboard puts the plan beside what happened. ${longDate(ex.day)} is one of the closer days. The chart below shows the rest.`,
    `<div class="cols" style="margin-top:5mm;align-items:start">
      <table><tr><th>${shortDate(ex.day)}</th><th class="num">Planned</th><th class="num">Happened</th></tr>
        <tr><td>Pairs</td><td class="num">${n(exF.pairs)}</td><td class="num">${n(exA.pairs)}</td></tr>
        <tr><td>Order lines</td><td class="num">${n(exF.lines)}</td><td class="num">${n(exA.lines)}</td></tr>
        <tr><td>Workers</td><td class="num">${exA.workers_planned}</td><td class="num">${exA.workers_needed} needed</td></tr>
        <tr><td>Boxes brought down</td><td class="num">${n(exA.boxes_moved)}</td><td class="num">${n(exA.boxes_useful)} needed</td></tr>
      </table>
      <p class="muted" style="margin:0">Pairs landed ${signed(exA.miss_pct, 0)} from the forecast, inside the range of ${n(exF.low)} to ${n(exF.high)}. Order lines ran above the usual ratio, and the workers planned still covered the day. ${n(exA.boxes_useful)} of the ${n(exA.boxes_moved)} boxes brought down were needed within the ${s.cover_days} days.</p>
    </div>
    <h2>What it raised that morning</h2>
    ${ex.checks.issues.map((i) => `<div class="issue">${tag(i.kind)}<span>${escape(i.text)}</span></div>`).join("")}
    <h2>All ${r.days} graded days, each planned from earlier orders only</h2>
    <figure>${replayChart(d.index)}</figure>
    <div class="tiles three" style="margin-top:4mm">
      <div class="tile"><b>${pct(f.miss_pct)}</b><span>forecast miss, against ${pct(f.same_weekday_last_week_miss_pct)} for the same weekday last week</span></div>
      <div class="tile"><b>${pct(w.covered_pct)}</b><span>of days with enough workers, ${pct(w.covered_if_high_pct)} when staffed for a high day</span></div>
      <div class="tile"><b>${pct(rep.useful_pct)}</b><span>of boxes brought down were needed within the ${s.cover_days} days</span></div>
    </div>
    `,
  );

  // 8. How far to trust it.
  const errors = split.windows.map((win) => [win, split.sku_size_error_pct[String(win)], split.sku_error_pct[String(win)]]);
  page(
    "Honesty",
    "How far to trust each part",
    "What the track record says about each answer, and what to do about it.",
    `<h2>The forecast: better than the simplest rule, still wide</h2>
    <p>It misses by ${pct(f.miss_pct)} of the pairs shipped, against ${pct(f.same_weekday_last_week_miss_pct)} for the same weekday last week, and ${pct(f.in_range_pct)} of days land inside the range. Over the whole period it runs ${signed(f.bias_pct)} from the total, so it does not lean one way. Daily volume swings hard here: on ${split.days_ten_times_the_day_before_or_a_tenth} of ${split.working_days} working days, the warehouse shipped at least ten times the day before, or a tenth of it.</p>
    <p class="muted"><b>So:</b> plan around the range, not only the middle figure.</p>
    <h2>Workers: slightly over rather than short</h2>
    <p>Enough workers were planned on ${pct(w.covered_pct)} of days. ${w.short_days} days were short and ${w.over_days} were over, at ${n(w.mean_planned, 2)} workers planned against ${n(w.mean_needed, 2)} needed on average. Staffing for a high day would have covered ${pct(w.covered_if_high_pct)}. The agent chose to on ${w.staffed_high_days} days.</p>
    <p class="muted"><b>So:</b> on a day when a late order costs more than an idle hour, staff to the high figure.</p>
    <h2>Replenishment: the weak part, and why</h2>
    <p>Of ${n(rep.boxes_moved)} boxes brought down, ${n(rep.boxes_useful)} were needed in time, and they caught ${pct(rep.caught_pct)} of the ${n(rep.boxes_needed)} that truly had to come down. The cause is measured: even with the next ${split.ahead_days} days' total pairs known exactly, sharing them out by recent sales misses badly.</p>
    <table style="margin-top:2mm"><tr><th>Recent days used</th><th class="num">Error by SKU size</th><th class="num">Error by SKU</th></tr>
      ${errors.map(([win, a, b]) => `<tr class="${win === 40 ? "hot" : ""}"><td>${win}${win === 40 ? " (what the agent uses)" : ""}</td><td class="num">${pct(a)}</td><td class="num">${pct(b)}</td></tr>`).join("")}
    </table>
    <p class="muted" style="margin-top:2.5mm"><b>So:</b> treat the move list as a starting point. A box is cheap to move; a pair missing from levels 1-2 costs a trip up the rack.</p>
    <h2>What this does not show</h2>
    <ul>
      <li>One stock snapshot: every morning starts from the same stock position.</li>
      <li>The ${s.seconds_per_box_moved} seconds a box and the ${s.allowance_pct}% allowance are assumptions.</li>
      <li>The scores are the built-in rules'. Claude is tested with a stand-in model.</li>
    </ul>`,
  );

  // 9. Run it.
  page(
    "Try it",
    "Run it yourself",
    "The dashboard needs nothing installed. Each calendar day it moves on by one working day and shows that day's plan, made only from the orders before it.",
    `<div class="try" style="margin-top:5mm"><div>${qr}</div><div>
      <h2 class="first">Open the dashboard</h2>
      <p style="margin:0"><a href="${SITE_URL}">${SITE_SHORT}</a></p>
      <p class="small" style="margin:1.5mm 0 0">Today shows the plan and every step. Track record grades every day. How it works lists every number the agent uses.</p>
    </div></div>
    <h2>Run it on a laptop</h2>
    <pre>pip install -e .
warehouse-planner plan                     # the next working day, step by step
warehouse-planner plan --date ${ex.day}   # any day in the records
warehouse-planner replay                   # plan every day and score the plans
warehouse-planner site                     # build the dashboard into _site/</pre>
    <p class="small" style="margin-top:2mm">To let Claude run the morning, install the <code>claude</code> extra and set <code>ANTHROPIC_API_KEY</code>. With no key, the built-in rules run it.</p>
    <h2>Change the numbers</h2>
    <p>Every number the agent uses sits in <code>src/warehouse_planner/settings.py</code>. Change one, then run the replay again.</p>
    <table><tr><th>Setting</th><th class="num">Value</th><th>Setting</th><th class="num">Value</th></tr>
      <tr><td>Crew on the roster</td><td class="num">${s.crew_on_roster}</td><td>Days of cover on levels 1-2</td><td class="num">${s.cover_days}</td></tr>
      <tr><td>Shift</td><td class="num">${s.shift_hours} hours</td><td>Allowance</td><td class="num">${s.allowance_pct}%</td></tr>
      <tr><td>Bringing a box down</td><td class="num">${s.seconds_per_box_moved} s</td><td>Days ahead planned</td><td class="num">${s.horizon_days}</td></tr>
      <tr><td>Days used to score methods</td><td class="num">${s.backtest_days}</td><td>Fewest days before it plans</td><td class="num">${s.min_history_days}</td></tr>
    </table>
    <h2>The records</h2>
    <p>Real orders from a footwear manufacturer's warehouse in Sherbrooke, Canada: ${n(rec.working_days)} working days from ${longDate(rec.first_day).replace(/^\w+ /, "")} to ${longDate(rec.last_day).replace(/^\w+ /, "")}, ${n(rec.order_lines)} order lines, ${n(rec.pairs)} pairs and ${n(rec.skus)} SKUs, stored in ${n(rec.boxes)} boxes across ${n(rec.locations)} locations: ${n(rec.boxes_l1_l2)} on levels 1-2 and ${n(rec.boxes_l3_l4)} on levels 3-4.</p>
    <p class="small">de Assis, de Paula Ferreira and Ouhimmou (2025), Order Picking Dataset from a Warehouse of a Footwear Manufacturing Company, Mendeley Data, doi.org/10.17632/pf2w725pw3.1, CC BY 4.0. The dataset's creators do not endorse this project. Code: MIT, at ${REPO_URL.replace("https://", "")}.</p>`,
  );

  const cover = `<section class="page cover">
    <div class="inner">
      ${MARK(64)}
      <p class="label">A guide for the warehouse team</p>
      <h1>${TITLE}</h1>
      <p class="sub">An AI agent that plans a footwear warehouse's day: how much will ship, which SKUs are in demand, which boxes to bring down from levels 3-4, and how many workers each day needs.</p>
    </div>
    <div class="art">${rackSvg(626, 236)}<div class="levels"><span>Levels 3-4 hold reserve. Levels 1-2 are within reach.</span><span>The agent says which boxes come down.</span></div></div>
    <div class="by"><span>Developed by ${AUTHOR}</span><span>${SITE_SHORT}</span></div>
  </section>`;

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${TITLE}: Guide</title><style>${CSS}</style></head><body>${cover}${pages.join("")}</body></html>`;
}
