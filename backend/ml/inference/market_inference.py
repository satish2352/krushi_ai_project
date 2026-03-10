"""
Inference Layer: Market Intelligence
======================================
Reads marketcropdata.csv and provides market lookup,
price trends, and mandi suggestions.
No ML model needed — pure data lookup + aggregation.
"""

import os
import pandas as pd
import numpy as np
from typing import Optional

BASE_DIR  = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "marketcropdata.csv"))

# Module-level cache
_MARKET_DF: Optional[pd.DataFrame] = None


def _load_market_data() -> pd.DataFrame:
    global _MARKET_DF
    if _MARKET_DF is None:
        df = pd.read_csv(DATA_PATH)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        df["arrival_date"] = pd.to_datetime(df["arrival_date"], dayfirst=True, errors="coerce")

        # Normalize text columns for case-insensitive matching
        for col in ["state", "district", "market", "commodity", "variety"]:
            if col in df.columns:
                df[f"{col}_normalized"] = df[col].str.lower().str.strip()

        _MARKET_DF = df
    return _MARKET_DF


def get_price_by_crop_state(crop: str, state: Optional[str] = None) -> dict:
    """
    Get market prices for a commodity, optionally filtered by state.

    Args:
        crop:  commodity/crop name (case-insensitive)
        state: state name to filter (optional)

    Returns:
        dict with price stats, top markets, price trend data

    API Response Design:
        {
          "crop": "Rice",
          "state": "Maharashtra",
          "avg_modal_price": 2100.5,
          "min_price": 1800,
          "max_price": 2500,
          "top_markets": [{"market": "Pune APMC", "avg_price": 2150, "district": "Pune"}, ...],
          "monthly_trend": [{"month": "2019-04", "avg_price": 2050}, ...]
        }
    """
    df = _load_market_data()
    crop_lower = crop.lower().strip()

    # Filter by commodity
    mask = df["commodity_normalized"].str.contains(crop_lower, na=False)
    filtered = df[mask]

    if filtered.empty:
        # Try partial match
        mask2 = df["commodity_normalized"].apply(lambda x: crop_lower in str(x))
        filtered = df[mask2]

    if filtered.empty:
        # Find similar commodities
        available = sorted(df["commodity"].unique().tolist())
        return {
            "error": f"Commodity '{crop}' not found in dataset.",
            "hint":  "Try one of: " + ", ".join(available[:20])
        }

    # Filter by state if provided
    if state:
        state_mask = filtered["state_normalized"].str.contains(state.lower().strip(), na=False)
        state_filtered = filtered[state_mask]
        if not state_filtered.empty:
            filtered = state_filtered

    # Aggregate
    avg_modal   = filtered["modal_price"].mean()
    min_price   = filtered["min_price"].min()
    max_price   = filtered["max_price"].max()
    median_price= filtered["modal_price"].median()

    # Top markets by avg price
    top_markets = (
        filtered.groupby(["market", "district", "state"])["modal_price"]
        .mean()
        .reset_index()
        .rename(columns={"modal_price": "avg_price"})
        .sort_values("avg_price", ascending=False)
        .head(10)
    )
    top_markets_list = top_markets.apply(lambda r: {
        "market":    r["market"],
        "district":  r["district"],
        "state":     r["state"],
        "avg_price_per_quintal": round(r["avg_price"], 2),
    }, axis=1).tolist()

    # Monthly trend (last 12 months of data available)
    if "arrival_date" in filtered.columns:
        filtered_dated = filtered.dropna(subset=["arrival_date"])
        monthly = (
            filtered_dated.groupby(filtered_dated["arrival_date"].dt.to_period("M"))["modal_price"]
            .mean()
            .tail(12)
            .reset_index()
        )
        monthly.columns = ["month", "avg_price"]
        monthly["month"] = monthly["month"].astype(str)
        monthly_trend = monthly.apply(lambda r: {
            "month":     r["month"],
            "avg_price": round(r["avg_price"], 2)
        }, axis=1).tolist()
    else:
        monthly_trend = []

    return {
        "crop":              filtered["commodity"].iloc[0],
        "state":             state or "All States",
        "records_found":     len(filtered),
        "price_stats": {
            "avg_modal_price_per_quintal": round(avg_modal, 2),
            "min_price_per_quintal":       round(min_price, 2),
            "max_price_per_quintal":       round(max_price, 2),
            "median_price_per_quintal":    round(median_price, 2),
        },
        "top_markets":   top_markets_list,
        "monthly_trend": monthly_trend,
    }


def get_nearby_mandis(state: str, district: Optional[str] = None,
                      crop: Optional[str] = None) -> dict:
    """
    Get nearby mandis/APMC markets for a state/district.

    Args:
        state:    state name (required)
        district: district name (optional, for closer results)
        crop:     filter by commodity (optional)

    Returns:
        dict with list of mandis with commodity info
    """
    df = _load_market_data()
    state_mask = df["state_normalized"].str.contains(state.lower().strip(), na=False)
    filtered   = df[state_mask]

    if filtered.empty:
        available_states = sorted(df["state"].unique().tolist())
        return {
            "error": f"State '{state}' not found.",
            "available_states": available_states
        }

    if district:
        dist_mask = filtered["district_normalized"].str.contains(district.lower().strip(), na=False)
        if not filtered[dist_mask].empty:
            filtered = filtered[dist_mask]

    if crop:
        crop_mask = filtered["commodity_normalized"].str.contains(crop.lower().strip(), na=False)
        if not filtered[crop_mask].empty:
            filtered = filtered[crop_mask]

    # Unique mandis
    mandis = (
        filtered.groupby(["market", "district", "state"])
        .agg(
            commodities=("commodity", lambda x: list(x.unique()[:10])),
            avg_price=("modal_price", "mean"),
            records=("modal_price", "count")
        )
        .reset_index()
        .sort_values("records", ascending=False)
        .head(15)
    )

    mandi_list = mandis.apply(lambda r: {
        "market_name":  r["market"],
        "district":     r["district"],
        "state":        r["state"],
        "commodities":  r["commodities"],
        "avg_price":    round(r["avg_price"], 2),
        "data_records": int(r["records"]),
        "type":         "APMC Mandi",
    }, axis=1).tolist()

    return {
        "state":           state,
        "district":        district or "All Districts",
        "total_mandis":    len(mandi_list),
        "mandis":          mandi_list,
    }


def get_all_commodities() -> list:
    """Return list of all available commodities in the dataset."""
    df = _load_market_data()
    return sorted(df["commodity"].unique().tolist())


def get_all_states() -> list:
    """Return list of all states in the dataset."""
    df = _load_market_data()
    return sorted(df["state"].unique().tolist())


if __name__ == "__main__":
    print("=== Market Intelligence Inference Test ===\n")

    # Test 1: Price by crop
    print("--- Prices for Rice in Maharashtra ---")
    result = get_price_by_crop_state("Rice", "Maharashtra")
    print(f"Avg Price: Rs {result.get('price_stats', {}).get('avg_modal_price_per_quintal', 'N/A')}/quintal")
    print(f"Top Markets: {result.get('top_markets', [])[:3]}")

    print("\n--- Nearby Mandis in Maharashtra, Pune ---")
    mandis = get_nearby_mandis("Maharashtra", "Pune")
    for m in mandis.get("mandis", [])[:5]:
        print(f"  {m['market_name']} ({m['district']}) — {m['commodities'][:3]}")

    print("\n--- Available States ---")
    states = get_all_states()
    print(f"  Total: {len(states)} states")
    print(f"  Sample: {states[:10]}")
