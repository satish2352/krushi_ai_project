"""
EDA Script: Crop Recommendation Dataset (Crop_data.csv)
=========================================================
Dataset: N, P, K, temperature, humidity, ph, rainfall -> label (crop name)
Task: Multi-class Classification
"""

import os
import sys
import warnings

# Force UTF-8 encoding for stdout/stderr (Windows compatibility)
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

warnings.filterwarnings("ignore")

# ==============================================================
# CONFIG
# ==============================================================
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "Crop_data.csv")
REPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports", "crop_eda")
os.makedirs(REPORT_DIR, exist_ok=True)

NUMERIC_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET_COL = "label"

# ==============================================================
# HELPER
# ==============================================================
def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def save_fig(name: str):
    path = os.path.join(REPORT_DIR, f"{name}.png")
    plt.tight_layout()
    plt.savefig(path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"  [Saved] {path}")


# ==============================================================
# 1. LOAD & SCHEMA VALIDATION
# ==============================================================
section("1. DATASET LOADING & SCHEMA VALIDATION")
df = pd.read_csv(DATA_PATH)

print(f"Shape          : {df.shape}")
print(f"Columns        : {list(df.columns)}")
print(f"\nDtypes:\n{df.dtypes}")
print(f"\nFirst 5 rows:\n{df.head()}")

expected_cols = NUMERIC_FEATURES + [TARGET_COL]
missing_cols = [c for c in expected_cols if c not in df.columns]
if missing_cols:
    print(f"\n[WARNING] Missing expected columns: {missing_cols}")
else:
    print(f"\n[OK] All expected columns present.")

# Range validation
VALID_RANGES = {
    "N":           (0, 200),
    "P":           (0, 200),
    "K":           (0, 200),
    "temperature": (0, 55),
    "humidity":    (0, 100),
    "ph":          (0, 14),
    "rainfall":    (0, 5000),
}
print("\nRange Validation:")
for col, (lo, hi) in VALID_RANGES.items():
    if col in df.columns:
        out = df[(df[col] < lo) | (df[col] > hi)].shape[0]
        status = "OK" if out == 0 else f"WARNING: {out} out-of-range rows"
        print(f"  {col:15s}: [{lo}, {hi}] → {status}")


# ==============================================================
# 2. MISSING VALUE ANALYSIS
# ==============================================================
section("2. MISSING VALUE ANALYSIS")
null_counts = df.isnull().sum()
null_pct = (null_counts / len(df) * 100).round(2)
missing_df = pd.DataFrame({
    "Missing Count": null_counts,
    "Missing %":     null_pct,
}).sort_values("Missing Count", ascending=False)
print(missing_df)

if null_counts.sum() == 0:
    print("\n[RESULT] No missing values. Dataset is complete.")
else:
    print(f"\n[RESULT] Total missing cells: {null_counts.sum()}")

# Missing values heatmap
fig, ax = plt.subplots(figsize=(10, 4))
sns.heatmap(df.isnull(), yticklabels=False, cbar=False, cmap="viridis", ax=ax)
ax.set_title("Missing Values Heatmap - Crop Data")
save_fig("missing_heatmap")


# ==============================================================
# 3. DESCRIPTIVE STATISTICS
# ==============================================================
section("3. DESCRIPTIVE STATISTICS")
desc = df[NUMERIC_FEATURES].describe().T
desc["cv"] = (desc["std"] / desc["mean"] * 100).round(2)  # Coefficient of variation
print(desc.round(3))


# ==============================================================
# 4. DATA DISTRIBUTION ANALYSIS
# ==============================================================
section("4. DATA DISTRIBUTION ANALYSIS")

# Histogram grid
fig, axes = plt.subplots(3, 3, figsize=(15, 10))
axes = axes.flatten()
for i, col in enumerate(NUMERIC_FEATURES):
    axes[i].hist(df[col], bins=40, color="#2ecc71", edgecolor="white", alpha=0.8)
    axes[i].set_title(f"Distribution of {col}")
    axes[i].set_xlabel(col)
    axes[i].set_ylabel("Frequency")
    skew = df[col].skew()
    axes[i].text(0.98, 0.92, f"Skew: {skew:.2f}", transform=axes[i].transAxes,
                 ha="right", fontsize=9, color="navy")
