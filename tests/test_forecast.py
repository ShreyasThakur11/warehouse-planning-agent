from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from warehouse_planner.forecast import (
    forecast_days,
    next_weekdays,
    point_forecast,
    score_methods,
    sku_shares,
)

from .conftest import tiny_warehouse


def weekly(weeks: int = 12) -> pd.Series:
    """Monday 100, Tuesday 80, Wednesday 60, Thursday 40, Friday 20, every week."""
    days = pd.bdate_range("2023-01-02", periods=5 * weeks)
    return pd.Series([100.0, 80, 60, 40, 20] * weeks, index=days)


def test_next_weekdays_skips_the_weekend():
    days = next_weekdays(pd.Timestamp("2023-03-03"), 3)  # a Friday
    assert [d.strftime("%a") for d in days] == ["Fri", "Mon", "Tue"]


def test_each_method_on_a_repeating_week():
    series = weekly()
    monday = pd.Timestamp("2023-03-27")
    history = series[series.index < monday]
    assert point_forecast(history, monday, "last_week") == 100
    assert point_forecast(history, monday, "weekday_average") == 100
    # 20-day level is 60; Mondays are 100 against a mean of 60.
    assert point_forecast(history, monday, "recent_level") == pytest.approx(100)


def test_a_repeating_week_is_forecast_exactly_by_every_method():
    series = weekly(30)  # long enough that the 120-day window holds whole weeks
    scores = score_methods(series, series.index[-1], backtest_days=10)
    assert [s.miss for s in scores] == [0.0, 0.0, 0.0]
    assert scores[0].method == "last_week"  # a tie goes to the simplest


def test_after_a_jump_the_quickest_method_wins():
    series = weekly()
    series.iloc[-10:] *= 2  # demand doubles for the last two weeks
    end = series.index[-1] + pd.Timedelta(days=3)
    scores = score_methods(series, end, backtest_days=5)
    assert scores[0].method == "last_week"
    assert scores[0].miss == 0.0
    assert all(s.miss > 0 for s in scores[1:])


def test_a_forecast_never_sees_its_own_day(warehouse):
    day = warehouse.plan_days()[30]
    before = forecast_days(warehouse, day, "recent_level", 3)
    altered = warehouse.daily.copy()
    altered.loc[altered.index >= day, "pairs"] = 1e9
    warehouse.__dict__["daily"] = altered
    try:
        after = forecast_days(warehouse, day, "recent_level", 3)
    finally:
        del warehouse.__dict__["daily"]
    assert [f.pairs for f in after] == [f.pairs for f in before]


def test_range_holds_the_forecast(warehouse):
    day = warehouse.plan_days()[50]
    for f in forecast_days(warehouse, day, "weekday_average", 5):
        assert f.low <= f.pairs <= f.high
        assert f.lines > 0 and f.runs > 0


def test_sku_shares_add_up():
    tiny = tiny_warehouse()
    shares = sku_shares(tiny, tiny.days[-1], 10)
    assert shares.to_dict() == {"AAA 9": 1.0}
    assert np.isclose(sku_shares(tiny, tiny.days[-1], 10).sum(), 1.0)
