# API contract

Backend: `http://localhost:8000` (interactive docs at `/docs`). Dashboard: `http://localhost:5173`.
Change a format only after telling the team; the simulator, backend and dashboard all depend on it.

## 1. Telemetry: simulator (or ESP32) → backend

`POST /api/telemetry` every 1 s per machine. Only `machineId` is required; missing fields get safe defaults.

```json
{
  "machineId": "EXC-001", "machineType": "excavator", "rfid": "A1B2C3D4", "ts": 1727080000.0,
  "engineOn": true, "seatbelt": true,
  "engineTempC": 92.4, "humidity": 61.0, "obstacleCm": 145,
  "accel": { "x": 1.2, "y": -0.03, "z": 9.7 }, "gyro": { "x": 0.5, "y": 1.2, "z": -0.1 },
  "slopeDeg": 7.3, "vibration": 0.42, "speedKmh": 6.1, "rpm": 1700,
  "oilPressurePsi": 50, "engineHours": 5123.4, "loadPct": 70, "surface": "gravel",
  "fuelRateLph": 24.5, "loadCycle": false, "harshEvent": false,
  "phase": "work", "scenarios": []
}
```

- `rfid` present = operator logged in (looked up in the operators table); `null` = logged out.
- `loadCycle`: true on the tick a bucket cycle completes. `harshEvent`: sudden jolt this tick.
- `phase`, `scenarios`: simulator-only debug info, shown on the Simulator page.

Response: `{ "ok": true, "commands": [ { "command": "overheat", "field": null, "value": null } ] }`.
Commands are queued with `POST /api/sim/command` (dashboard Simulator page).

| command | effect |
|---|---|
| `normal` | clear all scenarios |
| `set` + `field`/`value` | `engineOn`, `seatbelt`, `login` (true/false) |
| `overheat`, `worker_approach`, `steep_slope`, `unbuckle`, `long_idle`, `overspeed`, `bearing_wear`, `low_oil`, `fuel_waste`, `harsh` | timed scenario |

## 2. Camera events: dashboard → backend

`POST /api/events/camera` `{ "machineId": "EXC-001", "kind": "drowsy" | "person", "confidence": 0.9 }`
Re-send every ~2 s while the condition lasts; the alert clears 8 s after the last event.

## 3. WebSocket: backend → dashboard

`ws://localhost:8000/ws`. Every message is `{ "event": "...", "data": {...} }`.

| event | data |
|---|---|
| `snapshot` | list of machine summaries (sent on connect) |
| `telemetry` | machine summary: `{ machineId, machineType, online, operator, telemetry, predictions: { optimalSpeedKmh, advisory, fault, faultProb }, activeAlerts: [...] }` |
| `alert` | `{ id, machineId, operatorId, type, severity: "warning" \| "critical", message, ts }` |
| `alert_cleared` | `{ machineId, type }` |
| `login` / `logout` | `{ machineId, operator }` / `{ machineId }` |
| `insight` | usage window result: `{ machineId, operatorId, ts, features, anomaly, reason, reasons, score }` |
| `machine_offline` | `{ machineId }` (no telemetry for 5 s) |

Alert types and rules (in `backend/engine.py`):

| type | rule |
|---|---|
| `seatbelt` | engine on, belt off > 5 s → critical |
| `proximity` | engine on, obstacle < 100 cm warning, < 50 cm critical |
| `overheat` | engine temp > 100 °C warning, > 110 °C critical |
| `unsafe_tilt` | abs(slope) > 25° → critical |
| `engine_fault` | ML fault ≠ normal with ≥ 60% confidence (critical for overheating / low oil) |
| `overspeed` | speed > 1.25 × ML advised speed + 1 → warning |
| `idling` | engine on, stationary > `IDLE_ALERT_SEC` (demo 45 s, real 300 s) → warning |
| `anomaly` | usage-window anomaly model flags the last window → warning |
| `drowsy` / `camera_person` | camera events → critical / warning |
| `overheat_predicted` | linear trend of last ~30 s reaches 110 °C within 3 min → warning (`predictions.overheatEtaSec`) |

