# Member 4: Frontend Dashboard (`dashboard/`)

Branch: `dashboard`. Read `docs/CONTRACT.md` sections 4 and 5 for the socket events and REST endpoints.

## Goal
React live dashboard for the operator: the face of the project. Judges mostly see this, so make it clean and CAT-themed (black/yellow `#FFCD11`).

```
npm create vite@latest . -- --template react
npm i socket.io-client axios react-router-dom recharts
npm i @teachablemachine/image @tensorflow/tfjs
```
Tailwind or MUI, your choice. Keep the gateway URL in `.env` (`VITE_API_URL=http://localhost:4000`).

## Until gateway is ready
Use a local mock: a `setInterval` that emits fake telemetry/alerts matching the contract. Switch to the real socket later (one flag).

## Pages
1. **Login / Operator card**: waits for the `login` socket event (RFID tap) and shows the operator's name, photo and certifications. Add a manual login fallback for the demo.
2. **Live cockpit (main page)**
   - Gauges: engine temp, obstacle distance, slope (tilt graphic), predicted optimal speed
   - Seatbelt + engine status indicators
   - Alert feed (color by severity), with a full-screen red flash + sound on critical
   - Mini charts (recharts) for temp/slope over the last 60 s
3. **Today's tasks**: list from `GET /api/tasks`, predicted time per task, start/complete buttons, progress bar.
4. **Incident log**: table with filters by type/severity/date.
5. **Training hub**
   - Module cards: embedded YouTube videos (CAT safety/operation videos)
   - Short quiz after each video; score saved via `POST /api/training/progress`
   - Instructor booking form (date/time slot)
   - Optional: "suggested training" driven by the operator's incidents (e.g. many seatbelt violations lead to the seatbelt module)
6. **Safety score / insights**: operator score, anomaly history (idling, harsh use), trends.

## Drowsiness (webcam)
- Load the Teachable Machine model URL from Member 2.
- Run predictions every ~500 ms on the webcam feed.
- `drowsy` above 0.8 for 2 s or more: emit the socket `drowsy` event `{ machineId, confidence }` and show a big warning.
- Small webcam preview in the corner of the cockpit.

## Tasks
1. [ ] Vite app, routing, layout, theme.
2. [ ] Socket hook (`useSocket`) + mock data mode.
3. [ ] Cockpit page.
4. [ ] Tasks page.
5. [ ] Incident log.
6. [ ] Training hub.
7. [ ] Drowsiness webcam.
8. [ ] Safety score page.
9. [ ] Polish: responsive (tablet in a cab), dark theme, smooth alert animations.

## Done when
With the simulator running, every page shows live data, and triggering each scenario shows the right alert.
