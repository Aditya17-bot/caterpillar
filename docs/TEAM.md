# Who does what next

A working end-to-end version exists (see README → Run it). Everyone starts from it and improves their part. Work on `test`, pull often.

## Member 1: Simulator & demo (`simulator/`, `docs/`)
- [ ] Learn every scenario on the Simulator page; tune durations/values in `sim.py` so each alert is clearly visible in the demo.
- [ ] Optional: Wokwi (wokwi.com) ESP32 circuit with DHT22, HC-SR04, MPU6050, button as seatbelt, and a sketch that prints the telemetry JSON. Screenshot for the pitch ("hardware-ready").
- [ ] `docs/DEMO.md`: 3 to 5 minute demo script: login → normal work → seatbelt → worker approaching → overheating/ML fault → drowsiness camera → tasks & predicted time → training recommendation → incident log.
- [ ] Pitch deck: problem, architecture diagram, features vs problem statement table (README), model metrics (`backend/RESULTS.md`), future scope.
- [ ] Record a backup demo video.

## Member 2: ML & camera AI (`data/`, `backend/train.py`, `dashboard/src/pages/Camera.jsx`)
- [ ] Teachable Machine drowsiness model: Image project, classes `alert`, `drowsy`, `no_face`; 200 to 300 images each from all teammates (vary light, glasses, helmet). Export → TensorFlow.js → Upload → paste the URL into the Camera page field. MediaPipe eye detection already works without it.
- [ ] Tune the eye-openness threshold (default 0.21) and the person-near threshold on real webcams.
- [ ] Charts for the pitch: feature importance (speed), confusion matrix (fault), predicted vs actual (task time).
- [ ] Optional: use the organizers' dataset if they share it; retrain with `python backend/train.py`.

## Member 3: Backend (`backend/`)
- [ ] Read `engine.py` (live pipeline + alert rules) and `main.py` (REST). Run `python -m pytest backend/tests -q`.
- [ ] Operator shift summary endpoint: hours worked, idle %, incidents, fuel, tasks done.
- [ ] Record actual task durations and feed them back into task-time training (append to `data/task_history.csv`).
- [ ] Optional: MongoDB instead of SQLite if the judges care about the stack (only `db.py` changes).
- [ ] Keep `docs/CONTRACT.md` accurate.

## Member 4: Dashboard (`dashboard/`)
The current UI is deliberately plain. Make it good:
- [ ] CAT theme (black / `#FFCD11`), cockpit-style layout for a tablet in the cab.
- [ ] Gauges for speed vs advised speed, tilt graphic, obstacle distance radar.
- [ ] Full-screen flash + sound for critical alerts; acknowledge button.
- [ ] Operator login screen (shows when RFID login event arrives).
- [ ] Nicer tasks timeline, incident charts, safety score visual.
- [ ] Keep all data calls in `src/api.js`; don't change API formats without telling Member 3.

## Checkpoints
- Every ~3 h: pull `test`, run all 3 parts together, fix anything broken.
- 1 h before the end: freeze features, merge `test` → `main`, rehearse the demo twice.
