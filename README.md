# Smart Operator Assistant for CAT Machinery

An end-to-end intelligent companion for excavator/loader operators: live safety monitoring, daily tasks, training, anomaly detection and ML predictions.

## Architecture

```
ESP32 + sensors ──HTTP POST──▶ gateway (Node/Express :4000) ──HTTP──▶ ml-service (FastAPI :8000)
 (RFID, DHT22, HC-SR04,              │   │
  MPU6050, seatbelt)                 │   └── MongoDB (operators, tasks, incidents, telemetry)
                                     │
                              WebSocket (socket.io)
                                     ▼
                         dashboard (React :5173)  ◀── webcam drowsiness (Teachable Machine, in browser)
```

## Folders

| Folder        | Owner    | What                                                        |
|---------------|----------|-------------------------------------------------------------|
| `firmware/`   | Member 1 | ESP32 Arduino code, sensor reads, POST telemetry            |
| `ml-service/` | Member 2 | FastAPI + scikit-learn models, training notebooks           |
| `gateway/`    | Member 3 | Express API, WebSocket, MongoDB, alert rules, simulator     |
| `dashboard/`  | Member 4 | React dashboard, training hub, drowsiness webcam            |
| `data/`       | Member 2 | Datasets (real or synthetic) for training                   |
| `docs/`       | All      | `CONTRACT.md` = shared JSON formats. Change only with team agreement. |

## Features vs problem statement

| Problem statement requirement        | Our feature                                                        |
|--------------------------------------|--------------------------------------------------------------------|
| Daily task dashboard                 | Operator logs in via RFID, sees today's tasks + predicted time     |
| Seatbelt compliance                  | Seatbelt switch on ESP32, alert if engine on + belt off            |
| Proximity hazards                    | HC-SR04 distance, tiered warning/critical alerts                   |
| Incident logging                     | Every critical alert auto-saved to MongoDB, incident log page      |
| Working conditions                   | DHT22 temp/humidity, MPU6050 slope, factored into ML models        |
| Operator training hub                | Videos + quizzes + instructor booking + score tracking             |
| Unusual behavior (idling, unsafe)    | Idle-time rule + IsolationForest anomaly model, harsh-tilt events  |
| Task time estimation                 | Regression model (task type, slope, temp, operator history)        |
| Extra                                | Drowsiness (webcam), engine fault classifier, smart speed advisor, operator safety score |

## Git workflow

- `main` always runnable. No direct pushes.
- Branch per feature: `firmware/rfid`, `ml/speed-model`, `gateway/websocket`, `ui/training-hub`.
- Open a PR, one teammate reviews, merge.
- Pull `main` often.
