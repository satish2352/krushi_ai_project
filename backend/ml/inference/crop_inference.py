"""
Inference Layer: Crop Recommendation
======================================
Uses Google Gemini 2.0 Flash to recommend crops based on soil data.
Replaces the ML Random Forest model with Gemini's agricultural reasoning.

Response shape is IDENTICAL to the old ML version — no other files need changing.
"""

import os
import json
import re
import urllib.request
import urllib.error
from typing import Optional

try:
    import joblib
    import numpy as np
    import pandas as pd
    _ML_LIBS_AVAILABLE = True
except ImportError:
    _ML_LIBS_AVAILABLE = False

# ── Config ──────────────────────────────────────────────────────
# Load .env file automatically — works even if VS Code terminal injection is disabled
def _load_env_file():
    """Manually load .env file from backend/api/.env or backend/.env"""
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", "api", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
    ]
    for env_path in possible_paths:
        env_path = os.path.abspath(env_path)
        if os.path.exists(env_path):
            print(f"[CropInference] Loading .env from: {env_path}")
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, val = line.partition("=")
                        key = key.strip()
                        val = val.strip().strip('"').strip("'")
                        if key not in os.environ:
                            os.environ[key] = val
            return
    print("[CropInference] No .env file found — relying on system environment variables")

_load_env_file()

GEMINI_API_KEY  = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL    = "gemini-2.5-flash"
GEMINI_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

# ── Paths ────────────────────────────────────────────────────────
BASE_DIR      = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROFILES_PATH = os.path.join(BASE_DIR, "data", "soil_crop_profiles.json")
MODELS_DIR    = os.path.join(BASE_DIR, "models")

# ── Expected input schema ────────────────────────────────────────
REQUIRED_FIELDS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
FEATURE_ORDER   = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

# ── Yield ranges (domain knowledge, unchanged from original) ─────
YIELD_RANGES = {
    "rice":        {"min_qt": 25,  "max_qt": 60,  "unit": "quintals/acre"},
    "wheat":       {"min_qt": 15,  "max_qt": 45,  "unit": "quintals/acre"},
    "maize":       {"min_qt": 15,  "max_qt": 40,  "unit": "quintals/acre"},
    "chickpea":    {"min_qt": 5,   "max_qt": 15,  "unit": "quintals/acre"},
    "kidneybeans": {"min_qt": 5,   "max_qt": 14,  "unit": "quintals/acre"},
    "pigeonpeas":  {"min_qt": 4,   "max_qt": 12,  "unit": "quintals/acre"},
    "mothbeans":   {"min_qt": 2,   "max_qt": 8,   "unit": "quintals/acre"},
    "mungbean":    {"min_qt": 4,   "max_qt": 10,  "unit": "quintals/acre"},
    "blackgram":   {"min_qt": 4,   "max_qt": 10,  "unit": "quintals/acre"},
    "lentil":      {"min_qt": 5,   "max_qt": 12,  "unit": "quintals/acre"},
    "pomegranate": {"min_qt": 40,  "max_qt": 80,  "unit": "quintals/acre"},
    "banana":      {"min_qt": 80,  "max_qt": 200, "unit": "quintals/acre"},
    "mango":       {"min_qt": 20,  "max_qt": 100, "unit": "quintals/acre"},
    "grapes":      {"min_qt": 60,  "max_qt": 150, "unit": "quintals/acre"},
    "watermelon":  {"min_qt": 80,  "max_qt": 200, "unit": "quintals/acre"},
    "muskmelon":   {"min_qt": 60,  "max_qt": 120, "unit": "quintals/acre"},
    "apple":       {"min_qt": 60,  "max_qt": 150, "unit": "quintals/acre"},
    "orange":      {"min_qt": 40,  "max_qt": 100, "unit": "quintals/acre"},
    "papaya":      {"min_qt": 80,  "max_qt": 180, "unit": "quintals/acre"},
    "coconut":     {"min_qt": 30,  "max_qt": 100, "unit": "nuts/palm/year"},
    "cotton":      {"min_qt": 8,   "max_qt": 20,  "unit": "quintals (lint)/acre"},
    "jute":        {"min_qt": 20,  "max_qt": 40,  "unit": "quintals (fibre)/acre"},
    "coffee":      {"min_qt": 3,   "max_qt": 8,   "unit": "quintals (green)/acre"},
    "jowar":       {"min_qt": 8,   "max_qt": 20,  "unit": "quintals/acre"},
    "bajra":       {"min_qt": 6,   "max_qt": 18,  "unit": "quintals/acre"},
    "groundnut":   {"min_qt": 6,   "max_qt": 15,  "unit": "quintals/acre"},
    "mustard":     {"min_qt": 5,   "max_qt": 12,  "unit": "quintals/acre"},
    "sunflower":   {"min_qt": 6,   "max_qt": 14,  "unit": "quintals/acre"},
    "soybean":     {"min_qt": 8,   "max_qt": 20,  "unit": "quintals/acre"},
}


