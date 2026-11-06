"""Forecast the pairs the warehouse will ship, in total and for each SKU.

Three simple methods compete. Each morning the agent scores all three on the last
30 working days, using for every scored day only what was known the morning
before, and forecasts with the one that missed least. A method that wins one
month can lose the next, and the choice is recorded each time.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from warehouse_planner.data import Warehouse

METHODS = {
    "last_week": "Same weekday last week",
    "weekday_average": "Average of the last six same weekdays",
    "recent_level": "Last 20 days' average, shaped by weekday",
}


def next_weekdays(start: pd.Timestamp, count: int) -> list[pd.Timestamp]:
    """``start`` and the working days after it, Monday to Friday."""
    days: list[pd.Timestamp] = []
    day = pd.Timestamp(start)
    while len(days) < count:
        if day.day_of_week < 5:
            days.append(day)
        day += pd.Timedelta(days=1)
    return days


def _forecast(values: np.ndarray, weekdays: np.ndarray, weekday: int, method: str) -> float:
    if len(values) == 0:
        return 0.0
    same = values[weekdays == weekday]
    if method == "last_week":
        return float(same[-1]) if len(same) else float(values[-5:].mean())
    if method == "weekday_average":
        return float(same[-6:].mean()) if len(same) else float(values[-20:].mean())
    if method == "recent_level":
        level = float(values[-20:].mean())
        long, long_days = values[-120:], weekdays[-120:]
        on_day = long[long_days == weekday]
        if len(on_day) == 0 or long.mean() <= 0:
            return level
        return level * float(on_day.mean() / long.mean())
    raise ValueError(f"unknown method {method}")


def point_forecast(history: pd.Series, target: pd.Timestamp, method: str) -> float:
    """One method's forecast for ``target`` from working days before it."""
    return _forecast(
        history.to_numpy(dtype=float),
        history.index.day_of_week.to_numpy(),
        target.day_of_week,
        method,
    )


def _backtest(
    series: pd.Series, day: pd.Timestamp, method: str, days: int
) -> tuple[np.ndarray, np.ndarray]:
    """Actual pairs and this method's forecasts on the working days just before ``day``."""
    values = series.to_numpy(dtype=float)
    weekdays = series.index.day_of_week.to_numpy()
    end = int(series.index.searchsorted(day))
    start = max(0, end - days)
    guess = np.array(
        [_forecast(values[:i], weekdays[:i], int(weekdays[i]), method) for i in range(start, end)]
    )
    return values[start:end], guess


@dataclass(frozen=True)
class MethodScore:
    method: str
    name: str
    miss: float  # weighted absolute percentage error over the scored days
    days: int


def score_methods(
    series: pd.Series, day: pd.Timestamp, backtest_days: int, memo: dict | None = None
) -> list[MethodScore]:
    """Score every method on the working days just before ``day``. Best first."""
    key = ("scores", pd.Timestamp(day), backtest_days, series.name)
    if memo is not None and key in memo:
        return memo[key]
    scores = []
    for method, name in METHODS.items():
        actual, guess = _backtest(series, day, method, backtest_days)
        total = actual.sum()
        miss = float(np.abs(actual - guess).sum() / total) if total > 0 else 1.0
        scores.append(MethodScore(method, name, round(miss, 4), len(actual)))
    ranked = sorted(scores, key=lambda s: (s.miss, list(METHODS).index(s.method)))
    if memo is not None:
        memo[key] = ranked
    return ranked


def error_ratios(series: pd.Series, day: pd.Timestamp, method: str, days: int) -> np.ndarray:
    """Actual over forecast on recent days: how far this method tends to be off."""
    actual, guess = _backtest(series, day, method, days)
    keep = guess > 0
    return actual[keep] / guess[keep] if keep.any() else np.array([1.0])


@dataclass(frozen=True)
class DayForecast:
    date: pd.Timestamp
    pairs: float
    low: float
    high: float
    lines: float
    orders: float
    runs: float

    def as_dict(self) -> dict:
        return {
            "date": self.date.strftime("%Y-%m-%d"),
            "weekday": self.date.strftime("%a"),
            "pairs": round(self.pairs),
            "low": round(self.low),
            "high": round(self.high),
            "lines": round(self.lines),
            "orders": round(self.orders),
            "runs": round(self.runs),
        }


def forecast_dates(
    warehouse: Warehouse, day: pd.Timestamp, method: str, targets: list[pd.Timestamp]
) -> list[DayForecast]:
    """Forecasts for ``targets`` made on the morning of ``day``, from records before it.

    Lines, orders and trolley runs follow from pairs at their ratios over the last
    20 working days. The range comes from how far this method's forecasts fell from
    the actual pairs on the last 30 working days.
    """
    settings = warehouse.settings
    daily = warehouse.daily[warehouse.daily.index < day]
    pairs = daily["pairs"]
    ratios = error_ratios(warehouse.daily["pairs"], day, method, settings.backtest_days)
    low_ratio, high_ratio = np.quantile(ratios, [0.1, 0.9])
    recent = daily.iloc[-20:]
    total = float(recent["pairs"].sum()) or 1.0
    per_pair = {k: float(recent[k].sum()) / total for k in ("lines", "orders", "runs")}
    out = []
    for target in targets:
        point = max(point_forecast(pairs, target, method), 0.0)
        out.append(
            DayForecast(
                date=target,
                pairs=point,
                low=point * float(min(low_ratio, 1.0)),
                high=point * float(max(high_ratio, 1.0)),
                lines=point * per_pair["lines"],
                orders=point * per_pair["orders"],
                runs=point * per_pair["runs"],
            )
        )
    return out


def forecast_days(
    warehouse: Warehouse, day: pd.Timestamp, method: str, horizon: int
) -> list[DayForecast]:
    """Pairs, order lines, orders and trolley runs for ``day`` and the working days after it."""
    return forecast_dates(warehouse, day, method, next_weekdays(day, horizon))


def sku_shares(warehouse: Warehouse, day: pd.Timestamp, days: int) -> pd.Series:
    """Each SKU and size's share of all pairs over the recent working days."""
    matrix = warehouse.sku_matrix
    window = matrix[matrix.index < day].iloc[-days:]
    totals = window.sum()
    total = float(totals.sum())
    if total <= 0:
        return totals
    shares = totals[totals > 0] / total
    return shares.sort_values(ascending=False)
