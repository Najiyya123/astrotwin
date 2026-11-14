"""
AstroTwin - Step 2: The ML core
================================

This script reads data/crew.csv and does three things:

  1. PERSONAL BASELINES (rolling z-scores)
     For every astronaut and every metric, we look at their previous 14 days
     and ask: "how unusual is today, for THIS person?"
     z-score = (today - their recent average) / their recent spread
     z = 0  -> perfectly normal for them
     z = +3 -> much higher than normal for them

  2. ANOMALY DETECTION (Isolation Forest)
     An Isolation Forest is a machine-learning model that finds days that are
     "easy to isolate" - days that look different from the rest across several
     measurements at once. We train one per astronaut on their z-scores.

  3. RISK SCORES (0-100) for five NASA risk areas:
     bone, cardiovascular, immune, behavioral, radiation.

Finally it checks itself against data/anomalies.csv (the secret answer key)
and prints how many injected bad days it caught.

Output: data/crew_scored.csv

Run it with:   python model.py
"""

import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

DATA_DIR = "data"
WINDOW = 14            # days of history used for each personal baseline
WARMUP = 14            # first 14 days only build the baseline; no alerts yet
Z_ALERT = 2.5          # how many "spreads" from normal counts as unusual
RADIATION_LIMIT_MSV = 600   # NASA's career radiation limit for astronauts

# Metrics we watch for day-to-day anomalies.
# Radiation is handled separately: a solar storm hits the whole crew at once,
# so it is a space-weather alert, not a personal health anomaly.
HEALTH_METRICS = ["resting_hr", "systolic_bp", "sleep_hours", "exercise_min", "mood"]


# ---------------------------------------------------------------------------
# 1. Personal baselines
# ---------------------------------------------------------------------------
def add_personal_baselines(df):
    """Add a z-score column for each metric, per astronaut.

    shift(1) means the baseline only uses PAST days, never today itself.
    That is how it would work in real life.
    """
    df = df.sort_values(["astronaut", "day"]).copy()
    for col in HEALTH_METRICS:
        grouped = df.groupby("astronaut")[col]
        mean = grouped.transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=7).mean())
        std = grouped.transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=7).std())
        std = std.clip(lower=1e-6)              # avoid dividing by zero
        df[f"z_{col}"] = ((df[col] - mean) / std).fillna(0)
    return df


# ---------------------------------------------------------------------------
# 2. Isolation Forest anomaly detection
# ---------------------------------------------------------------------------
def detect_anomalies(df):
    z_cols = [f"z_{c}" for c in HEALTH_METRICS]
    df["if_score"] = 0.0
    df["is_anomaly"] = False

    for name, person in df.groupby("astronaut"):
        active = person[person["day"] > WARMUP]
        X = active[z_cols].abs().values          # size of deviation, either direction
        X = np.column_stack([X, active["symptoms"].values])

        model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
        model.fit(X)
        flagged = model.predict(X) == -1          # -1 means "anomaly"

        # Only keep flags where at least one metric is clearly unusual.
        # This removes borderline days the forest flagged by chance.
        strong = active[z_cols].abs().max(axis=1) >= Z_ALERT
        final = flagged & strong.values

        df.loc[active.index, "if_score"] = -model.score_samples(X)   # higher = stranger
        df.loc[active.index, "is_anomaly"] = final
    return df


