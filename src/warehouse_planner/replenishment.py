"""Bring reserve stock down from levels 3 and 4 to the pick faces on levels 1 and 2.

Pickers work from levels 1 and 2. When a SKU's boxes there will not last until
the end of the cover window, the agent lists the boxes to bring down from levels
3 and 4, from which location to which, most urgent first. A SKU with no pick face
gets one, in the place of boxes that have not sold. Where the racks cannot cover
the demand, or a SKU is not in the racks at all, it says so.

Each slot holds one box, and each box is one pair: a pick takes one box. The
records hold one storage snapshot, so every morning starts from it. Connected to
a warehouse system, the same code would read the real position each morning.
"""

from __future__ import annotations

from collections import defaultdict

import pandas as pd

from warehouse_planner.data import Warehouse
from warehouse_planner.forecast import DayForecast, sku_shares


def cover_need(
    warehouse: Warehouse, day: pd.Timestamp, forecast: list[DayForecast]
) -> pd.DataFrame:
    """Expected pairs per SKU and size over the cover window, against the boxes held."""
    settings = warehouse.settings
    shares = sku_shares(warehouse, day, settings.share_days)
    window = forecast[: settings.cover_days]
    cover_pairs = sum(f.pairs for f in window)
    today_pairs = window[0].pairs if window else 0.0
    table = pd.DataFrame({"share": shares})
    table["cover"] = table["share"] * cover_pairs
    table["today"] = table["share"] * today_pairs
    stock = warehouse.stock[["pick", "reserve"]]
    table = table.join(stock, how="left").fillna({"pick": 0, "reserve": 0})
    table[["pick", "reserve"]] = table[["pick", "reserve"]].astype(int)
    table["needed"] = (table["cover"].round() - table["pick"]).clip(lower=0).astype(int)
    table["move"] = table[["needed", "reserve"]].min(axis=1).astype(int)
    table["short"] = (table["needed"] - table["move"]).astype(int)
    table["in_racks"] = table.index.isin(warehouse.stock.index)
    return table


Box = tuple[str, str, int, int, int]  # location, aisle, bay, level, position


def _boxes(part: pd.DataFrame, zone: str) -> list[Box]:
    rows = part[part["zone"] == zone]
    return list(
        zip(
            rows["location"],
            rows["aisle"],
            rows["bay"].astype(int),
            rows["level"].astype(int),
            rows["position"].astype(int),
            strict=True,
        )
    )


def _nearest_first(reserve: list[Box], faces: list[Box]) -> list[Box]:
    """Reserve boxes ordered by closeness to the SKU's pick face: same bay, same aisle, level 3."""
    bays = {(f[1], f[2]) for f in faces}
    aisles = {f[1] for f in faces}
    return sorted(
        reserve,
        key=lambda b: (
            bool(faces) and (b[1], b[2]) not in bays,
            bool(faces) and b[1] not in aisles,
            b[3],
            b[0],
            b[4],
        ),
    )


def _face_for(box: Box, faces: list[Box]) -> str:
    """The pick face a box goes to: in its own bay if the SKU has one there."""
    for face in faces:
        if (face[1], face[2]) == (box[1], box[2]):
            return face[0]
    held: dict[str, int] = defaultdict(int)
    for face in faces:
        held[face[0]] += 1
    return max(sorted(held), key=lambda loc: held[loc])