def _get_yield_range(crop_name: str) -> dict:
    return YIELD_RANGES.get(
        crop_name.lower(),
        {"min_qt": 10, "max_qt": 50, "unit": "quintals/acre"}
    )


def _get_risk_level(confidence: float) -> str:
    if confidence >= 0.75:
        return "Low"
    elif confidence >= 0.50:
        return "Medium"
    else:
        return "High"


def _load_profiles() -> dict:
    if not hasattr(_load_profiles, "_cache"):
        try:
            with open(PROFILES_PATH, "r") as f:
                _load_profiles._cache = json.load(f)
        except Exception:
            _load_profiles._cache = {}
    return _load_profiles._cache


def validate_input(soil_data: dict) -> tuple:
    """Validate soil input. Returns (is_valid, error_message)."""
    for field in REQUIRED_FIELDS:
        if field not in soil_data:
            return False, f"Missing required field: '{field}'"

    VALID_RANGES = {
        "N":           (0, 300),
        "P":           (0, 300),
        "K":           (0, 300),
        "temperature": (-5, 55),
        "humidity":    (0, 100),
        "ph":          (0, 14),
        "rainfall":    (0, 10000),
    }
    for field, (lo, hi) in VALID_RANGES.items():
        val = soil_data.get(field)
        if val is not None:
            try:
                val = float(val)
                if val < lo or val > hi:
                    return False, f"Field '{field}'={val} out of range [{lo}, {hi}]"
            except (ValueError, TypeError):
                return False, f"Field '{field}' must be a number, got: {val}"
    return True, ""


def _call_gemini(prompt: str) -> str:
    """Call Gemini API and return raw text response."""
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY not set. "
            "Get a free key from https://aistudio.google.com/app/apikey "
            "then set it: set GEMINI_API_KEY=your_key_here"
        )

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "recommendations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "rank":              {"type": "integer"},
                                "crop":              {"type": "string"},
                                "confidence":        {"type": "number"},
                                "confidence_pct":    {"type": "string"},
                                "risk_level":        {"type": "string"},
                                "rainfall_suitable": {"type": "boolean"},
                                "rainfall_warning":  {"type": "string"},
                                "reason":            {"type": "string"}
                            },
                            "required": ["rank","crop","confidence","confidence_pct","risk_level","rainfall_suitable","reason"]
                        }
                    },
                    "limiting_factor": {"type": "string"},
                    "farming_season":  {"type": "string"}
                },
                "required": ["recommendations"]
            }
        }
    }).encode("utf-8")

    url = f"{GEMINI_ENDPOINT}?key={GEMINI_API_KEY}"
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    return data["candidates"][0]["content"]["parts"][0]["text"]


# ── Hard rainfall thresholds — Python enforces these, Gemini cannot override ─
CROP_MIN_RAINFALL = {
    "rice": 1200, "paddy": 1200, "sugarcane": 1500, "jute": 1200,
    "banana": 1200, "coconut": 1500, "coffee": 1500,
    "wheat": 450,  "maize": 500,  "cotton": 500,  "soybean": 450,
    "groundnut": 500, "sunflower": 400, "jowar": 300, "sorghum": 300,
    "bajra": 250, "chickpea": 300, "kidneybeans": 350, "pigeonpeas": 650,
    "lentil": 300, "mungbean": 300, "blackgram": 300, "mothbeans": 250,
    "mustard": 300, "papaya": 1000, "mango": 750, "grapes": 700,
    "apple": 1000, "orange": 750, "pomegranate": 500,
    "watermelon": 400, "muskmelon": 400,
}


