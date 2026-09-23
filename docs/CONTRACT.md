# Shared contract (agree on this first, then everyone works in parallel)

## Ports
- gateway: `http://localhost:4000`
- ml-service: `http://localhost:8000`
- dashboard: `http://localhost:5173`
- MongoDB: `mongodb://localhost:27017/cat_assistant`

## 1. Telemetry: simulator (virtual ESP32) → gateway
`POST /api/telemetry` every 1 s

```json
{
  "machineId": "EXC-001",
  "rfid": "A1B2C3D4",
  "ts": 1727080000,
  "engineOn": true,
  "seatbelt": false,
  "engineTempC": 92.4,
  "humidity": 61.0,
  "obstacleCm": 145,
  "accel": { "x": 0.12, "y": -0.03, "z": 9.78 },
  "gyro":  { "x": 0.5,  "y": 1.2,   "z": -0.1 },
  "slopeDeg": 7.3,
  "vibration": 0.42
}
```

## 2. Operator login: simulator → gateway
`POST /api/auth/rfid` `{ "rfid": "A1B2C3D4", "machineId": "EXC-001" }`
→ `{ "ok": true, "operator": { "id": "OP-01", "name": "Ravi", "certified": ["excavator"] } }`

## 3. ML service (gateway → ml-service)

`POST /predict/speed` `{ "accel": {...}, "gyro": {...}, "slopeDeg": 7.3 }` → `{ "speedKmh": 8.5 }`

`POST /predict/fault` `{ "engineTempC": 92.4, "vibration": 0.42, "obstacleCm": 145 }` → `{ "fault": "overheating", "prob": 0.87 }`

`POST /predict/task-time` `{ "machineId": "EXC-001", "taskType": "trenching", "slopeDeg": 7.3, "engineTempC": 92.4, "operatorId": "OP-01" }` → `{ "minutes": 42.5 }`

`POST /predict/anomaly` `{ "idleSec": 900, "engineTempC": 92.4, "vibration": 0.42, "slopeDeg": 7.3 }` → `{ "anomaly": true, "reason": "excessive_idling", "score": -0.21 }`

## 4. WebSocket: gateway → dashboard (socket.io)

| Event       | Payload                                                                 |
|-------------|-------------------------------------------------------------------------|
| `telemetry` | telemetry object + `{ "predictedSpeedKmh": 8.5 }`                       |
| `alert`     | `{ "id", "machineId", "type", "severity": "info|warning|critical", "message", "ts" }` |
| `login`     | operator object                                                         |

Alert `type` values: `seatbelt`, `proximity`, `overheat`, `drowsy`, `engine_fault`, `idling`, `unsafe_tilt`, `anomaly`.

Dashboard → gateway: `drowsy` event `{ "machineId", "confidence" }` (from Teachable Machine webcam).

## 5. REST for dashboard
- `GET /api/tasks?operatorId=OP-01&date=2026-09-23` → tasks with `predictedMinutes`
- `PATCH /api/tasks/:id` `{ "status": "done" }`
- `GET /api/incidents?machineId=EXC-001`
- `GET /api/training/modules`, `POST /api/training/progress`, `POST /api/training/bookings`
- `GET /api/operators/:id/score` → safety score

## 6. Alert thresholds (gateway rules)
- seatbelt: `engineOn && !seatbelt` for > 5 s → critical
- proximity: `< 100 cm` warning, `< 50 cm` critical
- overheat: `> 100 °C` warning, `> 110 °C` critical
- idling: `engineOn` and speed ~0 for > 5 min → warning
- unsafe_tilt: `|slopeDeg| > 25` → critical
