// The deck: a ten-minute talk in thirteen slides, with speaker notes.
//
// Each slide is a list of boxes measured in inches. The same list is drawn twice: as native
// PowerPoint shapes, and as HTML in the same font so each slide can be rendered and measured
// on a machine with no PowerPoint.

import { AUTHOR, C, FONT, LOOP, SITE_SHORT, SITE_URL, TITLE, TOOLS, longDate, n, niceTicks, pct, plural, shortDate, signed } from "./brand.mjs";

const W = 13.333;
const H = 7.5;
const M = 0.75;
const hex = (c) => c.replace("#", "").toUpperCase();
const LINE = 1.2;

// Drawing primitives.
const text = (x, y, w, h, value, o = {}) => ({ type: "text", x, y, w, h, value, size: 16, color: C.ink, ...o });
const box = (x, y, w, h, fill, o = {}) => ({ type: "box", x, y, w, h, fill, ...o });
const line = (x, y, w, h, color, weight = 1, o = {}) => ({ type: "line", x, y, w, h, color, weight, ...o });
const arrow = (x, y, w, color = C.ink3) => ({ type: "line", x, y, w, h: 0, color, weight: 1.5, arrow: true });
const image = (x, y, w, h, source) => ({ type: "image", x, y, w, h, source });

const card = (x, y, w, h, heading, body, fill = C.sunken) => [
  box(x, y, w, h, fill, { radius: 0.06 }),
  text(x + 0.2, y + 0.16, w - 0.4, 0.34, heading, { size: 16, bold: true }),
  text(x + 0.2, y + 0.54, w - 0.4, h - 0.64, body, { size: 14, color: C.ink2 }),
];

const stat = (x, y, w, big, small, o = {}) => [
  text(x, y, w, 0.8, big, { size: o.size ?? 40, bold: true, color: o.color || C.ink }),
  text(x, y + 0.74, w, o.h || 0.62, small, { size: 14, color: o.muted || C.ink2 }),
];

function barRows(x, y, w, rows, max, format, o = {}) {
  const labelW = o.labelW ?? 2.5;
  const valueW = o.valueW ?? 1.05;
  const rowH = o.rowH ?? 0.42;
  const out = [];
  rows.forEach((row, i) => {
    const top = y + i * rowH;
    const trackX = x + labelW + 0.1;
    const trackW = w - labelW - valueW - 0.2;
    out.push(text(x, top, labelW, rowH - 0.06, row.label, { size: 13, bold: !!row.hot, valign: "middle" }));
    out.push(box(trackX, top + 0.08, Math.max((row.value / max) * trackW, 0.03), rowH - 0.22, row.hot ? C.accent : C.rack));
    out.push(text(x + w - valueW, top, valueW, rowH - 0.06, format(row.value), { size: 13, bold: !!row.hot, align: "right", valign: "middle" }));
  });
  return out;
}

function table(x, y, widths, rows, o = {}) {
  const rowH = o.rowH ?? 0.42;
  const size = o.size ?? 13;
  const align = o.align ?? [];
  const hot = o.hot ?? -1;
  const out = [];
  const width = widths.reduce((a, b) => a + b, 0);
  rows.forEach((row, r) => {
    const top = y + r * rowH;
    if (r === hot) out.push(box(x, top, width, rowH, C.wash));
    let left = x;
    row.forEach((cell, c) => {
      out.push(text(left + 0.08, top, widths[c] - 0.16, rowH, cell, { size, bold: r === 0 || r === hot, align: align[c] || "left", valign: "middle", color: C.ink }));
      left += widths[c];
    });
    out.push(line(x, top + rowH, width, 0, r === 0 ? C.ink : C.line, r === 0 ? 1.25 : 0.75));
  });
  return out;
}

const frame = (title, parts, notes, kicker) => ({
  dark: false,
  notes,
  items: [
    text(M, 0.42, W - 2 * M, 0.3, kicker, { size: 12, bold: true, color: C.accent }),
    text(M, 0.72, W - 2 * M, 0.72, title, { size: 30, bold: true, valign: "top" }),
    ...parts.flat(Infinity),
  ],
});

