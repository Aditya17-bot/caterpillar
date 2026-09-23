# Smart Operator Assistant for CAT Machinery

An end-to-end intelligent companion for excavator/loader operators: live safety monitoring, daily tasks, training, anomaly detection and ML predictions.

## Architecture

No physical hardware: sensors are simulated by a virtual machine control panel. The ESP32 circuit is designed in Wokwi to show the hardware path.

```
simulator (virtual ESP32) ──HTTP POST──▶ gateway (Node/Express :4000) ──HTTP──▶ ml-service (FastAPI :8000)
 + control panel :5174              │   │
                                     │   └── MongoDB (operators, tasks, incidents, telemetry)
                                     │
                              WebSocket (socket.io)
                                     ▼
                         dashboard (React :5173)  ◀── webcam drowsiness (Teachable Machine, in browser)
```

## Folders

| Folder        | Owner    | What                                                        |
|---------------|----------|-------------------------------------------------------------|
| `simulator/`  | Member 1 | Virtual machine control panel, headless sim, Wokwi circuit, demo |
| `ml-service/` | Member 2 | FastAPI + scikit-learn models, training notebooks           |
| `gateway/`    | Member 3 | Express API, WebSocket, MongoDB, alert rules, safety score |
| `dashboard/`  | Member 4 | React dashboard, training hub, drowsiness webcam            |
| `data/`       | Member 2 | Datasets (real or synthetic) for training                   |
| `docs/`       | All      | `CONTRACT.md` = shared JSON formats. Change only with team agreement. |

## Features vs problem statement

| Problem statement requirement        | Our feature                                                        |
|--------------------------------------|--------------------------------------------------------------------|
| Daily task dashboard                 | Operator logs in via RFID, sees today's tasks + predicted time     |
| Seatbelt compliance                  | Seatbelt signal (simulated), alert if engine on + belt off         |
| Proximity hazards                    | HC-SR04 distance, tiered warning/critical alerts                   |
| Incident logging                     | Every critical alert auto-saved to MongoDB, incident log page      |
| Working conditions                   | DHT22 temp/humidity, MPU6050 slope, factored into ML models        |
| Operator training hub                | Videos + quizzes + instructor booking + score tracking             |
| Unusual behavior (idling, unsafe)    | Idle-time rule + IsolationForest anomaly model, harsh-tilt events  |
| Task time estimation                 | Regression model (task type, slope, temp, operator history)        |
| Extra                                | Drowsiness (webcam), engine fault classifier, smart speed advisor, operator safety score |

## Git workflow

Two branches:
- `main`: stable, always runnable. Demo runs from here.
- `test`: everyone pushes work here. Pull often (`git pull origin test`) to avoid conflicts.

When `test` runs end to end, merge `test` into `main`.

Each person's task list is in their folder: `simulator/TASKS.md`, `ml-service/TASKS.md`, `gateway/TASKS.md`, `dashboard/TASKS.md`.

## Datasets

```
pip install numpy pandas
python data/generate.py
```
Creates 4 CSVs in `data/` (gitignored, regenerate anytime).
