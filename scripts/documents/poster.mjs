// The poster: the whole project on one A1 sheet, readable from a metre away.

import { AUTHOR, C, FONT, LOOP, MARK, REPO_URL, SITE_SHORT, SITE_URL, TITLE, TOOLS, longDate, n, pct, plural, rackSvg, shortDate } from "./brand.mjs";

const CSS = `
@page { size: 594mm 841mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font: 23pt/1.4 ${FONT}, Helvetica, sans-serif; color: ${C.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 594mm; height: 841mm; overflow: hidden; background: ${C.surface}; }
.head { position: relative; display: grid; grid-template-columns: 50mm 1fr 150mm; gap: 12mm; align-items: center; height: 100mm; padding: 0 26mm; background: ${C.night}; color: ${C.nightInk}; }
.head h1 { margin: 0; font-size: 72pt; line-height: 1.05; letter-spacing: -1pt; }
.head p { margin: 4mm 0 0; font-size: 27pt; line-height: 1.3; color: ${C.nightInk2}; }
.head .art svg { display: block; width: 150mm; height: auto; }
.body { position: absolute; left: 26mm; right: 26mm; top: 100mm; bottom: 22mm; display: flex; flex-direction: column; justify-content: space-between; padding: 11mm 0 10mm; }
.row { display: grid; gap: 14mm; }
.two { grid-template-columns: 1fr 1fr; }
.three { grid-template-columns: 1fr 1fr 1fr; }
.four { grid-template-columns: repeat(4, 1fr); gap: 11mm; }
h2 { margin: 0 0 4.5mm; font-size: 36pt; line-height: 1.16; }
h3 { margin: 0 0 2.5mm; font-size: 26pt; line-height: 1.2; }
p { margin: 0 0 2.5mm; }
.muted { color: ${C.ink2}; }
.small { font-size: 19.5pt; line-height: 1.36; color: ${C.ink3}; }
.kicker { margin: 0 0 1.5mm; color: ${C.accent}; font-size: 19pt; font-weight: bold; }
.qs { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.q { padding: 5mm 5.5mm; border-radius: 2mm; background: ${C.sunken}; }
.q b { display: block; font-size: 26pt; line-height: 1.2; }
.q span { display: block; margin-top: 1.5mm; font-size: 20pt; line-height: 1.3; color: ${C.ink2}; }
.loop { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; }
.step { padding: 4.5mm; border-radius: 2mm; background: ${C.sunken}; }
.step b { display: block; color: ${C.accent}; font-size: 25pt; }
.step span { display: block; margin-top: 1mm; font-size: 18.5pt; line-height: 1.3; color: ${C.ink2}; }
.plan { padding: 10mm 11mm 11mm; border-radius: 3mm; background: ${C.page}; border: 0.4mm solid ${C.line}; }
.plan > h2 { margin-bottom: 1.5mm; }
.brief { margin: 0 0 6mm; padding: 3.5mm 5mm; border-left: 1.4mm solid ${C.accent}; background: ${C.wash}; font-size: 22pt; line-height: 1.4; }
.big { display: block; font-size: 62pt; font-weight: bold; line-height: 1.05; }
.vbars { display: flex; align-items: flex-end; gap: 1.6mm; height: 100mm; border-bottom: 0.5mm solid ${C.ink3}; }
.vbars .col { position: relative; flex: 1; height: 100%; }
.vbars .bar { position: absolute; left: 12%; right: 12%; bottom: 0; border-radius: 1mm 1mm 0 0; }
.vbars .band { position: absolute; left: 0; right: 0; border-radius: 1mm; background: ${C.soft}; }
.vbars .val { position: absolute; left: -4mm; right: -4mm; text-align: center; font-size: 19pt; font-weight: bold; }
.vlabels { display: flex; gap: 1.6mm; margin-top: 2mm; font-size: 17.5pt; color: ${C.ink3}; }
.vlabels span { flex: 1; text-align: center; white-space: nowrap; }
.vlabels .ahead { color: ${C.accent}; font-weight: bold; }
.roster { position: absolute; left: 0; right: 0; border-top: 0.6mm dashed ${C.ink}; }
.legend { display: flex; flex-wrap: wrap; gap: 1mm 5mm; margin: 0 0 3mm; font-size: 18pt; color: ${C.ink2}; }
.legend span { display: inline-flex; align-items: center; gap: 2mm; }
.sw { display: inline-block; width: 5.5mm; height: 5.5mm; border-radius: 0.8mm; }
.bars { display: grid; grid-template-columns: 37mm 1fr 20mm; gap: 4mm 3mm; align-items: center; font-size: 20pt; line-height: 1.2; }
.track { height: 7.5mm; }
.fill { height: 100%; border-radius: 0 1.5mm 1.5mm 0; background: ${C.rack}; }
.fill.hot { background: ${C.accent}; }
.value { text-align: right; white-space: nowrap; }
.code { font-family: Consolas, Menlo, monospace; font-size: 18.5pt; }
table { width: 100%; border-collapse: collapse; font-size: 20pt; line-height: 1.28; }
th { padding: 2mm 2mm; border-bottom: 0.6mm solid ${C.ink}; text-align: left; vertical-align: bottom; }
td { padding: 2mm 2mm; border-bottom: 0.3mm solid ${C.line}; vertical-align: top; }
.num { text-align: right; white-space: nowrap; }
tr.hot td { background: ${C.wash}; font-weight: bold; }
.stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; }
.stat { padding: 5mm; border-radius: 2mm; background: ${C.sunken}; }
.stat.hot { background: ${C.wash}; }
.stat b { display: block; font-size: 44pt; line-height: 1.1; }
.stat span { display: block; margin-top: 1.5mm; font-size: 19pt; line-height: 1.3; color: ${C.ink2}; }
.tag { display: inline-block; padding: 0.3mm 2mm; border-radius: 1mm; font-size: 15pt; font-weight: bold; }
.tag.ask { background: ${C.criticalWash}; color: ${C.critical}; }
.tag.check { background: ${C.cautionWash}; color: ${C.caution}; }
.note { padding: 4.5mm 5.5mm; border-left: 1.6mm solid ${C.accent}; background: ${C.wash}; }
.note b { display: block; margin-bottom: 1.5mm; font-size: 27pt; }
ul { margin: 0; padding: 0 0 0 6.5mm; }
li { margin: 0 0 1.5mm; }
.try { display: grid; grid-template-columns: 72mm 1fr; gap: 9mm; align-items: center; }
.qr svg { display: block; width: 72mm; height: 72mm; }
a { color: ${C.accent}; text-decoration: none; }
.foot { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: center; height: 22mm; padding: 0 26mm; background: ${C.night}; color: ${C.nightInk2}; font-size: 18pt; }
`;

