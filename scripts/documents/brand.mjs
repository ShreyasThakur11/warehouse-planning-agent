// What the guide, the deck and the poster share: the brand, and every figure they print.
// Figures are read from the replay's output and the built dashboard, so a document cannot
// disagree with the site.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const OUTPUT = path.join(ROOT, "deliverables");
export const SITE_URL = "https://shreyasthakur11.github.io/warehouse-planning-agent/";
export const SITE_SHORT = "shreyasthakur11.github.io/warehouse-planning-agent";
export const REPO_URL = "https://github.com/ShreyasThakur11/warehouse-planning-agent";
export const TITLE = "Warehouse Planning Agent";
export const AUTHOR = "Shreyas Thakur";
export const FONT = "Arial";

// The site's own colours, so the documents and the dashboard read as one thing.
export const C = {
  ink: "#12161b",
  ink2: "#47505b",
  ink3: "#626b77",
  line: "#e1e5ea",
  rack: "#c5ccd5",
  page: "#f6f7f9",
  surface: "#ffffff",
  sunken: "#eef1f4",
  accent: "#1f5fbf",
  soft: "#d9e5f7",
  wash: "#eef4fc",
  neutral: "#6f7884",
  night: "#0e1115",
  nightLine: "#262d36",
  nightInk: "#eef1f5",
  nightInk2: "#bcc3cc",
  caution: "#8a5a00",
  cautionWash: "#fbf1dc",
  critical: "#b3261e",
  criticalWash: "#fcebea",
  good: "#1d7a3e",
  nightAccent: "#6fa8ff",
  nightRack: "#3a434f",
  nightBox: "#262d36",
};

const svg = readFileSync(path.join(ROOT, "site", "favicon.svg"), "utf8").trim();
export const MARK = (size) => svg.replace("<svg ", `<svg width="${size}" height="${size}" aria-hidden="true" `);

const read = (...parts) => JSON.parse(readFileSync(path.join(ROOT, ...parts), "utf8"));

export const n = (x, digits = 0) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const longDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const shortDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
};

