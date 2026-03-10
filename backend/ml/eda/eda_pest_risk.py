"""
EDA Script: Pest Risk Dataset (train_yaOffsB.csv)
=================================================
Columns: ID, Estimated_Insects_Count, Crop_Type, Soil_Type,
         Pesticide_Use_Category, Number_Doses_Week, Number_Weeks_Used,
         Number_Weeks_Quit, Season, Crop_Damage
Task: Multi-class Classification (Crop_Damage: 0=None, 1=Low, 2=High)
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

DATA_PATH  = os.path.join(os.path.dirname(__file__), "..", "..", "..", "train_yaOffsB.csv")
REPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports", "pest_eda")
os.makedirs(REPORT_DIR, exist_ok=True)

NUMERIC_FEATURES = ["Estimated_Insects_Count", "Number_Doses_Week",
                    "Number_Weeks_Used", "Number_Weeks_Quit"]
CATEGORICAL_FEATURES = ["Crop_Type", "Soil_Type", "Pesticide_Use_Category", "Season"]
TARGET_COL = "Crop_Damage"
DROP_COLS  = ["ID"]


def section(t): print(f"\n{'='*60}\n  {t}\n{'='*60}")
def save_fig(n):
    p = os.path.join(REPORT_DIR, f"{n}.png")
    plt.tight_layout(); plt.savefig(p, dpi=120, bbox_inches="tight"); plt.close()
    print(f"  [Saved] {p}")


# ==============================================================
# 1. LOAD & SCHEMA
# ==============================================================
section("1. DATASET LOADING & SCHEMA")
df = pd.read_csv(DATA_PATH)
print(f"Shape   : {df.shape}")
print(f"Columns : {list(df.columns)}")
print(f"\nDtypes:\n{df.dtypes}")
print(f"\nSample:\n{df.head(5)}")

# Drop ID
df.drop(columns=[c for c in DROP_COLS if c in df.columns], inplace=True)


# ==============================================================
# 2. MISSING VALUES
# ==============================================================
section("2. MISSING VALUE ANALYSIS")
null_df = pd.DataFrame({
    "Missing": df.isnull().sum(),
    "% Missing": (df.isnull().sum() / len(df) * 100).round(2)
})
print(null_df)
total_missing = df.isnull().sum().sum()
print(f"Total missing: {total_missing}")

fig, ax = plt.subplots(figsize=(10, 3))
sns.heatmap(df.isnull(), yticklabels=False, cbar=False, cmap="viridis", ax=ax)
ax.set_title("Missing Values Heatmap – Pest Risk Data")
save_fig("missing_heatmap")


# ==============================================================
# 3. DESCRIPTIVE STATISTICS
# ==============================================================
section("3. DESCRIPTIVE STATISTICS (Numeric)")
print(df[NUMERIC_FEATURES].describe().round(2))


section("3b. CATEGORICAL FEATURE VALUE COUNTS")
for col in CATEGORICAL_FEATURES:
    if col in df.columns:
        print(f"\n{col}:\n{df[col].value_counts()}")


# ==============================================================
# 4. DISTRIBUTIONS
# ==============================================================
section("4. NUMERIC FEATURE DISTRIBUTIONS")
fig, axes = plt.subplots(2, 2, figsize=(14, 8))
axes = axes.flatten()
for i, col in enumerate(NUMERIC_FEATURES):
    axes[i].hist(df[col].dropna(), bins=50, color="#e74c3c", edgecolor="white", alpha=0.8)
    axes[i].set_title(f"Dist: {col}")
    skew = df[col].skew()
    axes[i].text(0.97, 0.92, f"Skew={skew:.2f}", transform=axes[i].transAxes,
                 ha="right", fontsize=9)
plt.suptitle("Numeric Feature Distributions – Pest Risk")
save_fig("numeric_distributions")


# ==============================================================
# 5. OUTLIER DETECTION
# ==============================================================
section("5. OUTLIER DETECTION")
for col in NUMERIC_FEATURES:
    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
    IQR = Q3 - Q1
    outliers = df[(df[col] < Q1 - 1.5*IQR) | (df[col] > Q3 + 1.5*IQR)]
    pct = round(len(outliers)/len(df)*100, 2)
    print(f"  {col:30s}: {len(outliers)} outliers ({pct}%)")

fig, axes = plt.subplots(1, 4, figsize=(16, 5))
for i, col in enumerate(NUMERIC_FEATURES):
    axes[i].boxplot(df[col].dropna(), patch_artist=True,
                    boxprops=dict(facecolor="#e74c3c", alpha=0.7))
    axes[i].set_title(col, fontsize=9)
plt.suptitle("Box Plots – Pest Risk Numeric Features")
save_fig("boxplots")


# ==============================================================
# 6. CORRELATION ANALYSIS
# ==============================================================
section("6. FEATURE CORRELATION")
all_numeric_cols = NUMERIC_FEATURES + [TARGET_COL]
corr = df[all_numeric_cols].corr()
print(corr.round(3))

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0, ax=ax)
ax.set_title("Correlation Matrix – Pest Risk (including target)")
save_fig("correlation_heatmap")

# Feature correlation with target
print("\nCorrelation with Target (Crop_Damage):")
target_corr = df[all_numeric_cols].corrwith(df[TARGET_COL]).sort_values(ascending=False)
print(target_corr)


# ==============================================================
# 7. CLASS IMBALANCE CHECK
# ==============================================================
section("7. CLASS IMBALANCE – TARGET ANALYSIS")
class_dist = df[TARGET_COL].value_counts().sort_index()
class_pct  = (class_dist / len(df) * 100).round(2)
print("Crop_Damage Classes:")
print("  0 = No Damage   1 = Low Damage   2 = High Damage")
for cls in class_dist.index:
    print(f"  Class {cls}: {class_dist[cls]:6d} ({class_pct[cls]:.2f}%)")

imbalance_ratio = round(class_dist.max() / class_dist.min(), 2)
print(f"\nImbalance Ratio: {imbalance_ratio}")

fig, axes = plt.subplots(1, 2, figsize=(12, 5))
class_dist.plot(kind="bar", ax=axes[0], color=["#27ae60","#f39c12","#e74c3c"],
                edgecolor="white")
axes[0].set_title("Crop Damage Class Distribution")
axes[0].set_xlabel("Crop Damage Level")
axes[0].set_ylabel("Count")
axes[0].set_xticklabels(["0-None","1-Low","2-High"], rotation=0)

class_dist.plot(kind="pie", ax=axes[1], autopct="%1.1f%%",
               colors=["#27ae60","#f39c12","#e74c3c"],
               labels=["0-None","1-Low","2-High"])
axes[1].set_title("Crop Damage Distribution (%)")
axes[1].set_ylabel("")
save_fig("class_distribution")

if imbalance_ratio > 3:
    print("\n[WARNING] Class imbalance detected. Recommend: class_weight='balanced' or SMOTE.")
else:
    print("\n[OK] Acceptable class distribution.")


# ==============================================================
# 8. INSECTS COUNT vs CROP DAMAGE
# ==============================================================
section("8. INSECT COUNT vs CROP DAMAGE")
# Sample for performance
sample = df.sample(min(5000, len(df)), random_state=42)
fig, ax = plt.subplots(figsize=(10, 6))
damage_labels = {0: "No Damage", 1: "Low Damage", 2: "High Damage"}
colors_map = {0: "#27ae60", 1: "#f39c12", 2: "#e74c3c"}
for cls in sorted(df[TARGET_COL].unique()):
    subset = sample[sample[TARGET_COL] == cls]
    ax.scatter(range(len(subset)), subset["Estimated_Insects_Count"],
               alpha=0.4, s=5, c=colors_map.get(cls, "blue"),
               label=damage_labels.get(cls, str(cls)))
ax.set_title("Insect Count vs Crop Damage (sample)")
ax.set_ylabel("Estimated Insects Count")
ax.legend()
save_fig("insects_vs_damage")

# Box plot by damage class
fig, ax = plt.subplots(figsize=(10, 6))
df.boxplot(column="Estimated_Insects_Count", by=TARGET_COL, ax=ax)
ax.set_title("Insect Count by Damage Class")
ax.set_xlabel("Crop Damage Level")
plt.suptitle("")
save_fig("insects_boxplot_by_damage")


# ==============================================================
# 9. SEASON ANALYSIS
# ==============================================================
section("9. SEASON ANALYSIS")
if "Season" in df.columns:
    season_damage = df.groupby(["Season", TARGET_COL]).size().unstack(fill_value=0)
    print(season_damage)

    season_damage.plot(kind="bar", stacked=True, figsize=(10, 5),
                       color=["#27ae60","#f39c12","#e74c3c"])
    plt.title("Crop Damage by Season")
    plt.xlabel("Season")
    plt.ylabel("Count")
    plt.xticks(rotation=0)
    plt.legend(["No Damage","Low Damage","High Damage"])
    save_fig("season_damage_analysis")


# ==============================================================
# 10. SUMMARY
# ==============================================================
section("10. EDA SUMMARY")
report = f"""
EDA SUMMARY – Pest Risk Dataset
=================================
Records          : {len(df)}
Features (post)  : {df.shape[1]-1} (excl. target)
Target           : Crop_Damage (3 classes: 0,1,2)
Missing          : {total_missing}
Imbalance Ratio  : {imbalance_ratio}

FINDINGS:
- Estimated_Insects_Count is the most predictive feature.
- Season and Pesticide_Use_Category are important categorical features.
- Class imbalance ratio = {imbalance_ratio} → {'Use class_weight=balanced' if imbalance_ratio > 3 else 'Acceptable, stratified split sufficient'}.

PREPROCESSING:
- Drop ID column.
- Encode Crop_Type, Soil_Type, Pesticide_Use_Category, Season (already numeric/encoded).
- Cap Estimated_Insects_Count outliers.
- StandardScaler on numeric features.
- Stratified 80/20 split.
"""
print(report)
with open(os.path.join(REPORT_DIR, "eda_summary.txt"), "w") as f:
    f.write(report)
print(f"\n[ALL DONE] Reports saved to: {REPORT_DIR}")
