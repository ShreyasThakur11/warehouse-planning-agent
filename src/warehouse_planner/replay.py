"""Plan every day in the records, then check each plan against what happened.

Each plan is made from the orders before its day only, exactly as on the morning
itself. The scores show how far to trust the agent, including where it is weak.
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np
import pandas as pd

from warehouse_planner.agent import Plan, run_agent
from warehouse_planner.data import Warehouse
from warehouse_planner.forecast import next_weekdays
from warehouse_planner.workers import moving_hours, picking_hours, workers_for

# The live replay starts on this date: day 0 of the replay is the first plan day,
# and each calendar day after it moves the replay on by one.
REPLAY_START = "2026-11-06"


def replay_days(warehouse: Warehouse) -> list[pd.Timestamp]:
    """Every plannable day in the records, then the first working day after them."""
    days = list(warehouse.plan_days())
    after = next_weekdays(warehouse.days[-1] + pd.Timedelta(days=1), 1)[0]
    return [*days, after]


def replay_index(today: pd.Timestamp | str, count: int) -> int:
    """Which replay day a calendar date shows. The site does the same sum in JavaScript."""
    offset = (pd.Timestamp(today).normalize() - pd.Timestamp(REPLAY_START)).days
    return offset % count


def grade(warehouse: Warehouse, plan: Plan) -> dict | None:
    """What actually happened on the plan's day, and how the plan compared."""
    day = pd.Timestamp(plan.day)
    if day not in warehouse.daily.index or not plan.results.get("forecast"):
        return None
    settings = warehouse.settings
    actual = warehouse.daily.loc[day]
    today = plan.results["forecast"]["today"]
    rep = plan.results["replenishment"]
    workers = plan.results["workers"]["today"]
    needed = workers_for(
        picking_hours(actual["pairs"], actual["lines"], actual["runs"], settings)
        + moving_hours(rep["boxes"], settings),
        settings,
    )

    # Boxes that truly had to come down: the pairs sold over the cover window
    # beyond what levels 1-2 held, up to what reserve held.
    position = warehouse.days.get_loc(day)
    window = warehouse.days[position : position + settings.cover_days]
    sold = warehouse.sku_matrix.loc[window].sum()
    stock = warehouse.stock[["pick", "reserve"]].reindex(sold.index).fillna(0)
    must = np.minimum((sold - stock["pick"]).clip(lower=0), stock["reserve"])
    moved = pd.Series(0.0, index=sold.index)
    for m in rep["moves"]:
        key = f"{m['sku']} {m['size']}"
        if key in moved.index:
            moved[key] += m["boxes"]
    useful = float(np.minimum(moved, must).sum())

    return {
        "pairs": int(actual["pairs"]),
        "lines": int(actual["lines"]),
        "orders": int(actual["orders"]),
        "people_who_picked": int(actual["people"]),
        "miss_pct": round(100 * (actual["pairs"] - today["pairs"]) / today["pairs"])
        if today["pairs"]
        else None,
        "in_range": bool(today["low"] <= actual["pairs"] <= today["high"]),
        "workers_planned": int(workers["workers"]),
        "workers_if_high": int(workers["workers_if_high"]),
        "workers_needed": int(needed),
        "boxes_moved": int(rep["boxes"]),
        "boxes_needed": int(must.sum()),
        "boxes_useful": int(useful),
    }


def plan_every_day(
    warehouse: Warehouse,
    progress: Callable[[int, int], None] | None = None,
    days: list[pd.Timestamp] | None = None,
) -> list[tuple[Plan, dict | None]]:
    out = []
    days = days if days is not None else replay_days(warehouse)
    for i, day in enumerate(days):
        plan = run_agent(warehouse, day, brain="rules")
        out.append((plan, grade(warehouse, plan)))
        if progress:
            progress(i + 1, len(days))
    return out


def summarise(warehouse: Warehouse, graded: list[tuple[Plan, dict | None]]) -> dict:
    """The replay's scores, with the simplest alternatives beside them."""
    rows = [(p, g) for p, g in graded if g]
    actual = np.array([g["pairs"] for _, g in rows], dtype=float)
    forecast = np.array([p.results["forecast"]["today"]["pairs"] for p, _ in rows], dtype=float)
    pairs = warehouse.daily["pairs"]
    naive = []
    for p, _ in rows:
        day = pd.Timestamp(p.day)
        same = pairs[(pairs.index < day) & (pairs.index.day_of_week == day.day_of_week)]
        naive.append(
            float(same.iloc[-1]) if len(same) else float(pairs[pairs.index < day].iloc[-1])
        )
    naive_arr = np.array(naive)
    planned = np.array([g["workers_planned"] for _, g in rows])
    high = np.array([g["workers_if_high"] for _, g in rows])
    needed = np.array([g["workers_needed"] for _, g in rows])
    moved = sum(g["boxes_moved"] for _, g in rows)
    useful = sum(g["boxes_useful"] for _, g in rows)
    must = sum(g["boxes_needed"] for _, g in rows)
    methods: dict[str, int] = {}
    escalations: dict[str, int] = {}
    for p, _ in rows:
        name = p.decisions.get("method_name", "none")
        methods[name] = methods.get(name, 0) + 1
        for issue in p.results["checks"].get("issues", []):
            escalations[issue["kind"]] = escalations.get(issue["kind"], 0) + 1
    staffed_high = sum(1 for p, _ in rows if p.decisions.get("staff_to") == "high")
    return {
        "days": len(rows),
        "first_day": rows[0][0].day,
        "last_day": rows[-1][0].day,
        "forecast": {
            "miss_pct": round(100 * float(np.abs(actual - forecast).sum() / actual.sum()), 1),
            "same_weekday_last_week_miss_pct": round(
                100 * float(np.abs(actual - naive_arr).sum() / actual.sum()), 1
            ),
            "in_range_pct": round(100 * float(np.mean([g["in_range"] for _, g in rows])), 1),
            "bias_pct": round(100 * (float(forecast.sum()) / float(actual.sum()) - 1), 1),
            "methods_used": methods,
        },
        "workers": {
            "covered_pct": round(100 * float(np.mean(planned >= needed)), 1),
            "covered_if_high_pct": round(100 * float(np.mean(high >= needed)), 1),
            "exact_pct": round(100 * float(np.mean(planned == needed)), 1),
            "short_days": int(np.sum(planned < needed)),
            "over_days": int(np.sum(planned > needed)),
            "staffed_high_days": staffed_high,
            "mean_planned": round(float(planned.mean()), 2),
            "mean_needed": round(float(needed.mean()), 2),
        },
        "replenishment": {
            "boxes_moved": int(moved),
            "boxes_needed": int(must),
            "boxes_useful": int(useful),
            "useful_pct": round(100 * useful / moved, 1) if moved else 0.0,
            "caught_pct": round(100 * useful / must, 1) if must else 0.0,
            "mean_boxes_per_day": round(moved / len(rows), 1),
        },
        "checks": escalations,
    }