const bars = (rows, max, format) =>
  `<div class="bars">${rows
    .map((r) => `<span class="code" style="${r.hot ? "font-weight:bold" : ""}">${r.label}</span><div class="track"><div class="fill ${r.hot ? "hot" : ""}" style="width:${((r.value / max) * 100).toFixed(1)}%"></div></div><span class="value" style="${r.hot ? "font-weight:bold" : ""}">${format(r.value)}</span>`)
    .join("")}</div>`;

function forecastBars(plan) {
  const recent = plan.recent.slice(-8);
  const ahead = plan.forecast.days;
  const max = Math.max(...recent.map((d) => d.pairs), ...ahead.map((d) => d.high)) * 1.04;
  const h = (v) => `${((v / max) * 100).toFixed(1)}%`;
  const cols = recent
    .map((d) => `<div class="col"><div class="bar" style="height:${h(d.pairs)};background:${C.rack}"></div></div>`)
    .concat(ahead.map((d) => `<div class="col"><div class="band" style="bottom:${h(d.low)};height:${h(d.high - d.low)}"></div><div class="bar" style="height:${h(d.pairs)};background:${C.accent}"></div></div>`))
    .join("");
  const labels = recent.map((d, i) => `<span>${i % 3 === 0 ? shortDate(d.date).slice(4) : ""}</span>`).concat(ahead.map((d) => `<span class="ahead">${d.weekday.slice(0, 2)}</span>`)).join("");
  return `<div class="legend"><span><i class="sw" style="background:${C.rack}"></i>Shipped</span><span><i class="sw" style="background:${C.accent}"></i>Forecast</span><span><i class="sw" style="background:${C.soft}"></i>Likely range</span></div>
    <div class="vbars">${cols}</div><div class="vlabels">${labels}</div>`;
}