export const pct = (x, digits = 1) => `${n(x, digits)}%`;
export const signed = (x, digits = 1) => `${x > 0 ? "+" : ""}${n(x, digits)}%`;
export const plural = (x, one, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The example day for "how a day went": the forecast landed close and the staffing was exact,
// and the agent's own check raised four items. The track record shows the typical days.
export const EXAMPLE_DAY = "2023-04-11";

// Steps of about four gridlines on round numbers.
export function niceTicks(max, count = 4) {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

// The rack motif: bays of four levels seen from the front. A few boxes on level 3 come down
// to empty slots on level 1, as the agent's move list asks.
export function rackSvg(width, height, o = {}) {
  const bays = o.bays ?? 6;
  const slots = o.slots ?? 3;
  const post = o.post ?? C.nightRack;
  const fill = o.box ?? C.nightBox;
  const mark = o.accent ?? C.nightAccent;
  const bayW = width / bays;
  const levelH = height / 4.15;
  const beam = Math.max(levelH * 0.07, 2);
  const postW = Math.max(bayW * 0.025, 2);
  const gap = bayW * 0.045;
  const boxW = (bayW - postW - 2 * gap - (slots - 1) * gap) / slots;
  const boxH = levelH * 0.5;
  const moving = o.moving ?? [[1, 1], [4, 2]];
  const isMoving = (b, s) => moving.some(([mb, ms]) => mb === b && ms === s);
  const parts = [];
  const bottom = (level) => height - (level - 1) * levelH;
  for (let b = 0; b < bays; b += 1) {
    const x0 = b * bayW + postW + gap;
    for (let level = 1; level <= 4; level += 1) {
      const y = bottom(level) - beam - boxH;
      for (let s = 0; s < slots; s += 1) {
        const x = x0 + s * (boxW + gap);
        const r = Math.min(boxW, boxH) * 0.08;
        if (isMoving(b, s)) {
          if (level === 3) parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="${r.toFixed(1)}" fill="${mark}"/>`);
          if (level === 1) parts.push(`<rect x="${(x + 1).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="${(boxW - 2).toFixed(1)}" height="${(boxH - 2).toFixed(1)}" rx="${r.toFixed(1)}" fill="none" stroke="${mark}" stroke-width="2" stroke-dasharray="6 4"/>`);
          if (level === 2) {
            const cx = x + boxW / 2;
            const top = bottom(3) - beam + 4;
            const end = bottom(1) - beam - boxH - 6;
            const head = Math.min(boxW * 0.16, 12);
            parts.push(`<path d="M${cx.toFixed(1)} ${top.toFixed(1)}V${end.toFixed(1)}" stroke="${mark}" stroke-width="3" stroke-linecap="round"/><polyline points="${(cx - head).toFixed(1)},${(end - head).toFixed(1)} ${cx.toFixed(1)},${end.toFixed(1)} ${(cx + head).toFixed(1)},${(end - head).toFixed(1)}" fill="none" stroke="${mark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
          }
          continue;
        }
        if ((b * 5 + level * 3 + s * 7) % 6 === 0) continue;
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="${r.toFixed(1)}" fill="${fill}"/>`);
      }
      parts.push(`<rect x="${(b * bayW).toFixed(1)}" y="${(bottom(level) - beam).toFixed(1)}" width="${bayW.toFixed(1)}" height="${beam.toFixed(1)}" fill="${post}"/>`);
    }
  }
  for (let b = 0; b <= bays; b += 1) {
    const x = Math.min(b * bayW, width - postW);
    parts.push(`<rect x="${x.toFixed(1)}" y="${(height - 4 * levelH - beam).toFixed(1)}" width="${postW.toFixed(1)}" height="${(4 * levelH + beam).toFixed(1)}" fill="${post}"/>`);
  }
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${parts.join("")}</svg>`;
}

export const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const CHIP = { observe: "OBSERVE", decide: "DECIDE", act: "TOOL", check: "CHECK", escalate: "ASK", report: "BRIEF" };

export const LOOP = [
  ["Observe", "Read the orders and grade the last plan."],
  ["Decide", "Choose the forecast method that missed least, and how to staff."],
  ["Act", "Forecast, find the SKUs in demand, plan the boxes and the workers."],
  ["Check", "Test the plan against the roster and the racks."],
  ["Report", "Write the brief and raise what a person must decide."],
];

export const TOOLS = [
  ["read_orders", "How much history there is, and the last working day's volume"],
  ["check_yesterday", "The last plan's forecast against what shipped"],
  ["compare_forecast_methods", "Each method's miss over the last 30 working days"],
  ["forecast_demand", "Pairs, lines and orders for the next 5 working days, with a range"],
  ["find_skus_in_demand", "The 15 SKUs expected to sell most, with trend and stock"],
  ["plan_replenishment", "Every box to bring down from levels 3-4 to 1-2"],
  ["plan_workers", "Hours of work and workers for each forecast day"],
  ["check_plan", "What a person should know or decide"],
];

// Group the move list as the dashboard does: one row per SKU size and destination.
export function groupMoves(moves) {
  const groups = [];
  const byKey = new Map();
  for (const m of moves) {
    const key = `${m.sku}|${m.size}|${m.to}`;
    if (!byKey.has(key)) {
      const g = { sku: m.sku, size: m.size, to: m.to, toLevel: m.to_level, boxes: 0, from: [], newFace: m.new_face, on: m.on_l1_l2, needed: m.needed };
      byKey.set(key, g);
      groups.push(g);
    }
    const g = byKey.get(key);
    g.boxes += m.boxes;
    g.from.push(`${m.from} L${m.from_level}`);
  }
  return groups;
}

export function load() {
  const replay = read("docs", "evidence", "replay.json");
  const split = read("docs", "evidence", "split.json");
  const index = read("_site", "data", "index.json");
  const forwardDate = index.days[index.days.length - 1].date;
  const forward = read("_site", "data", "days", `${forwardDate}.json`);
  const example = read("_site", "data", "days", `${EXAMPLE_DAY}.json`);
  if (!example.actual) throw new Error("The worked example needs a day in the records.");
  const methods = Object.entries(replay.forecast.methods_used).sort((a, b) => b[1] - a[1]);
  return {
    replay,
    split,
    index,
    settings: index.settings,
    records: index.records,
    forward,
    example,
    methods,
    groups: groupMoves(forward.replenishment.moves),
    exampleGroups: groupMoves(example.replenishment.moves),
  };
}
