# ML service

FastAPI on port 8000 serving 4 scikit-learn models. API formats: `docs/CONTRACT.md` section 3.

```
cd ml-service
pip install -r requirements.txt
python train.py                      # generates data if missing, trains, writes RESULTS.md
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/docs to try every endpoint in the browser.

The server trains the models automatically on first start if `models/` is empty (takes ~20 s). Model files are gitignored.

| File | What |
|---|---|
| `train.py` | Trains speed, fault, task-time, anomaly models into `models/*.joblib` |
| `main.py` | FastAPI endpoints |
| `RESULTS.md` | Metrics from the last training run (use in the pitch) |
| `tests/` | `python -m pytest tests -q` |
