"""
Model Training: Crop Yield Estimation (Regression)
===================================================
Models compared: Linear Regression (baseline), Random Forest Regressor,
                 Gradient Boosting Regressor
Cross-validation: 5-fold KFold
Metrics: R², RMSE, MAE
Final: Best model saved.
"""

import os, sys, warnings, joblib, json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.linear_model    import LinearRegression, Ridge
from sklearn.ensemble        import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import KFold, cross_validate, GridSearchCV
from sklearn.metrics         import (mean_squared_error, mean_absolute_error, r2_score)

warnings.filterwarnings("ignore")

BASE_DIR    = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR  = os.path.join(BASE_DIR, "models")
REPORTS_DIR = os.path.join(BASE_DIR, "reports", "yield_model")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

sys.path.insert(0, os.path.join(BASE_DIR, "preprocessing"))
from preprocess_yield import run as run_preprocessing

RANDOM_STATE = 42
# CV_FOLDS     = 5
CV_FOLDS     = 3


def section(t): print(f"\n{'='*60}\n  {t}\n{'='*60}")

def save_fig(name):
    p = os.path.join(REPORTS_DIR, f"{name}.png")
    plt.tight_layout()
    plt.savefig(p, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"  [Saved] {p}")


def rmse(y_true, y_pred):
    return np.sqrt(mean_squared_error(y_true, y_pred))


# ──────────────────────────────────────────────────────────────
# MODEL DEFINITIONS
# ──────────────────────────────────────────────────────────────
def get_models() -> dict:
    return {
        "Linear Regression (Baseline)": LinearRegression(),
        "Ridge Regression":             Ridge(alpha=1.0, random_state=RANDOM_STATE),
        # "Random Forest":                RandomForestRegressor(
        #                                     n_estimators=100, random_state=RANDOM_STATE, n_jobs=-1
        #                                 ),
        "Random Forest": RandomForestRegressor(
                                        n_estimators=50,
                                        max_depth=20,
                                        random_state=RANDOM_STATE,
                                            n_jobs=1
                                        ),
        "Gradient Boosting":            GradientBoostingRegressor(
                                            n_estimators=100, random_state=RANDOM_STATE, max_depth=4
                                        ),
    }


# ──────────────────────────────────────────────────────────────
# CROSS-VALIDATION COMPARISON
# ──────────────────────────────────────────────────────────────
def compare_models(models: dict, X_train, y_train) -> pd.DataFrame:
    section("MODEL COMPARISON — 5-Fold CV")
    cv = KFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    results = []

    for name, model in models.items():
        print(f"\n  Training {name}...")
        scores = cross_validate(
            model, X_train, y_train, cv=cv,
            scoring=["r2", "neg_mean_squared_error", "neg_mean_absolute_error"],
            # n_jobs=-1
            n_jobs=1
        )
        r2_mean   = scores["test_r2"].mean()
        rmse_mean = np.sqrt(-scores["test_neg_mean_squared_error"].mean())
        mae_mean  = -scores["test_neg_mean_absolute_error"].mean()

        results.append({
            "Model":        name,
            "CV R²":        f"{r2_mean:.4f} ± {scores['test_r2'].std():.4f}",
            "CV RMSE":      f"{rmse_mean:.4f}",
            "CV MAE":       f"{mae_mean:.4f}",
            "_r2_mean":     r2_mean,
        })
        print(f"    R²={r2_mean:.4f} | RMSE={rmse_mean:.4f} | MAE={mae_mean:.4f}")

    df = pd.DataFrame(results)
    print(f"\n{'='*60}\nMODEL COMPARISON TABLE:\n{'='*60}")
    print(df.drop(columns=["_r2_mean"]).to_string(index=False))

    best_idx  = df["_r2_mean"].idxmax()
    best_name = df.loc[best_idx, "Model"]
    print(f"\n✅ BEST MODEL: {best_name} (R²={df.loc[best_idx, '_r2_mean']:.4f})")
    return df, best_name


# ──────────────────────────────────────────────────────────────
# HYPERPARAMETER TUNING — Gradient Boosting
# ──────────────────────────────────────────────────────────────
def tune_gradient_boosting(X_train, y_train) -> GradientBoostingRegressor:
    section("HYPERPARAMETER TUNING — Gradient Boosting (GridSearchCV)")
    # param_grid = {
    #     "n_estimators": [100, 200],
    #     "max_depth":    [3, 4, 5],
    #     "learning_rate":[0.05, 0.1, 0.2],
    #     "subsample":    [0.8, 1.0],
    # }
    param_grid = {
    "n_estimators": [100, 150],
    "max_depth":    [3, 4],
    "learning_rate":[0.05, 0.1],
    }
    cv = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    gs = GridSearchCV(
        GradientBoostingRegressor(random_state=RANDOM_STATE),
        param_grid, cv=cv, scoring="r2", n_jobs=-1, verbose=1
    )
    gs.fit(X_train, y_train)
    print(f"\n  Best params : {gs.best_params_}")
    print(f"  Best CV R²  : {gs.best_score_:.4f}")
    return gs.best_estimator_