// Rack bays seen from the front: reserve on levels 3-4, pick faces on levels 1-2, and a box
// coming down. Drawn with shapes so PowerPoint keeps it editable.
function rack(x, y, w, h, o = {}) {
  const bays = o.bays ?? 4;
  const slots = 3;
  const post = o.post ?? C.nightRack;
  const fill = o.box ?? C.nightBox;
  const mark = o.accent ?? C.nightAccent;
  const bayW = w / bays;
  const levelH = h / 4.1;
  const beam = 0.05;
  const postW = 0.05;
  const gap = bayW * 0.05;
  const boxW = (bayW - postW - 2 * gap - (slots - 1) * gap) / slots;
  const boxH = levelH * 0.5;
  const moving = o.moving ?? [[1, 1]];
  const isMoving = (b, s) => moving.some(([mb, ms]) => mb === b && ms === s);
  const bottom = (level) => y + h - (level - 1) * levelH;
  const out = [];
  for (let b = 0; b < bays; b += 1) {
    const x0 = x + b * bayW + postW + gap;
    for (let level = 1; level <= 4; level += 1) {
      const top = bottom(level) - beam - boxH;
      for (let s = 0; s < slots; s += 1) {
        const bx = x0 + s * (boxW + gap);
        if (isMoving(b, s)) {
          if (level === 3) out.push(box(bx, top, boxW, boxH, mark, { radius: 0.03 }));
          if (level === 1) out.push(box(bx + 0.02, top + 0.02, boxW - 0.04, boxH - 0.04, null, { outline: mark, radius: 0.03 }));
          if (level === 2) out.push(line(bx + boxW / 2, bottom(3) - beam + 0.04, 0, bottom(1) - beam - boxH - (bottom(3) - beam) - 0.1, mark, 2.25, { arrow: true }));
          continue;
        }
        if ((b * 5 + level * 3 + s * 7) % 6 === 0) continue;
        out.push(box(bx, top, boxW, boxH, fill, { radius: 0.03 }));
      }
      out.push(box(x + b * bayW, bottom(level) - beam, bayW, beam, post));
    }
  }
  for (let b = 0; b <= bays; b += 1) out.push(box(Math.min(x + b * bayW, x + w - postW), y + h - 4 * levelH - beam, postW, 4 * levelH + beam, post));
  return out;
}

// Recent days shipped as grey bars, then the forecast in blue with its likely range behind it.
function forecastBars(x, y, w, h, plan) {
  const recent = plan.recent.slice(-15);
  const ahead = plan.forecast.days;
  const count = recent.length + ahead.length;
  const step = w / count;
  const { top: max, ticks } = niceTicks(Math.max(...recent.map((d) => d.pairs), ...ahead.map((d) => d.high)), 3);
  const yv = (v) => y + h - (v / max) * h;
  const out = [];
  ticks.forEach((v) => {
    out.push(line(x, yv(v), w, 0, C.line, 0.75));
    out.push(text(x - 0.75, yv(v) - 0.14, 0.65, 0.28, n(v), { size: 11, color: C.ink3, align: "right", valign: "middle" }));
  });
  recent.forEach((d, i) => {
    const bh = Math.max((d.pairs / max) * h, 0.02);
    out.push(box(x + i * step + step * 0.18, y + h - bh, step * 0.64, bh, C.rack));
  });
  ahead.forEach((d, i) => {
    const cx = x + (recent.length + i) * step;
    out.push(box(cx + step * 0.08, yv(d.high), step * 0.84, yv(d.low) - yv(d.high), C.soft, { radius: 0.03 }));
    const bh = Math.max((d.pairs / max) * h, 0.02);
    out.push(box(cx + step * 0.24, y + h - bh, step * 0.52, bh, C.accent));
    out.push(text(cx - 0.05, y + h + 0.08, step + 0.1, 0.28, d.weekday, { size: 11, bold: true, color: C.accent, align: "center" }));
  });
  [0, 5, 10].forEach((i) => out.push(text(x + i * step - 0.2, y + h + 0.08, 1.4, 0.28, shortDate(recent[i].date), { size: 11, color: C.ink3 })));
  return out;
}