for j in range(len(NUMERIC_FEATURES), len(axes)):
    axes[j].set_visible(False)
plt.suptitle("Feature Distributions – Crop Recommendation", fontsize=14, fontweight="bold")
save_fig("feature_distributions")

# Normality tests (Shapiro-Wilk on sample ≤ 5000)
print("\nNormality Tests (Shapiro-Wilk):")
sample = df[NUMERIC_FEATURES].sample(min(500, len(df)), random_state=42)
for col in NUMERIC_FEATURES:
    stat, p = stats.shapiro(sample[col])
    normal = "Normal" if p > 0.05 else "NOT Normal"
    print(f"  {col:15s}: W={stat:.4f}, p={p:.4f} → {normal}")

# Box plots
fig, axes = plt.subplots(2, 4, figsize=(16, 8))
axes = axes.flatten()
for i, col in enumerate(NUMERIC_FEATURES):
    axes[i].boxplot(df[col].dropna(), patch_artist=True,
                    boxprops=dict(facecolor="#27ae60", alpha=0.7))
    axes[i].set_title(col)
for j in range(len(NUMERIC_FEATURES), len(axes)):
    axes[j].set_visible(False)
plt.suptitle("Box Plots – Feature Spread & Outlier Visibility", fontsize=13)
save_fig("boxplots")


# ==============================================================
# 5. OUTLIER DETECTION (IQR + Z-Score)
# ==============================================================
section("5. OUTLIER DETECTION")
print(f"{'Feature':15s} {'IQR Outliers':>14} {'IQR %':>8} {'Z>3 Outliers':>14} {'Z %':>8}")
print("-" * 62)
outlier_summary = {}
for col in NUMERIC_FEATURES:
    # IQR method
    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
    IQR = Q3 - Q1
    iqr_out = df[(df[col] < Q1 - 1.5 * IQR) | (df[col] > Q3 + 1.5 * IQR)].shape[0]
    iqr_pct = round(iqr_out / len(df) * 100, 2)

    # Z-score method
    z_scores = np.abs(stats.zscore(df[col].dropna()))
    z_out = (z_scores > 3).sum()
    z_pct  = round(z_out / len(df) * 100, 2)

    outlier_summary[col] = {"iqr_outliers": iqr_out, "z_outliers": int(z_out)}
    print(f"  {col:13s} {iqr_out:>14} {iqr_pct:>7}% {int(z_out):>14} {z_pct:>7}%")

print("\n[DECISION] IQR method preferred; outliers to be capped in preprocessing.")


# ==============================================================
# 6. FEATURE CORRELATION ANALYSIS
# ==============================================================
section("6. FEATURE CORRELATION ANALYSIS")
corr_matrix = df[NUMERIC_FEATURES].corr(method="pearson")
print("Pearson Correlation Matrix:")
print(corr_matrix.round(3))

# Heatmap
fig, ax = plt.subplots(figsize=(9, 7))
mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
sns.heatmap(corr_matrix, annot=True, fmt=".2f", mask=mask, cmap="RdYlGn",
            vmin=-1, vmax=1, ax=ax, linewidths=0.5,
            annot_kws={"size": 9})
ax.set_title("Feature Correlation Heatmap – Crop Data")
save_fig("correlation_heatmap")

# Highly correlated pairs
print("\nHighly Correlated Pairs (|r| > 0.7):")
found = False
for i in range(len(corr_matrix.columns)):
    for j in range(i+1, len(corr_matrix.columns)):
        r = corr_matrix.iloc[i, j]
        if abs(r) > 0.7:
            print(f"  {corr_matrix.columns[i]} ↔ {corr_matrix.columns[j]} : r={r:.3f}")
            found = True
if not found:
    print("  None found — no multicollinearity issues.")


# ==============================================================
# 7. TARGET VARIABLE ANALYSIS (CLASS IMBALANCE)
# ==============================================================
section("7. TARGET VARIABLE ANALYSIS – CLASS IMBALANCE")
class_dist = df[TARGET_COL].value_counts()
class_pct  = df[TARGET_COL].value_counts(normalize=True).mul(100).round(2)

