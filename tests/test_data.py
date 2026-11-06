from __future__ import annotations

import hashlib

import pytest

from warehouse_planner.data import size_label
from warehouse_planner.settings import DATA_DIR

PUBLISHED = {
    "Customer_Order.csv": "e28ae8ac9b368b9496b153fafb5af685bd94ba1530ffcb308dfcd5403601f325",
    "Product.csv": "416527e5260c17003177e1389fd48042d9790be9ef9cabe4c6c07e583e01eb2f",
    "Random_Storage.csv": "c9c2eb25ff24f3fdc7f47c02cb44de7702c0416b2a309b754a939c4ae100a0b0",
    "Storage_Location.csv": "2895d9da16b4d63e85a17bfe050cc77b72d5654298072d6fa3b1732b1c1d6cc3",
}


@pytest.mark.parametrize("name", sorted(PUBLISHED))
def test_the_records_are_unchanged(name):
    digest = hashlib.sha256((DATA_DIR / name).read_bytes()).hexdigest()
    assert digest == PUBLISHED[name]


@pytest.mark.parametrize(
    ("raw", "label"),
    [(105, "10.5"), ("95", "9.5"), (9.0, "9"), ("13", "13"), (260, "260"), (None, "?"), ("x", "?")],
)
def test_sizes_read_as_people_write_them(raw, label):
    assert size_label(raw) == label


def test_the_orders_are_all_read(warehouse):
    assert len(warehouse.orders) == 122_370
    assert warehouse.orders["pairs"].sum() == 228_195
    assert len(warehouse.days) == 178
    assert warehouse.daily["pairs"].sum() == 228_195


def test_every_box_has_a_level(warehouse):
    slots = warehouse.slots
    assert len(slots) == 2292 * 18
    assert slots["level"].notna().all()
    assert (slots["zone"] == "pick").sum() == 30_456
    assert (slots["zone"] == "reserve").sum() == 10_800
    # A location's code repeats its level: A-14-31 is on level 3. One location in
    # the records disagrees: K-23-40 is coded level 4 but stored at height 3. The
    # agent goes by the recorded height.
    places = slots.drop_duplicates("location")
    coded = places["location"].str.split("-").str[2].str[0].astype(int)
    differ = places.loc[coded != places["level"].astype(int), "location"].tolist()
    assert differ == ["K-23-40"]


def test_stock_counts_boxes_by_zone(warehouse):
    stock = warehouse.stock
    assert stock["pick"].sum() == 30_456
    assert stock["reserve"].sum() == 10_800


def test_plan_days_have_history_and_are_weekdays(warehouse):
    days = warehouse.plan_days()
    assert (days.day_of_week < 5).all()
    assert warehouse.history_before(days[0]) == warehouse.settings.min_history_days
