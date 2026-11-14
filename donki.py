"""
AstroTwin - Step 3: Real NASA space-weather data (DONKI)
========================================================

DONKI is NASA's Space Weather Database Of Notifications, Knowledge, Information.
It records real events on the Sun that can harm astronauts:

  - FLR : solar flares (classes C < M < X; X is the strongest)
  - GST : geomagnetic storms (strength measured by the Kp index, 0-9)
  - SEP : solar energetic particle events (bursts of radiation in space)

This script downloads every such event during our mission window
(2024-02-11 to 2024-08-08), places each one on the mission timeline
(mission day 1-180), and saves a clean table for the dashboard.

It also saves the raw download to data/donki_cache.json. If the internet or
NASA's server is down during your demo, the script uses that cache instead.

Output: data/space_weather.csv

Run it with:   python donki.py
(No API key needed for the main CCMC address. NASA_API_KEY is only used
 by the old api.nasa.gov fallback.)
"""

import json
import os
import time
from datetime import date, timedelta

import pandas as pd
import requests

DATA_DIR = "data"
CACHE_FILE = os.path.join(DATA_DIR, "donki_cache.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "space_weather.csv")

MISSION_START = date(2024, 2, 11)      # must match generate_data.py
MISSION_DAYS = 180
MISSION_END = MISSION_START + timedelta(days=MISSION_DAYS - 1)

API_KEY = os.environ.get("NASA_API_KEY", "DEMO_KEY")

# Official addresses for the same data, tried in order.
# NASA's CCMC moved DONKI to the first address on 30 Sep 2026 (no key needed);
# the older two are kept only as fallbacks.
SOURCES = [
    ("https://ccmc.gsfc.nasa.gov/DONKI-API/get/{endpoint}", {}),
    ("https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/{endpoint}", {}),
    ("https://api.nasa.gov/DONKI/{endpoint}", {"api_key": API_KEY}),
]
ENDPOINTS = ["FLR", "GST", "SEP"]


# ---------------------------------------------------------------------------
# 1. Download (with fallback to the saved cache)
# ---------------------------------------------------------------------------
CHUNK_DAYS = 30        # the new CCMC API accepts at most 60 days per request
HEADERS = {"User-Agent": "AstroTwin-SpaceApps/1.0", "Accept": "application/json"}


def date_chunks():
    """Split the 180-day mission into 30-day pieces."""
    start = MISSION_START
    while start <= MISSION_END:
        end = min(start + timedelta(days=CHUNK_DAYS - 1), MISSION_END)
        yield start, end
        start = end + timedelta(days=1)


def get_json(url, params):
    """One request, with a single polite retry if NASA says 'too many requests'."""
    for attempt in range(2):
        response = requests.get(url, params=params, headers=HEADERS, timeout=30)
        if response.status_code == 429 and attempt == 0:
            wait = int(response.headers.get("Retry-After", "10"))
            print(f"  rate limited, waiting {wait}s...")
            time.sleep(min(wait, 60))
            continue
        response.raise_for_status()
        return response.json() or []     # raises ValueError if NASA sent HTML
    response.raise_for_status()


def fetch_endpoint(endpoint):
    for url_template, extra in SOURCES:
        url = url_template.format(endpoint=endpoint)
        events, seen = [], set()
        try:
            for start, end in date_chunks():
                params = {"startDate": start.isoformat(), "endDate": end.isoformat(), **extra}
                for record in get_json(url, params):
                    # The same event can appear in two chunks; keep it once.
                    event_id = next((v for k, v in record.items() if k.endswith("ID")), None)
                    if event_id in seen:
                        continue
                    seen.add(event_id)
                    events.append(record)
                time.sleep(0.5)          # be gentle with NASA's server
            return events
        except (requests.RequestException, ValueError) as error:
            print(f"  could not reach {url}: {error}")
    return None


def download_all():
    raw = {}
    for endpoint in ENDPOINTS:
        print(f"Downloading {endpoint} events from NASA DONKI...")
        result = fetch_endpoint(endpoint)
        if result is None:
            return None                     # signal: use the cache
        raw[endpoint] = result
        print(f"  got {len(result)} events")
    return raw


def load_raw():
    raw = download_all()
    if raw is not None:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(CACHE_FILE, "w") as f:
            json.dump(raw, f, indent=2)
        print(f"Saved raw NASA data to {CACHE_FILE}")
        return raw
    if os.path.exists(CACHE_FILE):
        print(f"NASA server unreachable - using saved cache {CACHE_FILE}")
        with open(CACHE_FILE) as f:
            return json.load(f)
    raise SystemExit("No internet and no cache yet. Run this once while online.")


# ---------------------------------------------------------------------------
# 2. Turn NASA's raw records into one clean table
# ---------------------------------------------------------------------------
def to_mission_day(timestamp):
    """'2024-05-10T17:00Z' -> (date, mission day number)"""
    event_date = date.fromisoformat(timestamp[:10])
    return event_date, (event_date - MISSION_START).days + 1


def parse_flares(records):
    rows = []
    for r in records:
        flare_class = (r.get("classType") or "")
        if not flare_class or flare_class[0] not in ("M", "X"):
            continue                        # skip weak C/B-class flares
        event_date, day = to_mission_day(r.get("peakTime") or r["beginTime"])
        rows.append({
            "date": event_date, "mission_day": day, "type": "Solar flare",
            "detail": f"Class {flare_class} flare",
            "severity": "high" if flare_class[0] == "X" else "moderate",
            "link": r.get("link", ""),
        })
    return rows


def parse_storms(records):
    rows = []
    for r in records:
        kp_values = [k.get("kpIndex", 0) for k in r.get("allKpIndex", [])]
        max_kp = max(kp_values) if kp_values else 0
        event_date, day = to_mission_day(r["startTime"])
        rows.append({
            "date": event_date, "mission_day": day, "type": "Geomagnetic storm",
            "detail": f"Max Kp index {max_kp:g}",
            "severity": "high" if max_kp >= 8 else ("moderate" if max_kp >= 6 else "low"),
            "link": r.get("link", ""),
        })
    return rows


def parse_particles(records):
    rows = []
    for r in records:
        event_date, day = to_mission_day(r["eventTime"])
        rows.append({
            "date": event_date, "mission_day": day, "type": "Solar particle event",
            "detail": "Burst of energetic particles (direct radiation risk to crew)",
            "severity": "high",
            "link": r.get("link", ""),
        })
    return rows


def build_table(raw):
    rows = (parse_flares(raw.get("FLR", []))
            + parse_storms(raw.get("GST", []))
            + parse_particles(raw.get("SEP", [])))
    table = pd.DataFrame(rows, columns=["date", "mission_day", "type", "detail", "severity", "link"])
    table = table[(table["mission_day"] >= 1) & (table["mission_day"] <= MISSION_DAYS)]
    return table.sort_values(["mission_day", "type"]).reset_index(drop=True)


def main():
    raw = load_raw()
    table = build_table(raw)
    table.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved {len(table)} space-weather events to {OUTPUT_FILE}")
    print(table["severity"].value_counts().to_string())

    print("\nEvents around mission day 90 (our solar-storm scene):")
    around = table[table["mission_day"].between(85, 95)]
    if around.empty:
        print("  none found in days 85-95")
    else:
        print(around[["date", "mission_day", "type", "detail", "severity"]].to_string(index=False))


if __name__ == "__main__":
    main()
