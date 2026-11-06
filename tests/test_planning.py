"""Replenishment and workers, on a warehouse small enough to check by hand and on the real one."""

from __future__ import annotations

import pytest

from warehouse_planner.forecast import forecast_days
from warehouse_planner.replenishment import plan_replenishment
from warehouse_planner.settings import Settings
from warehouse_planner.workers import picking_hours, plan_workers, workers_for

from .conftest import tiny_warehouse


def test_boxes_come_down_from_the_nearest_reserve_first():
    tiny = tiny_warehouse()
    day = tiny.days[20]
    forecast = forecast_days(tiny, day, "last_week", 5)
    assert forecast[0].pairs == 4
    plan = plan_replenishment(tiny, day, forecast)
    # Two days need 8 pairs, level 1 holds 1, reserve holds 3: all 3 come down, 4 short.
    assert plan["boxes"] == 3
    moves = {(m["from"], m["to"]): m["boxes"] for m in plan["moves"]}
    assert moves == {("A-01-31", "A-01-11"): 2, ("A-02-41", "A-01-11"): 1}
    assert plan["short"] == {"skus": 1, "pairs": 4, "examples": [{"sku": "AAA size 9", "pairs": 4}]}
    assert plan["unsold_on_l1_l2"]["boxes"] == 2
    assert plan["not_in_racks"]["skus"] == 0


def test_a_sku_with_no_pick_face_takes_the_place_of_unsold_boxes():
    tiny = tiny_warehouse()
    tiny.slots = tiny.slots[tiny.slots["location"] != "A-01-11"].reset_index(drop=True)
    day = tiny.days[20]
    plan = plan_replenishment(tiny, day, forecast_days(tiny, day, "last_week", 5))
    # Only BBB's two unsold boxes can make room, so two boxes come down.
    assert plan["boxes"] == 2
    assert {m["to"] for m in plan["moves"]} == {"A-01-12"}
    assert all(m["new_face"] for m in plan["moves"])
    assert [s["from"] for s in plan["swaps"]] == ["A-01-12", "A-01-12"]
    assert {s["sku_up"] for s in plan["swaps"]} == {"BBB size 10"}


def test_real_moves_respect_the_racks(warehouse, plan):
    rep = plan.results["replenishment"]
    assert rep["boxes"] > 0
    held = warehouse.slots.groupby(["location", "sku"]).size()
    used: dict[tuple[str, str], int] = {}
    for m in rep["moves"]:
        assert m["from_level"] in (3, 4) and m["to_level"] in (1, 2)
        key = (m["from"], f"{m['sku']} {m['size']}")
        used[key] = used.get(key, 0) + m["boxes"]
    for key, boxes in used.items():
        assert boxes <= held[key], key
    by_sku: dict[str, int] = {}
    for m in rep["moves"]:
        sku = f"{m['sku']} {m['size']}"
        by_sku[sku] = by_sku.get(sku, 0) + m["boxes"]
    for sku, boxes in by_sku.items():
        assert boxes <= warehouse.stock.loc[sku, "reserve"]


def test_picking_hours_follow_the_time_standard():
    s = Settings()
    # 50 stops at 10 s, 100 pairs at 6 s, 5 runs at 60 s plus 166.4 m at 1 m/s.
    assert picking_hours(100, 50, 5, s) == pytest.approx((500 + 600 + 5 * 226.4) / 3600)


@pytest.mark.parametrize(("hours", "workers"), [(0, 1), (3.0, 1), (6.8, 1), (6.81, 2), (13.6, 2)])
def test_hours_become_whole_workers(hours, workers):
    assert workers_for(hours, Settings()) == workers


def test_staffing_high_never_plans_fewer(warehouse, day):
    forecast = forecast_days(warehouse, day, "weekday_average", 5)
    expected = plan_workers(forecast, 80, "expected", warehouse.settings)
    high = plan_workers(forecast, 80, "high", warehouse.settings)
    for e, h in zip(expected["days"], high["days"], strict=True):
        assert h["workers"] >= e["workers"]
        assert e["workers"] == e["workers_expected"]
