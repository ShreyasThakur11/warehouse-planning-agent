"""Which SKUs are in demand, and where their stock sits."""

from __future__ import annotations

import pandas as pd

from warehouse_planner.data import Warehouse
from warehouse_planner.forecast import DayForecast, sku_shares


def measured_classes(pairs_by_ref: pd.Series) -> pd.Series:
    """A for the SKUs that make the first 80% of pairs, B for the next 15%, C for the rest."""
    ordered = pairs_by_ref.sort_values(ascending=False)
    total = float(ordered.sum())
    if total <= 0:
        return pd.Series("C", index=ordered.index)
    before = (ordered.cumsum() - ordered) / total
    return before.map(lambda share: "A" if share < 0.80 else ("B" if share < 0.95 else "C"))


def skus_in_demand(
    warehouse: Warehouse, day: pd.Timestamp, forecast: list[DayForecast], top: int
) -> dict:
    """The SKUs expected to sell most over the forecast days, with trend and stock."""
    settings = warehouse.settings
    shares = sku_shares(warehouse, day, settings.share_days)
    horizon_pairs = sum(f.pairs for f in forecast)
    first_day = forecast[0].pairs if forecast else 0.0

    matrix = warehouse.sku_matrix
    past = matrix[matrix.index < day]
    window = past.iloc[-settings.share_days :]
    recent = past.iloc[-10:]
    refs = warehouse.stock["ref"]
    ref_of = pd.Series([c.split(" ", 1)[0] for c in matrix.columns], index=matrix.columns)

    usual = window.T.groupby(ref_of).sum().T.mean()
    lately = recent.T.groupby(ref_of).sum().T.mean()
    share = shares.groupby(ref_of.reindex(shares.index)).sum().sort_values(ascending=False)
    classes = measured_classes(window.T.groupby(ref_of).sum().T.sum())
    catalogue = warehouse.products.set_index("ref")["catalogue_class"]
    stock = warehouse.stock.groupby(refs)[["pick", "reserve"]].sum()

    rows = []
    for ref, part in share.head(top).items():
        base = float(usual.get(ref, 0.0))
        now = float(lately.get(ref, 0.0))
        change = (now / base - 1.0) if base > 0 else 0.0
        trend = "rising" if change >= 0.25 else ("falling" if change <= -0.25 else "steady")
        expected = horizon_pairs * part
        pick = int(stock["pick"].get(ref, 0))
        rows.append(
            {
                "sku": ref,
                "expected_pairs": round(expected),
                "expected_today": round(first_day * part),
                "share_pct": round(100 * part, 1),
                "usual_per_day": round(base, 1),
                "last_10_days_per_day": round(now, 1),
                "change_pct": round(100 * change),
                "trend": trend,
                "boxes_l1_l2": pick,
                "boxes_l3_l4": int(stock["reserve"].get(ref, 0)),
                "days_on_l1_l2": round(pick / (first_day * part), 1) if first_day * part else None,
                "measured_class": str(classes.get(ref, "C")),
                "catalogue_class": str(catalogue.get(ref, "?")),
            }
        )
    spikes = [
        r["sku"]
        for r in rows
        if r["usual_per_day"] > 0
        and r["last_10_days_per_day"] >= settings.spike_ratio * r["usual_per_day"]
    ]
    mismatched = [
        r["sku"] for r in rows if r["measured_class"] == "A" and r["catalogue_class"] == "C"
    ]
    return {
        "horizon_days": len(forecast),
        "horizon_pairs": round(horizon_pairs),
        "skus": rows,
        "top_share_pct": round(sum(r["share_pct"] for r in rows), 1),
        "rising": [r["sku"] for r in rows if r["trend"] == "rising"],
        "spikes": spikes,
        "catalogue_says_c": mismatched,
    }
