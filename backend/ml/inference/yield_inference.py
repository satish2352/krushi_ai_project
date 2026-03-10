"""
Inference Layer: Yield Estimation
===================================
Clean prediction wrapper for the trained Gradient Boosting Regressor.
Returns yield, profit estimate, and break-even analysis.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Optional

BASE_DIR       = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR     = os.path.join(BASE_DIR, "models")


def _load_artifacts():
    if not hasattr(_load_artifacts, "_cache"):
        model_path    = os.path.join(MODELS_DIR, "yield_gbr_model.pkl")
        prep_path     = os.path.join(MODELS_DIR, "yield_preprocessor.pkl")
        features_path = os.path.join(MODELS_DIR, "yield_feature_names.pkl")

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model not found: {model_path}\n"
                "Run: python ml/training/train_yield_estimator.py"
            )

        try:
            _load_artifacts._cache = {
                "model":         joblib.load(model_path),
                "preprocessor":  joblib.load(prep_path),
                "feature_names": joblib.load(features_path),
            }
        except Exception as e:
            raise RuntimeError(f"Model load failed (sklearn version mismatch?): {e}")
    return _load_artifacts._cache


# ── Rule-based yield estimates (tons/hectare) when ML model unavailable ────
RULE_YIELD_TONS_HA = {
    "rice":        3.5,  "wheat":     3.0,  "maize":      4.0,
    "cotton":      1.5,  "sugarcane": 70.0, "soybean":    1.8,
    "chickpea":    1.0,  "banana":    30.0, "mango":      8.0,
    "jowar":       1.5,  "bajra":     1.2,  "groundnut":  1.5,
    "mustard":     1.2,  "sunflower": 1.2,  "lentil":     1.0,
    "mothbeans":   0.7,  "mungbean":  0.8,  "blackgram":  0.8,
    "kidneybeans": 0.8,  "pigeonpeas":1.0,  "coconut":    8.0,
    "papaya":      25.0, "muskmelon": 15.0, "watermelon": 20.0,
    "grapes":      12.0, "orange":    10.0, "pomegranate":8.0,
    "apple":       12.0, "jute":      2.5,  "coffee":     0.8,
    "default":     2.0,
}

# ── Domain knowledge: average input costs ─────────────────────
# Rs per acre (approximate India-level averages)
INPUT_COST_DEFAULTS = {
    "rice":        12000,
    "wheat":       8000,
    "maize":       7000,
    "cotton":      15000,
    "sugarcane":   25000,
    "soybean":     8000,
    "chickpea":    6000,
    "banana":      30000,
    "mango":       5000,
    "default":     10000,
}

# Average market price (Rs/quintal) from APMC data approximations
MARKET_PRICE_DEFAULTS = {
    "rice":        2000,
    "wheat":       2015,
    "maize":       1700,
    "cotton":      6000,
    "sugarcane":   300,
    "soybean":     4000,
    "chickpea":    5000,
    "banana":      1500,
    "mango":       3000,
    "default":     2500,
}

def _rule_based_yield(data: dict) -> dict:
    """
    Pure rule-based yield + profit calculation.
    Used when the GBR pkl model fails (e.g. sklearn version mismatch).
    """
    print("[YieldInference] Using rule-based fallback (ML model unavailable)")

    crop           = data.get("crop", "default").lower()
    farm_size_acres = float(data.get("farm_size_acres", 1.0))
    rainfall_mm    = float(data.get("rainfall_mm", 500))
    fertilizer     = bool(data.get("fertilizer_used", True))
    irrigation     = bool(data.get("irrigation_used", True))

    HECTARES_PER_ACRE = 0.4047
    TONS_TO_QUINTALS  = 10

    # Base yield from lookup
    base_yield = RULE_YIELD_TONS_HA.get(crop, RULE_YIELD_TONS_HA["default"])

    # Adjust for fertilizer and irrigation
    if fertilizer:  base_yield *= 1.15
    if irrigation:  base_yield *= 1.10

    # Adjust for rainfall
    # if rainfall_mm < 300:   base_yield *= 0.75
    # elif rainfall_mm > 1500: base_yield *= 1.10

    # -----

    annual_rainfall = rainfall_mm * 12
    if annual_rainfall < 600:    base_yield *= 0.75
    elif annual_rainfall > 1800: base_yield *= 1.10

    # -----

    yield_pred       = round(max(0.1, base_yield), 3)
    farm_size_ha     = farm_size_acres * HECTARES_PER_ACRE
    total_yield_tons = yield_pred * farm_size_ha
    total_yield_qt   = total_yield_tons * TONS_TO_QUINTALS

    crop_key       = crop
    market_price   = float(data.get("market_price_per_quintal",
                           MARKET_PRICE_DEFAULTS.get(crop_key,
                           MARKET_PRICE_DEFAULTS["default"])))
    input_cost_pa  = float(data.get("input_cost_per_acre",
                           INPUT_COST_DEFAULTS.get(crop_key,
                           INPUT_COST_DEFAULTS["default"])))

    total_revenue  = total_yield_qt * market_price
    total_cost     = input_cost_pa * farm_size_acres
    gross_profit   = total_revenue - total_cost
    profit_margin  = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
    breakeven_qt   = total_cost / market_price if market_price > 0 else 0
    is_profitable  = gross_profit > 0

    return {
        "yield_estimation": {
            "yield_per_hectare_tons": yield_pred,
            "yield_per_acre_tons":    round(yield_pred * HECTARES_PER_ACRE, 3),
            "total_yield_tons":       round(total_yield_tons, 2),
            "total_yield_quintals":   round(total_yield_qt, 2),
            "farm_size_acres":        farm_size_acres,
        },
        "profit_analysis": {
            "market_price_per_quintal": market_price,
            "input_cost_per_acre":      input_cost_pa,
            "total_cost_rs":            round(total_cost, 2),
            "total_revenue_rs":         round(total_revenue, 2),
            "gross_profit_rs":          round(gross_profit, 2),
            "profit_margin_pct":        round(profit_margin, 2),
            "is_profitable":            is_profitable,
        },
        "breakeven_analysis": {
            "breakeven_yield_quintals": round(breakeven_qt, 2),
            "breakeven_acres":          round(farm_size_acres * (breakeven_qt / total_yield_qt) if total_yield_qt > 0 else farm_size_acres, 2),
            "actual_vs_breakeven":      "ABOVE" if total_yield_qt > breakeven_qt else "BELOW",
            "safety_margin_pct":        round((total_yield_qt - breakeven_qt) / breakeven_qt * 100, 2) if breakeven_qt > 0 else 0,
        },
        "input_summary": {
            "crop":       crop,
            "region":     data.get("region", "India"),
            "soil_type":  data.get("soil_type", "Loam"),
            "fertilizer": fertilizer,
            "irrigation": irrigation,
        },
        "model_version": "v1.0_rule_based_fallback",
    }


# # ── Domain knowledge: average input costs ─────────────────────
# # Rs per acre (approximate India-level averages)
# INPUT_COST_DEFAULTS = {
#     "rice":        12000,
#     "wheat":       8000,
#     "maize":       7000,
#     "cotton":      15000,
#     "sugarcane":   25000,
#     "soybean":     8000,
#     "chickpea":    6000,
#     "banana":      30000,
#     "mango":       5000,
#     "default":     10000,
# }

# # Average market price (Rs/quintal) from APMC data approximations
# MARKET_PRICE_DEFAULTS = {
#     "rice":        2000,
#     "wheat":       2015,
#     "maize":       1700,
#     "cotton":      6000,
#     "sugarcane":   300,
#     "soybean":     4000,
#     "chickpea":    5000,
#     "banana":      1500,
#     "mango":       3000,
#     "default":     2500,
# }


def validate_yield_input(data: dict) -> tuple[bool, str]:
    required = ["crop", "region"]
    for f in required:
        if f not in data:
            return False, f"Missing required field: '{f}'"

    numeric_fields = {
        "rainfall_mm":          (0, 5000),
        "temperature_celsius":  (0, 55),
        "days_to_harvest":      (30, 365),
        "farm_size_acres":      (0.1, 10000),
    }
    for field, (lo, hi) in numeric_fields.items():
        val = data.get(field)
        if val is not None:
            try:
                val = float(val)
                if val < lo or val > hi:
                    return False, f"'{field}'={val} out of range [{lo},{hi}]"
            except (ValueError, TypeError):
                return False, f"'{field}' must be numeric."
    return True, ""


def predict_yield(data: dict) -> dict:
    """
    Predict crop yield and estimate profit.

    Args:
        data: dict with keys:
            - crop (str)              : e.g. "Rice"
            - region (str)            : e.g. "South"
            - soil_type (str)         : e.g. "Clay" [optional]
            - rainfall_mm (float)     : [optional, default 500]
            - temperature_celsius (float) : [optional, default 25]
            - fertilizer_used (bool)  : [optional, default True]
            - irrigation_used (bool)  : [optional, default True]
            - weather_condition (str) : [optional, default "Sunny"]
            - days_to_harvest (int)   : [optional, default 120]
            - farm_size_acres (float) : [optional, default 1.0]
            - input_cost_per_acre (float) : [optional]
            - market_price_per_quintal (float) : [optional]

    Returns:
        dict with yield_estimation, profit_analysis, breakeven_analysis
    """
    is_valid, error = validate_yield_input(data)
    if not is_valid:
        return {"error": error}

    try:
        artifacts     = _load_artifacts()
        model         = artifacts["model"]
        preprocessor  = artifacts["preprocessor"]
        feature_names = artifacts["feature_names"]
    except (FileNotFoundError, RuntimeError) as e:
        print(f"[YieldInference] ML model unavailable: {e}")
        return _rule_based_yield(data)

    crop   = data.get("crop", "Rice")
    region = data.get("region", "South")

    # Build feature dict with defaults
    feature_dict = {
        "Region":              region,
        "Soil_Type":           data.get("soil_type", "Loam"),
        "Crop":                crop,
        "Rainfall_mm":         float(data.get("rainfall_mm", 500)),
        "Temperature_Celsius": float(data.get("temperature_celsius", 25)),
        "Fertilizer_Used":     int(bool(data.get("fertilizer_used", True))),
        "Irrigation_Used":     int(bool(data.get("irrigation_used", True))),
        "Weather_Condition":   data.get("weather_condition", "Sunny"),
        "Days_to_Harvest":     int(data.get("days_to_harvest", 120)),
    }

    # Build DataFrame with correct feature order
    input_df = pd.DataFrame([{f: feature_dict.get(f) for f in feature_names}])

    # Convert booleans if needed
    for col in ["Fertilizer_Used", "Irrigation_Used"]:
        if col in input_df.columns:
            input_df[col] = input_df[col].astype(int)

    # Preprocess and predict
    X_processed = preprocessor.transform(input_df)
    yield_pred  = float(model.predict(X_processed)[0])  # tons/hectare
    yield_pred  = max(0.1, yield_pred)                   # Ensure non-negative

    # Unit conversions
    HECTARES_PER_ACRE = 0.4047
    TONS_TO_QUINTALS  = 10  # 1 ton = 10 quintals

    farm_size_acres = float(data.get("farm_size_acres", 1.0))
    farm_size_ha    = farm_size_acres * HECTARES_PER_ACRE

    total_yield_tons  = yield_pred * farm_size_ha
    total_yield_qt    = total_yield_tons * TONS_TO_QUINTALS

    # Profit analysis
    crop_key       = crop.lower()
    market_price   = float(data.get("market_price_per_quintal",
                           MARKET_PRICE_DEFAULTS.get(crop_key,
                           MARKET_PRICE_DEFAULTS["default"])))
    input_cost_pa  = float(data.get("input_cost_per_acre",
                           INPUT_COST_DEFAULTS.get(crop_key,
                           INPUT_COST_DEFAULTS["default"])))

    total_revenue  = total_yield_qt * market_price
    total_cost     = input_cost_pa * farm_size_acres
    gross_profit   = total_revenue - total_cost
    profit_margin  = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0

    # Breakeven
    breakeven_yield_qt    = total_cost / market_price if market_price > 0 else 0
    breakeven_yield_acres = breakeven_yield_qt / (yield_pred * HECTARES_PER_ACRE * TONS_TO_QUINTALS) if yield_pred > 0 else farm_size_acres
    is_profitable         = gross_profit > 0

    return {
        "yield_estimation": {
            "yield_per_hectare_tons": round(yield_pred, 3),
            "yield_per_acre_tons":    round(yield_pred * HECTARES_PER_ACRE, 3),
            "total_yield_tons":       round(total_yield_tons, 2),
            "total_yield_quintals":   round(total_yield_qt, 2),
            "farm_size_acres":        farm_size_acres,
        },
        "profit_analysis": {
            "market_price_per_quintal": market_price,
            "input_cost_per_acre":      input_cost_pa,
            "total_cost_rs":            round(total_cost, 2),
            "total_revenue_rs":         round(total_revenue, 2),
            "gross_profit_rs":          round(gross_profit, 2),
            "profit_margin_pct":        round(profit_margin, 2),
            "is_profitable":            is_profitable,
        },
        "breakeven_analysis": {
            "breakeven_yield_quintals": round(breakeven_yield_qt, 2),
            "breakeven_acres":          round(breakeven_yield_acres, 2),
            "actual_vs_breakeven":      "ABOVE" if total_yield_qt > breakeven_yield_qt else "BELOW",
            "safety_margin_pct":        round((total_yield_qt - breakeven_yield_qt) /
                                              breakeven_yield_qt * 100, 2) if breakeven_yield_qt > 0 else 0,
        },
        "input_summary": {
            "crop":        crop,
            "region":      region,
            "soil_type":   feature_dict["Soil_Type"],
            "fertilizer":  bool(feature_dict["Fertilizer_Used"]),
            "irrigation":  bool(feature_dict["Irrigation_Used"]),
        },
        "model_version": "v1.0_gradient_boosting",
    }


if __name__ == "__main__":
    print("=== Yield & Profit Estimator Test ===\n")

    test_input = {
        "crop":                  "Rice",
        "region":                "South",
        "soil_type":             "Clay",
        "rainfall_mm":           992.0,
        "temperature_celsius":   25.0,
        "fertilizer_used":       True,
        "irrigation_used":       True,
        "weather_condition":     "Rainy",
        "days_to_harvest":       140,
        "farm_size_acres":       2.5,
        "market_price_per_quintal": 2100,
        "input_cost_per_acre":   12000,
    }

    try:
        result = predict_yield(test_input)
        print(f"Crop:           {result['input_summary']['crop']}")
        print(f"Farm Size:      {result['yield_estimation']['farm_size_acres']} acres")
        print(f"Predicted Yield:{result['yield_estimation']['total_yield_quintals']} quintals")
        print(f"Revenue:        Rs {result['profit_analysis']['total_revenue_rs']:,.2f}")
        print(f"Total Cost:     Rs {result['profit_analysis']['total_cost_rs']:,.2f}")
        print(f"Gross Profit:   Rs {result['profit_analysis']['gross_profit_rs']:,.2f}")
        print(f"Profit Margin:  {result['profit_analysis']['profit_margin_pct']}%")
        print(f"Profitable:     {result['profit_analysis']['is_profitable']}")
        print(f"Breakeven at:   {result['breakeven_analysis']['breakeven_yield_quintals']} quintals")
    except FileNotFoundError as e:
        print(f"[INFO] {e}")
