"""How many workers each day needs, from the work the forecast implies.

Picking time follows the project report's time standard: a walk for each trolley
run, a stop for each order line and a few seconds for each pair. Bringing boxes
down from reserve adds a minute a box. Hours become workers at the productive
hours in a shift.
"""

from __future__ import annotations

import math

from warehouse_planner.forecast import DayForecast
from warehouse_planner.settings import Settings


def picking_hours(pairs: float, lines: float, runs: float, settings: Settings) -> float:
    run_seconds = settings.seconds_per_run_setup + settings.metres_per_run / settings.walk_speed_mps
    seconds = (
        lines * settings.seconds_per_stop + pairs * settings.seconds_per_pair + runs * run_seconds
    )
    return seconds / 3600.0


def moving_hours(boxes: float, settings: Settings) -> float:
    return boxes * settings.seconds_per_box_moved / 3600.0


def workers_for(hours: float, settings: Settings) -> int:
    """Whole workers for a number of hours. A working day always has at least one."""
    return max(1, math.ceil(hours / settings.productive_hours - 1e-9))


def plan_workers(
    forecast: list[DayForecast], boxes_today: int, staff_to: str, settings: Settings
) -> dict:
    """Workers for each forecast day, at the expected volume and if the day runs high.

    ``staff_to`` is the agent's choice: ``expected`` staffs to the middle of the
    forecast, ``high`` to the top of its range. Boxes to bring down on later days
    are estimated in proportion to their pairs.
    """
    first = forecast[0].pairs if forecast and forecast[0].pairs > 0 else 1.0
    days = []
    for f in forecast:
        boxes = boxes_today * f.pairs / first
        scale = f.high / f.pairs if f.pairs > 0 else 1.0
        pick = picking_hours(f.pairs, f.lines, f.runs, settings)
        move = moving_hours(boxes, settings)
        expected = workers_for(pick + move, settings)
        high = workers_for((pick + move) * max(scale, 1.0), settings)
        days.append(
            {
                "date": f.date.strftime("%Y-%m-%d"),
                "weekday": f.date.strftime("%a"),
                "picking_hours": round(pick, 1),
                "moving_hours": round(move, 1),
                "hours": round(pick + move, 1),
                "workers": high if staff_to == "high" else expected,
                "workers_expected": expected,
                "workers_if_high": high,
            }
        )
    return {
        "staff_to": staff_to,
        "productive_hours_per_worker": round(settings.productive_hours, 1),
        "crew_on_roster": settings.crew_on_roster,
        "days": days,
        "today": days[0] if days else None,
    }
