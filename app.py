"""
AstroTwin - Step 4: The dashboard
=================================

A Streamlit web app that shows everything from Steps 1-3:
  - Mission replay: drag a slider through all 180 days of the trip to Mars
  - Five risk gauges per astronaut (bone, cardio, immune, behavioral, radiation)
  - Alerts with plain-language actions
  - Trend charts with each astronaut's personal "normal" band
  - Real NASA space-weather events from DONKI
  - A daily check-in form
  - The model's self-check results

Run it with:   streamlit run app.py
(Run generate_data.py, model.py and donki.py first.)
"""

import os

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

DATA_DIR = "data"
MISSION_DAYS = 180
WINDOW = 14

RISKS = {
    "risk_bone": "Bone",
    "risk_cardio": "Cardiovascular",
    "risk_immune": "Immune",
    "risk_behavioral": "Behavioral",
    "risk_radiation": "Radiation",
}

METRICS = {
    "resting_hr": ("Resting heart rate", "bpm"),
    "systolic_bp": ("Systolic blood pressure", "mmHg"),
    "sleep_hours": ("Sleep", "hours"),
    "exercise_min": ("Exercise", "minutes"),
    "mood": ("Mood", "1-5"),
}

# Plain-language actions shown when a metric is unusual.
# Direction: +1 means "too high" is the problem, -1 means "too low".
ACTIONS = {
    "resting_hr": (+1, "Heart rate above your normal: rest, hydrate, and re-check in 2 hours. "
                       "Report to the flight surgeon if it is still high tomorrow."),
    "systolic_bp": (+1, "Blood pressure above your normal: reduce salt and caffeine today, "
                        "re-measure this evening."),
    "sleep_hours": (-1, "Sleep below your normal: dim lights 1 hour before rest, and ask the "
                        "commander to protect your next sleep period."),
    "exercise_min": (-1, "Exercise below target: schedule resistance exercise. Bone loss speeds "
                         "up on low-exercise days."),
    "mood": (-1, "Mood below your normal: book a private call home or with the crew "
                 "psychologist, and join a crew activity."),
}

GREEN, YELLOW, RED = "#2E9E5B", "#E0A526", "#D64545"


def risk_color(value):
    if value >= 70:
        return RED
    if value >= 40:
        return YELLOW
    return GREEN


def risk_label(value):
    if value >= 70:
        return "High"
    if value >= 40:
        return "Watch"
    return "OK"


# ---------------------------------------------------------------------------
# Data loading (cached so the app stays fast)
# ---------------------------------------------------------------------------
@st.cache_data
def load_crew():
    df = pd.read_csv(os.path.join(DATA_DIR, "crew_scored.csv"), parse_dates=["date"])
    # Personal normal band for charts: mean +/- 2 spreads of the previous 14 days
    for col in METRICS:
        g = df.groupby("astronaut")[col]
        df[f"mean_{col}"] = g.transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=7).mean())
        df[f"std_{col}"] = g.transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=7).std())
    return df


@st.cache_data
def load_space_weather():
    path = os.path.join(DATA_DIR, "space_weather.csv")
    if not os.path.exists(path):
        return pd.DataFrame(columns=["date", "mission_day", "type", "detail", "severity", "link"])
    return pd.read_csv(path)


@st.cache_data
def load_answer_key():
    path = os.path.join(DATA_DIR, "anomalies.csv")
    return pd.read_csv(path) if os.path.exists(path) else None