function workerBars(plan, roster) {
  const days = plan.workers.days;
  const max = Math.max(roster, ...days.map((d) => d.workers_if_high)) * 1.18;
  const h = (v) => `${((v / max) * 100).toFixed(1)}%`;
  const cols = days
    .map(
      (d) => `<div class="col">
        <div class="bar" style="bottom:${h(d.workers)};height:${h(d.workers_if_high - d.workers)};background:${C.soft};border-radius:1mm 1mm 0 0"></div>
        <div class="bar" style="height:${h(d.workers)};background:${C.accent};border-radius:0"></div>
        <div class="val" style="bottom:calc(${h(d.workers_if_high)} + 1mm)">${d.workers} (${d.workers_if_high})</div></div>`,
    )
    .join("");
  return `<div class="legend"><span><i class="sw" style="background:${C.accent}"></i>Planned</span><span><i class="sw" style="background:${C.soft}"></i>If the day runs high</span></div>
    <div class="vbars" style="position:relative">${cols}<div class="roster" style="bottom:${h(roster)}"></div></div>
    <div class="vlabels">${days.map((d) => `<span>${d.weekday}</span>`).join("")}</div>`;
}

const tag = (ask) => `<span class="tag ${ask ? "ask" : "check"}">${ask ? "ASK" : "CHECK"}</span>`;