def _enforce_rainfall(rec: dict, farmer_rainfall: float) -> dict:
    """
    Correct a recommendation dict using hard Python rainfall rules.
    Gemini sometimes marks Rice as rainfall_suitable=True even at 200mm.
    This post-processing step fixes that regardless of what Gemini says.
    """
    crop_lower = rec.get("crop", "").lower()
    min_rain   = next(
        (v for k, v in CROP_MIN_RAINFALL.items()
         if k in crop_lower or crop_lower in k),
        None
    )
    if min_rain is None:
        return rec

    if farmer_rainfall < min_rain * 0.5:
        rec["rainfall_suitable"] = False
        rec["rainfall_warning"]  = (
            f"Needs ~{min_rain}mm/year — you have {round(farmer_rainfall)}mm "
            f"(deficit {round(min_rain - farmer_rainfall)}mm). Will fail without heavy irrigation."
        )
        rec["risk_level"]     = "High"
        rec["confidence"]     = round(min(rec.get("confidence", 0.5) * 0.25, 0.20), 4)
        rec["confidence_pct"] = f"{round(rec['confidence'] * 100, 1)}%"
    elif farmer_rainfall < min_rain * 0.8:
        rec["rainfall_suitable"] = False
        rec["rainfall_warning"]  = (
            f"Needs ~{min_rain}mm — you have {round(farmer_rainfall)}mm. "
            "Supplemental irrigation strongly recommended."
        )
        if rec.get("risk_level") not in ("High",):
            rec["risk_level"] = "Medium"
    else:
        rec["rainfall_suitable"] = True
        rec["rainfall_warning"]  = None

    return rec


def _build_crop_prompt(soil_data: dict, top_n: int) -> str:
    """Build the structured prompt for Gemini crop recommendation."""
    rainfall     = float(soil_data["rainfall"])

    # Drought constraint block — injected as plain string, not inside f-string template
    # to avoid the {{}} escaping conflict with the JSON schema section
    if rainfall < 350:
        drought_block = (
            f"\n⚠️ CRITICAL — FARMER RAINFALL IS ONLY {round(rainfall)}mm/year:\n"
            f"At {round(rainfall)}mm you MUST ONLY recommend drought-tolerant crops: "
            "Bajra, Jowar, Chickpea, Mustard, Mungbean, Mothbeans, Lentil, Blackgram.\n"
            "DO NOT recommend Rice, Wheat, Maize, Cotton, Sugarcane, Soybean, Banana, "
            "Coconut, Coffee, Papaya, Mango, Grapes, Apple, Orange, Pigeonpeas "
            "— these crops WILL FAIL at this rainfall level. "
            "If you recommend any of these crops your answer is WRONG.\n"
        )
    elif rainfall < 600:
        drought_block = (
            f"\n⚠️ LOW RAINFALL — {round(rainfall)}mm/year:\n"
            "Prioritise moderate water-need crops: Jowar, Bajra, Groundnut, Mustard, Chickpea.\n"
            "Avoid Rice (1200mm), Sugarcane (1500mm). Wheat (450mm) and Maize (500mm) are marginal.\n"
        )
    else:
        drought_block = ""

    # Build data section separately — no JSON escaping needed here
    data_section = (
        f"- Nitrogen (N): {soil_data['N']} kg/ha\n"
        f"- Phosphorus (P): {soil_data['P']} kg/ha\n"
        f"- Potassium (K): {soil_data['K']} kg/ha\n"
        f"- Soil pH: {soil_data['ph']}\n"
        f"- Temperature: {soil_data['temperature']}C\n"
        f"- Humidity: {soil_data['humidity']}%\n"
        f"- Annual Rainfall: {rainfall} mm"
    )

    # JSON schema section uses plain string (no f-string) so {} are literal
    json_schema = """{
  "recommendations": [
    {
      "rank": 1,
      "crop": "crop_name_lowercase",
      "confidence": 0.88,
      "confidence_pct": "88.0%",
      "risk_level": "Low",
      "rainfall_suitable": true,
      "rainfall_warning": null,
      "reason": "2-3 sentence explanation referencing actual soil numbers and rainfall",
      "suitable_soils": ["loamy", "clay loam"],
      "description": "brief crop description"
    }
  ],
  "limiting_factor": "rainfall",
  "farming_season": "Kharif",
  "source": "gemini-2.0-flash"
}"""

    # Assemble final prompt via concatenation — no escaping issues
    return (
        "You are an expert Indian agricultural scientist. "
        "Recommend crops for a farmer based on ALL conditions — especially rainfall.\n\n"
        "FARMER SOIL AND CLIMATE DATA:\n"
        + data_section
        + "\n"
        + drought_block
        + "\nRULES (follow strictly):\n"
        "1. Rainfall is the #1 deciding factor. A crop that needs more water than available WILL FAIL.\n"
        "2. Crop minimum annual rainfall: Rice=1200mm, Sugarcane=1500mm, Wheat=450mm, "
        "Maize=500mm, Cotton=500mm, Jowar=300mm, Bajra=250mm, Chickpea=300mm, "
        "Mustard=300mm, Groundnut=500mm, Lentil=300mm, Mungbean=300mm, "
        "Soybean=450mm, Pigeonpeas=650mm, Coffee=1500mm, Banana=1200mm.\n"
        "3. Set rainfall_suitable=false for ANY crop whose minimum > farmer rainfall.\n"
        "4. Confidence for a rainfall-unsuitable crop MUST be below 0.20.\n"
        "5. Rank by suitability for ALL conditions — rainfall + soil + pH together.\n"
        f"6. Recommend exactly {top_n} crops.\n\n"
        "Return ONLY a JSON object. No text outside JSON. No markdown backticks.\n\n"
        + json_schema
    )


