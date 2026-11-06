"""Every number the agent works with, and where it comes from.

A value is either measured from the records each morning, taken from the original
project report, or an assumption. Assumptions are marked, and each one can be
changed without touching the code.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"


@dataclass(frozen=True)
class Settings:
    # Rack levels. Pickers reach levels 1 and 2 from the floor; 3 and 4 hold reserve
    # stock and need a ladder or a reach truck. Original project report.
    pick_levels: tuple[int, ...] = (1, 2)
    reserve_levels: tuple[int, ...] = (3, 4)

    # Reserve stock is brought down so that a pick face covers today and the next
    # working day. Original project report.
    cover_days: int = 2

    # Picking time, from the original project report: walking at 1 m/s, 10 s at each stop,
    # 6 s for each pair and 60 s to set up a trolley run.
    walk_speed_mps: float = 1.0
    seconds_per_stop: float = 10.0
    seconds_per_pair: float = 6.0
    seconds_per_run_setup: float = 60.0
    # Mean walk of one trolley run on the recorded routes, in metres, from the
    # original project's route simulation of the warehouse as it is laid out.
    metres_per_run: float = 166.4

    # Assumption: one box lifted from level 3 or 4 down to level 1 or 2, including
    # the reach to the slot, takes a minute.
    seconds_per_box_moved: float = 60.0

    # Assumption: an eight-hour shift with a 15% allowance for breaks, fatigue and
    # delay, the usual allowance in work measurement.
    shift_hours: float = 8.0
    allowance: float = 0.15

    # Assumption: the crew normally on the roster. A plan that needs more is sent to
    # a person instead of being treated as settled.
    crew_on_roster: int = 3

    # How the agent learns from the records.
    min_history_days: int = 40  # operating days before a first plan is made
    backtest_days: int = 30  # recent days used to choose a forecasting method
    share_days: int = 40  # recent days used to split demand across SKUs
    horizon_days: int = 5  # working days forecast ahead
    top_skus: int = 15

    # When to call a person. Raised too often, a warning stops being read, so each
    # threshold was set so that it fires on a minority of days in the records.
    # A SKU selling this many times its usual daily rate over the last 10 days:
    spike_ratio: float = 3.0
    # Pairs the racks cannot cover, as a share of the pairs due in the cover window:
    short_share: float = 0.05

    model: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5"))

    @property
    def productive_hours(self) -> float:
        return self.shift_hours * (1.0 - self.allowance)

    def but(self, **changes: object) -> Settings:
        return replace(self, **changes)  # type: ignore[arg-type]