# ---------------------------------------------------------------------------
# 3. Risk scores (0-100)
# ---------------------------------------------------------------------------
def add_risk_scores(df):
    g = df.groupby("astronaut")

    # Each person's "pre-mission normal" = average of their first 14 days
    base_sleep = g["sleep_hours"].transform(lambda s: s.iloc[:WARMUP].mean())
    base_mood = g["mood"].transform(lambda s: s.iloc[:WARMUP].mean())

    # 7-day rolling averages show slow trends better than single days
    sleep_7d = g["sleep_hours"].transform(lambda s: s.rolling(7, min_periods=1).mean())
    mood_7d = g["mood"].transform(lambda s: s.rolling(7, min_periods=1).mean())
    exercise_7d = g["exercise_min"].transform(lambda s: s.rolling(7, min_periods=1).mean())
    symptoms_7d = g["symptoms"].transform(lambda s: s.rolling(7, min_periods=1).sum())
    cumulative_dose = g["radiation_msv"].cumsum()

    # Bone: total loss so far (10% loss = 100) plus a penalty for low exercise
    bone_loss = 100 - df["bone_density_pct"]
    exercise_gap = (90 - exercise_7d).clip(lower=0)
    df["risk_bone"] = (bone_loss * 10 + exercise_gap * 0.5).clip(0, 100)

    # Cardiovascular: heart rate and blood pressure above personal normal
    df["risk_cardio"] = (25 * (df["z_resting_hr"].clip(lower=0)
                               + df["z_systolic_bp"].clip(lower=0))).clip(0, 100)

    # Immune: recent symptoms plus sleep debt
    sleep_debt = (base_sleep - sleep_7d).clip(lower=0)
    df["risk_immune"] = (symptoms_7d * 25 + sleep_debt * 40).clip(0, 100)

    # Behavioral: mood and sleep drifting below personal normal for a week
    mood_drop = (base_mood - mood_7d).clip(lower=0)
    df["risk_behavioral"] = (mood_drop * 80 + sleep_debt * 40).clip(0, 100)

    # Radiation: share of the career limit used, plus a jump on storm days
    storm_today = (df["radiation_msv"] > 5).astype(int)
    df["cumulative_dose_msv"] = cumulative_dose
    df["risk_radiation"] = (cumulative_dose / RADIATION_LIMIT_MSV * 100
                            + storm_today * 30).clip(0, 100)
    df["solar_storm_alert"] = storm_today.astype(bool)

    risk_cols = ["risk_bone", "risk_cardio", "risk_immune", "risk_behavioral", "risk_radiation"]
    df[risk_cols] = df[risk_cols].round(1)
    return df


# ---------------------------------------------------------------------------
# 4. Self-check against the answer key
# ---------------------------------------------------------------------------
def evaluate(df):
    key = pd.read_csv(os.path.join(DATA_DIR, "anomalies.csv"))
    truth = set(zip(key["astronaut"], key["day"]))
    flagged = set(zip(df.loc[df["is_anomaly"], "astronaut"], df.loc[df["is_anomaly"], "day"]))

    caught_days = truth & flagged
    false_alarms = flagged - truth

    # An "event" (e.g. a 2-day illness) counts as caught if any of its days is flagged
    key["caught"] = [(a, d) in flagged for a, d in zip(key["astronaut"], key["day"])]
    events = key.groupby(["astronaut", "event_type"])["caught"].any()

    active_days = int((df["day"] > WARMUP).sum())
    precision = len(caught_days) / len(flagged) if flagged else 0
    recall = len(caught_days) / len(truth)

    print("=== AstroTwin anomaly detection: self-check ===")
    print(f"Bad events caught:      {events.sum()} of {len(events)}")
    print(f"Bad days caught:        {len(caught_days)} of {len(truth)}  (recall {recall:.0%})")
    print(f"False alarms:           {len(false_alarms)} out of {active_days} monitored days")
    print(f"Precision:              {precision:.0%}")
    return {"events_caught": int(events.sum()), "events_total": len(events),
            "recall": recall, "precision": precision, "false_alarms": len(false_alarms)}


def main():
    df = pd.read_csv(os.path.join(DATA_DIR, "crew.csv"))
    df = add_personal_baselines(df)
    df = detect_anomalies(df)
    df = add_risk_scores(df)
    df.to_csv(os.path.join(DATA_DIR, "crew_scored.csv"), index=False)
    print(f"Saved scored data to {DATA_DIR}/crew_scored.csv\n")

    evaluate(df)

    print("\nAverage risk on three key mission days (0-100):")
    cols = ["risk_bone", "risk_cardio", "risk_immune", "risk_behavioral", "risk_radiation"]
    print(df[df["day"].isin([30, 90, 110])].groupby("day")[cols].mean().round(0).to_string())


if __name__ == "__main__":
    main()
