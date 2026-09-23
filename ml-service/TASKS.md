# Member 2: Machine Learning (`ml-service/`, `data/`)

Work on the `test` branch. Read `docs/CONTRACT.md` section 3. It defines the exact request/response for each endpoint.

## Goal
FastAPI service on port 8000 serving 4 scikit-learn models, plus a Teachable Machine drowsiness model for the dashboard.

## Step 0: dummy endpoints (first 1-2 hours)
Stand up FastAPI with all 4 endpoints returning hardcoded values so Member 3 can integrate right away. Then swap in real models.

```
pip install fastapi uvicorn scikit-learn pandas numpy joblib
uvicorn main:app --reload --port 8000
```
Enable CORS. Add `GET /health`.

## Data
- Ask the organizers for the dataset shown in the problem statement table (Machine ID, Fuel, Idling, ...). Use it if it's available.
- Otherwise write `data/generate.py`: synthetic data with realistic rules, e.g.
  - speed drops as the uphill slope rises, capped downhill for safety
  - fault = overheating when temp > 105, bearing_wear when vibration is high, else normal
  - task time grows with slope, temp, and task difficulty; per-operator skill factor
- Save CSVs to `data/`. Commit the generator script, not huge CSVs.

## Models
| Endpoint              | Model                          | Inputs                                         | Output             |
|-----------------------|--------------------------------|------------------------------------------------|--------------------|
| `/predict/speed`      | RandomForestRegressor          | accel xyz, gyro xyz, slopeDeg                  | speedKmh           |
| `/predict/fault`      | RandomForestClassifier         | engineTempC, vibration, obstacleCm             | fault + prob       |
| `/predict/task-time`  | GradientBoosting / RF Regressor| machineId, taskType, slopeDeg, engineTempC, operatorId | minutes    |
| `/predict/anomaly`    | IsolationForest + rules        | idleSec, engineTempC, vibration, slopeDeg      | anomaly, reason, score |

Anomaly `reason` should be human readable: `excessive_idling`, `harsh_operation`, `abnormal_temp`, etc. (use simple rules to label what the IsolationForest flagged).

## Tasks
1. [x] FastAPI skeleton + dummy endpoints (Pydantic models matching the contract).
2. [x] `data/generate.py` synthetic data.
3. [x] Training notebooks/scripts in `ml-service/train/`, saving `.joblib` to `ml-service/models/` (gitignored, so add a `train_all.py` that rebuilds them).
4. [x] Real models behind the endpoints.
5. [x] Record metrics (R², MAE, accuracy, confusion matrix) in `ml-service/RESULTS.md`. Judges love numbers and charts.
6. [ ] Teachable Machine: Image project, classes `alert` / `drowsy` (eyes closed, head nodding) / `no_face`. Collect webcam samples from all 4 teammates. Export as TensorFlow.js, upload, and give the model URL to Member 4.
7. [ ] Bonus: feature importance plot for the speed model (shows slope matters).

## Done when
`curl -X POST localhost:8000/predict/speed -d '{...}'` returns sane values, and the gateway shows predicted speed live on the dashboard.
