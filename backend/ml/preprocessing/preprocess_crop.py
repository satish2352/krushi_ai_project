"""
Preprocessing Pipeline: Crop Recommendation
=============================================
Reads Crop_data.csv, applies cleaning, encoding, scaling,
train/test split, and saves the pipeline.
"""

import os, sys, warnings, joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────
BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH  = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "Crop_data.csv"))
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

NUMERIC_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET_COL       = "label"


def load_and_validate(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    assert all(c in df.columns for c in NUMERIC_FEATURES + [TARGET_COL]), \
        f"Missing columns. Expected: {NUMERIC_FEATURES + [TARGET_COL]}"
    print(f"[OK] Loaded {len(df)} rows, {df.shape[1]} columns.")
    return df


def remove_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    before = len(df)
    df = df.drop_duplicates()
    print(f"[INFO] Duplicates removed: {before - len(df)}")
    return df


def handle_missing(df: pd.DataFrame) -> pd.DataFrame:
    """Fill numeric missing values with column median."""
    for col in NUMERIC_FEATURES:
        if df[col].isnull().any():
            median_val = df[col].median()
            df[col].fillna(median_val, inplace=True)
            print(f"[INFO] Filled {col} NaN with median={median_val:.3f}")
    return df


def cap_outliers_iqr(df: pd.DataFrame, cols: list) -> pd.DataFrame:
    """Cap outliers using Tukey's IQR fences (1.5×IQR). Avoids dropping rows."""
    for col in cols:
        Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        IQR    = Q3 - Q1
        lo, hi = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
        before = ((df[col] < lo) | (df[col] > hi)).sum()
        df[col] = df[col].clip(lo, hi)
        if before > 0:
            print(f"[INFO] Capped {before} outliers in '{col}'")
    return df


def encode_target(df: pd.DataFrame) -> tuple[pd.DataFrame, LabelEncoder]:
    le = LabelEncoder()
    df["label_encoded"] = le.fit_transform(df[TARGET_COL])
    print(f"[INFO] Target encoded — {len(le.classes_)} classes: {list(le.classes_)}")
    return df, le


def build_feature_pipeline() -> Pipeline:
    """Sklearn pipeline: StandardScaler on all numeric features."""
    transformer = ColumnTransformer(
        transformers=[
            ("scaler", StandardScaler(), NUMERIC_FEATURES)
        ],
        remainder="drop"
    )
    return Pipeline(steps=[("preprocessing", transformer)])


def run():
    print("\n" + "="*60)
    print("  CROP RECOMMENDATION — Preprocessing Pipeline")
    print("="*60)

    # Load
    df = load_and_validate(DATA_PATH)

    # Clean
    df = remove_duplicates(df)
    df = handle_missing(df)
    df = cap_outliers_iqr(df, NUMERIC_FEATURES)

    # Encode target
    df, label_encoder = encode_target(df)

    # Features & labels
    X = df[NUMERIC_FEATURES].values
    y = df["label_encoded"].values

    # Train/test split — STRATIFIED to preserve class distribution
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y              # Avoids data leakage & class imbalance in splits
    )
    print(f"\n[SPLIT] Train: {X_train.shape}, Test: {X_test.shape}")

    # Build & fit preprocessing pipeline  (fit ONLY on train — avoids leakage!)
    preprocessor = build_feature_pipeline()
    X_train_scaled = preprocessor.fit_transform(
        pd.DataFrame(X_train, columns=NUMERIC_FEATURES)
    )
    X_test_scaled  = preprocessor.transform(
        pd.DataFrame(X_test, columns=NUMERIC_FEATURES)
    )
    print(f"[OK] Scaling applied — Train: {X_train_scaled.shape}, Test: {X_test_scaled.shape}")

    # Verify no NaN leaked
    assert not np.isnan(X_train_scaled).any(), "NaN in train after scaling!"
    assert not np.isnan(X_test_scaled).any(), "NaN in test after scaling!"
    print("[OK] No NaN values after preprocessing.")

    # Save artifacts
    joblib.dump(label_encoder, os.path.join(MODELS_DIR, "crop_label_encoder.pkl"))
    joblib.dump(preprocessor,  os.path.join(MODELS_DIR, "crop_preprocessor.pkl"))
    print(f"\n[Saved] crop_label_encoder.pkl")
    print(f"[Saved] crop_preprocessor.pkl")

    # Feature statistics — useful for API validation
    stats_df = pd.DataFrame(X_train, columns=NUMERIC_FEATURES).describe().T.round(4)
    stats_df.to_csv(os.path.join(MODELS_DIR, "crop_feature_stats.csv"))
    print(f"[Saved] crop_feature_stats.csv")

    return X_train_scaled, X_test_scaled, y_train, y_test, label_encoder, preprocessor


if __name__ == "__main__":
    run()
