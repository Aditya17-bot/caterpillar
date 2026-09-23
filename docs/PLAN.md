# Build order

Nobody waits for anybody. Everyone builds against `CONTRACT.md` using fake data first, then swaps in the real thing.

| Who needs          | Real thing from | Fake it with until ready                          |
|--------------------|-----------------|---------------------------------------------------|
| Dashboard          | Gateway         | Local mock `setInterval` emitting contract events |
| Gateway            | Simulator       | curl / Postman with contract JSON                 |
| Gateway            | ML service      | ML dummy endpoints (hardcoded values)             |
| Simulator          | Gateway         | `console.log` the JSON                            |

## Phase 1: Skeletons talk (first ~2-3 h). Goal: data flows end to end, all fake.
- Simulator: `sim.js` POSTs contract JSON every 1 s.
- Gateway: `POST /api/telemetry` re-emits over socket.io. `/health`.
- ML: FastAPI with 4 dummy endpoints.
- Dashboard: Vite app + socket hook, prints live telemetry on screen.
- **Checkpoint:** run all 4 on one laptop. The number on the dashboard changes every second. Merge all branches to `main`.

## Phase 2: Real features (bulk of time)
- Simulator: control panel, sliders, scenario buttons.
- Gateway: MongoDB, rules engine, incidents, tasks, training APIs.
- ML: synthetic data, train real models, Teachable Machine drowsiness.
- Dashboard: cockpit, tasks, incident log, training hub.
- **Checkpoint every ~3 h:** merge to `main`, run everything together, fix contract mismatches.

## Phase 3: Integrate & polish (last ~4 h)
- Real ML models plugged into the gateway, predictions on the dashboard.
- Drowsiness webcam, safety score, anomaly/idling alerts.
- Run through `docs/DEMO.md` start to finish at least twice.
- Freeze features 1 h before the end. Only bug fixes after that.
