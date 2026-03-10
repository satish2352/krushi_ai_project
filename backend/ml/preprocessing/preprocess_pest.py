"""
Preprocessing Pipeline: Pest Risk Dataset
==========================================
Reads train_yaOffsB.csv, applies cleaning, encoding, scaling,
stratified train/test split, and saves pipeline.
"""

import os, warnings, joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

warnings.filterwarnings("ignore")

BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH  = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "train_yaOffsB.csv"))
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

NUMERIC_FEATURES     = ["Estimated_Insects_Count", "Number_Doses_Week",
                         "Number_Weeks_Used", "Number_Weeks_Quit"]
CATEGORICAL_FEATURES = ["Crop_Type", "Soil_Type", "Pesticide_Use_Category", "Season"]
TARGET_COL           = "Crop_Damage"
DROP_COLS            = ["ID"]


def section(t): print(f"\n{'='*60}\n  {t}\n{'='*60}")


def load_and_validate(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"[OK] Loaded {len(df)} rows from {os.path.basename(path)}")
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    # Drop ID
    for col in DROP_COLS:
        if col in df.columns:
            df = df.drop(columns=[col])
            print(f"[INFO] Dropped column: {col}")

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

    # Validate target values
    valid_targets = {0, 1, 2}
    invalid_target_rows = ~df[TARGET_COL].isin(valid_targets)
    if invalid_target_rows.any():
        print(f"[WARNING] Dropping {invalid_target_rows.sum()} rows with invalid target values.")
        df = df[~invalid_target_rows]

    print(f"[OK] After cleaning: {len(df)} rows, missing: {df.isnull().sum().sum()}")
    return df


def cap_outliers(df: pd.DataFrame) -> pd.DataFrame:
    for col in NUMERIC_FEATURES:
        if col in df.columns:
            Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            IQR = Q3 - Q1
            cnt = ((df[col] < Q1-1.5*IQR) | (df[col] > Q3+1.5*IQR)).sum()
            df[col] = df[col].clip(Q1 - 1.5*IQR, Q3 + 1.5*IQR)
            if cnt > 0:
                print(f"[INFO] Capped {cnt} outliers in '{col}'")
    return df


def build_pipeline(num_cols: list, cat_cols: list) -> Pipeline:
    """
    Numeric: StandardScaler
    Categorical: Already numeric-encoded in this dataset → passthrough
    """
    transformers = []
    if num_cols:
        transformers.append(("num", StandardScaler(), num_cols))
    if cat_cols:
        # These are already integer-encoded in the dataset
        transformers.append(("cat", "passthrough", cat_cols))

    return Pipeline(steps=[
        ("preprocessor", ColumnTransformer(transformers=transformers, remainder="drop"))
    ])


def run():
    section("PEST RISK — Preprocessing Pipeline")

    df = load_and_validate(DATA_PATH)
    df = clean_data(df)
    df = cap_outliers(df)

    existing_num = [c for c in NUMERIC_FEATURES     if c in df.columns]
    existing_cat = [c for c in CATEGORICAL_FEATURES if c in df.columns]
    all_features = existing_num + existing_cat

    X = df[all_features]
    y = df[TARGET_COL].values

    print(f"\n[INFO] Features: {all_features}")
    print(f"[INFO] Target distribution: {dict(pd.Series(y).value_counts().sort_index())}")

    # Stratified split — essential for classification
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"[SPLIT] Train: {X_train.shape}, Test: {X_test.shape}")

    # Build pipeline — fit ONLY on train to prevent leakage
    pipeline = build_pipeline(existing_num, existing_cat)
    X_train_proc = pipeline.fit_transform(X_train)
    X_test_proc  = pipeline.transform(X_test)

    assert not np.isnan(X_train_proc).any(), "NaN in train!"
    assert not np.isnan(X_test_proc).any(), "NaN in test!"
    print(f"[OK] Processed — Train: {X_train_proc.shape}, Test: {X_test_proc.shape}")

    # Save
    joblib.dump(pipeline,      os.path.join(MODELS_DIR, "pest_preprocessor.pkl"))
    joblib.dump(all_features,  os.path.join(MODELS_DIR, "pest_feature_names.pkl"))
    print("[Saved] pest_preprocessor.pkl")
    print("[Saved] pest_feature_names.pkl")

    return X_train_proc, X_test_proc, y_train, y_test, pipeline, all_features


if __name__ == "__main__":
    run()
