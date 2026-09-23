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

## Folders

| Folder | What |
|---|---|
| `data/` | `generate.py` makes the 4 synthetic training datasets |
| `backend/` | FastAPI app: ML (`ml.py`, `train.py`), live pipeline + alerts (`engine.py`), REST (`main.py`), SQLite (`db.py`, `seed.py`), training content (`training.py`) |
| `simulator/` | `sim.py` virtual machines |
| `dashboard/` | React (Vite) dashboard: Live, Camera, Tasks, Incidents, Training, Simulator pages. Intentionally plain, to be restyled |
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

Model metrics: `backend/RESULTS.md`.

## Git workflow

- `main`: stable, demo runs from here.
- `test`: everyone pushes work here. `git pull origin test` often.
- Merge `test` into `main` when it runs end to end.
