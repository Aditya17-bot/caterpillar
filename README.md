# Smart Operator Assistant for CAT Machinery

An end-to-end intelligent companion for excavator/loader operators: live safety monitoring, daily tasks with ML time estimates, training hub, unusual-behavior detection, and in-browser camera AI (drowsiness + person detection).

## Architecture

```
simulator/sim.py  ── POST /api/telemetry every 1 s ──▶  backend (FastAPI :8000)
 (virtual machines,     ◀── queued commands in response ──   ├─ 4 ML models (scikit-learn)
  scenarios)                                                  ├─ alert rules → incidents (SQLite)
                                                              ├─ 15-min usage windows → anomaly model
                                                              └─ WebSocket /ws
                                                                   │
dashboard (React :5173)  ◀────────── live telemetry, alerts ───────┘
 └─ camera AI in the browser (MediaPipe eyes, Teachable Machine, COCO-SSD)
      └─ POST /api/events/camera when drowsy / person near
```

No physical hardware: the simulator plays the role of the ESP32 + sensors (RFID, DHT22, HC-SR04, MPU6050, seatbelt switch). It sends the same JSON a real board would, so swapping in hardware later changes nothing downstream.

## Run it (3 terminals)

```bash
# 1. backend (first start trains models + seeds DB, ~20 s)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. simulator
pip install httpx
python simulator/sim.py              # add --chaos 30 for random scenarios

# 3. dashboard
cd dashboard
npm install
npm run dev                          # http://localhost:5173
```

API docs: http://localhost:8000/docs. Reset demo data: `cd backend && python seed.py`.

**Voice co-pilot with Claude:** set `ANTHROPIC_API_KEY` (or run `ant auth login`) before starting the backend. Without credentials the co-pilot still works in offline mode (rule-based answers from the same live data). Voice input needs Chrome or Edge.

## Folders

| Folder | What |
|---|---|
| `data/` | `generate.py` makes the 4 synthetic training datasets |
| `backend/` | FastAPI app: ML (`ml.py`, `train.py`), live pipeline + alerts (`engine.py`), REST (`main.py`), SQLite (`db.py`, `seed.py`), training content (`training.py`) |
| `simulator/` | `sim.py` virtual machines |
| `dashboard/` | React (Vite) dashboard: Live, Camera, Tasks, Shift, Incidents, Training, Supervisor, Simulator pages + floating voice co-pilot. Intentionally plain, to be restyled |
| `docs/` | `CONTRACT.md` API formats · `TEAM.md` who does what next |

## Features vs problem statement

| Problem statement | Implementation |
|---|---|
| Daily task dashboard | Tasks page: today's tasks per machine with ML predicted time + range, start/complete, actual vs predicted |
| Seatbelt compliance | Engine on + belt off > 5 s → critical alert + incident |
| Proximity hazards | Distance sensor tiers (< 1 m warning, < 50 cm critical) + camera person detection (COCO-SSD) |
| Incident logging | Every warning/critical alert saved with a sensor snapshot; filterable incident log |
| Working conditions | Slope, surface, temp, weather feed the speed and task-time models; terrain advisory |
| Operator training hub | Modules with videos + graded quizzes, instructor booking, recommendations driven by the operator's incidents |
| Unusual behavior | Idle timer alert + IsolationForest on 15-min usage windows (idling, unsafe operation, fuel waste) |
| Task time estimation | RandomForest on task type, volume, soil, slope, weather, operator experience |
| Extra | Engine fault classifier, ML speed advisor + overspeed alert, drowsiness (MediaPipe + optional Teachable Machine), operator safety score |

## Differentiators

| Feature | What it does |
|---|---|
| Voice co-pilot (Claude) | Hands-free Q&A from live data ("why the alert?", "how long left?"), start-of-shift briefing, speaks critical alerts aloud, English + Indian languages |
| Predictive warnings | Overheat countdown from the temperature trend before the limit is hit; live task pace ("finishes 12 min late") from load cycles |
| Explainable estimates | Each task time shows its top factors ("rock soil +49 min, 12° slope +8 min") |
| Shift report | End of shift: totals, averages, peaks, fuel cost, CO₂, grade, highlights, and an AI-written summary; printable, saved |
| Hazard response simulator | 60 s training drill (worker, seatbelt, slope, overheat) scored on reaction time, feeds the safety score |
| Supervisor view | Fleet table, operator safety ranking, business impact (idle fuel cost, CO₂, yearly saving if idling halved) |
| Machine view | Live tilt drawing of the machine and a proximity radar |
| Site map | Game-style top-down map: shaded terrain with contours or slope-danger colours, danger zones (pit edge, pedestrian area, power line, gas pipe), every machine with heading, trail and label, proximity rings, minimap, hover for elevation/slope. Machines drive over the real terrain, so the slope sensor matches the map |
| Geofence + machine proximity | Alerts when a machine enters a zone or comes within 20 m / 10 m of another machine |
| SOS | Button, voice ("SOS", "help me") or automatic on rollover (> 35°) or breakdown. Every machine within 300 m gets distance + direction and can respond; shown live on the map |
| Pre-start inspection | Daily walk-around checklist with defect photo; critical defects lock the machine out (engine interlock) and open an urgent maintenance request |
| Maintenance booking | Book service, suggested from the ML fault model; status flow requested → scheduled → in progress → done |
| Incident black box | Every incident records 60 s before / 30 s after: readings, alert timeline, machine path; replay with a scrubber |

Model metrics: `backend/RESULTS.md`.

## Git workflow

- `main`: stable, demo runs from here.
- `test`: everyone pushes work here. `git pull origin test` often.
- Merge `test` into `main` when it runs end to end.
