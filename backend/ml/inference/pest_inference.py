"""
Inference Layer: Pest Risk Prediction
=======================================
Clean wrapper for pest risk classification model.
Returns risk level, probability, and preventive advisory.
"""

import os
import joblib
import numpy as np
import pandas as pd

BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(BASE_DIR, "models")

DAMAGE_LABELS = {0: "No Damage", 1: "Low Damage", 2: "High Damage"}
RISK_LEVELS   = {0: "Low",        1: "Medium",      2: "High"}

# Domain: Preventive recommendations by damage level + season
PREVENTIVE_ADVICE = {
    0: [
        "Continue current pest monitoring schedule.",
        "Apply Neem-based spray (Azadirachtin) as preventive measure.",
        "Maintain field hygiene — remove crop residues.",
    ],
    1: [
        "Increase scouting frequency to 2× per week.",
        "Apply recommended pesticide at early infestation stage.",
        "Consider pheromone traps for bollworm / stem borer monitoring.",
        "Spray Chlorpyrifos 20EC @ 2 ml/litre water.",
    ],
    2: [
        "URGENT: High damage risk. Immediate intervention required.",
        "Apply systemic pesticide: Imidacloprid 17.8SL @ 0.5 ml/litre.",
        "For fungal diseases: Carbendazim 50WP @ 2 g/litre.",
        "Consult local KVK (Krishi Vigyan Kendra) for crop-specific protocol.",
        "Consider crop insurance claim if losses exceed 33%.",
        "Avoid irrigation during heavy pest activity.",
    ],
}

SEASON_MAP = {1: "Rabi (Winter)", 2: "Kharif (Monsoon)", 3: "Zaid (Summer)"}


def _load_artifacts():
    if not hasattr(_load_artifacts, "_cache"):
        model_path    = os.path.join(MODELS_DIR, "pest_risk_model.pkl")
        prep_path     = os.path.join(MODELS_DIR, "pest_preprocessor.pkl")
        features_path = os.path.join(MODELS_DIR, "pest_feature_names.pkl")

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model not found: {model_path}\n"
                "Run: python ml/training/train_pest_risk.py"
            )

        _load_artifacts._cache = {
            "model":         joblib.load(model_path),
            "preprocessor":  joblib.load(prep_path),
            "feature_names": joblib.load(features_path),
        }
    return _load_artifacts._cache


def validate_pest_input(data: dict) -> tuple[bool, str]:
    """Validate pest risk prediction inputs."""
    if "insects_count" not in data:
        return False, "Missing field: 'insects_count'"

    try:
        val = float(data["insects_count"])
        if val < 0:
            return False, "insects_count must be >= 0"
    except (ValueError, TypeError):
        return False, "insects_count must be numeric"

    season = data.get("season", 1)
    if season not in [1, 2, 3]:
        return False, "season must be 1 (Rabi), 2 (Kharif), or 3 (Zaid)"

    return True, ""


def predict_pest_risk(data: dict) -> dict:
    """
    Predict pest/crop damage risk.

    Args:
        data: dict with keys:
            - insects_count (float)            : Estimated insect count (required)
            - crop_type (int)                  : 0=Cereals, 1=Pulses, 2=Oilseeds (default 1)
            - soil_type (int)                  : 0=Sandy, 1=Loam, 2=Clay (default 1)
            - pesticide_use_category (int)     : 0=None, 1=Organic, 2=Chemical (default 1)
            - number_doses_week (float)        : doses applied per week (default 0)
            - number_weeks_used (float)        : weeks pesticide used (default 0)
            - number_weeks_quit (float)        : weeks since last pesticide (default 0)
            - season (int)                     : 1=Rabi, 2=Kharif, 3=Zaid (default 2)

    Returns:
        dict with risk_level, damage_class, confidence, advisory
    """
    is_valid, error = validate_pest_input(data)
    if not is_valid:
        return {"error": error}

    artifacts     = _load_artifacts()
    model         = artifacts["model"]
    preprocessor  = artifacts["preprocessor"]
    feature_names = artifacts["feature_names"]

    # Map input keys to training column names
    feature_map = {
        "Estimated_Insects_Count": float(data.get("insects_count", 0)),
        "Crop_Type":               int(data.get("crop_type", 1)),
        "Soil_Type":               int(data.get("soil_type", 1)),
        "Pesticide_Use_Category":  int(data.get("pesticide_use_category", 1)),
        "Number_Doses_Week":       float(data.get("number_doses_week", 0)),
        "Number_Weeks_Used":       float(data.get("number_weeks_used", 0)),
        "Number_Weeks_Quit":       float(data.get("number_weeks_quit", 0)),
        "Season":                  int(data.get("season", 2)),
    }

    # Build DataFrame in correct feature order
    input_df   = pd.DataFrame([{f: feature_map.get(f) for f in feature_names}])
    X_processed = preprocessor.transform(input_df)

    # Predict
    damage_class = int(model.predict(X_processed)[0])
    try:
        proba        = model.predict_proba(X_processed)[0]
        confidence   = float(proba[damage_class])
        all_proba    = {DAMAGE_LABELS[i]: round(float(p), 4) for i, p in enumerate(proba)}
    except AttributeError:
        confidence = 1.0
        all_proba  = {}

    season_num = int(data.get("season", 2))

    return {
        "damage_class":    damage_class,
        "damage_label":    DAMAGE_LABELS[damage_class],
        "risk_level":      RISK_LEVELS[damage_class],
        "confidence":      round(confidence, 4),
        "confidence_pct":  f"{round(confidence*100, 1)}%",
        "all_probabilities": all_proba,
        "season":          SEASON_MAP.get(season_num, "Unknown"),
        "preventive_advisory": PREVENTIVE_ADVICE[damage_class],
        "urgency":         "IMMEDIATE" if damage_class == 2 else (
                           "MONITOR"   if damage_class == 1 else "ROUTINE"),
        "model_version":   "v1.0_random_forest",
    }


if __name__ == "__main__":
    print("=== Pest Risk Inference Test ===\n")

    # Low risk scenario
    low_risk = {"insects_count": 50, "season": 1, "pesticide_use_category": 2}
    # High risk scenario
    high_risk = {"insects_count": 800, "season": 2, "pesticide_use_category": 0,
                 "number_weeks_quit": 4}

    for scenario, test_input in [("Low Risk", low_risk), ("High Risk", high_risk)]:
        print(f"--- {scenario} Scenario ---")
        try:
            result = predict_pest_risk(test_input)
            print(f"Damage Class   : {result['damage_class']} ({result['damage_label']})")
            print(f"Risk Level     : {result['risk_level']}")
            print(f"Confidence     : {result['confidence_pct']}")
            print(f"Urgency        : {result['urgency']}")
            print(f"Advisory:")
            for a in result["preventive_advisory"]:
                print(f"  • {a}")
        except FileNotFoundError as e:
            print(f"[INFO] {e}")
        print()
