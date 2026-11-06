"""Measure how well recent sales split a known total across SKUs and SKU sizes.

    python scripts/measure_split.py

For every plan day, the pairs actually sold over the next five working days are
taken as known, then shared out by each SKU's share of the last N working days.
What is left is the error of the split alone. It also counts the working days whose
volume was at least ten times the day before, or a tenth of it or less. Writes
docs/evidence/split.json.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from warehouse_planner.data import Warehouse  # noqa: E402

WINDOWS = [10, 20, 40, 60, 90]
AHEAD = 5


def split_error(matrix, days, window: int) -> float:
    missed = 0.0
    total = 0.0
    for day in days:
        i = matrix.index.get_loc(day)
        past = matrix.iloc[max(0, i - window) : i].sum()
        ahead = matrix.iloc[i : i + AHEAD].sum()
        if past.sum() <= 0 or ahead.sum() <= 0:
            continue
        share = past / past.sum()
        missed += float(np.abs(ahead - share * ahead.sum()).sum())
        total += float(ahead.sum())
    return round(100 * missed / total, 1)


def main() -> None:
    warehouse = Warehouse.load()
    days = list(warehouse.plan_days())
    sizes = warehouse.sku_matrix
    refs = sizes.T.groupby([c.split(" ", 1)[0] for c in sizes.columns]).sum().T
    pairs = warehouse.daily["pairs"]
    ratio = pairs / pairs.shift(1)
    swings = int(((ratio >= 10) | (ratio <= 0.1)).sum())
    result = {
        "days": len(days),
        "working_days": len(pairs),
        "days_ten_times_the_day_before_or_a_tenth": swings,
        "ahead_days": AHEAD,
        "windows": WINDOWS,
        "sku_size_error_pct": {str(w): split_error(sizes, days, w) for w in WINDOWS},
        "sku_error_pct": {str(w): split_error(refs, days, w) for w in WINDOWS},
    }
    out = ROOT / "docs" / "evidence" / "split.json"
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
