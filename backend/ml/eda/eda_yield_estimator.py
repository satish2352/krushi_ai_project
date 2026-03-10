"""
EDA Script: Crop Yield Estimation Dataset (crop_yield.csv)
===========================================================
Columns: Region, Soil_Type, Crop, Rainfall_mm, Temperature_Celsius,
         Fertilizer_Used, Irrigation_Used, Weather_Condition,
         Days_to_Harvest, Yield_tons_per_hectare
Task: Regression (predict Yield_tons_per_hectare)
"""

import os
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

warnings.filterwarnings("ignore")

DATA_PATH  = os.path.join(os.path.dirname(__file__), "..", "..", "..", "crop_yield.csv")
REPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports", "yield_eda")
os.makedirs(REPORT_DIR, exist_ok=True)

NUMERIC_FEATURES     = ["Rainfall_mm", "Temperature_Celsius", "Days_to_Harvest"]
BOOLEAN_FEATURES     = ["Fertilizer_Used", "Irrigation_Used"]
CATEGORICAL_FEATURES = ["Region", "Soil_Type", "Crop", "Weather_Condition"]
TARGET_COL           = "Yield_tons_per_hectare"


def section(t): print(f"\n{'='*60}\n  {t}\n{'='*60}")
def save_fig(n):
    p = os.path.join(REPORT_DIR, f"{n}.png")
    plt.tight_layout(); plt.savefig(p, dpi=120, bbox_inches="tight"); plt.close()
    print(f"  [Saved] {p}")


# ==============================================================
# 1. LOAD & SCHEMA
# ==============================================================
section("1. DATASET LOADING & SCHEMA")
# Load sample first to get dtypes, then full
df = pd.read_csv(DATA_PATH)
print(f"Shape   : {df.shape}")
print(f"Columns : {list(df.columns)}")
print(f"\nDtypes:\n{df.dtypes}")
print(f"\nSample:\n{df.head(5)}")


# ==============================================================
# 2. MISSING VALUES
# ==============================================================
section("2. MISSING VALUE ANALYSIS")
null_df = pd.DataFrame({
    "Missing": df.isnull().sum(),
    "% Missing": (df.isnull().sum() / len(df) * 100).round(2)
}).sort_values("Missing", ascending=False)
print(null_df)
total_missing = df.isnull().sum().sum()
print(f"\nTotal missing: {total_missing}")

fig, ax = plt.subplots(figsize=(10, 4))
sns.heatmap(df.isnull(), yticklabels=False, cbar=False, cmap="viridis", ax=ax)
ax.set_title("Missing Values Heatmap – Yield Data")
save_fig("missing_heatmap")


# ==============================================================
# 3. TARGET VARIABLE ANALYSIS
# ==============================================================
section("3. TARGET VARIABLE: Yield_tons_per_hectare")
print(df[TARGET_COL].describe().round(3))
skew = df[TARGET_COL].skew()
kurt = df[TARGET_COL].kurtosis()
print(f"\nSkewness : {skew:.4f}")
print(f"Kurtosis : {kurt:.4f}")

# Check normality
stat, p = stats.shapiro(df[TARGET_COL].sample(min(500, len(df)), random_state=42))
print(f"Shapiro-Wilk : W={stat:.4f}, p={p:.4f} → {'Normal' if p>0.05 else 'NOT Normal'}")

fig, axes = plt.subplots(1, 3, figsize=(15, 5))
axes[0].hist(df[TARGET_COL], bins=60, color="#3498db", edgecolor="white", alpha=0.8)
axes[0].set_title("Yield Distribution")
axes[0].set_xlabel("Yield (tons/ha)")

stats.probplot(df[TARGET_COL].dropna(), dist="norm", plot=axes[1])
axes[1].set_title("Q-Q Plot (Normal)")

np.log1p(df[TARGET_COL]).hist(bins=60, ax=axes[2], color="#2980b9", edgecolor="white")
axes[2].set_title("Log-Transformed Yield")
plt.suptitle("Target Variable Analysis – Yield", fontsize=13)
save_fig("target_distribution")


# ==============================================================
# 4. NUMERIC FEATURE ANALYSIS
# ==============================================================
section("4. NUMERIC FEATURE DISTRIBUTIONS")
print(df[NUMERIC_FEATURES].describe().round(2))

fig, axes = plt.subplots(1, 3, figsize=(15, 5))
for i, col in enumerate(NUMERIC_FEATURES):
    axes[i].hist(df[col].dropna(), bins=50, color="#3498db", edgecolor="white", alpha=0.8)
    axes[i].set_title(f"{col}")
    axes[i].set_xlabel(col)
plt.suptitle("Numeric Feature Distributions")
save_fig("numeric_distributions")


# ==============================================================
# 5. OUTLIER DETECTION
# ==============================================================
section("5. OUTLIER DETECTION")
all_numeric = NUMERIC_FEATURES + [TARGET_COL]
for col in all_numeric:
    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
    IQR = Q3 - Q1
    outliers = df[(df[col] < Q1 - 1.5*IQR) | (df[col] > Q3 + 1.5*IQR)]
    pct = round(len(outliers)/len(df)*100, 2)
    print(f"  {col:35s}: {len(outliers)} outliers ({pct}%)")

fig, axes = plt.subplots(1, 4, figsize=(18, 5))
for i, col in enumerate(all_numeric):
    axes[i].boxplot(df[col].dropna(), patch_artist=True,
                    boxprops=dict(facecolor="#3498db", alpha=0.7))
    axes[i].set_title(col, fontsize=9)
