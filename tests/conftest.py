from __future__ import annotations

import pandas as pd
import pytest

from warehouse_planner.agent import run_agent
from warehouse_planner.data import Warehouse
from warehouse_planner.settings import Settings


@pytest.fixture(autouse=True)
def _no_key(monkeypatch):
    """No test may reach a real model, whatever is set on the machine running it."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture(scope="session")
def warehouse() -> Warehouse:
    return Warehouse.load()


@pytest.fixture(scope="session")
def day(warehouse) -> pd.Timestamp:
    return warehouse.plan_days()[60]


@pytest.fixture(scope="session")
def plan(warehouse, day):
    return run_agent(warehouse, day, brain="rules")


def tiny_warehouse(settings: Settings | None = None) -> Warehouse:
    """Two SKUs over eight weeks, small enough to work out by hand.

    SKU AAA size 9 sells 4 pairs every working day, has 1 box on level 1 and 3 boxes
    on level 3. SKU BBB size 10 never sells and has 2 boxes on level 1.
    """
    settings = settings or Settings(min_history_days=10, backtest_days=5, share_days=10)
    days = pd.bdate_range("2023-01-02", periods=40)
    orders = pd.DataFrame(
        {
            "date": days,
            "hour": 8,
            "order": [f"O{i}" for i in range(len(days))],
            "ref": "AAA",
            "size": "9",
            "pairs": 4,
            "run": [f"R{i}" for i in range(len(days))],
            "operator": "Operator_1",
        }
    )
    orders["sku"] = orders["ref"] + " " + orders["size"]
    rows = [
        ("A-01-11", 1, "AAA", "9", 1),
        ("A-01-31", 1, "AAA", "9", 3),
        ("A-01-31", 2, "AAA", "9", 3),
        ("A-02-41", 1, "AAA", "9", 4),
        ("A-01-12", 1, "BBB", "10", 1),
        ("A-01-12", 2, "BBB", "10", 1),
    ]
    slots = pd.DataFrame(rows, columns=["location", "position", "ref", "size", "level"])
    slots["level"] = slots["level"].astype("Int64")
    slots["aisle"] = slots["location"].str.split("-").str[0]
    slots["bay"] = slots["location"].str.split("-").str[1].astype(int)
    slots["sku"] = slots["ref"] + " " + slots["size"]
    slots["zone"] = slots["level"].map(lambda v: "pick" if v in settings.pick_levels else "reserve")
    products = pd.DataFrame({"ref": ["AAA", "BBB"], "catalogue_class": ["C", "A"]})
    return Warehouse(orders=orders, slots=slots, products=products, settings=settings)