export function posterHtml(d, qr) {
  const { replay: r, split, settings: s, records: rec, forward: fw, groups } = d;
  const f = r.forecast;
  const wk = r.workers;
  const rep = r.replenishment;
  const c = r.checks;
  const today = fw.forecast.today;
  const fr = fw.replenishment;
  const top = fw.skus.skus.slice(0, 6);
  const first = groups.slice(0, 3);

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${TITLE}: Poster</title><style>${CSS}</style></head><body>
<section class="page">
  <header class="head">${MARK(190)}<div><h1>${TITLE}</h1><p>An AI agent that plans a footwear warehouse's day, every morning.</p></div><div class="art">${rackSvg(600, 300, { bays: 4, moving: [[1, 1], [3, 0]] })}</div></header>
  <div class="body">

    <div class="row two">
      <section>
        <h2>Four answers before picking starts</h2>
        <div class="qs">
          <div class="q"><b>How much will ship?</b><span>Pairs, order lines and orders for the next ${s.horizon_days} working days, with a likely range.</span></div>
          <div class="q"><b>Which SKUs are in demand?</b><span>The ${fw.skus.skus.length} expected to sell most, and where their stock sits.</span></div>
          <div class="q"><b>What comes down from levels 3-4?</b><span>Every box to bring within reach for the next ${s.cover_days} working days.</span></div>
          <div class="q"><b>How many workers each day?</b><span>Hours of work turned into workers, and the number if the day runs high.</span></div>
        </div>
      </section>
      <section>
        <h2>What makes it an agent</h2>
        <p class="muted">It is given a goal and ${TOOLS.length} tools. It decides which tool to call next, reads the answer, checks its own plan and asks a person when it should not settle something alone.</p>
        <div class="loop">${LOOP.map(([a, b]) => `<div class="step"><b>${a}</b><span>${b}</span></div>`).join("")}</div>
      </section>
    </div>

    <section class="plan">
      <p class="kicker">A real plan</p>
      <h2>${longDate(fw.day)}, the first working day after the records end</h2>
      <p class="muted" style="margin-bottom:4mm">Every plan on the dashboard opens with the agent's brief:</p>
      <div class="brief">${fw.brief}</div>
      <div class="row four">
        <div><h3>1. Demand</h3><span class="big">${n(today.pairs)}</span><p class="small">pairs expected, likely ${n(today.low)} to ${n(today.high)}</p>${forecastBars(fw)}</div>
        <div><h3>2. SKUs in demand</h3><p class="small" style="margin-bottom:3mm">Pairs over the next ${fw.skus.horizon_days} working days. The top ${fw.skus.skus.length} take ${pct(fw.skus.top_share_pct)}.</p>${bars(top.map((k, i) => ({ label: k.sku, value: k.expected_pairs, hot: i === 0 })), top[0].expected_pairs, (x) => n(x))}</div>
        <div><h3>3. Boxes to bring down</h3><span class="big">${n(fr.boxes)}</span><p class="small">boxes from levels 3-4 to 1-2: ${plural(fr.skus, "SKU size")}, ${n(fr.new_faces)} new pick faces</p>
          <table style="margin-top:3mm"><tr><th>SKU size</th><th>From</th><th>To</th></tr>${first.map((g) => `<tr><td class="code">${g.sku} ${g.size}</td><td>${g.from[0]}</td><td>${g.to}</td></tr>`).join("")}</table></div>
        <div><h3>4. Workers</h3><span class="big">${fw.workers.today.workers}</span><p class="small">${fw.workers.today.workers === 1 ? "worker" : "workers"} today, ${fw.workers.today.workers_if_high} if the day runs high. Dashed: the ${s.crew_on_roster} on the roster.</p>${workerBars(fw, s.crew_on_roster)}</div>
      </div>
    </section>

    <div class="row three">
      <section>
        <h2>How well it planned ${r.days} real days</h2>
        <p class="muted">Each planned from earlier orders only, then checked against what happened. The simplest rule, the same weekday last week, misses by ${pct(f.same_weekday_last_week_miss_pct)}.</p>
        <div class="stats">
          <div class="stat"><b>${pct(f.miss_pct)}</b><span>forecast miss, as a share of pairs shipped</span></div>
          <div class="stat"><b>${pct(wk.covered_pct)}</b><span>of days with enough workers planned</span></div>
          <div class="stat hot"><b>${pct(rep.useful_pct)}</b><span>of boxes brought down were needed in time</span></div>
        </div>
      </section>
      <section>
        <h2>What did not work, and why</h2>
        <ul>
          <li>Demand by SKU size is too lumpy to place: even knowing the next ${split.ahead_days} days' total, sharing it by recent sales misses by ${pct(split.sku_size_error_pct["40"])}.</li>
          <li>So the plans caught ${pct(rep.caught_pct)} of the ${n(rep.boxes_needed)} boxes that truly had to come down.</li>
          <li>${wk.short_days} of ${r.days} days needed more workers than planned.</li>
        </ul>
      </section>
      <section>
        <h2>People stay in charge</h2>
        <table>
          <tr><th>What its check raised</th><th class="num">Days</th><th></th></tr>
          <tr><td>More workers than the roster</td><td class="num">${c.crew}</td><td>${tag(true)}</td></tr>
          <tr><td>Demand the racks cannot cover</td><td class="num">${c.short}</td><td>${tag(true)}</td></tr>
          <tr><td>A SKU at 3 times its usual rate</td><td class="num">${c.spike}</td><td>${tag(false)}</td></tr>
          <tr><td>Weekly: SKU sizes not in the racks</td><td class="num">${c.missing}</td><td>${tag(false)}</td></tr>
          <tr><td>Weekly: idle boxes on levels 1-2</td><td class="num">${c.reslot}</td><td>${tag(false)}</td></tr>
        </table>
      </section>
    </div>

    <div class="row two">
      <section>
        <div class="note"><b>The language model never calculates a number</b>Tools do every sum. With an Anthropic API key, Claude runs the same loop through the same tools, and a brief that states a number no tool produced is rejected. The scores here are the built-in rules'.</div>
        <p class="small" style="margin-top:5mm">The records are real: ${n(rec.working_days)} working days, ${n(rec.pairs)} pairs, ${n(rec.skus)} SKUs and ${n(rec.boxes)} boxes from one warehouse in Sherbrooke, Canada. They hold one snapshot of what sat where, so every morning starts from the same stock. No live warehouse is connected.</p>
      </section>
      <section>
        <div class="try">
          <div class="qr">${qr}</div>
          <div>
            <h2>See it plan today</h2>
            <p style="margin:0;font-size:19pt;white-space:nowrap"><a href="${SITE_URL}">${SITE_SHORT}</a></p>
            <p class="small" style="margin:2mm 0 0">A live dashboard that shows a new plan each day: the brief, every step the agent took, and every plan checked against what happened. Nothing to install.</p>
          </div>
        </div>
      </section>
    </div>
  </div>
  <footer class="foot"><span>Developed by ${AUTHOR}</span><span>Data: de Assis, de Paula Ferreira and Ouhimmou (2025), CC BY 4.0</span><span>${REPO_URL.replace("https://", "")}</span></footer>
</section>
</body></html>`;
}