# ---------------------------------------------------------------------------
# Small building blocks
# ---------------------------------------------------------------------------
def gauge(value, title):
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=value,
        number={"valueformat": ".0f", "font": {"size": 30}},
        title={"text": f"{title}<br><span style='font-size:13px'>{risk_label(value)}</span>",
               "font": {"size": 16}},
        gauge={
            "axis": {"range": [0, 100], "tickwidth": 1, "tickvals": [0, 40, 70, 100],
                     "tickfont": {"size": 10}},
            "bar": {"color": risk_color(value), "thickness": 0.75},
            "steps": [
                {"range": [0, 40], "color": "rgba(46,158,91,0.12)"},
                {"range": [40, 70], "color": "rgba(224,165,38,0.15)"},
                {"range": [70, 100], "color": "rgba(214,69,69,0.15)"},
            ],
        },
    ))
    fig.update_layout(height=230, margin=dict(l=35, r=35, t=70, b=10))
    return fig


def unusual_metrics(row, threshold=2.5):
    """Return [(metric, z, action)] for metrics clearly outside this person's normal."""
    found = []
    for col, (direction, action) in ACTIONS.items():
        z = row.get(f"z_{col}", 0)
        if pd.notna(z) and direction * z >= threshold:
            found.append((col, z, action))
    return found


def trend_chart(person, metric, day, storm_days):
    label, unit = METRICS[metric]
    data = person[person["day"] <= day]
    mean, std = data[f"mean_{metric}"], data[f"std_{metric}"]

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=data["day"], y=mean + 2 * std, line=dict(width=0),
                             showlegend=False, hoverinfo="skip"))
    fig.add_trace(go.Scatter(x=data["day"], y=mean - 2 * std, line=dict(width=0),
                             fill="tonexty", fillcolor="rgba(46,158,91,0.15)",
                             name="Personal normal range", hoverinfo="skip"))
    fig.add_trace(go.Scatter(x=data["day"], y=data[metric], mode="lines",
                             line=dict(color="#3A6EA5", width=2), name=label))
    flagged = data[data["is_anomaly"]]
    fig.add_trace(go.Scatter(x=flagged["day"], y=flagged[metric], mode="markers",
                             marker=dict(color=RED, size=10, symbol="x"),
                             name="Flagged by AI"))
    for d in storm_days:
        if d <= day:
            fig.add_vline(x=d, line=dict(color="#9B59B6", dash="dot", width=1))
    fig.update_layout(height=320, margin=dict(l=10, r=10, t=30, b=10),
                      xaxis_title="Mission day", yaxis_title=f"{label} ({unit})",
                      xaxis_range=[1, MISSION_DAYS],
                      legend=dict(orientation="h", y=1.12))
    return fig


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------
st.set_page_config(page_title="AstroTwin", page_icon="🛰️", layout="wide")

missing = [f for f in ["crew_scored.csv"] if not os.path.exists(os.path.join(DATA_DIR, f))]
if missing:
    st.error("Data not found. Run `python generate_data.py` and `python model.py` first.")
    st.stop()

crew = load_crew()
weather = load_space_weather()
high_events = weather[weather["severity"] == "high"]
storm_days = sorted(high_events["mission_day"].unique())

# --- Sidebar: mission replay controls ---
st.sidebar.title("🛰️ AstroTwin")
st.sidebar.caption("Your health copilot when Earth is 20 minutes away")
day = st.sidebar.slider("Mission day (replay)", 1, MISSION_DAYS, 90)
astronaut = st.sidebar.selectbox("Astronaut", sorted(crew["astronaut"].unique()))
st.sidebar.markdown("---")
st.sidebar.caption("Health data is simulated. Space-weather events are real, "
                   "from NASA's DONKI database.")

today = crew[(crew["day"] == day)].set_index("astronaut")
person = crew[crew["astronaut"] == astronaut].sort_values("day")
row = today.loc[astronaut]

# --- Header ---
st.title(f"Mission day {day} of {MISSION_DAYS}")
st.caption(f"{row['date']:%d %B %Y} · Transit to Mars · Crew of {len(today)}")

# --- Alerts ---
events_now = weather[weather["mission_day"].between(day - 1, day)]
if row["solar_storm_alert"] or not events_now[events_now["severity"] == "high"].empty:
    details = "; ".join(events_now.loc[events_now["severity"] == "high", "detail"].unique()[:3])
    st.error(f"☢️ **SOLAR STORM ALERT** — move the crew to the shielded shelter now. "
             f"{('NASA DONKI: ' + details) if details else ''}")

