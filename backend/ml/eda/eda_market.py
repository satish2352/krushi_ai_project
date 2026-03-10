"""
EDA Script: Market / APMC Price Dataset (marketcropdata.csv)
=============================================================
Columns: state, district, market, commodity, variety, arrival_date,
         min_price, max_price, modal_price
Task: Data Understanding + Price Trend Analysis (for Market Intelligence Module)
"""

import os
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings("ignore")

DATA_PATH   = os.path.join(os.path.dirname(__file__), "..", "..", "..", "marketcropdata.csv")
REPORT_DIR  = os.path.join(os.path.dirname(__file__), "..", "reports", "market_eda")
os.makedirs(REPORT_DIR, exist_ok=True)

PRICE_COLS   = ["min_price", "max_price", "modal_price"]
CAT_COLS     = ["state", "district", "market", "commodity", "variety"]


def section(title: str):
    print(f"\n{'='*60}\n  {title}\n{'='*60}")

def save_fig(name: str):
    path = os.path.join(REPORT_DIR, f"{name}.png")
    plt.tight_layout()
    plt.savefig(path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"  [Saved] {path}")


# ==============================================================
# 1. LOAD & SCHEMA
# ==============================================================
section("1. DATASET LOADING & SCHEMA")
df = pd.read_csv(DATA_PATH)
df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
print(f"Shape       : {df.shape}")
print(f"Columns     : {list(df.columns)}")
print(f"\nDtypes:\n{df.dtypes}")
print(f"\nSample rows:\n{df.head(5).to_string()}")

# Date parsing
df["arrival_date"] = pd.to_datetime(df["arrival_date"], dayfirst=True, errors="coerce")
print(f"\nDate range  : {df['arrival_date'].min()} → {df['arrival_date'].max()}")


# ==============================================================
# 2. MISSING VALUE ANALYSIS
# ==============================================================
section("2. MISSING VALUE ANALYSIS")
null_df = pd.DataFrame({
    "Missing": df.isnull().sum(),
    "% Missing": (df.isnull().sum() / len(df) * 100).round(2)
})
print(null_df)
print(f"\nTotal missing cells: {df.isnull().sum().sum()}")


# ==============================================================
# 3. CATEGORICAL COVERAGE
# ==============================================================
section("3. CATEGORICAL COVERAGE")
for col in CAT_COLS:
    print(f"  {col:15s}: {df[col].nunique():5d} unique values")

print(f"\nTop 10 States:")
print(df["state"].value_counts().head(10))
print(f"\nTop 15 Commodities:")
print(df["commodity"].value_counts().head(15))


# ==============================================================
# 4. PRICE DISTRIBUTION ANALYSIS
# ==============================================================
section("4. PRICE DISTRIBUTION ANALYSIS")
print(df[PRICE_COLS].describe().round(2))

fig, axes = plt.subplots(1, 3, figsize=(15, 5))
for i, col in enumerate(PRICE_COLS):
    axes[i].hist(df[col].dropna(), bins=60, color="#e67e22", edgecolor="white", alpha=0.8)
    axes[i].set_title(f"Distribution: {col}")
    axes[i].set_xlabel("Price (₹/quintal)")
    axes[i].set_ylabel("Frequency")
plt.suptitle("Price Column Distributions – Market Data", fontsize=13)
save_fig("price_distributions")


# ==============================================================
# 5. OUTLIER DETECTION IN PRICES
# ==============================================================
section("5. PRICE OUTLIER DETECTION")
for col in PRICE_COLS:
    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
    IQR    = Q3 - Q1
    outliers = df[(df[col] < Q1 - 1.5 * IQR) | (df[col] > Q3 + 1.5 * IQR)]
    print(f"  {col:15s}: {len(outliers)} outliers ({round(len(outliers)/len(df)*100,2)}%)")

# Box plots
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
for i, col in enumerate(PRICE_COLS):
    axes[i].boxplot(df[col].dropna(), patch_artist=True,
                    boxprops=dict(facecolor="#e67e22", alpha=0.7))
    axes[i].set_title(col)
    axes[i].set_ylabel("Price (₹)")
plt.suptitle("Price Outliers – Market Data")
save_fig("price_boxplots")


# ==============================================================
# 6. PRICE CORRELATION
# ==============================================================
section("6. PRICE CORRELATION")
corr = df[PRICE_COLS].corr()
print(corr.round(3))

fig, ax = plt.subplots(figsize=(6, 4))
sns.heatmap(corr, annot=True, fmt=".3f", cmap="Oranges", ax=ax)
ax.set_title("Price Column Correlation")
save_fig("price_correlation")

print("\n[INSIGHT] min/max/modal prices are highly correlated → use modal_price as primary.")


# ==============================================================
# 7. TOP COMMODITIES + AVERAGE PRICE
# ==============================================================
section("7. COMMODITY PRICE ANALYSIS")
commodity_stats = (
    df.groupby("commodity")["modal_price"]
    .agg(["mean", "median", "std", "count"])
    .rename(columns={"mean": "avg_price", "median":"median_price", "std":"std_price", "count":"records"})
    .sort_values("avg_price", ascending=False)
)
print("Top 15 commodities by average price:")
print(commodity_stats.head(15).round(2))
commodity_stats.to_csv(os.path.join(REPORT_DIR, "commodity_price_stats.csv"))

# Bar chart top 20 commodities
top20 = commodity_stats.head(20)
fig, ax = plt.subplots(figsize=(14, 6))
top20["avg_price"].plot(kind="bar", ax=ax, color="#e67e22", edgecolor="white")
ax.set_title("Top 20 Commodities – Average Modal Price (₹/quintal)")
ax.set_ylabel("Avg Modal Price (₹)")
ax.tick_params(axis="x", rotation=60)
save_fig("top20_commodity_prices")


# ==============================================================
# 8. STATE-WISE ANALYSIS
# ==============================================================
section("8. STATE-WISE PRICE ANALYSIS")
state_stats = (
    df.groupby("state")["modal_price"]
    .agg(["mean", "count"])
    .sort_values("mean", ascending=False)
)
print(state_stats.round(2))

fig, ax = plt.subplots(figsize=(14, 6))
state_stats["mean"].plot(kind="bar", ax=ax, color="#8e44ad", edgecolor="white")
ax.set_title("Average Modal Price by State")
ax.set_ylabel("Avg Price (₹/quintal)")
ax.tick_params(axis="x", rotation=60)
save_fig("state_price_analysis")


# ==============================================================
# 9. SUMMARY
# ==============================================================
section("9. EDA SUMMARY")
report = f"""
EDA SUMMARY – Market / APMC Dataset
=====================================
Records         : {len(df)}
Date Range      : {df['arrival_date'].min()} – {df['arrival_date'].max()}
States          : {df['state'].nunique()}
Markets         : {df['market'].nunique()}
Commodities     : {df['commodity'].nunique()}
Missing Values  : {df.isnull().sum().sum()}

FINDINGS:
- Data covers {df['state'].nunique()} states, {df['market'].nunique()} markets.
- High correlation between min/max/modal prices → use modal_price as reference.
- Significant price outliers exist → cap or log-transform for analysis.
- Top commodities by price: {', '.join(commodity_stats.head(5).index.tolist())}

MODULE INTEGRATION PLAN:
- Filter by state + commodity to return local mandi prices.
- Serve averaged modal_price per market as price benchmark.
- Use historical date range for basic price trend chart.
"""
print(report)
with open(os.path.join(REPORT_DIR, "eda_summary.txt"), "w") as f:
    f.write(report)

print(f"\n[ALL DONE] Reports saved to: {REPORT_DIR}")
