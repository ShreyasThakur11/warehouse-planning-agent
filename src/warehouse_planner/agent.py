"""The planning agent: each morning it reads the orders, decides, acts and checks.

The loop is the same whichever brain runs it:

1. Observe: read the orders and grade yesterday's plan.
2. Decide: choose a forecasting method from how each one did lately.
3. Act: forecast demand, find the SKUs in demand, plan the boxes to bring down,
   and plan the workers.
4. Check: test the plan against the roster and the forecast's confidence, and
   send what it cannot settle to a person.
5. Report: write a short brief for the supervisor.

The built-in brain makes each decision by a written rule. Claude, when a key is
set, makes the same decisions by judgement and writes its own brief. Either way
every number comes from a tool, and a brief that states any other number is
thrown out.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any

import pandas as pd

from warehouse_planner.data import Warehouse
from warehouse_planner.forecast import METHODS
from warehouse_planner.guard import ungrounded
from warehouse_planner.llm import Model, connect
from warehouse_planner.tools import SPECS, Toolbox, ToolError, count

BUILT_IN = "Built-in rules"


@dataclass
class Step:
    kind: str  # observe, decide, act, check, escalate, report
    text: str
    tool: str | None = None
    args: dict[str, Any] | None = None


@dataclass
class Plan:
    day: str
    brain: str
    brief: str
    decisions: dict[str, Any]
    results: dict[str, Any]
    steps: list[Step] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "day": self.day,
            "weekday": pd.Timestamp(self.day).strftime("%A"),
            "brain": self.brain,
            "brief": self.brief,
            "decisions": self.decisions,
            **self.results,
            "steps": [asdict(s) for s in self.steps],
        }


class Run:
    """One morning's work: the toolbox and the record of every step."""

    def __init__(self, warehouse: Warehouse, day: pd.Timestamp) -> None:
        self.box = Toolbox(warehouse, day)
        self.steps: list[Step] = []

    def log(self, kind: str, text: str, tool: str | None = None, args: dict | None = None) -> None:
        self.steps.append(Step(kind, text, tool, args or None))

    def act(self, name: str, text: str = "", **args: Any) -> dict[str, Any]:
        result = self.box.call(name, args)
        self.log("act", text or describe(name, result), name, args)
        return result


def describe(name: str, r: dict[str, Any]) -> str:
    """One plain sentence for what a tool returned."""
    if name == "read_orders":
        if not r.get("history_days"):
            return "There are no orders before this day."
        return (
            f"Read {r['history_days']} working days of orders, up to {r['last_day']}, "
            f"when the warehouse shipped {r['last_day_pairs']:,} pairs in {r['last_day_lines']:,} "
            "order lines."
        )
    if name == "check_yesterday":
        if not r.get("available"):
            return "No earlier plan to grade yet."
        miss = r["miss_pct"] or 0
        side = "above" if miss > 0 else "below"
        gap = f"{abs(miss)}% {side} it" if miss else "exactly that"
        return (
            f"The last working day, {r['day']}, was forecast at {r['forecast_pairs']:,} pairs and "
            f"{r['actual_pairs']:,} shipped, {gap}. Picking needed "
            f"{count(r['picking_workers_the_day_needed'], 'worker')} against "
            f"{r['picking_workers_planned']} planned."
        )
    if name == "compare_forecast_methods":
        parts = [f"{m['name'].lower()} {m['miss_pct']}%" for m in r["methods"]]
        return (
            f"Scored the methods on the last {r['scored_days']} working days: "
            + ", ".join(parts)
            + "."
        )
    if name == "forecast_demand":
        t = r["today"]
        return (
            f"Forecast {t['pairs']:,} pairs for {t['weekday']} {t['date']} ({t['low']:,} to "
            f"{t['high']:,}), in about {t['lines']:,} order lines, and {r['week_pairs']:,} pairs "
            f"over the next {len(r['days'])} working days."
        )
    if name == "find_skus_in_demand":
        top = r["skus"][0] if r["skus"] else None
        lead = f"{top['sku']} leads with about {top['expected_pairs']:,} pairs. " if top else ""
        rising = f"Rising: {', '.join(r['rising'])}." if r["rising"] else "None is rising sharply."
        return f"{lead}The top {len(r['skus'])} SKUs make {r['top_share_pct']}% of pairs. {rising}"
    if name == "plan_replenishment":
        if not r["boxes"]:
            return f"Levels 1-2 hold enough of every SKU until {r['cover_until']}."
        new = f", {r['new_faces']} of them on new pick faces" if r["new_faces"] else ""
        return (
            f"Bring down {count(r['boxes'], 'box', 'boxes')} from levels 3-4 to 1-2 in "
            f"{count(r['tasks'], 'move')} for {count(r['skus'], 'SKU size')}{new}, to cover "
            f"until {r['cover_until']}."
        )
    if name == "plan_workers":
        t = r["today"]
        return (
            f"Today needs {count(t['workers'], 'worker')} for {t['hours']} hours of work: "
            f"{t['picking_hours']} picking and {t['moving_hours']} bringing boxes down."
        )
    if name == "check_plan":
        n = len(r["issues"])
        return "The plan passes every check." if not n else f"The check raised {count(n, 'item')}."
    return f"{name} done."


