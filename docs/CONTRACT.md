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

All fields camelCase. Only **bold** fields are required; the rest have defaults. Live docs: `http://localhost:8000/docs`. Bad enum values return 422.

**`POST /predict/speed`**: call on every telemetry tick
```json
{ "slopeDeg": 7.3, "machineType": "excavator", "accel": {"x":0.12,"y":-0.03,"z":9.78},
  "gyro": {"x":0.5,"y":1.2,"z":-0.1}, "vibration": 0.42, "loadPct": 50, "surface": "gravel" }
```
Required: **slopeDeg**. `machineType`: excavator | loader | dozer. `surface`: asphalt | gravel | sand | mud. If `accel` is missing it's derived from the slope.
→ `{ "speedKmh": 8.5, "slopeDeg": 7.3, "advisory": "Normal terrain." }`

**`POST /predict/fault`**: call on every telemetry tick (or every 5 s)
```json
{ "engineTempC": 92.4, "vibration": 0.42, "oilPressurePsi": 50, "rpm": 1600,
  "humidity": 61, "engineHours": 5000, "obstacleCm": 145 }
```
Required: **engineTempC, vibration**.
→ `{ "fault": "normal", "prob": 0.93, "probabilities": { "normal": 0.93, "overheating": 0.04, ... } }`
Fault classes: normal | overheating | bearing_wear | low_oil_pressure | sensor_fault.

**`POST /predict/task-time`**: call when loading today's tasks
```json
{ "taskType": "trenching", "machineId": "EXC-001", "operatorId": "OP-01", "volumeM3": 200,
  "soilType": "clay", "slopeDeg": 5, "tempC": 32, "weather": "clear", "timeOfDay": "morning" }
```
Required: **taskType** (trenching | digging | loading | backfilling | hauling | grading). `soilType`: sand | gravel | clay | rock. `weather`: clear | dust | fog | rain. `timeOfDay` defaults to the current time. `tempC` is the ambient air temp, not the engine temp. Operator experience is looked up from `operatorId` (OP-01..OP-10), or pass `operatorExperienceYrs`.
→ `{ "minutes": 42.5, "low": 36.1, "high": 49.0, "operatorExperienceYrs": 6.8 }` (low/high = 10th-90th percentile)

**`POST /predict/anomaly`**: gateway aggregates each machine over a 15-minute window, then calls once per window
```json
{ "idleMin": 11, "fuelUsedL": 2.1, "loadCycles": 3, "avgRpm": 850, "maxTiltDeg": 8,
  "harshEvents": 0, "overspeedEvents": 0, "seatbeltOffSec": 0, "proximityAlerts": 0 }
```
Required: **idleMin** (0-15).
→ `{ "anomaly": true, "reason": "excessive_idling", "reasons": ["excessive_idling"], "score": -0.08 }`
Reasons: normal | excessive_idling | unsafe_operation | fuel_waste | unusual_pattern.

`GET /health` → `{ "ok": true, "models": [...] }` · `GET /models` → metrics per model

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
