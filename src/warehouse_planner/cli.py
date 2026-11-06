"""The command line: plan a day, replay the records, or build the dashboard."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from warehouse_planner.agent import run_agent
from warehouse_planner.data import Warehouse
from warehouse_planner.replay import plan_every_day, replay_days, summarise
from warehouse_planner.settings import ROOT

_MARK = {
    "observe": "SEE",
    "decide": "DECIDE",
    "act": "TOOL",
    "check": "CHECK",
    "escalate": "ASK",
    "report": "BRIEF",
}


def _plan(args: argparse.Namespace) -> int:
    warehouse = Warehouse.load()
    day = pd.Timestamp(args.date) if args.date else replay_days(warehouse)[-1]
    plan = run_agent(warehouse, day, brain=args.brain)
    data = plan.as_dict()
    if args.json:
        Path(args.json).write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    print(f"\nPlan for {data['weekday']} {plan.day}  ·  brain: {plan.brain}\n")
    for step in plan.steps:
        tool = f" [{step.tool}]" if step.tool else ""
        print(f"  {_MARK.get(step.kind, step.kind.upper()):<6}{tool} {step.text}")
    if not plan.results.get("forecast"):
        return 1
    print("\nSKUs in demand over the next working days")
    for s in plan.results["skus"]["skus"][:10]:
        print(
            f"  {s['sku']:<8} {s['expected_pairs']:>5} pairs  {s['trend']:<8} "
            f"L1-2 {s['boxes_l1_l2']:>4}  L3-4 {s['boxes_l3_l4']:>3}"
        )
    moves = plan.results["replenishment"]["moves"]
    print(f"\nBring down from levels 3-4 ({len(moves)} moves, first 10)")
    for m in moves[:10]:
        print(f"  {m['sku']:<8} size {m['size']:<5} {m['boxes']} box  {m['from']} -> {m['to']}")
    print("\nWorkers")
    for d in plan.results["workers"]["days"]:
        print(
            f"  {d['weekday']} {d['date']}  {d['workers']} (if high {d['workers_if_high']})  "
            f"{d['hours']} h"
        )
    return 0


def _replay(args: argparse.Namespace) -> int:
    warehouse = Warehouse.load()
    graded = plan_every_day(
        warehouse, lambda done, total: print(f"  {done}/{total}", end="\r", flush=True)
    )
    scores = summarise(warehouse, graded)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(scores, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(scores, indent=2))
    return 0


def _site(args: argparse.Namespace) -> int:
    from warehouse_planner.site import build

    index = build(Path(args.out), claude_today=args.claude_today, today=args.today)
    print(f"Built {len(index['days'])} days into {args.out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="warehouse-planner", description="An AI agent that plans a footwear warehouse's day."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    plan = sub.add_parser("plan", help="plan one day and print the agent's steps")
    plan.add_argument("--date", help="the day to plan, YYYY-MM-DD (default: after the records)")
    plan.add_argument("--brain", choices=["auto", "rules", "claude"], default="auto")
    plan.add_argument("--json", help="also save the whole plan as JSON here")
    plan.set_defaults(run=_plan)

    replay = sub.add_parser("replay", help="plan every day in the records and score the plans")
    replay.add_argument("--out", default=str(ROOT / "docs" / "evidence" / "replay.json"))
    replay.set_defaults(run=_replay)

    site = sub.add_parser("site", help="build the dashboard")
    site.add_argument("--out", default=str(ROOT / "_site"))
    site.add_argument("--claude-today", action="store_true", help="re-plan today's day with Claude")
    site.add_argument("--today", help="the calendar date to treat as today, YYYY-MM-DD")
    site.set_defaults(run=_site)

    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    return int(args.run(args))


if __name__ == "__main__":
    raise SystemExit(main())
