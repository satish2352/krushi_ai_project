"""
Preprocessing Pipeline: Crop Yield Estimation
===============================================
Reads crop_yield.csv, applies cleaning, encoding, scaling,
80/20 split, and saves pipeline artifacts.
"""

import os, warnings, joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OrdinalEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

warnings.filterwarnings("ignore")

BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH  = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "crop_yield.csv"))
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

NUMERIC_FEATURES     = ["Rainfall_mm", "Temperature_Celsius", "Days_to_Harvest"]
BOOLEAN_FEATURES     = ["Fertilizer_Used", "Irrigation_Used"]
CATEGORICAL_FEATURES = ["Region", "Soil_Type", "Crop", "Weather_Condition"]
TARGET_COL           = "Yield_tons_per_hectare"
ALL_FEATURES         = NUMERIC_FEATURES + BOOLEAN_FEATURES + CATEGORICAL_FEATURES


def section(t): print(f"\n{'='*60}\n  {t}\n{'='*60}")


def load_and_validate(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"[OK] Loaded {len(df)} rows from {os.path.basename(path)}")
    print(f"     Columns: {list(df.columns)}")
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    # Drop duplicates
    before = len(df)
    df = df.drop_duplicates()
    print(f"[INFO] Duplicates removed: {before - len(df)}")

    # Handle missing
    for col in NUMERIC_FEATURES:
        if col in df.columns and df[col].isnull().any():
            df[col].fillna(df[col].median(), inplace=True)
    for col in CATEGORICAL_FEATURES:
        if col in df.columns and df[col].isnull().any():
            df[col].fillna(df[col].mode()[0], inplace=True)
    for col in BOOLEAN_FEATURES:
        if col in df.columns and df[col].isnull().any():
            df[col].fillna(False, inplace=True)

    # Convert boolean features to int
    for col in BOOLEAN_FEATURES:
        if col in df.columns:
            df[col] = df[col].astype(int)

    print(f"[OK] Missing values handled. Remaining: {df.isnull().sum().sum()}")
    return df


def cap_outliers(df: pd.DataFrame) -> pd.DataFrame:
    for col in NUMERIC_FEATURES + [TARGET_COL]:
        if col in df.columns:
            Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            IQR = Q3 - Q1
            lo, hi = Q1 - 1.5*IQR, Q3 + 1.5*IQR
            cnt = ((df[col] < lo) | (df[col] > hi)).sum()
            df[col] = df[col].clip(lo, hi)
            if cnt > 0:
                print(f"[INFO] Capped {cnt} outliers in '{col}'")
    return df


def build_pipeline(cat_cols, num_cols, bool_cols) -> Pipeline:
    """
    ColumnTransformer pipeline:
    - Numeric: StandardScaler
    - Categorical: OrdinalEncoder (compact, compatible with tree models)
    - Boolean: passthrough (already int 0/1)
    """
    transformers = []
    if num_cols:
        transformers.append(("num", StandardScaler(), num_cols))
    if cat_cols:
        transformers.append(("cat", OrdinalEncoder(
            handle_unknown="use_encoded_value", unknown_value=-1
        ), cat_cols))
    if bool_cols:
        transformers.append(("bool", "passthrough", bool_cols))

    return Pipeline(steps=[
        ("preprocessor", ColumnTransformer(transformers=transformers, remainder="drop"))
    ])


def run():
    section("YIELD ESTIMATION — Preprocessing Pipeline")

    # Load
    df = load_and_validate(DATA_PATH)

    # Reduce dataset size for efficient model training (avoid memory overflow)
    if len(df) > 200000:
        df = df.sample(n=200000, random_state=42)
        print(f"[INFO] Sampled dataset to {len(df)} rows for training efficiency")

    # Clean
    df = clean_data(df)
    df = cap_outliers(df)

    # Validate required columns
    missing_cols = [c for c in ALL_FEATURES + [TARGET_COL] if c not in df.columns]
    if missing_cols:
        print(f"[WARNING] Missing columns: {missing_cols}")
        existing_cat = [c for c in CATEGORICAL_FEATURES if c in df.columns]
        existing_num = [c for c in NUMERIC_FEATURES    if c in df.columns]
        existing_bool = [c for c in BOOLEAN_FEATURES   if c in df.columns]
    else:
        existing_cat  = CATEGORICAL_FEATURES
        existing_num  = NUMERIC_FEATURES
        existing_bool = BOOLEAN_FEATURES

    existing_features = existing_num + existing_bool + existing_cat

    # Features & target
    X = df[existing_features]
    y = df[TARGET_COL].values
    print(f"\n[INFO] Features used: {existing_features}")
    print(f"[INFO] Target range: {y.min():.3f} – {y.max():.3f}")

    # Train/test split — NOT stratified (regression task)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )
    print(f"[SPLIT] Train: {X_train.shape}, Test: {X_test.shape}")

    # Build pipeline — fit ONLY on train
    pipeline = build_pipeline(existing_cat, existing_num, existing_bool)
    X_train_proc = pipeline.fit_transform(X_train)
    X_test_proc  = pipeline.transform(X_test)
    print(f"[OK] Processed — Train: {X_train_proc.shape}, Test: {X_test_proc.shape}")

    # Verify no NaN
    assert not np.isnan(X_train_proc).any(), "NaN in train after preprocessing!"
    assert not np.isnan(X_test_proc).any(), "NaN in test after preprocessing!"
    print("[OK] No NaN values after preprocessing.")

    # Save
    joblib.dump(pipeline,          os.path.join(MODELS_DIR, "yield_preprocessor.pkl"))
    joblib.dump(existing_features, os.path.join(MODELS_DIR, "yield_feature_names.pkl"))
    print("[Saved] yield_preprocessor.pkl")
    print("[Saved] yield_feature_names.pkl")

    return X_train_proc, X_test_proc, y_train, y_test, pipeline, existing_features


if __name__ == "__main__":
    run()
