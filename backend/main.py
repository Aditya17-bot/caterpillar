"""Smart Operator Assistant backend: REST + WebSocket + ML in one FastAPI app.

Run from backend/:
    uvicorn main:app --reload --port 8000

API docs: http://localhost:8000/docs · formats: docs/CONTRACT.md
"""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from datetime import date
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import engine
import ml
import seed
import training


@asynccontextmanager
async def lifespan(_: FastAPI):
    ml.load_models()
    if not db.DB_PATH.exists():
        seed.seed()
    db.init()
    task = asyncio.create_task(engine.housekeeping())
    yield
    task.cancel()


app = FastAPI(title="CAT Smart Operator Assistant", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(ml.router)


def _operator(row: Dict) -> Dict:
    row["certified"] = json.loads(row.get("certified") or "[]")
    return row


# ---------- machine data in ----------

@app.post("/api/telemetry", tags=["machine"])
async def telemetry(payload: Dict[str, Any]):
    """Called by the simulator (or a real ESP32) every second. Response carries queued commands."""
    if "machineId" not in payload:
        raise HTTPException(422, "machineId required")
    return await engine.ingest(payload)


class CameraEvent(BaseModel):
    machineId: str
    kind: Literal["drowsy", "person"]
    confidence: float = 1.0


@app.post("/api/events/camera", tags=["machine"])
async def camera(ev: CameraEvent):
    """Browser camera detections (drowsiness, person). Re-send while the condition lasts."""
    await engine.camera_event(ev.machineId, ev.kind, ev.confidence)
    return {"ok": True}


class SimCommand(BaseModel):
    machineId: str
    command: str                # scenario name, or "set"
    field: Optional[str] = None
    value: Any = None


@app.post("/api/sim/command", tags=["machine"])
async def sim_command(cmd: SimCommand):
    """Queue a command for the simulator; delivered in the next telemetry response."""
    engine.state(cmd.machineId).commands.append(cmd.model_dump())
    return {"ok": True}


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await engine.hub.connect(websocket)
    try:
        await websocket.send_text(json.dumps({
            "event": "snapshot",
            "data": [engine.summary(m) for m in engine.machines.values()],
        }, default=str))
        while True:
            await websocket.receive_text()   # keepalive; client messages ignored
    except WebSocketDisconnect:
        engine.hub.disconnect(websocket)


# ---------- machines & operators ----------

@app.get("/api/machines", tags=["fleet"])
def list_machines():
    rows = db.query("SELECT * FROM machines ORDER BY id")
    return [{**r, **(engine.summary(engine.machines[r["id"]]) if r["id"] in engine.machines else
                     {"machineId": r["id"], "online": False})} for r in rows]


@app.get("/api/machines/{machine_id}/history", tags=["fleet"])
def machine_history(machine_id: str):
    ms = engine.machines.get(machine_id)
    return list(ms.history) if ms else []


@app.get("/api/alerts/active", tags=["fleet"])
def active_alerts():
    return [a for ms in engine.machines.values() for a in ms.alerts.values()]


@app.get("/api/operators", tags=["operators"])
def list_operators():
    return [_operator(r) for r in db.query("SELECT * FROM operators ORDER BY id")]


def safety_score(operator_id: str) -> Dict:
    week_ago = time.time() - 7 * 86400
    rows = db.query("SELECT type, severity FROM incidents WHERE operator_id = ? AND ts > ?",
                    [operator_id, week_ago])
    done = db.one("SELECT COUNT(DISTINCT module_id) AS n FROM training_progress "
                  "WHERE operator_id = ? AND score >= 60", [operator_id])["n"]
    penalty = sum(5 if r["severity"] == "critical" else 2 for r in rows)
    score = max(0, min(100, 100 - penalty + 3 * done))
    by_type: Dict[str, int] = {}
    for r in rows:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1
    return {"operatorId": operator_id, "score": score, "incidents7d": len(rows),
            "byType": by_type, "trainingCompleted": done}


@app.get("/api/operators/{operator_id}", tags=["operators"])
def get_operator(operator_id: str):
    row = db.one("SELECT * FROM operators WHERE id = ?", [operator_id])
    if not row:
        raise HTTPException(404, "operator not found")
    return {**_operator(row), "safety": safety_score(operator_id)}


@app.get("/api/operators/{operator_id}/score", tags=["operators"])
def get_score(operator_id: str):
    return safety_score(operator_id)


# ---------- tasks ----------

def _predict_task(t: Dict) -> Dict:
    res = ml.predict_task_time(ml.TaskTimeRequest(
        task_type=t["task_type"], machine_id=t["machine_id"], operator_id=t["operator_id"],
        volume_m3=t["volume_m3"], soil_type=t["soil_type"], slope_deg=t["slope_deg"],
        temp_c=t["temp_c"], weather=t["weather"], time_of_day=t["time_of_day"],
    ))
    db.execute("UPDATE tasks SET predicted_minutes=?, predicted_low=?, predicted_high=? WHERE id=?",
               [res.minutes, res.low, res.high, t["id"]])
    return {**t, "predicted_minutes": res.minutes, "predicted_low": res.low, "predicted_high": res.high}


@app.get("/api/tasks", tags=["tasks"])
def list_tasks(operatorId: Optional[str] = None, machineId: Optional[str] = None,
               day: Optional[str] = None):
    sql, params = "SELECT * FROM tasks WHERE date = ?", [day or date.today().isoformat()]
    if operatorId:
        sql, params = sql + " AND operator_id = ?", params + [operatorId]
    if machineId:
        sql, params = sql + " AND machine_id = ?", params + [machineId]
    rows = db.query(sql + " ORDER BY machine_id, CASE time_of_day WHEN 'morning' THEN 0 ELSE 1 END, id", params)
    return [r if r["predicted_minutes"] is not None else _predict_task(r) for r in rows]


class TaskUpdate(BaseModel):
    status: Literal["pending", "in_progress", "done"]


@app.patch("/api/tasks/{task_id}", tags=["tasks"])
def update_task(task_id: int, body: TaskUpdate):
    t = db.one("SELECT * FROM tasks WHERE id = ?", [task_id])
    if not t:
        raise HTTPException(404, "task not found")
    now = time.time()
    if body.status == "in_progress":
        db.execute("UPDATE tasks SET status=?, started_at=? WHERE id=?", [body.status, now, task_id])
    elif body.status == "done":
        started = t["started_at"] or now
        db.execute("UPDATE tasks SET status=?, finished_at=?, actual_minutes=? WHERE id=?",
                   [body.status, now, round((now - started) / 60, 1), task_id])
    else:
        db.execute("UPDATE tasks SET status=?, started_at=NULL, finished_at=NULL, actual_minutes=NULL "
                   "WHERE id=?", [body.status, task_id])
    return db.one("SELECT * FROM tasks WHERE id = ?", [task_id])


# ---------- incidents & insights ----------

@app.get("/api/incidents", tags=["incidents"])
def list_incidents(machineId: Optional[str] = None, operatorId: Optional[str] = None,
                   type: Optional[str] = None, severity: Optional[str] = None, limit: int = 200):
    sql, params = "SELECT * FROM incidents WHERE 1=1", []
    for col, val in (("machine_id", machineId), ("operator_id", operatorId),
                     ("type", type), ("severity", severity)):
        if val:
            sql, params = sql + f" AND {col} = ?", params + [val]
    rows = db.query(sql + " ORDER BY ts DESC LIMIT ?", params + [limit])
    for r in rows:
        r["snapshot"] = json.loads(r["snapshot"] or "{}")
    return rows


@app.get("/api/insights/windows", tags=["incidents"])
def usage_windows(machineId: Optional[str] = None, limit: int = 50):
    sql, params = "SELECT * FROM usage_windows", []
    if machineId:
        sql, params = sql + " WHERE machine_id = ?", [machineId]
    rows = db.query(sql + " ORDER BY ts DESC LIMIT ?", params + [limit])
    for r in rows:
        r["features"] = json.loads(r["features"])
        r["anomaly"] = bool(r["anomaly"])
    return rows


# ---------- training hub ----------

@app.get("/api/training/modules", tags=["training"])
def training_modules(operatorId: Optional[str] = None):
    progress: Dict[str, float] = {}
    rec: List[str] = []
    if operatorId:
        for r in db.query("SELECT module_id, MAX(score) AS best FROM training_progress "
                          "WHERE operator_id = ? GROUP BY module_id", [operatorId]):
            progress[r["module_id"]] = r["best"]
        types = [r["type"] for r in db.query(
            "SELECT type FROM incidents WHERE operator_id = ? AND ts > ?",
            [operatorId, time.time() - 7 * 86400])]
        rec = [m for m in training.recommended(types) if progress.get(m, 0) < 60]
    return {
        "modules": [{**training.public(m), "bestScore": progress.get(m["id"])} for m in training.MODULES],
        "recommended": rec,
        "instructors": training.INSTRUCTORS,
    }


class QuizSubmission(BaseModel):
    operatorId: str
    moduleId: str
    answers: List[int]


@app.post("/api/training/progress", tags=["training"])
def submit_quiz(body: QuizSubmission):
    if body.moduleId not in training.BY_ID:
        raise HTTPException(404, "module not found")
    score = training.grade(body.moduleId, body.answers)
    db.insert("training_progress", {"operator_id": body.operatorId, "module_id": body.moduleId,
                                    "score": score, "ts": time.time()})
    return {"score": score, "passed": score >= 60}


class Booking(BaseModel):
    operatorId: str
    instructor: str
    slot: str
    topic: str = ""


@app.get("/api/training/bookings", tags=["training"])
def list_bookings(operatorId: Optional[str] = None):
    if operatorId:
        return db.query("SELECT * FROM bookings WHERE operator_id = ? ORDER BY slot", [operatorId])
    return db.query("SELECT * FROM bookings ORDER BY slot")


@app.post("/api/training/bookings", tags=["training"])
def create_booking(body: Booking):
    bid = db.insert("bookings", {"operator_id": body.operatorId, "instructor": body.instructor,
                                 "slot": body.slot, "topic": body.topic, "ts": time.time()})
    return db.one("SELECT * FROM bookings WHERE id = ?", [bid])


# ---------- meta ----------

@app.get("/health", tags=["meta"])
def health():
    return {"ok": True, "models": sorted(ml.MODELS), "machinesOnline":
            [m.machine_id for m in engine.machines.values() if m.online]}


@app.get("/models", tags=["meta"])
def models():
    return ml.model_info()