def predict_crop(soil_data: dict, top_n: int = 3) -> dict:
    """
    Main crop recommendation — uses Gemini 2.5 Flash.
    Falls back to ML model automatically if Gemini is unavailable.
    Response shape identical to original ML version.
    """
    is_valid, error_msg = validate_input(soil_data)
    if not is_valid:
        return {"error": error_msg, "recommendations": []}

    try:
        # Ask for extra crops so after rainfall enforcement we still have enough suitable ones
        gemini_top_n = top_n + 3
        prompt      = _build_crop_prompt(soil_data, gemini_top_n)
        raw_text    = _call_gemini(prompt)

        clean = raw_text.strip()
        clean = re.sub(r"^```json\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
        gemini_result = json.loads(clean)

    except ValueError as e:
        # No API key
        print(f"[CropInference] {e}")
        return _predict_crop_pkl_fallback(soil_data, top_n)

    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print(f"[CropInference] Gemini network error: {e} — using pkl fallback")
        return _predict_crop_pkl_fallback(soil_data, top_n)

    except (json.JSONDecodeError, KeyError) as e:
        print(f"[CropInference] Gemini response parse error: {e} — using pkl fallback")
        return _predict_crop_pkl_fallback(soil_data, top_n)

    # Enrich with yield ranges and profiles
    profiles        = _load_profiles()
    recommendations = []

    for rec in gemini_result.get("recommendations", [])[:gemini_top_n]:
        crop_lower = rec.get("crop", "").lower().strip()
        profile    = profiles.get(crop_lower, {})
        confidence = float(rec.get("confidence", 0.5))

        enriched = {
            "rank":              rec.get("rank", len(recommendations) + 1),
            "crop":              crop_lower,
            "confidence":        round(confidence, 4),
            "confidence_pct":    rec.get("confidence_pct", f"{round(confidence*100,1)}%"),
            "risk_level":        rec.get("risk_level", _get_risk_level(confidence)),
            "yield_range":       _get_yield_range(crop_lower),
            "description":       rec.get("description") or profile.get("description", ""),
            "suitable_soils":    rec.get("suitable_soils") or profile.get("soil_types", []),
            "reason":            rec.get("reason", ""),
            "rainfall_suitable": rec.get("rainfall_suitable", True),
            "rainfall_warning":  rec.get("rainfall_warning"),
        }
        # Hard enforce rainfall rules — Gemini cannot override Python logic
        farmer_rain = float(soil_data.get("rainfall", 9999))
        enriched = _enforce_rainfall(enriched, farmer_rain)
        recommendations.append(enriched)

    # ── Smart sort: suitable crops ALWAYS before unsuitable ones ──────────────
    # Gemini may return Rice as rank #1 even at 202mm rainfall because it ranks
    # by soil fit alone. We re-sort so rainfall_suitable=True crops lead,
    # then by confidence descending. This prevents AgriShop / LLM from picking
    # a crop that will fail in the farmer's actual climate.
    recommendations.sort(
        key=lambda r: (0 if r.get("rainfall_suitable", True) else 1, -r["confidence"])
    )

    # Trim to requested top_n AFTER sorting so suitable crops are always included
    recommendations = recommendations[:top_n]

    for i, r in enumerate(recommendations, 1):
        r["rank"] = i

    return {
        "recommendations": recommendations,
        "input_summary":   {k: soil_data[k] for k in FEATURE_ORDER},
        "limiting_factor": gemini_result.get("limiting_factor", ""),
        "farming_season":  gemini_result.get("farming_season", ""),
        "model_version":   "gemini-2.5-flash",
    }


def _predict_crop_pkl_fallback(soil_data: dict, top_n: int = 3) -> dict:
    """
    Step 2 fallback — uses trained crop_rf_model.pkl (90.18% accuracy).
    Called when Gemini fails. Falls back to if-else rules if pkl also fails.
    model_version: v2.0_random_forest_pkl
    """
    print("[CropInference] Gemini unavailable — trying Random Forest pkl (90% accuracy)")

    if not _ML_LIBS_AVAILABLE:
        print("[CropInference] joblib/sklearn not installed — falling to rule-based")
        return _predict_crop_ml_fallback(soil_data, top_n)

    try:
        model_path   = os.path.join(MODELS_DIR, "crop_rf_model.pkl")
        prep_path    = os.path.join(MODELS_DIR, "crop_preprocessor.pkl")
        encoder_path = os.path.join(MODELS_DIR, "crop_label_encoder.pkl")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"crop_rf_model.pkl not found at {model_path}")

        model        = joblib.load(model_path)
        preprocessor = joblib.load(prep_path)
        label_encoder= joblib.load(encoder_path)

        # Build input in correct feature order
        NUMERIC_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
        input_df = pd.DataFrame([{
            f: float(soil_data.get(f, 0)) for f in NUMERIC_FEATURES
        }])

        # Scale and predict
        X_scaled     = preprocessor.transform(input_df)
        probabilities= model.predict_proba(X_scaled)[0]   # probability per class
        class_indices= np.argsort(probabilities)[::-1]    # sort by highest prob

        profiles = _load_profiles()
        recommendations = []

        for rank, idx in enumerate(class_indices[:top_n], 1):
            crop       = label_encoder.classes_[idx].lower()
            confidence = round(float(probabilities[idx]), 4)
            profile    = profiles.get(crop, {})

            rec = {
                "rank":             rank,
                "crop":             crop,
                "confidence":       confidence,
                "confidence_pct":   f"{round(confidence * 100, 1)}%",
                "risk_level":       _get_risk_level(confidence),
                "yield_range":      _get_yield_range(crop),
                "description":      profile.get("description", ""),
                "suitable_soils":   profile.get("soil_types", []),
                "reason":           f"Random Forest model selected {crop} based on your soil profile (N={soil_data.get('N')}, P={soil_data.get('P')}, K={soil_data.get('K')}, pH={soil_data.get('ph')}).",
                "rainfall_suitable": True,
                "rainfall_warning":  None,
            }

            # Apply same rainfall enforcement as Gemini path
            farmer_rain = float(soil_data.get("rainfall", 9999))
            rec = _enforce_rainfall(rec, farmer_rain)
            recommendations.append(rec)

        # Same smart sort as Gemini path — rainfall suitable crops first
        recommendations.sort(
            key=lambda r: (0 if r.get("rainfall_suitable", True) else 1, -r["confidence"])
        )
        for i, r in enumerate(recommendations, 1):
            r["rank"] = i

        print(f"[CropInference] pkl fallback success — top crop: {recommendations[0]['crop']} ({recommendations[0]['confidence_pct']})")

        return {
            "recommendations": recommendations,
            "input_summary":   {k: soil_data[k] for k in FEATURE_ORDER},
            "limiting_factor": "",
            "farming_season":  "",
            "model_version":   "v2.0_random_forest_pkl",
        }

    except Exception as e:
        print(f"[CropInference] pkl fallback failed: {e} — falling to rule-based")
        return _predict_crop_ml_fallback(soil_data, top_n)