export function deckSlides(d) {
  const { replay: r, split, settings: s, records: rec, forward: fw } = d;
  const f = r.forecast;
  const wk = r.workers;
  const rep = r.replenishment;
  const today = fw.forecast.today;
  const wt = fw.workers.today;
  const fr = fw.replenishment;
  const slides = [];
  const cw = W - 2 * M;

  // 1. Title.
  slides.push({
    dark: true,
    notes: `This is an AI agent that plans a footwear warehouse's day. Every morning it works out how much will ship, which SKUs are in demand, which boxes to bring down from levels 3-4 to levels 1-2, and how many workers each day needs. It shows every step on a live dashboard.`,
    items: [
      image(M, 0.8, 0.95, 0.95, "mark"),
      text(M, 2.15, 6.6, 1.9, TITLE, { size: 50, bold: true, color: C.nightInk, valign: "top" }),
      text(M, 4.15, 6.4, 1.0, "An AI agent that plans a footwear warehouse's day, every morning.", { size: 20, color: C.nightInk2, valign: "top" }),
      rack(7.9, 1.25, 4.68, 4.55),
      text(7.9, 5.98, 4.68, 0.3, "Levels 3-4 hold reserve. Levels 1-2 are within reach.", { size: 12, color: C.nightInk2 }),
      text(M, 6.78, 6, 0.32, `Developed by ${AUTHOR}`, { size: 14, color: C.nightInk2 }),
    ],
  });

  // 2. The job.
  const qW = (cw - 3 * 0.3) / 4;
  const questions = [
    ["Demand", "How much will ship?", `Pairs, order lines and orders for the next ${s.horizon_days} working days.`],
    ["SKUs", "Which SKUs are in demand?", `The ${fw.skus.skus.length} expected to sell most, and where their stock sits.`],
    ["Replenishment", "What comes down from levels 3-4?", `Every box to bring within reach for the next ${s.cover_days} working days.`],
    ["Workers", "How many workers each day?", "Hours of work turned into workers, and the number if the day runs high."],
  ];
  slides.push(
    frame(
      "Four answers before picking starts",
      [
        questions.map(([k, q, a], i) => {
          const x = M + i * (qW + 0.3);
          return [
            box(x, 2.0, qW, 2.5, C.sunken, { radius: 0.06 }),
            text(x + 0.2, 2.16, qW - 0.4, 0.3, k, { size: 13, bold: true, color: C.accent }),
            text(x + 0.2, 2.52, qW - 0.4, 0.78, q, { size: 18, bold: true }),
            text(x + 0.2, 3.34, qW - 0.4, 1.06, a, { size: 13, color: C.ink2 }),
          ];
        }),
        rack(M, 4.85, 2.6, 1.85, { bays: 2, post: C.rack, box: C.sunken, accent: C.accent, moving: [[0, 1]] }),
        text(3.65, 4.95, 8.93, 0.4, "Levels 1-2 are within a picker's reach. Levels 3-4 hold reserve.", { size: 18, bold: true }),
        text(3.65, 5.45, 8.93, 1.1, "A SKU that sells needs boxes on levels 1-2 before the day starts. The agent says which ones come down, from where and to where, and how many people the day needs.", { size: 15, color: C.ink2 }),
      ],
      `These are the four questions the warehouse asked for. The third one matters most on the floor: reserve stock sits on levels 3-4, out of reach, so the boxes that will sell have to come down to levels 1-2 before picking starts.`,
      "The job",
    ),
  );

  // 3. The records.
  const graded = d.index.days.filter((x) => x.actual);
  const peak = Math.max(...graded.map((x) => x.actual.pairs));
  const { top: chartMax, ticks: chartTicks } = niceTicks(peak, 3);
  const chartX = 6.55;
  const chartW = W - M - chartX;
  const step = chartW / graded.length;
  slides.push(
    frame(
      "Real records from one warehouse",
      [
        stat(M, 2.0, 2.5, n(rec.working_days), "working days of orders", { size: 34 }),
        stat(M + 2.6, 2.0, 2.5, n(rec.pairs), "pairs shipped", { size: 34 }),
        stat(M, 3.55, 2.5, n(rec.skus), "SKUs, in many sizes", { size: 34 }),
        stat(M + 2.6, 3.55, 2.5, n(rec.boxes), "boxes in the racks", { size: 34 }),
        text(M, 5.15, 5.0, 0.32, "Where the boxes sit", { size: 14, bold: true }),
        box(M, 5.55, (5.0 * rec.boxes_l1_l2) / rec.boxes, 0.36, C.accent),
        box(M + (5.0 * rec.boxes_l1_l2) / rec.boxes + 0.03, 5.55, 5.0 - (5.0 * rec.boxes_l1_l2) / rec.boxes - 0.03, 0.36, C.ink3),
        text(M, 5.98, 3.0, 0.3, `${n(rec.boxes_l1_l2)} on levels 1-2`, { size: 13 }),
        text(M + 3.0, 5.98, 2.0, 0.3, `${n(rec.boxes_l3_l4)} on 3-4`, { size: 13, align: "right" }),
        text(chartX, 2.0, chartW, 0.32, "Pairs shipped each working day, March to October 2023", { size: 14, bold: true }),
        chartTicks.map((v) => [line(chartX, 6.0 - (v / chartMax) * 3.4, chartW, 0, v === 0 ? C.ink3 : C.line, 0.75), text(chartX - 0.78, 6.0 - (v / chartMax) * 3.4 - 0.14, 0.68, 0.28, n(v), { size: 11, color: C.ink3, align: "right", valign: "middle" })]),
        graded.map((x, i) => {
          const bh = Math.max((x.actual.pairs / chartMax) * 3.4, 0.01);
          return box(chartX + i * step + step * 0.12, 6.0 - bh, step * 0.76, bh, C.rack);
        }),
        text(chartX, 6.1, chartW, 0.6, `On ${split.days_ten_times_the_day_before_or_a_tenth} of ${split.working_days} working days, the warehouse shipped at least ten times the day before, or a tenth of it.`, { size: 13, color: C.ink2 }),
      ],
      `The records come from a footwear manufacturer's warehouse in Sherbrooke, Canada, published openly in 2025. Look at the chart: volume swings hard from one day to the next. Any forecast here will miss by a lot, so the question is whether the agent beats the simple rules a supervisor would use.`,
      "The records",
    ),
  );

  // 4. The loop.
  const stepW = (cw - 4 * 0.42) / 5;
  slides.push(
    frame(
      "What makes it an agent",
      [
        LOOP.map(([a, b], i) => {
          const x = M + i * (stepW + 0.42);
          return [
            box(x, 2.05, stepW, 1.8, i === 1 ? C.wash : C.sunken, { radius: 0.06 }),
            text(x + 0.16, 2.18, stepW - 0.32, 0.4, a, { size: 18, bold: true, color: C.accent }),
            text(x + 0.16, 2.62, stepW - 0.32, 1.15, b, { size: 13, color: C.ink2 }),
            i < 4 ? arrow(x + stepW + 0.07, 2.95, 0.28) : [],
          ];
        }),
        text(M, 3.95, cw, 0.3, "Every morning, with no one at the keyboard.", { size: 13, color: C.ink3, align: "right" }),
        card(M, 4.4, 3.8, 1.6, "A goal", "A plan for the day that a supervisor can act on."),
        card(M + 4.02, 4.4, 3.8, 1.6, "Tools", `${TOOLS.length} small tools do every sum. It chooses which to call, and when.`),
        card(M + 8.04, 4.4, 3.79, 1.6, "Judgement", "It picks the forecast method, how to staff, and what to raise with a person."),
      ],
      `An ordinary program runs the same steps every time. An agent is given a goal and tools, decides which tool to use next, reads the answer and decides what to do with it. This one also checks its own plan, and hands anything it should not settle alone to the supervisor.`,
      "The idea",
    ),
  );

  // 5. Tools and the rule.
  slides.push(
    frame(
      `${TOOLS.length} tools, and one rule`,
      [
        table(M, 1.95, [2.85, 4.85], [["Tool", "What it returns"], ...TOOLS.map(([a, b]) => [a, b])], { rowH: 0.47, size: 12 }),
        box(8.75, 2.0, 3.83, 2.35, C.wash, { radius: 0.06 }),
        text(8.95, 2.14, 3.43, 0.7, "The language model never calculates a number", { size: 16, bold: true }),
        text(8.95, 2.9, 3.43, 1.35, "A brief that states a number no tool produced is rejected, and rewritten from the tools' answers.", { size: 13, color: C.ink2 }),
        card(8.75, 4.55, 3.83, 1.68, "Two brains", "Built-in rules with no key, or Claude with one. Same tools, same check."),
      ],
      `The tools are plain code: they read the orders, forecast, split demand across SKUs, plan boxes and workers, and check the plan. Claude can run the loop instead of the built-in rules, but it never does arithmetic. That rule is enforced in code, and the same check runs over this project's own documents.`,
      "The idea",
    ),
  );

  // 6. Demand.
  slides.push(
    frame(
      `The next working day: about ${n(today.pairs)} pairs`,
      [
        [["Pairs shipped", C.rack, 1.7], ["Forecast", C.accent, 1.3], ["Likely range", C.soft, 1.6]].reduce((acc, [label, color, width]) => {
          const x = acc.x;
          acc.items.push(box(x, 2.04, 0.18, 0.18, color), text(x + 0.26, 1.97, width - 0.3, 0.32, label, { size: 13, color: C.ink2, valign: "middle" }));
          acc.x += width;
          return acc;
        }, { x: M + 0.8, items: [] }).items,
        forecastBars(M + 0.8, 2.45, 7.0, 3.3, fw),
        stat(9.1, 2.0, 3.48, n(today.pairs), `pairs expected, likely ${n(today.low)} to ${n(today.high)}`, { h: 0.62 }),
        stat(9.1, 3.5, 3.48, n(today.lines), `order lines, in about ${n(today.orders)} orders`, { h: 0.34 }),
        text(9.1, 4.75, 3.48, 0.32, "Method chosen this morning", { size: 13, bold: true }),
        text(9.1, 5.1, 3.48, 0.95, `${fw.forecast.method_name}: it missed by ${pct(fw.methods.methods[0].miss_pct)} over the last ${fw.methods.scored_days} days.`, { size: 13, color: C.ink2 }),
      ],
      `The worked example is the first working day after the records end. The agent scored three methods on the last ${fw.methods.scored_days} working days and used the one that missed least. The blue band is the likely range, taken from that method's own past misses. A wide band is honest: volume here swings hard.`,
      "A real plan",
    ),
  );

  // 7. SKUs.
  const top = fw.skus.skus.slice(0, 8);
  slides.push(
    frame(
      "Which SKUs are in demand",
      [
        text(M, 1.95, 7.6, 0.32, `Pairs expected over the next ${fw.skus.horizon_days} working days`, { size: 14, color: C.ink2 }),
        barRows(M, 2.4, 7.6, top.map((k, i) => ({ label: `${k.sku}, ${k.trend}`, value: k.expected_pairs, hot: i === 0 })), top[0].expected_pairs, (x) => n(x), { labelW: 2.4, rowH: 0.47 }),
        stat(9.1, 2.0, 3.48, pct(fw.skus.top_share_pct), `of the forecast falls on the top ${fw.skus.skus.length} SKUs`, { h: 0.62 }),
        stat(9.1, 3.55, 3.48, n(top[0].days_on_l1_l2, 1), `days the boxes on levels 1-2 last for ${top[0].sku}`, { h: 0.62 }),
        text(9.1, 5.1, 3.48, 0.9, `Rising lately: ${fw.skus.rising.join(", ") || "none"}.`, { size: 14, color: C.ink2 }),
      ],
      `It shares the forecast out across SKUs by their sales over the last ${fr.unsold_on_l1_l2.days} working days. For each SKU it shows the trend over the last 10 days and how long the boxes within reach will last. That last figure is what drives the move list on the next slide.`,
      "A real plan",
    ),
  );

  // 8. Replenishment.
  const firsts = d.groups.slice(0, 3);
  const topups = d.groups.filter((g) => !g.newFace).sort((a, b) => b.boxes - a.boxes).slice(0, 2);
  slides.push(
    frame(
      `Bring ${n(fr.boxes)} boxes down from levels 3-4`,
      [
        stat(M, 2.0, 2.7, n(fr.boxes), "boxes to bring down", { size: 36, h: 0.34 }),
        stat(M + 2.95, 2.0, 2.7, n(fr.skus), "SKU sizes", { size: 36, h: 0.34 }),
        stat(M + 5.9, 2.0, 2.7, n(fr.new_faces), "new pick faces", { size: 36, h: 0.34 }),
        stat(M + 8.85, 2.0, 2.98, shortDate(fr.cover_until).slice(4), `covered until, ${longDate(fr.cover_until).split(" ")[0]}`, { size: 36, h: 0.34 }),
        table(
          M,
          3.4,
          [2.6, 1.0, 3.3, 1.9, 3.03],
          [
            ["SKU size", "Boxes", "From", "To", "Why"],
            ...[...firsts, ...topups].map((g) => [`${g.sku} size ${g.size}`, String(g.boxes), g.from.length > 1 ? `${g.from[0]} and ${g.from.length - 1} more` : g.from[0], `${g.to} L${g.toLevel}`, g.newFace ? "New pick face" : `${n(g.on)} on L1-2, ${n(g.needed)} needed`]),
          ],
          { rowH: 0.42, size: 13, align: ["left", "right", "left", "left", "left"] },
        ),
        text(M, 6.08, cw, 0.62, `It also flags what it cannot fix: ${plural(fr.short.skus, "SKU size")} will run short by about ${plural(fr.short.pairs, "pair")}.`, { size: 14, color: C.ink2 }),
      ],
      `This is the work list for the morning: which boxes move from levels 3-4 to levels 1-2, from where, to where, and why. The ones about to run out come first. A new pick face needs a free slot, so the agent sends ${plural(fr.swaps.length, "idle box", "idle boxes")} up to make room.`,
      "A real plan",
    ),
  );

  // 9. Workers.
  const days = fw.workers.days;
  const { top: wMax, ticks: wTicks } = niceTicks(Math.max(s.crew_on_roster, ...days.map((x) => x.workers_if_high)), 3);
  const cX = M + 0.5;
  const cY = 2.35;
  const cH = 3.3;
  const cW = 6.9;
  const slotW = cW / days.length;
  const wy = (v) => cY + cH - (v / wMax) * cH;
  slides.push(
    frame(
      "How many workers each day",
      [
        wTicks.map((v) => [line(cX, wy(v), cW, 0, C.line, 0.75), text(cX - 0.5, wy(v) - 0.14, 0.4, 0.28, String(v), { size: 11, color: C.ink3, align: "right", valign: "middle" })]),
        days.map((x, i) => {
          const bx = cX + i * slotW + slotW * 0.25;
          const bw = slotW * 0.5;
          return [
            x.workers_if_high > x.workers ? box(bx, wy(x.workers_if_high), bw, wy(x.workers) - wy(x.workers_if_high), C.soft) : [],
            box(bx, wy(x.workers), bw, cY + cH - wy(x.workers), C.accent),
            text(cX + i * slotW, wy(x.workers_if_high) - 0.36, slotW, 0.3, `${x.workers} (${x.workers_if_high})`, { size: 13, bold: true, align: "center" }),
            text(cX + i * slotW, cY + cH + 0.08, slotW, 0.28, shortDate(x.date), { size: 11, color: C.ink3, align: "center" }),
          ];
        }),
        line(cX, wy(s.crew_on_roster), cW, 0, C.ink, 1.25, { dash: true }),
        text(M, 6.12, 7.4, 0.3, `Workers planned, and in brackets if the day runs high. Dashed: the ${s.crew_on_roster} on the roster.`, { size: 12, color: C.ink3 }),
        table(
          8.55,
          2.0,
          [1.6, 1.15, 1.28],
          [["Day", "Hours", "Workers"], ...days.map((x) => [shortDate(x.date), n(x.hours, 1), String(x.workers)])],
          { rowH: 0.42, size: 13, align: ["left", "right", "right"] },
        ),
        text(8.55, 4.75, 4.03, 1.3, `${s.seconds_per_stop} s a stop, ${s.seconds_per_pair} s a pair, ${s.seconds_per_box_moved} s a box moved, plus ${s.allowance_pct}%. A worker gives ${n(s.productive_hours, 1)} hours.`, { size: 13, color: C.ink2 }),
      ],
      `The hours come from a time standard: stops, pairs, trolley runs and the boxes to move. It staffs to the expected volume unless 4 of the last 5 days ran above forecast, when it staffs to the top of the range. A day that needs more than the roster goes to the supervisor.`,
      "A real plan",
    ),
  );

  // 10. Track record.
  slides.push(
    frame(
      `How well it planned ${r.days} real days`,
      [
        text(M, 1.95, cw, 0.34, "Each day planned from the orders before it only, then checked against what happened", { size: 14, color: C.ink2 }),
        box(M, 2.55, 3.8, 2.45, C.sunken, { radius: 0.06 }),
        stat(M + 0.25, 2.7, 3.3, pct(f.miss_pct), `forecast miss, against ${pct(f.same_weekday_last_week_miss_pct)} for the same weekday last week`, { h: 0.66 }),
        text(M + 0.25, 4.2, 3.3, 0.62, `${pct(f.in_range_pct)} of days inside the range. Bias ${signed(f.bias_pct)}.`, { size: 13, color: C.ink3 }),
        box(M + 4.02, 2.55, 3.8, 2.45, C.sunken, { radius: 0.06 }),
        stat(M + 4.27, 2.7, 3.3, pct(wk.covered_pct), `of days with enough workers, ${pct(wk.covered_if_high_pct)} when staffed for a high day`, { h: 0.66 }),
        text(M + 4.27, 4.2, 3.3, 0.62, `${n(wk.mean_planned, 2)} planned against ${n(wk.mean_needed, 2)} needed, on average.`, { size: 13, color: C.ink3 }),
        box(M + 8.04, 2.55, 3.79, 2.45, C.wash, { radius: 0.06 }),
        stat(M + 8.29, 2.7, 3.29, pct(rep.useful_pct), `of boxes brought down were needed within ${s.cover_days} days`, { h: 0.66 }),
        text(M + 8.29, 4.2, 3.29, 0.62, `${n(rep.boxes_useful)} of ${n(rep.boxes_moved)} boxes. The weak part.`, { size: 13, color: C.ink3 }),
        text(M, 5.35, cw, 0.62, "It beats the simplest rule on the forecast, and leans slightly over on workers rather than short.", { size: 16, bold: true }),
      ],
      `The miss is large because the volume swings, but it beats the rule a supervisor would reach for first. Workers lean slightly over, which suits a warehouse where an idle hour costs less than a late order. Boxes are the weak part, and the next slide says why.`,
      "Results",
    ),
  );

  // 11. What did not work.
  const half = (cw - 0.3) / 2;
  slides.push(
    frame(
      "What did not work, and why",
      [
        card(M, 2.0, half, 1.5, "SKU-size demand is too lumpy to place", `Even with the next ${split.ahead_days} days' total known exactly, sharing it by recent sales misses by ${pct(split.sku_size_error_pct["40"])} by SKU size.`, C.wash),
        card(M + half + 0.3, 2.0, half, 1.5, "A longer history barely helps", `${split.windows[0]} days of sales: ${pct(split.sku_size_error_pct[String(split.windows[0])])} by SKU size. ${split.windows[split.windows.length - 1]} days: ${pct(split.sku_size_error_pct[String(split.windows[split.windows.length - 1])])}. The agent uses ${fr.unsold_on_l1_l2.days}.`),
        card(M, 3.7, half, 1.5, "Boxes moved early, few needed", `It caught ${pct(rep.caught_pct)} of the ${n(rep.boxes_needed)} boxes that truly had to come down.`),
        card(M + half + 0.3, 3.7, half, 1.5, "Some days still ran short", `${wk.short_days} of ${r.days} days needed more workers than planned. ${wk.over_days} had more than needed.`),
        text(M, 5.5, cw, 0.62, "These results sit in the repository beside the ones that worked.", { size: 15, bold: true }),
      ],
      `Publishing what failed is part of the method. A box is cheap to move, so the agent still brings down what the forecast points to, and the dashboard shows how few were needed. A supervisor should treat the move list as a starting point.`,
      "Honesty",
    ),
  );

  // 12. Control.
  const c = r.checks;
  slides.push(
    frame(
      "People stay in charge",
      [
        text(M, 1.95, 7.5, 0.34, `What its own check raised over the ${r.days} days`, { size: 14, color: C.ink2 }),
        table(
          M,
          2.4,
          [5.2, 1.2, 1.1],
          [
            ["Check", "Days", "Mark"],
            ["More workers needed than the roster holds", String(c.crew), "ASK"],
            ["Demand the racks cannot cover", String(c.short), "ASK"],
            ["A SKU selling at 3 times its usual rate", String(c.spike), "CHECK"],
            ["Weekly: SKU sizes with no box in the racks", String(c.missing), "CHECK"],
            ["Weekly: idle boxes on levels 1-2", String(c.reslot), "CHECK"],
          ],
          { rowH: 0.5, size: 13, align: ["left", "right", "left"] },
        ),
        card(8.75, 2.0, 3.83, 1.45, "It plans, people act", "It does not run the warehouse. A person carries out the plan."),
        card(8.75, 3.65, 3.83, 1.45, "Two kinds wait", "ASK items need a decision before the plan is settled."),
        card(8.75, 5.3, 3.83, 1.15, "Every step shown", "The dashboard lists each one."),
      ],
      `Each threshold was set so that it fires on a minority of days. The two weekly reviews run on the first plan day of each week, so a standing issue is not repeated daily. Nothing here is connected to a live warehouse system.`,
      "Control",
    ),
  );

  // 13. Try it.
  slides.push({
    dark: true,
    notes: `Open the dashboard on a phone or laptop. It opens on today's plan: the brief, every step the agent took, and the four answers. Pick any day to see how its plan compared with what happened. Nothing is installed and no key is needed.`,
    items: [
      image(M, 0.8, 0.75, 0.75, "mark"),
      text(M, 1.9, 7.6, 1.0, "See it plan today", { size: 48, bold: true, color: C.nightInk, valign: "top" }),
      text(M, 3.0, 7.6, 0.8, "A live dashboard that shows a new plan each day, with nothing to install.", { size: 20, color: C.nightInk2, valign: "top" }),
      text(M, 4.05, 7.6, 1.5, ["Today: the brief, every step and the four answers", "Track record: every plan against what happened", "How it works: every number the agent uses"], { size: 16, color: C.nightInk, bullets: true }),
      box(9.0, 1.3, 3.58, 3.58, "#ffffff", { radius: 0.06 }),
      image(9.2, 1.5, 3.18, 3.18, "qr"),
      text(7.2, 5.05, 5.38, 0.3, SITE_SHORT, { size: 12, color: C.nightAccent, align: "right", link: SITE_URL }),
      text(M, 6.78, 6, 0.32, `Developed by ${AUTHOR}`, { size: 14, color: C.nightInk2 }),
      text(5.2, 6.78, 7.38, 0.32, "Data: de Assis, de Paula Ferreira and Ouhimmou (2025), CC BY 4.0", { size: 12, color: C.nightInk2, align: "right" }),
    ],
  });

  slides.forEach((slide, index) => {
    slide.items = slide.items.flat(Infinity);
    if (!slide.dark) {
      slide.items.push(text(M, 6.98, 6, 0.28, TITLE, { size: 11, color: C.ink3 }));
      slide.items.push(text(W - M - 1, 6.98, 1, 0.28, String(index + 1), { size: 11, color: C.ink3, align: "right" }));
    }
    slide.previewHtml = (qr) => preview(slide, qr, d.markPng);
    slide.audit = AUDIT;
  });
  return slides;
}

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function preview(slide, qr, markPng) {
  const inch = 96;
  const css = (o) => `left:${o.x * inch}px;top:${o.y * inch}px;width:${o.w * inch}px;height:${o.h * inch}px;`;
  const parts = slide.items.map((o) => {
    if (o.type === "box") {
      const radius = o.radius ? `${o.radius * inch}px` : "0";
      const paint = o.outline ? `border:2px dashed ${o.outline};background:transparent` : `background:${o.fill}`;
      return `<div class="box" style="${css(o)}${paint};border-radius:${radius}"></div>`;
    }
    if (o.type === "line") {
      const horizontal = o.h === 0;
      const vertical = o.w === 0;
      if (vertical) {
        const head = o.arrow ? `<div class="rule" style="left:${o.x * inch - 5}px;top:${(o.y + o.h) * inch - 2}px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ${o.color}"></div>` : "";
        return `<div class="rule" style="left:${o.x * inch - o.weight * 0.66}px;top:${o.y * inch}px;width:${o.weight * 1.33}px;height:${o.h * inch}px;background:${o.color}"></div>${head}`;
      }
      const head = o.arrow ? `<div class="rule" style="left:${(o.x + o.w) * inch - 2}px;top:${o.y * inch - 5}px;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid ${o.color}"></div>` : "";
      const paint = o.dash ? `border-top:${o.weight * 1.33}px dashed ${o.color};background:transparent` : `background:${o.color}`;
      return `<div class="rule" style="left:${o.x * inch}px;top:${o.y * inch - o.weight * 0.66}px;width:${horizontal ? o.w * inch : o.weight * 1.33}px;height:${o.weight * 1.33}px;${paint}"></div>${head}`;
    }
    if (o.type === "image") {
      return `<img class="image" src="${o.source === "qr" ? qr : markPng}" style="${css(o)}" alt="">`;
    }
    const body = Array.isArray(o.value)
      ? o.value.map((v) => `<div class="${o.bullets ? "item" : ""}">${escape(v)}</div>`).join("")
      : escape(o.value);
    const justify = o.valign === "middle" ? "center" : "flex-start";
    return `<div class="text" style="${css(o)}justify-content:${justify};font-size:${o.size}pt;line-height:${LINE};color:${o.color};font-weight:${o.bold ? 700 : 400};text-align:${o.align || "left"}"><div class="measure">${body}</div></div>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { position: relative; width: ${W * inch}px; height: ${H * inch}px; overflow: hidden; font-family: ${FONT}, Helvetica, sans-serif; background: ${slide.dark ? C.night : C.surface}; }
  .box, .rule, .text, .image { position: absolute; }
  .text { display: flex; flex-direction: column; }
  .item { position: relative; padding-left: 0.25in; margin-bottom: 0.08in; }
  .item::before { content: ""; position: absolute; left: 0.04in; top: 0.5em; width: 0.07in; height: 0.07in; border-radius: 50%; background: currentColor; }
  </style></head><body>${parts.join("")}</body></html>`;
}

// A text box must hold its own text with a little to spare, because PowerPoint sets lines slightly
// wider than a browser, and no two text boxes may touch.
const AUDIT = () => {
  const problems = [];
  const boxes = [...document.querySelectorAll(".text")].map((el) => {
    const inner = el.querySelector(".measure");
    const outer = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(inner);
    const rects = [...range.getClientRects()];
    const r = {
      left: Math.min(...rects.map((x) => x.left)),
      right: Math.max(...rects.map((x) => x.right)),
      top: Math.min(...rects.map((x) => x.top)),
      bottom: Math.max(...rects.map((x) => x.bottom)),
    };
    const label = el.textContent.trim().slice(0, 36);
    if (r.bottom > outer.bottom + 0.5) problems.push(`"${label}" overflows its box by ${Math.round(r.bottom - outer.bottom)}px`);
    if (r.right > outer.right + 0.5) problems.push(`"${label}" is too wide`);
    if (outer.right > innerWidth - 40 || outer.left < 40) problems.push(`"${label}" sits in the margin`);
    if (outer.bottom > innerHeight - 20) problems.push(`"${label}" runs off the slide`);
    return { r, outer, label };
  });
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i].r;
      const b = boxes[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
        problems.push(`"${boxes[i].label}" overlaps "${boxes[j].label}"`);
      }
    }
  }
  if (/NaN|undefined|\[object|null/.test(document.body.textContent)) problems.push("A missing value reached the slide.");
  return problems;
};