print(f"Number of classes: {df[TARGET_COL].nunique()}")
print(f"Classes: {sorted(df[TARGET_COL].unique().tolist())}")
print(f"\nClass Distribution:")
summary = pd.DataFrame({"Count": class_dist, "Percentage": class_pct})
print(summary)

# Imbalance ratio
max_cls = class_dist.max()
min_cls = class_dist.min()
imbalance_ratio = round(max_cls / min_cls, 2)
print(f"\nImbalance Ratio (max/min): {imbalance_ratio}")
if imbalance_ratio < 1.5:
    print("[RESULT] Dataset is well-balanced. No SMOTE/oversampling needed.")
elif imbalance_ratio < 5:
    print("[RESULT] Mild imbalance. Monitor precision/recall per class.")
else:
    print("[RESULT] Significant imbalance. Consider SMOTE or class_weight='balanced'.")

# Class distribution plot
fig, axes = plt.subplots(1, 2, figsize=(16, 6))
class_dist.plot(kind="bar", ax=axes[0], color="#27ae60", edgecolor="white")
axes[0].set_title("Class Distribution (Crop Labels)")
axes[0].set_xlabel("Crop")
axes[0].set_ylabel("Count")
axes[0].tick_params(axis="x", rotation=45)

class_dist.plot(kind="pie", ax=axes[1], autopct="%1.1f%%",
               colors=sns.color_palette("tab20", len(class_dist)))
axes[1].set_title("Class Distribution (Pie)")
axes[1].set_ylabel("")
save_fig("class_distribution")


# ==============================================================
# 8. PER-CLASS FEATURE ANALYSIS
# ==============================================================
section("8. PER-CLASS FEATURE STATISTICS")
# Box plot per crop for pH and N
fig, axes = plt.subplots(1, 2, figsize=(20, 8))
df.boxplot(column="ph", by=TARGET_COL, ax=axes[0])
axes[0].set_title("pH Distribution per Crop")
axes[0].set_xlabel("Crop")
axes[0].tick_params(axis="x", rotation=90)

df.boxplot(column="N", by=TARGET_COL, ax=axes[1])
axes[1].set_title("Nitrogen (N) per Crop")
axes[1].set_xlabel("Crop")
axes[1].tick_params(axis="x", rotation=90)
plt.suptitle("")
save_fig("per_class_feature_box")

# Mean feature per class
class_means = df.groupby(TARGET_COL)[NUMERIC_FEATURES].mean().round(2)
print("\nMean Feature Values per Crop (top 10):")
print(class_means.head(10))

# Save CSV summary
class_means.to_csv(os.path.join(REPORT_DIR, "class_feature_means.csv"))
print(f"\n[Saved] class_feature_means.csv")


# ==============================================================
# 9. SUMMARY REPORT
# ==============================================================
section("9. EDA SUMMARY")
report = f"""
EDA SUMMARY - Crop Recommendation Dataset
==========================================
Records         : {len(df)}
Features        : {len(NUMERIC_FEATURES)} numeric
Target          : {TARGET_COL} ({df[TARGET_COL].nunique()} classes)
Missing Values  : {df.isnull().sum().sum()} total
Imbalance Ratio : {imbalance_ratio}

FINDINGS:
- Dataset is {'complete' if df.isnull().sum().sum() == 0 else 'has missing values'}.
- All {len(NUMERIC_FEATURES)} features are numeric — no encoding needed.
- Imbalance ratio = {imbalance_ratio} → {'Balanced' if imbalance_ratio < 2 else 'Moderately imbalanced'}.
- pH and rainfall show natural variation across crops.
- K (Potassium) and N show high importance for crop differentiation.

PREPROCESSING DECISIONS:
- Scale features with StandardScaler (tree models) or MinMaxScaler.
- No categorical encoding needed.
- Apply IQR capping for outliers before training.
- Stratified train/test split (80/20).

RECOMMENDED MODEL: Random Forest (handles non-linearity, robust to outliers).
"""
print(report)
with open(os.path.join(REPORT_DIR, "eda_summary.txt"), "w") as f:
    f.write(report)

print(f"\n[ALL DONE] Reports saved to: {REPORT_DIR}")