def _predict_crop_ml_fallback(soil_data: dict, top_n: int = 3) -> dict:
    """
    Dataset-matched rule-based fallback.
    Scores crops by how well input matches actual dataset ranges.
    Designed to match dataset labels — Gemini layer adds agronomy correction later.
    """
    print("[CropInference] Using dataset-matched rule-based fallback")
    try:
        N        = float(soil_data.get("N", 80))
        P        = float(soil_data.get("P", 40))
        K        = float(soil_data.get("K", 40))
        ph       = float(soil_data.get("ph", 6.5))
        rainfall = float(soil_data.get("rainfall", 100))

        # Dataset-derived ranges: (N_min, N_max, P_min, P_max, K_min, K_max, pH_min, pH_max, R_min, R_max)
        DATASET_RANGES = {
            "apple":       (0,   40,  120, 145, 195, 205, 5.5, 6.5, 100, 125),
            "banana":      (80,  120,  70,  95,  45,  55, 5.5, 6.5,  90, 120),
            "blackgram":   (20,   60,  55,  80,  15,  25, 6.5, 7.8,  60,  75),
            "chickpea":    (20,   60,  55,  80,  75,  85, 6.0, 8.9,  65,  95),
            "coconut":     (0,    40,   5,  30,  25,  35, 5.5, 6.5, 131, 226),
            "coffee":      (80,  120,  15,  40,  25,  35, 6.0, 7.5, 115, 199),
            "cotton":      (100, 140,  35,  60,  15,  25, 5.8, 8.0,  61, 100),
            "grapes":      (0,    40, 120, 145, 195, 205, 5.5, 6.5,  65,  75),
            "jute":        (60,  100,  35,  60,  35,  45, 6.0, 7.5, 150, 200),
            "kidneybeans": (0,    40,  55,  80,  15,  25, 5.5, 6.0,  60, 150),
            "lentil":      (0,    40,  55,  80,  15,  25, 5.9, 7.8,  35,  55),
            "maize":       (60,  100,  35,  60,  15,  25, 5.5, 7.0,  61, 110),
            "mango":       (0,    40,  15,  40,  25,  35, 4.5, 7.0,  89, 101),
            "mothbeans":   (0,    40,  35,  60,  15,  25, 3.5, 9.9,  31,  74),
            "mungbean":    (0,    40,  35,  60,  15,  25, 6.2, 7.2,  36,  60),
            "muskmelon":   (80,  120,   5,  30,  45,  55, 6.0, 6.8,  20,  30),
            "orange":      (0,    40,   5,  30,   5,  15, 6.0, 8.0, 100, 120),
            "papaya":      (31,   70,  46,  70,  45,  55, 6.5, 7.0,  40, 249),
            "pigeonpeas":  (0,    40,  55,  80,  15,  25, 4.5, 7.4,  90, 199),
            "pomegranate": (0,    40,   5,  30,  35,  45, 5.6, 7.2, 103, 112),
            "rice":        (60,   99,  35,  60,  35,  45, 5.0, 7.9, 183, 299),
            "watermelon":  (80,  120,   5,  30,  45,  55, 6.0, 7.0,  40,  60),
            # Extra crops from rule system (not in dataset — for Gemini hybrid layer)
            "jowar":       (40,   90,  20,  50,  15,  35, 6.0, 7.5,  25,  80),
            "bajra":       (20,   60,  10,  35,  10,  25, 6.0, 7.5,  20,  60),
            "mustard":     (20,   60,  20,  50,  10,  30, 6.0, 7.5,  25,  55),
            "wheat":       (50,   90,  25,  55,  25,  45, 6.0, 7.5,  40,  80),
            "soybean":     (40,   80,  30,  60,  20,  40, 5.8, 7.0,  50, 100),
            "groundnut":   (20,   50,  30,  60,  20,  40, 5.5, 7.0,  50,  90),
            "sunflower":   (40,   80,  30,  60,  25,  45, 6.0, 7.5,  40,  80),
        }

        def range_score(val, lo, hi):
            """Returns 100 if in range, decreases by distance outside range."""
            if lo <= val <= hi:
                return 100
            dist = min(abs(val - lo), abs(val - hi))
            span = max(hi - lo, 1)
            return max(0, 100 - (dist / span) * 100)

        scored = []
        for crop, (n0,n1, p0,p1, k0,k1, ph0,ph1, r0,r1) in DATASET_RANGES.items():
            n_sc   = range_score(N,        n0,  n1)
            p_sc   = range_score(P,        p0,  p1)
            k_sc   = range_score(K,        k0,  k1)
            ph_sc  = range_score(ph,       ph0, ph1)
            r_sc   = range_score(rainfall, r0,  r1)
            # Rainfall weighted highest — most distinguishing factor
            total = (n_sc * 0.25) + (p_sc * 0.20) + (k_sc * 0.20) + (ph_sc * 0.15) + (r_sc * 0.20)
            scored.append((crop, round(total, 2)))

        scored.sort(key=lambda x: x[1], reverse=True)
        top_crops = scored[:top_n]

        profiles = _load_profiles()
        recommendations = []

        for rank, (crop, score) in enumerate(top_crops, 1):
            confidence = round(min(max(score / 100.0, 0.05), 0.95), 4)
            profile    = profiles.get(crop, {})
            rec = {
                "rank":             rank,
                "crop":             crop,
                "confidence":       confidence,
                "confidence_pct":   f"{round(confidence * 100, 1)}%",
                "risk_level":       _get_risk_level(confidence),
                "yield_range":      _get_yield_range(crop),
                "description":      profile.get("description", ""),
                "suitable_soils":   profile.get("soil_types", []),
                "reason":           "",
                "rainfall_suitable": True,
                "rainfall_warning":  None,
            }
            recommendations.append(rec)

        return {
            "recommendations": recommendations,
            "input_summary":   {k: soil_data[k] for k in FEATURE_ORDER},
            "model_version":   "v3.0_dataset_matched_rules",
        }

    except Exception as e:
        print(f"[CropInference] Dataset-matched fallback failed: {e}")
        return {"recommendations": [], "error": str(e), "input_summary": soil_data}