flags = unusual_metrics(row)
if row["is_anomaly"] or flags:
    st.warning(f"**{astronaut}: today looks unusual for you.**")
    for col, z, action in flags:
        st.markdown(f"- **{METRICS[col][0]}** is {abs(z):.1f}× your normal spread. {action}")
elif not row["solar_storm_alert"]:
    st.success(f"{astronaut}: all readings within your personal normal today.")

tab_crew, tab_trends, tab_weather, tab_checkin, tab_model = st.tabs(
    ["Crew status", "Trends", "Space weather", "Daily check-in", "How well it works"])

# --- Tab 1: gauges + crew table ---
with tab_crew:
    st.subheader(f"{astronaut} — risk by NASA risk area")
    cols = st.columns(len(RISKS))
    for c, (key, label) in zip(cols, RISKS.items()):
        c.plotly_chart(gauge(float(row[key]), label), width="stretch",
                       key=f"gauge_{key}")

    st.subheader("Whole crew today")
    table = today[list(RISKS)].rename(columns=RISKS)
    table["Flag"] = ["⚠️ Check" if v else "" for v in today["is_anomaly"]]
    st.dataframe(
        table.style.format({v: "{:.0f}" for v in RISKS.values()})
                   .map(lambda v: f"color: {risk_color(v)}; font-weight: 600"
                        if isinstance(v, (int, float)) else "",
                        subset=list(RISKS.values())),
        width="stretch",
    )
    st.caption(f"Cumulative radiation dose: {row['cumulative_dose_msv']:.0f} mSv "
               f"of NASA's 600 mSv career limit · Bone density: "
               f"{row['bone_density_pct']:.1f}% of pre-flight")

# --- Tab 2: trends ---
with tab_trends:
    metric = st.selectbox("Measurement", list(METRICS), format_func=lambda m: METRICS[m][0])
    st.plotly_chart(trend_chart(person, metric, day, storm_days), width="stretch")
    st.caption("Green band = this astronaut's own normal range (previous 14 days). "
               "Red ✕ = days the AI flagged. Purple lines = major real solar events.")

    risk_hist = person[person["day"] <= day]
    fig = go.Figure()
    for key, label in RISKS.items():
        fig.add_trace(go.Scatter(x=risk_hist["day"], y=risk_hist[key], name=label, mode="lines"))
    fig.update_layout(height=300, margin=dict(l=10, r=10, t=30, b=10),
                      xaxis_title="Mission day", yaxis_title="Risk (0-100)",
                      xaxis_range=[1, MISSION_DAYS], yaxis_range=[0, 100],
                      legend=dict(orientation="h", y=1.15))
    st.plotly_chart(fig, width="stretch")

# --- Tab 3: space weather ---
with tab_weather:
    if weather.empty:
        st.info("No space-weather data yet. Run `python donki.py`.")
    else:
        so_far = weather[weather["mission_day"] <= day]
        st.metric("Real solar events so far this mission", len(so_far),
                  f"{(so_far['severity'] == 'high').sum()} high severity", delta_color="off")
        colors = so_far["severity"].map({"high": RED, "moderate": YELLOW, "low": GREEN})
        fig = go.Figure(go.Scatter(
            x=so_far["mission_day"], y=so_far["type"], mode="markers",
            marker=dict(size=12, color=colors), text=so_far["detail"],
            hovertemplate="Day %{x}<br>%{text}<extra></extra>"))
        fig.update_layout(height=260, margin=dict(l=10, r=10, t=10, b=10),
                          xaxis_title="Mission day", xaxis_range=[1, MISSION_DAYS])
        st.plotly_chart(fig, width="stretch")
        st.dataframe(so_far[["date", "mission_day", "type", "detail", "severity"]]
                     .sort_values("mission_day", ascending=False),
                     width="stretch", hide_index=True)
        st.caption("Source: NASA DONKI (Space Weather Database Of Notifications, "
                   "Knowledge, Information), via NASA CCMC.")

