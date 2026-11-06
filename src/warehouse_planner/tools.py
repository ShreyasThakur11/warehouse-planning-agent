"""The agent's tools. Every number in a plan comes out of one of these.

A brain, whether the built-in rules or Claude, decides which tool to call, with
which settings, and what to do with the answer. The tools do the arithmetic. The
same ``SPECS`` are sent to Claude as its tool definitions.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from warehouse_planner.data import Warehouse
from warehouse_planner.demand import skus_in_demand
from warehouse_planner.forecast import (
    METHODS,
    DayForecast,
    forecast_dates,
    forecast_days,
    point_forecast,
    score_methods,
)
from warehouse_planner.replenishment import plan_replenishment
from warehouse_planner.workers import picking_hours, plan_workers, workers_for

SPECS: list[dict[str, Any]] = [
    {
        "name": "read_orders",
        "description": "Read the order records up to the morning of the plan day: how much "
        "history there is, what yesterday shipped, and any gap in the records.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "check_yesterday",
        "description": "Compare yesterday's forecast and worker plan with what actually happened, "
        "and whether recent days ran above or below forecast.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "compare_forecast_methods",
        "description": "Score the three forecasting methods on the last 30 working days. "
        "Lower miss is better.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "forecast_demand",
        "description": "Forecast pairs, order lines and orders for the plan day and the next "
        "working days with one method, with a range.",
        "input_schema": {
            "type": "object",
            "properties": {"method": {"type": "string", "enum": list(METHODS)}},
            "required": ["method"],
        },
    },
    {
        "name": "find_skus_in_demand",
        "description": "List the SKUs expected to sell most over the forecast days, with their "
        "trend and how many boxes sit on levels 1-2 and 3-4. Needs a forecast first.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "plan_replenishment",
        "description": "List the boxes to bring down from levels 3-4 to levels 1-2 today, the "
        "swaps that make room, and demand the racks cannot cover. Needs a forecast first.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "plan_workers",
        "description": "Workers needed each forecast day for picking and for bringing boxes "
        "down. staff_to is 'expected' or 'high' (the top of the forecast range).",
        "input_schema": {
            "type": "object",
            "properties": {"staff_to": {"type": "string", "enum": ["expected", "high"]}},
            "required": ["staff_to"],
        },
    },
    {
        "name": "check_plan",
        "description": "Check the plan against the roster and the forecast's confidence, and "
        "list anything a supervisor must decide.",
        "input_schema": {"type": "object", "properties": {}},
    },
]

_ORDER = ["forecast_demand", "find_skus_in_demand", "plan_replenishment", "plan_workers"]


def count(n: int, word: str, many: str | None = None) -> str:
    """``1 worker``, ``3 workers``, with thousands separated."""
    return f"{n:,} {word if n == 1 else (many or word + 's')}"


class ToolError(Exception):
    """A tool was called out of order or with a bad argument. The brain is told why."""


class Toolbox:
    """Tools for planning one day, sharing what earlier calls produced."""

    def __init__(self, warehouse: Warehouse, day: pd.Timestamp) -> None:
        self.warehouse = warehouse
        self.settings = warehouse.settings
        self.day = pd.Timestamp(day).normalize()
        self.forecast: list[DayForecast] = []
        self.method: str | None = None
        self.results: dict[str, Any] = {}

    def call(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        handler = getattr(self, f"_{name}", None)
        if name not in {s["name"] for s in SPECS} or handler is None:
            raise ToolError(f"There is no tool called {name}.")
        result = handler(**(arguments or {}))
        self.results[name] = result
        return result

    # Tools -------------------------------------------------------------------

    def _read_orders(self) -> dict[str, Any]:
        daily = self.warehouse.daily
        past = daily[daily.index < self.day]
        if past.empty:
            return {"plan_day": self.day.strftime("%Y-%m-%d"), "history_days": 0}
        last = past.index[-1]
        gap = int((self.day - last).days)
        return {
            "plan_day": self.day.strftime("%Y-%m-%d"),
            "plan_weekday": self.day.strftime("%A"),
            "history_days": len(past),
            "first_day": past.index[0].strftime("%Y-%m-%d"),
            "last_day": last.strftime("%Y-%m-%d"),
            "calendar_days_since_last": gap,
            "last_day_pairs": int(past["pairs"].iloc[-1]),
            "last_day_lines": int(past["lines"].iloc[-1]),
            "last_day_orders": int(past["orders"].iloc[-1]),
            "average_pairs_last_20_days": round(float(past["pairs"].iloc[-20:].mean())),
            "enough_history": len(past) >= self.settings.min_history_days,
        }

    def _check_yesterday(self) -> dict[str, Any]:
        daily = self.warehouse.daily
        past = daily[daily.index < self.day]
        if len(past) < self.settings.min_history_days:
            return {"available": False}
        settings = self.settings
        rows = []
        for t in past.index[-5:]:
            method = score_methods(daily["pairs"], t, settings.backtest_days, self.warehouse.memo)[
                0
            ].method
            guess = point_forecast(daily["pairs"][daily.index < t], t, method)
            rows.append((t, method, float(past.loc[t, "pairs"]), guess))
        above = sum(1 for _, _, actual, guess in rows if actual > guess)
        t, method, actual, guess = rows[-1]
        made = forecast_dates(self.warehouse, t, method, [t])[0]
        y = past.loc[t]
        planned = workers_for(picking_hours(made.pairs, made.lines, made.runs, settings), settings)
        needed = workers_for(picking_hours(y["pairs"], y["lines"], y["runs"], settings), settings)
        return {
            "available": True,
            "day": t.strftime("%Y-%m-%d"),
            "method_used": method,
            "forecast_pairs": round(guess),
            "actual_pairs": round(actual),
            "miss_pct": round(100 * (actual - guess) / guess) if guess else None,
            "picking_workers_planned": planned,
            "picking_workers_the_day_needed": needed,
            "days_above_forecast_of_last_5": above,
        }

    def _compare_forecast_methods(self) -> dict[str, Any]:
        scores = score_methods(
            self.warehouse.daily["pairs"],
            self.day,
            self.settings.backtest_days,
            self.warehouse.memo,
        )
        return {
            "scored_days": scores[0].days,
            "methods": [
                {"method": s.method, "name": s.name, "miss_pct": round(100 * s.miss, 1)}
                for s in scores
            ],
            "best": scores[0].method,
        }

    def _forecast_demand(self, method: str) -> dict[str, Any]:
        if method not in METHODS:
            raise ToolError(f"method must be one of {', '.join(METHODS)}.")
        self.method = method
        self.forecast = forecast_days(self.warehouse, self.day, method, self.settings.horizon_days)
        days = [f.as_dict() for f in self.forecast]
        first = self.forecast[0]
        ratio = first.high / first.low if first.low > 0 else float("inf")
        return {
            "method": method,
            "method_name": METHODS[method],
            "days": days,
            "today": days[0],
            "week_pairs": round(sum(f.pairs for f in self.forecast)),
            "range_ratio": round(ratio, 1) if ratio != float("inf") else None,
        }

    def _need_forecast(self) -> None:
        if not self.forecast:
            raise ToolError("Call forecast_demand first.")

    def _find_skus_in_demand(self) -> dict[str, Any]:
        self._need_forecast()
        return skus_in_demand(self.warehouse, self.day, self.forecast, self.settings.top_skus)

    def _plan_replenishment(self) -> dict[str, Any]:
        self._need_forecast()
        return plan_replenishment(self.warehouse, self.day, self.forecast)

    def _plan_workers(self, staff_to: str) -> dict[str, Any]:
        self._need_forecast()
        if staff_to not in ("expected", "high"):
            raise ToolError("staff_to must be 'expected' or 'high'.")
        boxes = int(self.results.get("plan_replenishment", {}).get("boxes", 0))
        return plan_workers(self.forecast, boxes, staff_to, self.settings)

    def _check_plan(self) -> dict[str, Any]:
        missing = [name for name in _ORDER if name not in self.results]
        if missing:
            raise ToolError(f"Not ready to check: call {', '.join(missing)} first.")
        settings = self.settings
        today = self.results["forecast_demand"]["today"]["date"]
        issues = []
        for day in self.results["plan_workers"]["days"]:
            if day["workers"] > settings.crew_on_roster:
                issues.append(
                    {
                        "kind": "crew",
                        "day": day["date"],
                        "text": f"{day['weekday']} {day['date']} needs "
                        f"{count(day['workers'], 'worker')}, more than the "
                        f"{settings.crew_on_roster} on the roster. Arrange cover.",
                    }
                )
        rep = self.results["plan_replenishment"]
        cover_pairs = sum(
            d["pairs"] for d in self.results["forecast_demand"]["days"][: settings.cover_days]
        )
        if rep["short"]["pairs"] > settings.short_share * cover_pairs:
            issues.append(
                {
                    "kind": "short",
                    "day": today,
                    "text": f"{count(rep['short']['skus'], 'SKU size')} will run out on levels 1-4 "
                    f"before {rep['cover_until']}, about {count(rep['short']['pairs'], 'pair')} "
                    "short. Call stock in from production.",
                }
            )
        for sku in self.results["find_skus_in_demand"]["spikes"]:
            issues.append(
                {
                    "kind": "spike",
                    "day": today,
                    "text": f"{sku} has sold at least {settings.spike_ratio:g} times its "
                    "usual rate over the last 10 days. Check whether one large order is "
                    "behind it.",
                }
            )
        previous = self.warehouse.days[self.warehouse.days < self.day]
        new_week = (
            len(previous) == 0 or previous[-1].isocalendar()[:2] != self.day.isocalendar()[:2]
        )
        gone = rep["not_in_racks"]
        if new_week and gone["skus"]:
            issues.append(
                {
                    "kind": "missing",
                    "day": today,
                    "text": f"Weekly review: {count(gone['skus'], 'SKU size')} expected to sell "
                    f"before {rep['cover_until']} have no box in the racks, about "
                    f"{count(gone['pairs'], 'pair')}. Give them a slot or pick them where they "
                    "are kept.",
                }
            )
        unsold = rep["unsold_on_l1_l2"]
        if new_week and unsold["boxes"]:
            issues.append(
                {
                    "kind": "reslot",
                    "day": today,
                    "text": f"Weekly review: {count(unsold['boxes'], 'box', 'boxes')} on "
                    f"levels 1-2 have not sold in {unsold['days']} working days. Moving them "
                    "up to levels 3-4 would free pick faces for the SKUs that sell.",
                }
            )
        return {"issues": issues, "ready": not any(i["kind"] == "crew" for i in issues)}