# ── Soil Gap Analysis (unchanged from original) ───────────────────
def get_soil_gap_analysis(soil_data: dict, desired_crop: str) -> dict:
    """Unchanged from original — uses rule-based profile system."""
    profiles = _load_profiles()
    crop_key = desired_crop.lower().strip()

    if crop_key not in profiles:
        return {"error": f"Crop '{desired_crop}' not in profiles.", "available_crops": list(profiles.keys())}

    profile          = profiles[crop_key]
    gaps             = []
    recommendations  = []
    correction_steps = []

    for nutrient in ["N", "P", "K"]:
        current      = float(soil_data.get(nutrient, 0))
        required_min = profile[nutrient]["min"]
        required_max = profile[nutrient]["max"]
        unit         = profile[nutrient]["unit"]

        if current < required_min:
            deficit = required_min - current
            gaps.append({"nutrient": nutrient, "current": current,
                "required_min": required_min, "required_max": required_max,
                "deficit": round(deficit, 2), "unit": unit, "status": "DEFICIENT",
                "severity": "High" if deficit > required_min * 0.5 else "Medium"})
        elif current > required_max:
            gaps.append({"nutrient": nutrient, "current": current,
                "required_min": required_min, "required_max": required_max,
                "excess": round(current - required_max, 2), "unit": unit,
                "status": "EXCESS", "severity": "Medium"})
        else:
            gaps.append({"nutrient": nutrient, "current": current,
                "required_min": required_min, "required_max": required_max,
                "unit": unit, "status": "OPTIMAL"})

    current_ph = float(soil_data.get("ph", 7.0))
    ph_min     = profile["ph"]["min"]
    ph_max     = profile["ph"]["max"]
    ph_status  = "OPTIMAL"

    if current_ph < ph_min:
        ph_status = "TOO_ACIDIC"
        recommendations.append(f"Apply Agricultural Lime to raise pH from {current_ph} to {ph_min}-{ph_max}. Approx {round((ph_min - current_ph) * 200)} kg/acre")
        correction_steps.append(f"Step 1: Spread {round((ph_min - current_ph)*200)} kg/acre lime into top 15cm soil. Wait 2-3 weeks before seeding.")
    elif current_ph > ph_max:
        ph_status = "TOO_ALKALINE"
        recommendations.append(f"Apply Gypsum or Elemental Sulphur to lower pH from {current_ph} to {ph_min}-{ph_max}.")
        correction_steps.append("Step 1: Apply Gypsum @ 5-10 kg/acre. Irrigate well. Retest after 4 weeks.")

    fertilizer_plan = []
    step_num        = len(correction_steps) + 1

    for gap in gaps:
        if gap["status"] == "DEFICIENT":
            nutrient = gap["nutrient"]
            deficit  = gap.get("deficit", 0)
            if nutrient == "N":
                urea_qty = round(deficit * 2.17, 1)
                fertilizer_plan.append({"nutrient": "Nitrogen (N)", "product": "Urea (46% N)",
                    "quantity_kg_acre": urea_qty, "application": "Split: 50% basal + 25% tillering + 25% heading", "alternative": "DAP"})
                correction_steps.append(f"Step {step_num}: Apply Urea @ {urea_qty} kg/acre in 2-3 splits.")
            elif nutrient == "P":
                dap_qty = round(deficit * 2.17, 1)
                fertilizer_plan.append({"nutrient": "Phosphorus (P)", "product": "DAP (46% P2O5)",
                    "quantity_kg_acre": dap_qty, "application": "Basal application before sowing", "alternative": "SSP"})
                correction_steps.append(f"Step {step_num}: Apply DAP @ {dap_qty} kg/acre as basal dose.")
            elif nutrient == "K":
                mop_qty = round(deficit * 1.67, 1)
                fertilizer_plan.append({"nutrient": "Potassium (K)", "product": "MOP (60% K2O)",
                    "quantity_kg_acre": mop_qty, "application": "Basal or split with N", "alternative": "SOP"})
                correction_steps.append(f"Step {step_num}: Apply MOP @ {mop_qty} kg/acre.")
            step_num += 1

    micronutrient_plan = profile.get("micronutrients", [])
    if micronutrient_plan:
        correction_steps.append(f"Step {step_num}: Apply micronutrients: {', '.join(micronutrient_plan)}. Foliar spray recommended.")

    correction_steps.append(f"Step {step_num+1}: Wait 3-4 weeks after correction, take fresh soil test, re-upload for updated recommendation.")

    return {
        "desired_crop": desired_crop,
        "nutrient_gaps": gaps,
        "ph_analysis": {"current": current_ph, "required_min": ph_min, "required_max": ph_max, "status": ph_status},
        "fertilizer_plan": fertilizer_plan,
        "micronutrient_plan": micronutrient_plan,
        "pesticide_advisory": profile.get("pesticides", []),
        "general_recommendations": recommendations,
        "correction_steps": correction_steps,
        "suitable_soil_types": profile.get("soil_types", []),
        "crop_description": profile.get("description", ""),
    }


if __name__ == "__main__":
    print("=== Gemini Crop Recommendation Test ===\n")
    test_soil = {"N": 90, "P": 42, "K": 43, "temperature": 20.9, "humidity": 82.0, "ph": 6.5, "rainfall": 202.9}
    print("Input:", test_soil)
    print(f"API key set: {'Yes' if GEMINI_API_KEY else 'NO — set GEMINI_API_KEY first'}\n")
    result = predict_crop(test_soil, top_n=3)
    print(f"Model: {result.get('model_version')}  |  Limiting factor: {result.get('limiting_factor')}")
    for rec in result["recommendations"]:
        print(f"  #{rec['rank']} {rec['crop']:15s} {rec['confidence_pct']:6s}  Risk: {rec['risk_level']}")
        if rec.get("rainfall_warning"):
            print(f"       WARNING: {rec['rainfall_warning']}")
        if rec.get("reason"):
            print(f"       Reason: {rec['reason'][:90]}")
