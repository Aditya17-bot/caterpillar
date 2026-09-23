# Member 3: Backend Gateway (`gateway/`)

Branch: `gateway`. You own `docs/CONTRACT.md`. You're the glue between hardware, ML and dashboard.

## Goal
Node.js + Express on port 4000: receives telemetry, runs alert rules, calls the ML service, stores to MongoDB, pushes live data over socket.io.

```
npm init -y
npm i express socket.io mongoose cors dotenv axios
npm i -D nodemon
```
MongoDB: local install or free MongoDB Atlas cluster. Put the URI in `.env` (commit `.env.example`).

## Step 0: SIMULATOR FIRST (first 2 hours)
`gateway/simulator.js` sends fake telemetry to `POST /api/telemetry` every 1 s, matching CONTRACT section 1. Include scenarios you can trigger: seatbelt off, obstacle close, overheating, long idling, steep slope. This unblocks the dashboard and is the demo backup if the hardware fails.

## MongoDB collections
- `operators`: id, name, rfid, certifications, safetyScore
- `machines`: id, type (excavator/loader), model
- `tasks`: operatorId, machineId, date, taskType, site, status, predictedMinutes, actualMinutes
- `incidents`: machineId, operatorId, type, severity, message, ts, telemetry snapshot
- `telemetry`: raw readings (TTL index, keep ~1 day)
- `training`: modules, progress (operatorId, moduleId, score), bookings

Write `gateway/seed.js` with demo operators, RFID UIDs (get them from Member 1's cards), today's tasks, and training modules.

## Tasks
1. [ ] Express skeleton, CORS, `/health`.
2. [ ] Simulator.
3. [ ] `POST /api/telemetry`: save, run rules, call `/predict/speed` + `/predict/fault` (don't block on ML: timeout 500 ms, skip on error), emit `telemetry` event.
4. [ ] Alert rules engine (`rules.js`) with thresholds from CONTRACT section 6. Debounce so the same alert doesn't fire every second. Critical alerts are saved to `incidents` and emitted as `alert`.
5. [ ] Idle tracking per machine (engine on, no movement, for > 5 min), then call `/predict/anomaly`.
6. [ ] `POST /api/auth/rfid`: look up the operator, emit `login`.
7. [ ] Listen for the dashboard `drowsy` socket event, then create an alert + incident.
8. [ ] REST: tasks (with `predictedMinutes` from `/predict/task-time`), incidents, training modules/progress/bookings, operator safety score.
9. [ ] Safety score: start at 100, subtract per incident weighted by severity, add back for completed training.
10. [ ] `npm run dev` / `npm run sim` / `npm run seed` scripts in package.json.

## Done when
`npm run sim` running, the dashboard shows live data and alerts, and the incidents land in MongoDB.
