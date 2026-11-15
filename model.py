"""
AstroTwin - Step 2: The ML core
Threshold evaluation added; production Z_ALERT remains unchanged.
"""

import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

DATA_DIR = "data"
WINDOW = 14
WARMUP = 14
Z_ALERT = 2.5
RADIATION_LIMIT_MSV = 600

HEALTH_METRICS = ["resting_hr", "systolic_bp", "sleep_hours", "exercise_min", "mood"]


def add_personal_baselines(df):
    """Calculate each astronaut's rolling z-scores using prior days only."""
    df = df.sort_values(["astronaut", "day"]).copy()
    for col in HEALTH_METRICS:
        grouped = df.groupby("astronaut")[col]
        mean = grouped.transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=7).mean())
        std = grouped.transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=7).std())
        std = std.clip(lower=1e-6)
        df[f"z_{col}"] = ((df[col] - mean) / std).fillna(0)
    return df


def detect_anomalies(df):
    z_cols = [f"z_{c}" for c in HEALTH_METRICS]
    df["if_score"] = 0.0
    df["if_candidate"] = False
    df["is_anomaly"] = False

    for name, person in df.groupby("astronaut"):
        active = person[person["day"] > WARMUP]
        X = active[z_cols].abs().values
        X = np.column_stack([X, active["symptoms"].values])

        model = IsolationForest(n_estimators=200, contamination=0.03, random_state=42)
        model.fit(X)  # Fit before predicting.
        flagged = model.predict(X) == -1

        # Preserve raw Isolation Forest predictions for threshold experiments.
        df.loc[active.index, "if_candidate"] = flagged

        strong = active[z_cols].abs().max(axis=1) >= Z_ALERT
        final = flagged & strong.values

        df.loc[active.index, "if_score"] = -model.score_samples(X)
        df.loc[active.index, "is_anomaly"] = final
    return df


def add_risk_scores(df):
    g = df.groupby("astronaut")
    base_sleep = g["sleep_hours"].transform(lambda s: s.iloc[:WARMUP].mean())
    base_mood = g["mood"].transform(lambda s: s.iloc[:WARMUP].mean())

    sleep_7d = g["sleep_hours"].transform(lambda s: s.rolling(7, min_periods=1).mean())
    mood_7d = g["mood"].transform(lambda s: s.rolling(7, min_periods=1).mean())
    exercise_7d = g["exercise_min"].transform(lambda s: s.rolling(7, min_periods=1).mean())
    symptoms_7d = g["symptoms"].transform(lambda s: s.rolling(7, min_periods=1).sum())
    cumulative_dose = g["radiation_msv"].cumsum()

    bone_loss = 100 - df["bone_density_pct"]
    exercise_gap = (90 - exercise_7d).clip(lower=0)
    df["risk_bone"] = (bone_loss * 10 + exercise_gap * 0.5).clip(0, 100)

        # Combine positive heart rate and blood pressure deviations
    cardio_deviation = (
        df["z_resting_hr"].clip(lower=0)
        + df["z_systolic_bp"].clip(lower=0)
    )

    # Calculate a 3-day rolling average for each astronaut
    cardio_3d = cardio_deviation.groupby(
        df["astronaut"]
    ).transform(
        lambda s: s.rolling(3, min_periods=1).mean()
    )

    # Calculate smoothed cardiovascular risk index
    df["risk_cardio"] = (25 * cardio_3d).clip(0, 100)

    sleep_debt = (base_sleep - sleep_7d).clip(lower=0)
    df["risk_immune"] = (symptoms_7d * 25 + sleep_debt * 40).clip(0, 100)

    mood_drop = (base_mood - mood_7d).clip(lower=0)
    df["risk_behavioral"] = (mood_drop * 80 + sleep_debt * 40).clip(0, 100)

    storm_today = (df["radiation_msv"] > 5).astype(int)
    df["cumulative_dose_msv"] = cumulative_dose
    df["risk_radiation"] = (cumulative_dose / RADIATION_LIMIT_MSV * 100
                            + storm_today * 30).clip(0, 100)
    df["solar_storm_alert"] = storm_today.astype(bool)

    risk_cols = ["risk_bone", "risk_cardio", "risk_immune", "risk_behavioral", "risk_radiation"]
    df[risk_cols] = df[risk_cols].round(1)
    return df


