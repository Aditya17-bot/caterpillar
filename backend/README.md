# Backend

One FastAPI app: ML models, live telemetry pipeline, alert rules, SQLite, WebSocket. Formats: `docs/CONTRACT.md`.

```
pip install -r requirements.txt
uvicorn main:app --reload --port 8000     # http://localhost:8000/docs
```
First start trains the models (if `models/` is empty) and seeds `app.db` (if missing).

| File | What |
|---|---|
| `main.py` | App, REST routes, WebSocket `/ws` |
| `engine.py` | Per-machine live state, ML calls, alert rules, usage windows → anomaly model |
| `ml.py` | Model loading, `/predict/*` routes |
| `train.py` | Trains 4 models → `models/*.joblib`, metrics → `RESULTS.md` |
| `db.py` / `seed.py` | SQLite helpers / demo data reset (`python seed.py`) |
| `training.py` | Training hub modules, quizzes, instructors |
| `tests/` | `python -m pytest tests -q` |

Env vars for demo timing: `WINDOW_SEC` (usage window, default 60), `IDLE_ALERT_SEC` (default 45).
