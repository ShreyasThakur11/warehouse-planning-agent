"""Read the warehouse records into the tables the agent works from.

The four files in ``data/`` are used exactly as published. Nothing here changes a
value: sizes are decoded into labels, and locations are split into aisle, bay and
level.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

import numpy as np
import pandas as pd

from warehouse_planner.settings import DATA_DIR, Settings

# The records write half sizes without the point: 105 is 10.5. Sizes from 215 up
# are Mondopoint, in millimetres, and stay as written.
_HALF_SIZES = {35, 45, 55, 65, 75, 85, 95, 105, 115, 125}


def size_label(raw: object) -> str:
    """A footwear size as people write it: 9, 10.5 or 260."""
    try:
        value = float(str(raw).strip())
    except ValueError:
        return "?"
    if np.isnan(value):
        return "?"
    if value in _HALF_SIZES:
        value /= 10.0
    return str(int(value)) if float(value).is_integer() else f"{value:.1f}"


def _strip(frame: pd.DataFrame) -> pd.DataFrame:
    frame.columns = [str(c).strip() for c in frame.columns]
    for column in frame.columns:
        if pd.api.types.is_string_dtype(frame[column]):
            frame[column] = frame[column].str.strip()
    return frame


def read_orders(path: Path) -> pd.DataFrame:
    """One row per order line: the date, the SKU and size, and the pairs ordered."""
    raw = _strip(pd.read_csv(path, sep=";", encoding="utf-8-sig"))
    created = pd.to_datetime(raw["creationDate"], dayfirst=True)
    orders = pd.DataFrame(
        {
            "date": created.dt.normalize(),
            "hour": created.dt.hour,
            "order": raw["orderNumber"].astype(str),
            "ref": raw["Reference"],
            "size": raw["Size (US)"].map(size_label),
            "pairs": raw["quantity (units)"].astype(int),
            "run": raw["waveNumber"].astype(str),
            "operator": raw["operator"],
        }
    )
    orders["sku"] = orders["ref"] + " " + orders["size"]
    return orders


def read_slots(storage: Path, locations: Path, settings: Settings) -> pd.DataFrame:
    """One row per box in the racks: where it is, which level, and what it holds.

    ``Random_Storage.csv`` lists the 18 boxes at each location. ``Storage_Location.csv``
    gives each location's level, its ``z`` coordinate.
    """
    wide = _strip(pd.read_csv(storage, dtype=str))
    long = wide.melt(id_vars=["originalLocation"], var_name="position", value_name="box")
    long = long.dropna(subset=["box"])
    parts = long["box"].str.split(";", n=1, expand=True)
    places = _strip(pd.read_csv(locations))
    levels = places.set_index("originalLocation")["z"]
    slots = pd.DataFrame(
        {
            "location": long["originalLocation"].to_numpy(),
            "position": long["position"].str.replace("col_", "", regex=False).astype(int),
            "ref": parts[0].str.strip().to_numpy(),
            "size": parts[1].map(size_label).to_numpy(),
        }
    )
    slots["level"] = slots["location"].map(levels).astype("Int64")
    split = slots["location"].str.split("-", expand=True)
    slots["aisle"] = split[0]
    slots["bay"] = split[1].astype(int)
    slots["sku"] = slots["ref"] + " " + slots["size"]
    slots["zone"] = np.select(
        [
            slots["level"].isin(settings.pick_levels).to_numpy(dtype=bool),
            slots["level"].isin(settings.reserve_levels).to_numpy(dtype=bool),
        ],
        ["pick", "reserve"],
        default="other",
    )
    return slots.sort_values(["location", "position"]).reset_index(drop=True)


def read_products(path: Path) -> pd.DataFrame:
    raw = _strip(pd.read_csv(path, sep=";"))
    return pd.DataFrame({"ref": raw["Reference"], "catalogue_class": raw["ABCCOD"]})


@dataclass
class Warehouse:
    """The records, and the daily views of them that every tool reads."""

    orders: pd.DataFrame
    slots: pd.DataFrame
    products: pd.DataFrame
    settings: Settings
    memo: dict = field(default_factory=dict, repr=False)

    @classmethod
    def load(cls, folder: Path | None = None, settings: Settings | None = None) -> Warehouse:
        folder = folder or DATA_DIR
        settings = settings or Settings()
        return cls(
            orders=read_orders(folder / "Customer_Order.csv"),
            slots=read_slots(
                folder / "Random_Storage.csv", folder / "Storage_Location.csv", settings
            ),
            products=read_products(folder / "Product.csv"),
            settings=settings,
        )

    @cached_property
    def daily(self) -> pd.DataFrame:
        """Pairs, order lines, orders and trolley runs on each day the warehouse worked."""
        grouped = self.orders.groupby("date")
        return pd.DataFrame(
            {
                "pairs": grouped["pairs"].sum(),
                "lines": grouped.size(),
                "orders": grouped["order"].nunique(),
                "runs": grouped["run"].nunique(),
                "people": grouped["operator"].nunique(),
            }
        ).astype(float)

    @cached_property
    def days(self) -> pd.DatetimeIndex:
        return pd.DatetimeIndex(self.daily.index)

    @cached_property
    def sku_matrix(self) -> pd.DataFrame:
        """Pairs of each SKU and size (columns) on each working day (rows)."""
        table = self.orders.pivot_table(
            index="date", columns="sku", values="pairs", aggfunc="sum", fill_value=0
        )
        return table.reindex(self.days, fill_value=0).astype(float)

    @cached_property
    def stock(self) -> pd.DataFrame:
        """Boxes of each SKU and size at the pick levels and in reserve."""
        table = self.slots.pivot_table(
            index="sku", columns="zone", values="position", aggfunc="count", fill_value=0
        )
        table = table.reindex(columns=["pick", "reserve"], fill_value=0).astype(int)
        refs = self.slots.drop_duplicates("sku").set_index("sku")[["ref", "size"]]
        return table.join(refs)

    @cached_property
    def slots_by_sku(self) -> dict[str, pd.DataFrame]:
        return {sku: part for sku, part in self.slots.groupby("sku")}

    @cached_property
    def level_of(self) -> dict[str, int]:
        first = self.slots.drop_duplicates("location")
        return dict(zip(first["location"], first["level"].astype(int), strict=True))

    def history_before(self, day: pd.Timestamp) -> int:
        """How many working days of records exist before ``day``."""
        return int((self.days < day).sum())

    def plan_days(self) -> pd.DatetimeIndex:
        """Weekdays in the records with enough history behind them to plan."""
        days = self.days[self.settings.min_history_days :]
        return days[days.day_of_week < 5]
