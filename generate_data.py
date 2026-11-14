"""
AstroTwin - Step 1: Simulated mission data generator
=====================================================

Real astronaut medical records are private, so we create realistic
SIMULATED data for a 180-day trip to Mars with 4 crew members.

What this script does:
  1. Gives each astronaut their own "normal" (personal baseline).
  2. Simulates 180 days of daily check-ins for each astronaut.
  3. Adds realistic slow trends (bone loss, a mid-mission mood slump).
  4. Adds a solar storm on mission day 90 (radiation spike).
  5. Secretly injects a few "bad days" (illness, insomnia, heart spikes)
     and writes them to a separate answer-key file, so later we can test
     whether our ML model finds them.

Output files (in the data/ folder):
  - crew.csv       : one row per astronaut per day (what the app sees)
  - anomalies.csv  : the answer key of injected bad days (for evaluation only)

Run it with:   python generate_data.py
"""

import os
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# 1. Settings you can change
# ---------------------------------------------------------------------------
SEED = 42                      # fixed seed = same data every run (reproducible)
MISSION_DAYS = 180             # length of the trip to Mars
MISSION_START = "2024-02-11"   # day 1. Day 90 lands on 2024-05-10, the date of a
                               # real, very strong solar storm we will pull from
                               # NASA's DONKI database in Step 3.
SOLAR_EVENT_DAY = 90
OUTPUT_DIR = "data"

rng = np.random.default_rng(SEED)

# Each astronaut has their own normal values. This is what makes the
# "personal digital twin" idea work: 66 bpm is normal for one person
# but unusual for another.
CREW = [
    {"name": "Commander Ayesha", "resting_hr": 58, "systolic_bp": 112, "sleep_hours": 7.2, "mood": 4.2},
    {"name": "Pilot Daniel",     "resting_hr": 64, "systolic_bp": 120, "sleep_hours": 6.8, "mood": 3.9},
    {"name": "Engineer Mei",     "resting_hr": 61, "systolic_bp": 108, "sleep_hours": 7.5, "mood": 4.0},
    {"name": "Scientist Omar",   "resting_hr": 67, "systolic_bp": 124, "sleep_hours": 6.5, "mood": 3.7},
]

# Injected "bad days": (astronaut index, start day, type, number of days)
# All are after day 14, so the model has two weeks to learn each baseline.
INJECTED_EVENTS = [
    (0, 34,  "illness",  2),
    (0, 132, "hr_spike", 1),
    (1, 51,  "insomnia", 2),
    (1, 148, "illness",  2),
    (2, 70,  "hr_spike", 1),
    (2, 110, "insomnia", 2),
    (3, 42,  "hr_spike", 1),
    (3, 160, "illness",  2),
]


# ---------------------------------------------------------------------------
# 2. Helper: simulate one astronaut for the whole mission
# ---------------------------------------------------------------------------
def simulate_astronaut(person):
    rows = []
    bone_density = 100.0          # % of pre-flight bone density
    dates = pd.date_range(MISSION_START, periods=MISSION_DAYS, freq="D")

    for day in range(1, MISSION_DAYS + 1):
        # --- Exercise: astronauts aim for about 2 hours a day ---
        exercise = rng.normal(115, 20)
        if rng.random() < 0.08:              # some busy days with little exercise
            exercise = rng.normal(40, 10)
        exercise = float(np.clip(exercise, 0, 180))

        # --- Bone loss: about 1-1.5% per month in microgravity,
        #     faster on days with little exercise ---
        daily_loss = 1.25 / 30
        if exercise < 60:
            daily_loss *= 1.8
        bone_density -= daily_loss + rng.normal(0, 0.005)

        # --- Month 4 slump (days 91-120): sleep and mood dip, a pattern
        #     often reported in isolation studies ---
        slump = 1.0 if 91 <= day <= 120 else 0.0

        resting_hr = rng.normal(person["resting_hr"], 2.0)
        systolic_bp = rng.normal(person["systolic_bp"], 4.0)
        sleep = rng.normal(person["sleep_hours"] - 0.5 * slump, 0.4)
        mood = rng.normal(person["mood"] - 0.7 * slump, 0.35)
        symptoms = 1 if rng.random() < 0.03 else 0   # occasional minor complaint

        # --- Radiation: about 1.8 mSv/day in deep space (similar to what
        #     Curiosity measured on its way to Mars), plus a spike on the
        #     solar event days. Spike size is illustrative. ---
        radiation = rng.normal(1.8, 0.1)
        if day == SOLAR_EVENT_DAY:
            radiation += 25.0
        elif day == SOLAR_EVENT_DAY + 1:
            radiation += 8.0

        rows.append({
            "date": dates[day - 1].date(),
            "day": day,
            "astronaut": person["name"],
            "resting_hr": resting_hr,
            "systolic_bp": systolic_bp,
            "sleep_hours": sleep,
            "exercise_min": exercise,
            "mood": mood,
            "symptoms": symptoms,
            "radiation_msv": radiation,
            "bone_density_pct": bone_density,
        })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 3. Helper: inject the bad days into the data
# ---------------------------------------------------------------------------
def inject_events(df):
    answer_key = []
    for crew_idx, start_day, kind, length in INJECTED_EVENTS:
        name = CREW[crew_idx]["name"]
        for d in range(start_day, start_day + length):
            mask = (df["astronaut"] == name) & (df["day"] == d)
            if kind == "illness":
                df.loc[mask, "resting_hr"] += 12
                df.loc[mask, "sleep_hours"] -= 1.5
                df.loc[mask, "mood"] -= 1.0
                df.loc[mask, "exercise_min"] *= 0.3
                df.loc[mask, "symptoms"] = 1
            elif kind == "insomnia":
                df.loc[mask, "sleep_hours"] -= 3.0
                df.loc[mask, "mood"] -= 1.2
            elif kind == "hr_spike":
                df.loc[mask, "resting_hr"] += 15
                df.loc[mask, "systolic_bp"] += 15
            answer_key.append({"astronaut": name, "day": d, "event_type": kind})
    return df, pd.DataFrame(answer_key)


# ---------------------------------------------------------------------------
# 4. Main: build everything and save
# ---------------------------------------------------------------------------
def main():
    df = pd.concat([simulate_astronaut(p) for p in CREW], ignore_index=True)
    df, answer_key = inject_events(df)

    # Keep values realistic and tidy
    df["sleep_hours"] = df["sleep_hours"].clip(2, 10)
    df["mood"] = df["mood"].clip(1, 5)
    for col in ["resting_hr", "systolic_bp", "exercise_min"]:
        df[col] = df[col].round(0)
    for col in ["sleep_hours", "mood", "radiation_msv"]:
        df[col] = df[col].round(2)
    df["bone_density_pct"] = df["bone_density_pct"].round(3)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df.to_csv(os.path.join(OUTPUT_DIR, "crew.csv"), index=False)
    answer_key.to_csv(os.path.join(OUTPUT_DIR, "anomalies.csv"), index=False)

    # Quick summary so you can see it worked
    print(f"Saved {len(df)} rows for {df['astronaut'].nunique()} astronauts "
          f"to {OUTPUT_DIR}/crew.csv")
    print(f"Saved {len(answer_key)} injected bad days to {OUTPUT_DIR}/anomalies.csv\n")
    print("Bone density at end of mission (% of pre-flight):")
    print(df[df["day"] == MISSION_DAYS][["astronaut", "bone_density_pct"]]
          .to_string(index=False))
    print(f"\nTotal radiation per astronaut: "
          f"{df.groupby('astronaut')['radiation_msv'].sum().mean():.0f} mSv")


if __name__ == "__main__":
    main()