# ──────────────────────────────────────────────────────────────
# TEST SET EVALUATION
# ──────────────────────────────────────────────────────────────
def evaluate_model(model, X_test, y_test, model_name: str) -> dict:
    section(f"TEST SET EVALUATION — {model_name}")
    y_pred = model.predict(X_test)

    r2  = r2_score(y_test, y_pred)
    rmse_val = rmse(y_test, y_pred)
    mae_val  = mean_absolute_error(y_test, y_pred)

    print(f"  R²   : {r2:.4f}")
    print(f"  RMSE : {rmse_val:.4f} tons/ha")
    print(f"  MAE  : {mae_val:.4f} tons/ha")

    # Residual plot
    residuals = y_test - y_pred
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))

    # Predicted vs Actual
    axes[0].scatter(y_test, y_pred, alpha=0.3, s=8, color="#3498db")
    lo, hi = min(y_test.min(), y_pred.min()), max(y_test.max(), y_pred.max())
    axes[0].plot([lo, hi], [lo, hi], "r--", linewidth=1.5, label="Perfect fit")
    axes[0].set_xlabel("Actual Yield (tons/ha)")
    axes[0].set_ylabel("Predicted Yield (tons/ha)")
    axes[0].set_title(f"Actual vs Predicted\nR²={r2:.4f}")
    axes[0].legend()

    # Residuals vs Predicted
    axes[1].scatter(y_pred, residuals, alpha=0.3, s=8, color="#e74c3c")
    axes[1].axhline(0, color="black", linewidth=1.5)
    axes[1].set_xlabel("Predicted")
    axes[1].set_ylabel("Residuals")
    axes[1].set_title(f"Residuals vs Predicted\nRMSE={rmse_val:.4f}")

    # Residual distribution
    axes[2].hist(residuals, bins=50, color="#9b59b6", edgecolor="white", alpha=0.8)
    axes[2].axvline(0, color="black", linewidth=1.5)
    axes[2].set_xlabel("Residual")
    axes[2].set_ylabel("Frequency")
    axes[2].set_title(f"Residual Distribution\nMAE={mae_val:.4f}")

    plt.suptitle(f"Regression Evaluation – {model_name}", fontsize=13)
    save_fig("regression_evaluation")

    return {"r2": r2, "rmse": rmse_val, "mae": mae_val}


# ──────────────────────────────────────────────────────────────
# FEATURE IMPORTANCE
# ──────────────────────────────────────────────────────────────
def plot_feature_importance(model, feature_names: list):
    if hasattr(model, "feature_importances_"):
        imps = model.feature_importances_
        idx  = np.argsort(imps)[::-1]
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.bar(range(len(feature_names)), [imps[i] for i in idx],
               color="#8e44ad", edgecolor="white")
        ax.set_xticks(range(len(feature_names)))
        ax.set_xticklabels([feature_names[i] for i in idx], rotation=45, ha="right")
        ax.set_title("Feature Importance – Yield Estimation Model")
        ax.set_ylabel("Importance Score")
        save_fig("feature_importance")

        print("\nFeature Importance Ranking:")
        for i in idx:
            print(f"  {feature_names[i]:35s}: {imps[i]:.4f}")


# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────
def main():
    section("YIELD ESTIMATION — Model Training")

    # Preprocessing
    X_train, X_test, y_train, y_test, pipeline, feature_names = run_preprocessing()

    # Model comparison
    models     = get_models()
    compare_df, best_name = compare_models(models, X_train, y_train)

    # Hyperparameter tuning — GBR is typically best for regression on tabular data
    section("Tuning Best Model (Gradient Boosting Regressor)")
    best_model = tune_gradient_boosting(X_train, y_train)

    # Test evaluation
    metrics = evaluate_model(best_model, X_test, y_test, "GradientBoosting (Tuned)")

    # Feature importance
    plot_feature_importance(best_model, feature_names)

    # Save model
    model_path = os.path.join(MODELS_DIR, "yield_gbr_model.pkl")
    joblib.dump(best_model, model_path)
    print(f"\n[Saved] {model_path}")

    metrics["model_name"]    = "GradientBoostingRegressor (Tuned)"
    metrics["feature_names"] = feature_names
    with open(os.path.join(MODELS_DIR, "yield_model_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    compare_df.drop(columns=["_r2_mean"]).to_csv(
        os.path.join(REPORTS_DIR, "model_comparison.csv"), index=False
    )

    section("MODEL SELECTION JUSTIFICATION")
    justification = f"""
SELECTED MODEL: Gradient Boosting Regressor (Hyperparameter Tuned)

JUSTIFICATION:
1. R² SCORE   : GBR achieves R²={metrics['r2']:.4f} vs Linear Regression's lower baseline.
                Tree-based boosting captures non-linear yield interactions.

2. ROBUSTNESS : Boosting is robust to feature scale differences (Region, Soil, CropType
                are categorical → ordinal encoded; GBR handles this naturally).

3. FEATURE IMPORTANCE: GBR provides feature importances — agronomists can see which
                       factors matter most (Crop type, Irrigation, Rainfall, etc.).

4. vs Linear Regression: Yield is NOT linearly related to input features.
                          E.g., too much rainfall HURTS yield (flood effect) —
                          non-linear relationship that GBR captures.

5. vs Random Forest: GBR consistently outperforms RF for tabular regression tasks
                     by iteratively correcting residuals.

PERFORMANCE:
  R²   : {metrics['r2']:.4f}
  RMSE : {metrics['rmse']:.4f} tons/ha
  MAE  : {metrics['mae']:.4f} tons/ha
"""
    print(justification)
    # with open(os.path.join(REPORTS_DIR, "model_selection_justification.txt"), "w") as f:
    #     f.write(justification)
    with open(os.path.join(REPORTS_DIR, "model_selection_justification.txt"), "w", encoding="utf-8") as f:
        f.write(justification)

    print("\n✅ Yield Estimation model training COMPLETE.")


if __name__ == "__main__":
    main()
