# Member 1: Virtual Machine Simulator + Demo (`simulator/`)

Work on the `test` branch. Read `docs/CONTRACT.md` sections 1 and 2. You send exactly that JSON.

## Why no real hardware
We don't build physical hardware. Instead you build a **virtual CAT machine** that behaves like the ESP32 + sensors would, so the whole system is demoable anywhere. For the "we thought about hardware" story, you also design the circuit in **Wokwi** (free online ESP32 simulator) and show it in the pitch.

## Part A: Machine Control Panel (main job, first priority)
A small web page (plain HTML+JS or Vite, your choice) at `http://localhost:5174` that acts as the machine's cab.

Controls:
- Machine picker: `EXC-001` (excavator), `LDR-002` (loader), run several at once for a fleet view
- RFID "tap card" buttons, one per demo operator (sends `POST /api/auth/rfid`)
- Engine ON/OFF toggle, Seatbelt toggle
- Sliders: engine temp (20 to 130 °C), obstacle distance (0 to 400 cm), slope (-35° to +35°), vibration (0 to 2)
- Every 1 s: build telemetry JSON (CONTRACT section 1) and `POST /api/telemetry`. Add small random noise so the charts look real.
- Derive `accel`/`gyro` from the slope slider (accel.x = 9.81·sin(slope), accel.z = 9.81·cos(slope)) so the ML speed model gets consistent inputs.

Scenario buttons (one click, scripted, for the demo):
- "Unbuckled seatbelt": engine on, belt off
- "Worker approaching": obstacle slides 300 to 30 cm over 5 s
- "Overheating": temp climbs to 115 °C
- "Long idle": engine on, no movement (fast-forward the idle timer)
- "Steep slope": slope goes to 28°
- "Normal shift": everything nominal

## Part B: Headless mode
`simulator/sim.js` (Node): same logic without UI, `node sim.js --machines 3 --scenario random`. It runs in the background so the dashboard always has data. It's also the backup if anything breaks during the demo.

## Part C: Wokwi "virtual hardware" (for the pitch)
- At https://wokwi.com make an ESP32 project with DHT22, HC-SR04, MPU6050, a push button (seatbelt), a buzzer, and an LED. (RC522 RFID isn't in Wokwi, so use a button labeled "RFID" or mention it on the slide.)
- Write the Arduino sketch: read sensors, compute slope with `atan2`, build the JSON, beep on local alerts. It doesn't need to reach our gateway; printing JSON to Serial is enough to show.
- Save the project link + screenshots to `simulator/WOKWI.md`, and commit the `.ino` to `simulator/esp32/`.

## Part D: Demo owner
- Write `docs/DEMO.md`: a 3 to 5 minute demo script (login, normal ops, each alert, training hub, predictions).
- Build the pitch deck: problem, architecture diagram, features vs problem statement, ML results (from Member 2), future scope (real CAT telematics, VisionLink integration).
- Record a backup demo video.

## Tasks (in order)
1. [ ] Headless `sim.js` sending contract JSON (Member 3 and 4 need this in the first 2 hours).
2. [ ] Control panel page with sliders + toggles.
3. [ ] Scenario buttons.
4. [ ] RFID tap + multi-machine.
5. [ ] Wokwi circuit + sketch.
6. [ ] DEMO.md + deck + backup video.

## Done when
Moving a slider changes the dashboard live, and each scenario button fires the right alert on the dashboard.
