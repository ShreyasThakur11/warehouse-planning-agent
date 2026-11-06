"""Build the dashboard: the static pages, one plan per replay day, and the scores.

The pages need no server. ``data/index.json`` lists every replay day with its
headline figures and the replay's scores; ``data/days/<date>.json`` holds the full
plan for one day, with what actually happened when the records show it.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from warehouse_planner.agent import Plan, run_agent
from warehouse_planner.data import Warehouse
from warehouse_planner.llm import connect
from warehouse_planner.replay import REPLAY_START, grade, plan_every_day, replay_index, summarise
from warehouse_planner.settings import ROOT


def _row(plan: Plan, actual: dict | None) -> dict[str, Any]:
    f = plan.results.get("forecast", {}).get("today", {})
    w = plan.results.get("workers", {}).get("today") or {}
    rep = plan.results.get("replenishment", {})
    return {
        "date": plan.day,
        "weekday": pd.Timestamp(plan.day).strftime("%a"),
        "pairs": f.get("pairs"),
        "low": f.get("low"),
        "high": f.get("high"),
        "workers": w.get("workers"),
        "workers_if_high": w.get("workers_if_high"),
        "boxes": rep.get("boxes"),
        "issues": len(plan.results.get("checks", {}).get("issues", [])),
        "method": plan.decisions.get("method"),
        "actual": None
        if actual is None
        else {
            "pairs": actual["pairs"],
            "workers_needed": actual["workers_needed"],
            "boxes_useful": actual["boxes_useful"],
        },
    }


def recent(warehouse: Warehouse, day: str, count: int = 20) -> list[dict[str, Any]]:
    """The pairs shipped on the working days just before a plan day, for its chart."""
    daily = warehouse.daily
    before = daily[daily.index < pd.Timestamp(day)].tail(count)
    return [
        {"date": d.strftime("%Y-%m-%d"), "pairs": int(p)}
        for d, p in zip(before.index, before["pairs"], strict=True)
    ]


def settings_card(warehouse: Warehouse) -> dict[str, Any]:
    s = warehouse.settings
    return {
        "pick_levels": list(s.pick_levels),
        "reserve_levels": list(s.reserve_levels),
        "cover_days": s.cover_days,
        "seconds_per_stop": s.seconds_per_stop,
        "seconds_per_pair": s.seconds_per_pair,
        "seconds_per_run_setup": s.seconds_per_run_setup,
        "metres_per_run": s.metres_per_run,
        "seconds_per_box_moved": s.seconds_per_box_moved,
        "shift_hours": s.shift_hours,
        "allowance_pct": round(100 * s.allowance),
        "productive_hours": round(s.productive_hours, 1),
        "crew_on_roster": s.crew_on_roster,
        "min_history_days": s.min_history_days,
        "backtest_days": s.backtest_days,
        "horizon_days": s.horizon_days,
    }


def records_card(warehouse: Warehouse) -> dict[str, Any]:
    slots = warehouse.slots
    return {
        "first_day": warehouse.days[0].strftime("%Y-%m-%d"),
        "last_day": warehouse.days[-1].strftime("%Y-%m-%d"),
        "working_days": len(warehouse.days),
        "order_lines": len(warehouse.orders),
        "pairs": int(warehouse.orders["pairs"].sum()),
        "skus": int(warehouse.orders["ref"].nunique()),
        "locations": int(slots["location"].nunique()),
        "boxes": len(slots),
        "boxes_l1_l2": int((slots["zone"] == "pick").sum()),
        "boxes_l3_l4": int((slots["zone"] == "reserve").sum()),
    }


def build(
    out: Path,
    warehouse: Warehouse | None = None,
    claude_today: bool = False,
    today: str | None = None,
    verbose: bool = True,
    days: list[pd.Timestamp] | None = None,
) -> dict[str, Any]:
    """Write the whole dashboard into ``out``. Returns the replay's scores."""
    warehouse = warehouse or Warehouse.load()
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(ROOT / "site", out)
    days_dir = out / "data" / "days"
    days_dir.mkdir(parents=True, exist_ok=True)

    def progress(done: int, total: int) -> None:
        if verbose and (done % 20 == 0 or done == total):
            print(f"  planned {done} of {total} days", flush=True)

    graded = plan_every_day(warehouse, progress, days)
    scores = summarise(warehouse, graded)

    if claude_today:
        model = connect(warehouse.settings.model)
        if model is None:
            print("  no ANTHROPIC_API_KEY: every plan stays with the built-in rules")
        else:
            at = replay_index(today or datetime.now(timezone.utc).date().isoformat(), len(graded))
            day = graded[at][0].day
            plan = run_agent(warehouse, day, brain="claude", model=model)
            graded[at] = (plan, grade(warehouse, plan))
            print(f"  re-planned {day} with {plan.brain}")

    for plan, actual in graded:
        payload = {**plan.as_dict(), "actual": actual, "recent": recent(warehouse, plan.day)}
        (days_dir / f"{plan.day}.json").write_text(
            json.dumps(payload, separators=(",", ":"), default=str), encoding="utf-8"
        )
    index = {
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "replay_start": REPLAY_START,
        "days": [_row(p, a) for p, a in graded],
        "scores": scores,
        "settings": settings_card(warehouse),
        "records": records_card(warehouse),
    }
    (out / "data" / "index.json").write_text(
        json.dumps(index, separators=(",", ":"), default=str), encoding="utf-8"
    )
    (out / ".nojekyll").write_text("", encoding="utf-8")
    return index
