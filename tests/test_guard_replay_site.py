"""The number guard, the replay and its scores, the dashboard build and the command line."""

from __future__ import annotations

import json

import pandas as pd

from warehouse_planner.cli import main
from warehouse_planner.guard import ungrounded
from warehouse_planner.replay import grade, replay_days, replay_index, summarise
from warehouse_planner.settings import ROOT
from warehouse_planner.site import build


def test_codes_dates_and_levels_are_not_figures():
    text = "On 2023-10-20 bring 62 boxes of 8N10W9 size 10.5 from M-24-30 on levels 3-4."
    assert ungrounded(text, {"boxes": 62, "size": "10.5"}) == []


def test_an_invented_figure_is_caught_and_rounding_is_not():
    assert ungrounded("Expect 1,240 pairs.", {"pairs": 1240}) == []
    assert ungrounded("Expect about 832 pairs.", {"pairs": 831.6}) == []
    assert ungrounded("Expect 1,240 pairs.", {"pairs": 1100}) == [1240.0]
    assert ungrounded("Staff 4 workers.", {"workers": 2}) == [4.0]


def test_the_replay_moves_one_day_each_day():
    assert replay_index("2026-11-06", 135) == 0
    assert replay_index("2026-11-07", 135) == 1
    assert replay_index(pd.Timestamp("2026-11-06") + pd.Timedelta(days=135), 135) == 0
    assert replay_index("2026-11-05", 135) == 134


def test_the_replay_ends_with_the_day_after_the_records(warehouse):
    days = replay_days(warehouse)
    assert days[-1] > warehouse.days[-1]
    assert days[-1].day_of_week < 5


def test_a_plan_is_graded_against_the_day(warehouse, plan):
    result = grade(warehouse, plan)
    assert result["pairs"] == warehouse.daily.loc[pd.Timestamp(plan.day), "pairs"]
    assert result["boxes_useful"] <= min(result["boxes_moved"], result["boxes_needed"])
    assert result["workers_needed"] >= 1


def test_scores_come_with_the_simplest_alternative(warehouse, plan):
    scores = summarise(warehouse, [(plan, grade(warehouse, plan))])
    assert scores["days"] == 1
    assert "same_weekday_last_week_miss_pct" in scores["forecast"]
    assert 0 <= scores["replenishment"]["useful_pct"] <= 100


def test_the_published_scores_are_a_full_replay(warehouse):
    published = json.loads((ROOT / "docs" / "evidence" / "replay.json").read_text("utf-8"))
    assert published["days"] == len(warehouse.plan_days())
    assert published["first_day"] == warehouse.plan_days()[0].strftime("%Y-%m-%d")


def test_the_dashboard_builds(warehouse, tmp_path):
    days = [*warehouse.plan_days()[:2], replay_days(warehouse)[-1]]
    index = build(tmp_path / "site", warehouse, verbose=False, days=days)
    assert len(index["days"]) == 3
    assert index["days"][-1]["actual"] is None
    for name in ("index.html", "how.html", "history.html", "404.html", "data/index.json"):
        assert (tmp_path / "site" / name).exists(), name
    first = json.loads(
        (tmp_path / "site" / "data" / "days" / f"{days[0]:%Y-%m-%d}.json").read_text()
    )
    assert first["actual"]["pairs"] > 0
    assert first["steps"][-1]["kind"] == "report"


def test_the_command_line_plans_a_day(capsys):
    assert main(["plan", "--date", "2023-07-18", "--brain", "rules"]) == 0
    out = capsys.readouterr().out
    assert "Plan for Tuesday 2023-07-18" in out
    assert "BRIEF" in out and "Bring down from levels 3-4" in out