def plan_replenishment(
    warehouse: Warehouse, day: pd.Timestamp, forecast: list[DayForecast]
) -> dict:
    """The boxes to bring down today, the swaps that make room, and what cannot be covered."""
    settings = warehouse.settings
    need = cover_need(warehouse, day, forecast)
    slots = warehouse.slots
    level_of = warehouse.level_of
    matrix = warehouse.sku_matrix
    recent = matrix[matrix.index < day].iloc[-settings.share_days :].sum()
    sold = set(recent[recent > 0].index)
    unsold = slots[(slots["zone"] == "pick") & ~slots["sku"].isin(sold)]
    # Free places for new pick faces: locations on levels 1-2 holding unsold boxes.
    room = {loc: list(part.index) for loc, part in unsold.groupby("location")}
    place = unsold.drop_duplicates("location").set_index("location")[["aisle", "bay"]]

    todo = need[need["move"] > 0].assign(
        days_left=lambda t: t["pick"] / t["today"].clip(lower=1e-9)
    )
    todo = todo.sort_values(["days_left", "today"], ascending=[True, False])
    cover_end = forecast[min(settings.cover_days, len(forecast)) - 1].date

    moves: list[dict] = []
    swaps: list[dict] = []
    for sku, row in todo.iterrows():
        part = warehouse.slots_by_sku[str(sku)]
        faces = _boxes(part, "pick")
        chosen = _nearest_first(_boxes(part, "reserve"), faces)[: int(row["move"])]
        new_face = not faces
        if new_face:
            # One location for the whole new face, as close as possible to the first box.
            first = chosen[0]
            open_places = place[[len(room.get(loc, [])) > 0 for loc in place.index]]
            if open_places.empty:
                continue
            distance = (open_places["aisle"] != first[1]) * 1000 + (
                open_places["bay"] - first[2]
            ).abs()
            enough = open_places[[len(room[loc]) >= len(chosen) for loc in open_places.index]].index
            pool = distance.loc[enough] if len(enough) else distance
            target = str(pool.sort_values(kind="stable").index[0])
        info = {
            "sku": str(part["ref"].iloc[0]),
            "size": str(part["size"].iloc[0]),
            "on_l1_l2": int(row["pick"]),
            "needed": int(round(row["cover"])),
            "today": round(float(row["today"]), 1),
            "new_face": bool(new_face),
        }
        counts: dict[tuple[str, str], int] = defaultdict(int)
        for box in chosen:
            if new_face:
                if not room.get(target):
                    break
                freed = slots.loc[room[target].pop(0)]
                swaps.append(
                    {
                        "sku_up": f"{freed['ref']} size {freed['size']}",
                        "from": target,
                        "to": box[0],
                        "makes_room_for": f"{info['sku']} size {info['size']}",
                    }
                )
                destination = target
            else:
                destination = _face_for(box, faces)
            counts[(box[0], destination)] += 1
        for (source, destination), boxes in counts.items():
            moves.append(
                {
                    **info,
                    "boxes": boxes,
                    "from": source,
                    "from_level": level_of[source],
                    "to": destination,
                    "to_level": level_of[destination],
                }
            )

    short = need[(need["short"] > 0) & need["in_racks"]].sort_values("short", ascending=False)
    missing = need[~need["in_racks"] & (need["cover"].round() >= 1)].sort_values(
        "cover", ascending=False
    )
    label = {sku: f"{sku.split(' ', 1)[0]} size {sku.split(' ', 1)[1]}" for sku in need.index}
    return {
        "cover_days": settings.cover_days,
        "cover_until": cover_end.strftime("%Y-%m-%d"),
        "boxes": int(sum(m["boxes"] for m in moves)),
        "tasks": len(moves),
        "skus": len({(m["sku"], m["size"]) for m in moves}),
        "new_faces": len({(m["sku"], m["size"]) for m in moves if m["new_face"]}),
        "moves": moves,
        "swaps": swaps,
        "short": {
            "skus": int(short.shape[0]),
            "pairs": int(short["short"].sum()),
            "examples": [
                {"sku": label[s], "pairs": int(v)} for s, v in short["short"].head(5).items()
            ],
        },
        "not_in_racks": {
            "skus": int(missing.shape[0]),
            "pairs": int(round(missing["cover"].sum())),
            "examples": [
                {"sku": label[s], "pairs": int(round(v))}
                for s, v in missing["cover"].head(5).items()
            ],
        },
        "unsold_on_l1_l2": {
            "skus": int(unsold["sku"].nunique()),
            "boxes": int(unsold.shape[0]),
            "days": settings.share_days,
        },
    }