# --- Tab 4: daily check-in ---
with tab_checkin:
    st.subheader(f"1-minute check-in for {astronaut}")
    history = person[(person["day"] < day) & (person["day"] >= day - WINDOW)]
    if len(history) < 7:
        st.info("Move the slider past day 8 so AstroTwin has a week of history to compare against.")
    else:
        with st.form("checkin"):
            c1, c2, c3 = st.columns(3)
            entry = {
                "resting_hr": c1.number_input("Resting heart rate (bpm)", 30, 200,
                                              int(history["resting_hr"].mean())),
                "systolic_bp": c1.number_input("Systolic blood pressure (mmHg)", 70, 220,
                                               int(history["systolic_bp"].mean())),
                "sleep_hours": c2.number_input("Sleep last night (hours)", 0.0, 14.0,
                                               round(float(history["sleep_hours"].mean()), 1), 0.5),
                "exercise_min": c2.number_input("Exercise today (minutes)", 0, 300,
                                                int(history["exercise_min"].mean())),
                "mood": c3.slider("Mood (1 = very low, 5 = great)", 1, 5,
                                  int(round(history["mood"].mean()))),
            }
            c3.checkbox("Any symptoms today?", key="symptoms")
            submitted = st.form_submit_button("Check against my normal")

        if submitted:
            any_flag = False
            for col, value in entry.items():
                mean, std = history[col].mean(), max(history[col].std(), 1e-6)
                z = (value - mean) / std
                direction, action = ACTIONS[col]
                label, unit = METRICS[col]
                if direction * z >= 2.5:
                    any_flag = True
                    st.warning(f"**{label}: {value} {unit}** — unusual for you "
                               f"(your normal is about {mean:.1f}). {action}")
                else:
                    st.markdown(f"✅ **{label}: {value} {unit}** — within your normal "
                                f"(about {mean:.1f}).")
            if st.session_state.get("symptoms"):
                st.warning("Symptoms reported: log them in the medical record and repeat "
                           "the check-in tomorrow morning.")
            elif not any_flag:
                st.success("Everything looks normal for you today.")

# --- Tab 5: model self-check ---
with tab_model:
    key = load_answer_key()
    st.subheader("How well does the AI catch problems?")
    st.write("We hid health events (illness, insomnia, heart-rate spikes) in the simulated "
             "data, then checked whether AstroTwin found them without being told.")
    if key is not None:
        truth = set(zip(key["astronaut"], key["day"]))
        flagged = set(zip(crew.loc[crew["is_anomaly"], "astronaut"],
                          crew.loc[crew["is_anomaly"], "day"]))
        key["caught"] = [(a, d) in flagged for a, d in zip(key["astronaut"], key["day"])]
        events = key.groupby(["astronaut", "event_type"])["caught"].any()
        monitored = int((crew["day"] > WINDOW).sum())
        false_alarms = len(flagged - truth)

        c1, c2, c3 = st.columns(3)
        c1.metric("Health events caught", f"{events.sum()} of {len(events)}")
        c2.metric("Bad days caught", f"{len(truth & flagged)} of {len(truth)}")
        c3.metric("False alarm rate", f"{false_alarms / monitored:.1%}",
                  f"{false_alarms} of {monitored} days", delta_color="off")
        st.caption("Tuned to miss nothing: on the way to Mars, a missed illness costs more "
                   "than an extra check-in.")
    st.markdown("**How it works:** for each astronaut and each measurement, AstroTwin learns "
                "a personal normal from the previous 14 days (rolling z-scores). An Isolation "
                "Forest then looks for days that are unusual across several measurements at "
                "once.")