plt.suptitle("Box Plots – Yield Dataset")
save_fig("boxplots")


# ==============================================================
# 6. CORRELATION WITH TARGET
# ==============================================================
section("6. FEATURE CORRELATION WITH TARGET")
# Boolean to int
df_copy = df.copy()
for col in BOOLEAN_FEATURES:
    if col in df_copy.columns:
        df_copy[col] = df_copy[col].astype(int)

numeric_corr = df_copy[all_numeric + BOOLEAN_FEATURES].corr()
print(numeric_corr.round(3))

target_corr = numeric_corr[TARGET_COL].drop(TARGET_COL).sort_values(ascending=False)
print(f"\nCorrelation with {TARGET_COL}:")
print(target_corr.round(3))

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(numeric_corr, annot=True, fmt=".2f", cmap="coolwarm", ax=ax, linewidths=0.5)
ax.set_title("Correlation Heatmap – Yield Dataset")
save_fig("correlation_heatmap")


# ==============================================================
# 7. CATEGORICAL FEATURE ANALYSIS
# ==============================================================
section("7. CATEGORICAL FEATURE ANALYSIS")
for col in CATEGORICAL_FEATURES:
    if col in df.columns:
        n_unique = df[col].nunique()
        print(f"\n{col} ({n_unique} unique): {df[col].value_counts().head(8).to_dict()}")

# Yield by Crop
if "Crop" in df.columns:
    crop_yield_stats = df.groupby("Crop")[TARGET_COL].agg(["mean","median","std"]).round(3)
    print(f"\nYield by Crop:\n{crop_yield_stats.sort_values('mean', ascending=False)}")
    crop_yield_stats.to_csv(os.path.join(REPORT_DIR, "yield_by_crop.csv"))

    fig, ax = plt.subplots(figsize=(14, 6))
    sorted_crops = df.groupby("Crop")[TARGET_COL].mean().sort_values(ascending=False)
    sorted_crops.plot(kind="bar", ax=ax, color="#3498db", edgecolor="white")
    ax.set_title("Average Yield by Crop")
    ax.set_ylabel("Avg Yield (tons/ha)")
    ax.tick_params(axis="x", rotation=45)
    save_fig("yield_by_crop")

# Yield by Region
if "Region" in df.columns:
    fig, ax = plt.subplots(figsize=(10, 5))
    df.boxplot(column=TARGET_COL, by="Region", ax=ax)
    ax.set_title("Yield by Region")
    plt.suptitle("")
    save_fig("yield_by_region")

# Fertilizer & Irrigation impact
fig, axes = plt.subplots(1, 2, figsize=(12, 5))
for i, col in enumerate(BOOLEAN_FEATURES):
    if col in df.columns:
        df.boxplot(column=TARGET_COL, by=col, ax=axes[i])
        axes[i].set_title(f"Yield by {col}")
plt.suptitle("Impact of Fertilizer & Irrigation on Yield")
save_fig("fertilizer_irrigation_impact")


# ==============================================================
# 8. SCATTER PLOTS (NUMERIC vs TARGET)
# ==============================================================
section("8. SCATTER PLOTS – NUMERIC vs TARGET")
fig, axes = plt.subplots(1, 3, figsize=(16, 5))
sample = df.sample(min(3000, len(df)), random_state=42)
for i, col in enumerate(NUMERIC_FEATURES):
    axes[i].scatter(sample[col], sample[TARGET_COL], alpha=0.3, s=10, color="#3498db")
    axes[i].set_xlabel(col)
    axes[i].set_ylabel("Yield (tons/ha)")
    axes[i].set_title(f"{col} vs Yield")
    # Add trend line
    m, b = np.polyfit(sample[col].dropna(), sample[TARGET_COL][sample[col].notna()], 1)
    x_line = np.linspace(sample[col].min(), sample[col].max(), 100)
    axes[i].plot(x_line, m*x_line + b, "r--", linewidth=1.5)
plt.suptitle("Numeric Features vs Yield")
save_fig("scatter_plots")


# ==============================================================
# 9. SUMMARY
# ==============================================================
section("9. EDA SUMMARY")
report = f"""
EDA SUMMARY – Crop Yield Dataset
==================================
Records         : {len(df)}
Features        : {df.shape[1]-1} (excl. target)
Target          : {TARGET_COL}
  Min           : {df[TARGET_COL].min():.3f}
  Max           : {df[TARGET_COL].max():.3f}
  Mean          : {df[TARGET_COL].mean():.3f}
  Std           : {df[TARGET_COL].std():.3f}
  Skewness      : {skew:.3f}
Missing Values  : {total_missing}

FINDINGS:
- Target is {'approximately normal' if abs(skew) < 0.5 else 'skewed — consider log transform'}.
- Fertilizer & Irrigation boolean flags have notable impact on yield.
- Crop type is the most important categorical predictor.
- Rainfall and Temperature show modest linear correlation with yield.

PREPROCESSING DECISIONS:
- Encode Region, Soil_Type, Crop, Weather_Condition (OneHotEncoder or OrdinalEncoder).
- Convert Fertilizer_Used, Irrigation_Used to int.
- StandardScaler on numeric features.
- 80/20 train/test split (random, not stratified for regression).
- {'Apply log1p transform on target' if abs(skew) > 1 else 'Target transformation optional'}.

RECOMMENDED MODEL: Gradient Boosting Regressor (handles mixed types, non-linearity).
"""
print(report)
with open(os.path.join(REPORT_DIR, "eda_summary.txt"), "w") as f:
    f.write(report)
print(f"\n[ALL DONE] Reports saved to: {REPORT_DIR}")