Usage windows last `WINDOW_SEC` (demo 60 s, real 900 s) and are scaled to 15 minutes before scoring.

## 4. REST

| method | path | notes |
|---|---|---|
| GET | `/api/machines` | fleet with live state |
| GET | `/api/machines/{id}/history` | last ~3 min of readings |
| GET | `/api/alerts/active` | |
| GET | `/api/operators`, `/api/operators/{id}`, `/api/operators/{id}/score` | safety score = 100 − 5·critical − 2·warning (7 days) + 3·modules passed |
| GET | `/api/tasks?machineId=&operatorId=&day=YYYY-MM-DD` | today by default; includes `predicted_minutes`, `predicted_low`, `predicted_high`, `factors` (top effects in minutes) and, for the running task, `pace` (`progressPct`, `projectedMinutes`, `deltaMin`) |
| PATCH | `/api/tasks/{id}` | `{ "status": "pending" \| "in_progress" \| "done" }`; done records `actual_minutes` |
| GET | `/api/incidents?machineId=&operatorId=&type=&severity=&limit=` | newest first, with sensor `snapshot` |
| GET | `/api/insights/windows?machineId=&limit=` | past usage windows |
| GET | `/api/training/modules?operatorId=` | modules (no answers), `bestScore`, `recommended`, `instructors` |
| POST | `/api/training/progress` | `{ operatorId, moduleId, answers: [int] }` → `{ score, passed }` |
| GET/POST | `/api/training/bookings` | `{ operatorId, instructor, slot, topic }` |
| GET | `/api/shift/{machineId}` | live shift report: stats (totals, averages, peaks), tasks, incidents, cost, scores, highlights |
| POST | `/api/shift/{machineId}/end` | `{ lang }` → final report + `summary` (AI or offline) + `source`; saved, counters restart |
| GET | `/api/shift-reports?machineId=&operatorId=` | saved reports |
| POST | `/api/copilot/chat` | `{ machineId, message, history: [{role, content}], lang }` → `{ reply, source: "claude" \| "offline" }` |
| POST | `/api/copilot/briefing` | `{ machineId, lang }` → `{ reply, source }` |
| POST | `/api/training/sim-result` | `{ operatorId, score, avgReactionMs, hazards, missed }` (stored as module `hazard-sim`) |
| GET | `/api/impact` | fleet fuel/idle/CO₂/cost numbers + yearly projection |
| GET | `/api/leaderboard` | operators by safety score, with hazard-sim best |
| GET | `/health`, `/models` | status, model metrics |

## 5. ML endpoints (also used internally)

camelCase JSON, only **bold** fields required. Bad enum values → 422.

- `POST /predict/speed` **slopeDeg**, machineType, accel, gyro, vibration, loadPct, surface → `{ speedKmh, slopeDeg, advisory }`
- `POST /predict/fault` **engineTempC, vibration**, oilPressurePsi, rpm, humidity, engineHours, obstacleCm → `{ fault, prob, probabilities }`
- `POST /predict/task-time` **taskType**, machineId, machineType, operatorId, operatorExperienceYrs, volumeM3, soilType, slopeDeg, tempC, weather, timeOfDay → `{ minutes, low, high, operatorExperienceYrs }`
- `POST /predict/anomaly` **idleMin**, fuelUsedL, loadCycles, avgRpm, maxTiltDeg, harshEvents, overspeedEvents, seatbeltOffSec, proximityAlerts → `{ anomaly, reason, reasons, score }`

Enums: machineType excavator | loader | dozer · surface asphalt | gravel | sand | mud · taskType trenching | digging | loading | backfilling | hauling | grading · soilType sand | gravel | clay | rock · weather clear | dust | fog | rain · timeOfDay morning | afternoon | night.