def evaluate_thresholds(df):
    """Compare z-score gates while holding Isolation Forest predictions fixed."""
    key = pd.read_csv(os.path.join(DATA_DIR, "anomalies.csv"))
    truth = set(zip(key["astronaut"], key["day"]))

    z_cols = [f"z_{c}" for c in HEALTH_METRICS]
    active = df[df["day"] > WARMUP].copy()
    active["max_z"] = active[z_cols].abs().max(axis=1)

    results = []
    for threshold in np.arange(1.5, 4.01, 0.25):
        flagged = active[
            active["if_candidate"] & (active["max_z"] >= threshold)
        ]
        predicted = set(zip(flagged["astronaut"], flagged["day"]))

        caught_days = truth & predicted
        missed_days = truth - predicted
        false_alarms = predicted - truth

        key["caught"] = [
            (a, d) in predicted
            for a, d in zip(key["astronaut"], key["day"])
        ]
        events = key.groupby(["astronaut", "event_type"])["caught"].any()

        results.append({
            "threshold": round(float(threshold), 2),
            "events_caught": int(events.sum()),
            "total_events": len(events),
            "days_caught": len(caught_days),
            "missed_days": len(missed_days),
            "false_alarms": len(false_alarms),
            "precision": len(caught_days) / len(predicted) if predicted else 0,
            "recall": len(caught_days) / len(truth) if truth else 0,
        })

    results_df = pd.DataFrame(results)
    print("\n=== ANOMALY THRESHOLD EXPERIMENT ===")
    print(results_df.to_string(index=False, formatters={
        "precision": "{:.1%}".format,
        "recall": "{:.1%}".format,
    }))

    # Prioritize zero missed injected days, then minimize false alarms.
    best = results_df[results_df["missed_days"] == 0]
    if not best.empty:
        best = best.sort_values(
            ["false_alarms", "threshold"], ascending=[True, False]
        ).iloc[0]
        print("\n=== RECOMMENDED THRESHOLD ===")
        print(f"Threshold:       {best['threshold']}")
        print(f"Events caught:   {best['events_caught']}/{best['total_events']}")
        print(f"Bad days caught: {best['days_caught']}")
        print(f"False alarms:    {best['false_alarms']}")
        print(f"Precision:       {best['precision']:.1%}")
        print(f"Recall:          {best['recall']:.1%}")
    else:
        print("\nNo tested threshold caught all injected bad days. "
              "Keep the current threshold and investigate missed events.")

    return results_df

def inspect_missed_days(df):
    key = pd.read_csv(os.path.join(DATA_DIR, "anomalies.csv"))

    flagged = set(
        zip(
            df.loc[df["is_anomaly"], "astronaut"],
            df.loc[df["is_anomaly"], "day"]
        )
    )

    missed = key[
        ~key.apply(
            lambda row: (row["astronaut"], row["day"]) in flagged,
            axis=1
        )
    ]

    z_cols = [f"z_{c}" for c in HEALTH_METRICS]

    print("\n=== MISSED BAD DAYS DIAGNOSTIC ===")

    for _, event in missed.iterrows():
        row = df[
            (df["astronaut"] == event["astronaut"])
            & (df["day"] == event["day"])
        ]

        if row.empty:
            continue

        row = row.iloc[0]

        print(f"\nAstronaut: {event['astronaut']}")
        print(f"Day: {event['day']}")
        print(f"Event: {event['event_type']}")
        print(f"Isolation Forest candidate: {row['if_candidate']}")
        print(f"Maximum z-score: {row[z_cols].abs().max():.2f}")
        print(f"Sleep z-score: {row['z_sleep_hours']:.2f}")
        print(f"Isolation Forest score: {row['if_score']:.4f}")