export async function writeDeck(slides, PptxGenJS, qr, file, markPng) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: W, height: H });
  pptx.layout = "WIDE";
  pptx.title = TITLE;
  pptx.author = AUTHOR;
  pptx.company = AUTHOR;
  pptx.subject = "An AI agent that plans a footwear warehouse's day";
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.background = { color: hex(slide.dark ? C.night : C.surface) };
    for (const o of slide.items) {
      if (o.type === "box") {
        const shape = o.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
        const options = { x: o.x, y: o.y, w: o.w, h: o.h };
        if (o.outline) {
          options.fill = { type: "none" };
          options.line = { color: hex(o.outline), width: 1.5, dashType: "dash" };
        } else {
          options.fill = { color: hex(o.fill) };
          options.line = { type: "none" };
        }
        if (o.radius) options.rectRadius = o.radius;
        s.addShape(shape, options);
      } else if (o.type === "line") {
        s.addShape(pptx.ShapeType.line, { x: o.x, y: o.y, w: o.w, h: o.h, line: { color: hex(o.color), width: o.weight, ...(o.dash ? { dashType: "dash" } : {}), ...(o.arrow ? { endArrowType: "triangle" } : {}) } });
      } else if (o.type === "image") {
        s.addImage({ data: o.source === "qr" ? qr : markPng, x: o.x, y: o.y, w: o.w, h: o.h, altText: o.source === "qr" ? `QR code for ${SITE_URL}` : `${TITLE} icon` });
      } else {
        const base = { fontFace: FONT, fontSize: o.size, color: hex(o.color), bold: !!o.bold };
        const value = Array.isArray(o.value)
          ? o.value.map((v, i) => ({ text: v, options: { ...base, bullet: o.bullets ? { indent: 16 } : false, breakLine: i < o.value.length - 1, paraSpaceAfter: 6 } }))
          : [{ text: o.value, options: o.link ? { ...base, hyperlink: { url: o.link } } : base }];
        s.addText(value, {
          x: o.x,
          y: o.y,
          w: o.w,
          h: o.h,
          margin: 0,
          align: o.align || "left",
          valign: o.valign === "middle" ? "middle" : "top",
          fit: "none",
          wrap: true,
          lineSpacingMultiple: 1,
        });
      }
    }
    s.addNotes(slide.notes);
  }
  await pptx.writeFile({ fileName: file, compression: true });
  return file;
}
