"""
Master Training Runner — Run All ML Pipelines
===============================================
Runs all three model training scripts in sequence.
Usage:
    python ml/run_all_training.py
    python ml/run_all_training.py --skip-eda    (skip EDA, just train)
"""

import os
import sys
import time

if sys.stdout.encoding.lower() != 'utf-8':
    try: sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError: pass
import argparse
import subprocess

BASE_DIR    = os.path.abspath(os.path.dirname(__file__))
TRAINING_DIR = os.path.join(BASE_DIR, "training")
EDA_DIR     = os.path.join(BASE_DIR, "eda")


def run_script(script_path: str, label: str) -> bool:
    """Run a Python script and return True if successful."""
    print(f"\n{'='*60}")
    print(f"  RUNNING: {label}")
    print(f"  Script : {script_path}")
    print(f"{'='*60}")

    start = time.time()
    result = subprocess.run(
        [sys.executable, script_path],
        capture_output=False,
        text=True,
    )
    elapsed = round(time.time() - start, 1)

    if result.returncode == 0:
        print(f"\n  [OK] DONE - {label} ({elapsed}s)")
        return True
    else:
        print(f"\n  [ERROR] FAILED - {label} (exit code: {result.returncode})")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run all Krishi AI ML training pipelines")
    parser.add_argument("--skip-eda",     action="store_true", help="Skip EDA scripts")
    parser.add_argument("--skip-training",action="store_true", help="Skip model training")
    parser.add_argument("--eda-only",     action="store_true", help="Run only EDA scripts")
    args = parser.parse_args()

    print("\n" + "="*60)
    print("  KRISHI AI — MASTER ML TRAINING RUNNER")
    print("="*60)

    total_start = time.time()
    successes = []
    failures  = []

    # ── PHASE 1: EDA ──────────────────────────────────────────
    if not args.skip_eda:
        print("\n\nPHASE 1: EXPLORATORY DATA ANALYSIS")
        print("-"*60)

        eda_scripts = [
            (os.path.join(EDA_DIR, "eda_crop_recommendation.py"), "EDA: Crop Recommendation"),
            (os.path.join(EDA_DIR, "eda_market.py"),              "EDA: Market Data"),
            (os.path.join(EDA_DIR, "eda_pest_risk.py"),           "EDA: Pest Risk"),
            (os.path.join(EDA_DIR, "eda_yield_estimator.py"),     "EDA: Yield Estimation"),
        ]

        for script, label in eda_scripts:
            if os.path.exists(script):
                ok = run_script(script, label)
                (successes if ok else failures).append(label)
            else:
                print(f"  [SKIP] {label} — script not found: {script}")

    if args.eda_only:
        print("\n[INFO] --eda-only flag set. Skipping model training.")
    elif not args.skip_training:
        # ── PHASE 2: MODEL TRAINING ───────────────────────────
        print("\n\nPHASE 2: MODEL TRAINING")
        print("-"*60)
        print("  NOTE: This may take 5–20 minutes depending on your machine.")
        print("  XGBoost will be used if installed (pip install xgboost).")

        training_scripts = [
            (os.path.join(TRAINING_DIR, "train_crop_recommendation.py"),
             "Model Training: Crop Recommendation"),
            (os.path.join(TRAINING_DIR, "train_yield_estimator.py"),
             "Model Training: Yield Estimation"),
            (os.path.join(TRAINING_DIR, "train_pest_risk.py"),
             "Model Training: Pest Risk"),
        ]

        for script, label in training_scripts:
            if os.path.exists(script):
                ok = run_script(script, label)
                (successes if ok else failures).append(label)
            else:
                print(f"  [SKIP] {label} — script not found: {script}")

    # ── SUMMARY ───────────────────────────────────────────────
    total_time = round(time.time() - total_start, 1)

    print(f"\n\n{'='*60}")
    print(f"  TRAINING COMPLETE — Total time: {total_time}s")
    print(f"{'='*60}")
    print(f"  Successful : {len(successes)}")
    for s in successes:
        print(f"       • {s}")
    if failures:
        print(f"  Failed     : {len(failures)}")
        for f in failures:
            print(f"       • {f}")

    print(f"\n  Saved models → backend/ml/models/")
    print(f"  EDA reports  → backend/ml/reports/")
    print(f"\n  Next step: Run inference tests:")
    print(f"    python ml/inference/crop_inference.py")
    print(f"    python ml/inference/yield_inference.py")
    print(f"    python ml/inference/pest_inference.py")
    print(f"    python ml/inference/market_inference.py")


if __name__ == "__main__":
    main()
