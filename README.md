# AstroTwin: a personal health digital twin for astronauts

**NASA Space Apps Challenge 2026 · Challenge: Create Health Monitoring Software for Astronauts on Space Missions**

> On the way to Mars, a message to Earth can take up to 20 minutes each way. Astronauts must notice health problems themselves. AstroTwin learns each astronaut's personal normal, flags unusual days with machine learning, and warns the crew about real solar storms from NASA's DONKI database.

**Live demo:** https://astrotwin.streamlit.app
**Demo video:** coming soon

---

## What it does

| Feature | How it helps |
|---|---|
| **1-minute daily check-in** | Heart rate, blood pressure, sleep, exercise, mood, symptoms |
| **Personal baselines** | Compares each astronaut with *their own* last 14 days, not a population average |
| **AI anomaly detection** | An Isolation Forest flags days that are unusual across several measurements at once |
| **Five NASA risk gauges** | Bone, cardiovascular, immune, behavioral and radiation risk, 0–100 |
| **Real space weather** | Solar flares, geomagnetic storms and particle events from NASA DONKI trigger shelter alerts |
| **Action guidance** | Every alert comes with plain-language next steps |
| **Mission replay** | A slider moves through all 180 days of a simulated trip to Mars |

## Results

We hid 8 health events (illness, insomnia, heart-rate spikes) across 13 days in the simulated data. AstroTwin was never told where they were.

| Measure | Result |
|---|---|
| Health events caught | **8 of 8** |
| Bad days caught | **12 of 13** (92% recall) |
| False alarms | 13 of 664 monitored days (**2.0%**) |

The system is tuned to miss nothing. On a Mars mission, a missed illness costs far more than an extra check-in.

## The mission story

The simulated mission starts on 11 February 2024, so mission day 90 falls on **10 May 2024**. On that day the crew meets a real event: NASA DONKI records X-class solar flares and a burst of energetic particles. A strong X2.9 flare follows on day 95.

| Mission day | What happens |
|---|---|
| 35 | Commander Ayesha falls ill. Her heart rate leaves her personal normal range and AstroTwin flags it |
| 90 | Real solar storm: shelter alert, radiation risk jumps |
| 91–120 | Month-4 slump: sleep and mood drop across the crew, behavioral risk turns red |
| 180 | About 8% bone loss after six months: bone risk is high |

## How it works

```
generate_data.py  →  data/crew.csv             simulated 180-day mission, 4 crew
model.py          →  data/crew_scored.csv      baselines, anomaly flags, risk scores
donki.py          →  data/space_weather.csv    real NASA space-weather events
app.py            →  Streamlit dashboard
```

1. **Personal baseline.** For each astronaut and measurement, `z = (today − mean of previous 14 days) / spread of previous 14 days`. Only past days are used, as in real operations.
2. **Anomaly detection.** One scikit-learn `IsolationForest` per astronaut on the size of each z-score plus symptoms. A flag is kept only if at least one measurement is clearly unusual (|z| ≥ 2.5).
3. **Risk scores.**
   - Bone: cumulative bone loss plus a low-exercise penalty
   - Cardiovascular: heart rate and blood pressure above personal normal
   - Immune: recent symptoms plus sleep debt
   - Behavioral: 7-day mood and sleep below the astronaut's pre-mission normal
   - Radiation: share of NASA's 600 mSv career limit used, plus a storm-day spike

## Data

- **NASA DONKI** (Space Weather Database Of Notifications, Knowledge, Information), via NASA's Community Coordinated Modeling Center: solar flares (FLR), geomagnetic storms (GST) and solar energetic particle events (SEP), 11 Feb – 8 Aug 2024. These are **real** events.
- **Astronaut health data is simulated.** Real astronaut medical records are private. Trends are modelled on published spaceflight findings: about 1–1.5% bone loss per month in microgravity, about 1.8 mSv/day of radiation in deep space (similar to what the Curiosity rover measured on its way to Mars), and the mid-mission mood dip often reported in isolation studies.

## Run it yourself

### 1 — Generate the data (Python, one-time)

```bash
pip install -r requirements.txt
python generate_data.py   # simulated 180-day mission
python model.py           # ML baselines, anomaly flags, risk scores
python donki.py           # real NASA DONKI space-weather events
```

### 2 — Next.js web dashboard (recommended)

> Requires Node.js 18+

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

For production:

```bash
cd frontend
npm run build
npm start
```

### 3 — Streamlit dashboard (original)

```bash
streamlit run app.py
```

## Why it matters on Earth

The same personal-baseline approach works for polar research crews, submarine crews, remote workers, and older adults living alone: anyone far from a doctor who needs to notice change early.

## Limitations and next steps

- Health data is simulated. The next step is testing on public wearable datasets.
- Risk score weights are hand-set. They could be calibrated with clinical guidance.
- Radiation dose in a real storm depends on shielding. A future version could model the shelter.

## Team

Built in 48 hours for NASA Space Apps 2026 by Nimra Faryal ([@nimrafaryal](https://github.com/nimrafaryal)) and team. Full team list coming soon.

*NASA does not endorse this project. Health data shown is simulated and is not medical advice.*