def write_brief(results: dict[str, Any]) -> str:
    """The supervisor's brief, from the tool results alone."""
    f = results["forecast_demand"]["today"]
    w = results["plan_workers"]["today"]
    rep = results["plan_replenishment"]
    skus = results["find_skus_in_demand"]
    issues = results["check_plan"]["issues"]
    day = pd.Timestamp(f["date"])
    parts = [
        f"{day.strftime('%A')} {f['date']}: expect about {f['pairs']:,} pairs "
        f"({f['low']:,} to {f['high']:,}) in {f['lines']:,} order lines.",
    ]
    if rep["boxes"]:
        first = rep["moves"][0]
        parts.append(
            f"Bring down {count(rep['boxes'], 'box', 'boxes')} from levels 3-4 to 1-2 before "
            f"picking starts, starting with {first['sku']} size {first['size']} from "
            f"{first['from']}."
        )
    else:
        parts.append("Levels 1-2 hold enough for today; nothing needs bringing down.")
    extra = (
        f", {w['workers_if_high']} if the day runs high"
        if w["workers_if_high"] > w["workers"]
        else ""
    )
    parts.append(f"Staff {count(w['workers'], 'worker')}{extra}.")
    if skus["rising"]:
        parts.append(f"Rising: {', '.join(skus['rising'][:3])}.")
    urgent = [i for i in issues if i["kind"] in ("crew", "short")]
    if urgent:
        parts.append(f"{count(len(urgent), 'item')} for the supervisor to settle, listed below.")
    return " ".join(parts)


# The built-in brain ------------------------------------------------------------


def rule_brain(run: Run) -> tuple[dict[str, Any], str]:
    """Each decision made by a written rule, in the order a planner would take it."""
    s = run.box.settings
    feed = run.act("read_orders")
    if not feed.get("enough_history"):
        run.log(
            "escalate",
            f"Only {feed.get('history_days', 0)} working days of orders; the agent needs "
            f"{s.min_history_days} before it plans. Nothing was planned.",
        )
        return {}, "Not enough history to plan this day."
    if feed["calendar_days_since_last"] > 4:
        run.log(
            "observe",
            f"The records stop {feed['calendar_days_since_last']} days before today, so the "
            "warehouse was probably closed. Planning from the days it worked.",
        )

    yesterday = run.act("check_yesterday")
    above = yesterday.get("days_above_forecast_of_last_5", 0)

    methods = run.act("compare_forecast_methods")
    best, *others = methods["methods"]
    run.log(
        "decide",
        f"Forecast with {best['name'].lower()}: it missed by {best['miss_pct']}% lately, "
        f"against {others[0]['miss_pct']}% and {others[1]['miss_pct']}% for the others.",
    )
    run.act("forecast_demand", method=best["method"])
    run.act("find_skus_in_demand")
    run.act("plan_replenishment")

    if above >= 4:
        staff_to = "high"
        why = (
            f"{above} of the last 5 days ran above forecast, so staff to the top of the range "
            "rather than the middle."
        )
    else:
        staff_to = "expected"
        why = f"{above} of the last 5 days ran above forecast, so staff to the expected volume."
    run.log("decide", why[0].upper() + why[1:])
    run.act("plan_workers", staff_to=staff_to)

    check = run.act("check_plan")
    for issue in check["issues"]:
        kind = "escalate" if issue["kind"] in ("crew", "short") else "check"
        run.log(kind, issue["text"])
    return {"method": best["method"], "staff_to": staff_to}, write_brief(run.box.results)


# Claude as the brain -------------------------------------------------------------

SYSTEM = """You are the planning agent for a footwear warehouse. Every morning you plan the day:
how many pairs will ship, which SKUs are in demand, which boxes to bring down from reserve on
rack levels 3-4 to the pick faces on levels 1-2, and how many workers each day needs.

Work only through the tools. Call read_orders and check_yesterday first. Choose a forecasting
method with compare_forecast_methods; you may prefer a method that missed slightly more if you
have a reason, and say it. Then call forecast_demand, find_skus_in_demand, plan_replenishment
and plan_workers. Staff to 'high' if recent days have run above forecast, otherwise 'expected'.
Finish with check_plan.

Then write a brief for the supervisor in at most 110 words: plain sentences, no headings, no
lists, no markdown. Say the pairs expected and the range, the boxes to bring down and where to
start, the workers, and anything from check_plan a person must decide. Every number you write
must come from a tool result. Never calculate a number yourself."""