def inspect_false_alarms(df):
    key = pd.read_csv(os.path.join(DATA_DIR, "anomalies.csv"))

    truth = set(zip(key["astronaut"], key["day"]))

    false_alarms = df[
        df["is_anomaly"]
        & ~df.apply(
            lambda row: (row["astronaut"], row["day"]) in truth,
            axis=1
        )
    ]

    z_cols = [f"z_{c}" for c in HEALTH_METRICS]

    print("\n=== FALSE ALARM METRIC ANALYSIS ===")

    for _, row in false_alarms.iterrows():

        # Identify the metric contributing the largest deviation
        metric = row[z_cols].abs().idxmax()

        print(
            f"{row['astronaut']} | Day {row['day']} | "
            f"Main metric: {metric} | "
            f"Z-score: {row[metric]:.2f} | "
            f"Symptoms: {row['symptoms']} | "
            f"IF score: {row['if_score']:.4f}"
        )

def evaluate_metric_thresholds(df):
    key = pd.read_csv(os.path.join(DATA_DIR, "anomalies.csv"))
    truth = set(zip(key["astronaut"], key["day"]))

    active = df[df["day"] > WARMUP].copy()

    z_cols = [f"z_{c}" for c in HEALTH_METRICS]

    results = []

    for metric in HEALTH_METRICS:
        z_col = f"z_{metric}"

        for threshold in [2.5, 3.0, 3.5, 4.0]:

            flagged = active[
                active["if_candidate"]
                & (active[z_col].abs() >= threshold)
            ]

            predicted = set(
                zip(flagged["astronaut"], flagged["day"])
            )

            caught = truth & predicted
            false_alarms = predicted - truth

            results.append({
                "metric": metric,
                "threshold": threshold,
                "caught_days": len(caught),
                "missed_days": len(truth - predicted),
                "false_alarms": len(false_alarms)
            })

    results_df = pd.DataFrame(results)

    print("\n=== METRIC-SPECIFIC THRESHOLD EXPERIMENT ===")
    print(results_df.to_string(index=False))

    return results_df
def evaluate(df):
    key = pd.read_csv(os.path.join(DATA_DIR, "anomalies.csv"))
    truth = set(zip(key["astronaut"], key["day"]))
    flagged = set(zip(df.loc[df["is_anomaly"], "astronaut"], df.loc[df["is_anomaly"], "day"]))

    caught_days = truth & flagged
    false_alarms = flagged - truth

    key["caught"] = [(a, d) in flagged for a, d in zip(key["astronaut"], key["day"])]
    events = key.groupby(["astronaut", "event_type"])["caught"].any()

    active_days = int((df["day"] > WARMUP).sum())
    precision = len(caught_days) / len(flagged) if flagged else 0
    recall = len(caught_days) / len(truth) if truth else 0

    print("=== AstroTwin anomaly detection: self-check ===")
    print(f"Bad events caught:      {events.sum()} of {len(events)}")
    print(f"Bad days caught:        {len(caught_days)} of {len(truth)}  (recall {recall:.0%})")
    print(f"False alarms:           {len(false_alarms)} out of {active_days} monitored days")
    print(f"Precision:              {precision:.0%}")
    return {
        "events_caught": int(events.sum()),
        "events_total": len(events),
        "recall": recall,
        "precision": precision,
        "false_alarms": len(false_alarms),
    }


def main():
    df = pd.read_csv(os.path.join(DATA_DIR, "crew.csv"))
    df = add_personal_baselines(df)
    df = detect_anomalies(df)
    df = add_risk_scores(df)
    df.to_csv(os.path.join(DATA_DIR, "crew_scored.csv"), index=False)
    print(f"Saved scored data to {DATA_DIR}/crew_scored.csv\n")

    evaluate(df)
    evaluate_thresholds(df)
    inspect_missed_days(df)
    inspect_false_alarms(df)
    evaluate_metric_thresholds(df)


    print("\nAverage risk on three key mission days (0-100):")
    cols = ["risk_bone", "risk_cardio", "risk_immune", "risk_behavioral", "risk_radiation"]
    print(df[df["day"].isin([30, 90, 110])].groupby("day")[cols].mean().round(0).to_string())


if __name__ == "__main__":
    main()