def _trim(name: str, result: dict[str, Any]) -> dict[str, Any]:
    """What Claude is shown of a result: long lists cut to their first rows."""
    if name == "plan_replenishment":
        return {**result, "moves": result["moves"][:12], "swaps": result["swaps"][:5]}
    if name == "find_skus_in_demand":
        return {**result, "skus": result["skus"][:10]}
    return result


def claude_brain(run: Run, model: Model, max_turns: int = 16) -> tuple[dict[str, Any], str]:
    """Claude decides which tool to call next until it writes the brief."""
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": f"Plan {run.box.day.strftime('%A %Y-%m-%d')}."}
    ]
    text = ""
    for _ in range(max_turns):
        reply = model.reply(SYSTEM, messages, SPECS)
        if reply.text.strip() and reply.tool_calls:
            run.log("decide", reply.text.strip())
        if not reply.tool_calls:
            text = reply.text.strip()
            break
        messages.append({"role": "assistant", "content": reply.content})
        results: list[dict[str, Any]] = []
        for call in reply.tool_calls:
            try:
                result = run.act(call.name, **call.arguments)
                content = json.dumps(_trim(call.name, result), default=str)
                results.append({"type": "tool_result", "tool_use_id": call.id, "content": content})
            except (ToolError, TypeError) as error:
                run.log("check", f"{call.name} was refused: {error}", call.name, call.arguments)
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": str(error),
                        "is_error": True,
                    }
                )
        messages.append({"role": "user", "content": results})

    box = run.box
    if not box.results.get("read_orders", {}).get("enough_history", True):
        return {}, text or "Not enough history to plan this day."
    # Whatever Claude left out, the rules complete, and the record says so.
    if "forecast_demand" not in box.results:
        best = box.call("compare_forecast_methods")["best"]
        run.act("forecast_demand", method=best)
        run.log("check", "Claude did not forecast, so the rules chose the best-scoring method.")
    for name in ("find_skus_in_demand", "plan_replenishment"):
        if name not in box.results:
            run.act(name)
            run.log("check", f"Claude skipped {name}, so the rules ran it.")
    if "plan_workers" not in box.results:
        run.act("plan_workers", staff_to="expected")
        run.log(
            "check", "Claude did not plan the workers, so the rules staffed to the expected volume."
        )
    if "check_plan" not in box.results:
        run.act("check_plan")
    for issue in box.results["check_plan"]["issues"]:
        run.log("escalate" if issue["kind"] in ("crew", "short") else "check", issue["text"])

    decisions = {"method": box.method, "staff_to": box.results["plan_workers"]["staff_to"]}
    missing = ungrounded(text, box.results) if text else []
    if not text or missing:
        why = (
            f"Claude's brief stated {', '.join(f'{m:g}' for m in missing[:4])}, "
            "which no tool produced"
            if missing
            else "Claude wrote no brief"
        )
        run.log("check", f"{why}, so the brief below is written from the tool results.")
        return decisions, write_brief(box.results)
    run.log("check", "Every number in Claude's brief matches a tool result.")
    return decisions, text


# Running the agent ---------------------------------------------------------------


def run_agent(
    warehouse: Warehouse,
    day: pd.Timestamp | str,
    brain: str = "auto",
    model: Model | None = None,
) -> Plan:
    """Plan one day. ``brain`` is ``auto``, ``rules`` or ``claude``."""
    run = Run(warehouse, pd.Timestamp(day))
    if brain == "claude" or (brain == "auto" and model is None):
        model = model or connect(warehouse.settings.model)
        if brain == "claude" and model is None:
            raise RuntimeError("Claude needs ANTHROPIC_API_KEY and the anthropic package.")
    if brain == "rules":
        model = None
    if model is not None:
        decisions, brief = claude_brain(run, model)
        name = f"Claude ({model.name})"
    else:
        decisions, brief = rule_brain(run)
        name = BUILT_IN
    run.log("report", brief)
    results = {
        "feed": run.box.results.get("read_orders", {}),
        "yesterday": run.box.results.get("check_yesterday", {}),
        "methods": run.box.results.get("compare_forecast_methods", {}),
        "forecast": run.box.results.get("forecast_demand", {}),
        "skus": run.box.results.get("find_skus_in_demand", {}),
        "replenishment": run.box.results.get("plan_replenishment", {}),
        "workers": run.box.results.get("plan_workers", {}),
        "checks": run.box.results.get("check_plan", {}),
    }
    if decisions.get("method"):
        decisions["method_name"] = METHODS[decisions["method"]]
    return Plan(
        day=run.box.day.strftime("%Y-%m-%d"),
        brain=name,
        brief=brief,
        decisions=decisions,
        results=results,
        steps=run.steps,
    )
