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
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import copilot
import db
import engine
import insights
import inspection
import site_map
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


@app.get("/api/operators/{operator_id}", tags=["operators"])
def get_operator(operator_id: str):
    row = db.one("SELECT * FROM operators WHERE id = ?", [operator_id])
    if not row:
        raise HTTPException(404, "operator not found")
    return {**_operator(row), "safety": insights.safety_score(operator_id)}


@app.get("/api/operators/{operator_id}/score", tags=["operators"])
def get_score(operator_id: str):
    return insights.safety_score(operator_id)


# ---------- tasks ----------

@app.get("/api/tasks", tags=["tasks"])
def list_tasks(operatorId: Optional[str] = None, machineId: Optional[str] = None,
               day: Optional[str] = None):
    """Tasks with ML estimate, range, explanation factors and live pace for the running task."""
    return insights.tasks_for(machineId, operatorId, day)


class TaskUpdate(BaseModel):
    status: Literal["pending", "in_progress", "done"]


@app.patch("/api/tasks/{task_id}", tags=["tasks"])
def update_task(task_id: int, body: TaskUpdate):
    t = db.one("SELECT * FROM tasks WHERE id = ?", [task_id])
    if not t:
        raise HTTPException(404, "task not found")
    now = time.time()
    if body.status == "in_progress":
        engine.state(t["machine_id"]).task_cycles = 0
        db.execute("UPDATE tasks SET status=?, started_at=? WHERE id=?", [body.status, now, task_id])
    elif body.status == "done":
        started = t["started_at"] or now
        db.execute("UPDATE tasks SET status=?, finished_at=?, actual_minutes=? WHERE id=?",
                   [body.status, now, round((now - started) / 60, 1), task_id])
    else:
        db.execute("UPDATE tasks SET status=?, started_at=NULL, finished_at=NULL, actual_minutes=NULL "
                   "WHERE id=?", [body.status, task_id])
    return insights.with_pace(insights.ensure_prediction(db.one("SELECT * FROM tasks WHERE id = ?", [task_id])))


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
        r["hasBlackbox"] = bool(r.pop("blackbox", None))
    return rows


@app.get("/api/incidents/{incident_id}", tags=["incidents"])
def get_incident(incident_id: int):
    """One incident with its black-box recording (readings and alerts ~60 s before, 30 s after)."""
    r = db.one("SELECT * FROM incidents WHERE id = ?", [incident_id])
    if not r:
        raise HTTPException(404, "incident not found")
    r["snapshot"] = json.loads(r["snapshot"] or "{}")
    r["blackbox"] = json.loads(r["blackbox"]) if r.get("blackbox") else None
    return r


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


class SimResult(BaseModel):
    operatorId: str
    score: float
    avgReactionMs: Optional[float] = None
    hazards: int = 0
    missed: int = 0


@app.post("/api/training/sim-result", tags=["training"])
def sim_result(body: SimResult):
    """Hazard-response simulator result; counts as the 'hazard-sim' training module."""
    db.insert("training_progress", {"operator_id": body.operatorId, "module_id": "hazard-sim",
                                    "score": round(body.score, 1), "ts": time.time()})
    return {"ok": True, "passed": body.score >= 60}


# ---------- shift report ----------

@app.get("/api/shift/{machine_id}", tags=["shift"])
def shift_live(machine_id: str):
    """Current shift stats and averages so far."""
    return insights.shift_report(machine_id)


class EndShift(BaseModel):
    lang: str = "en"


@app.post("/api/shift/{machine_id}/end", tags=["shift"])
async def end_shift(machine_id: str, body: EndShift = EndShift()):
    """Close the shift: final stats + AI-written summary, saved; counters restart."""
    report = insights.shift_report(machine_id)
    summary = await copilot.shift_summary(report, body.lang)
    rid = insights.save_shift_report(report, summary["summary"], summary["source"])
    ms = engine.state(machine_id)
    engine.start_shift(ms, (ms.operator or {}).get("id"))
    return {"id": rid, **report, **summary}


@app.get("/api/shift-reports", tags=["shift"])
def shift_reports(machineId: Optional[str] = None, operatorId: Optional[str] = None, limit: int = 20):
    sql, params = "SELECT * FROM shift_reports WHERE 1=1", []
    if machineId:
        sql, params = sql + " AND machine_id = ?", params + [machineId]
    if operatorId:
        sql, params = sql + " AND operator_id = ?", params + [operatorId]
    rows = db.query(sql + " ORDER BY end DESC LIMIT ?", params + [limit])
    for r in rows:
        r["stats"] = json.loads(r["stats"])
    return rows


# ---------- co-pilot ----------

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    machineId: str
    message: str
    history: List[ChatTurn] = []
    lang: str = "en"


@app.post("/api/copilot/chat", tags=["copilot"])
async def copilot_chat(body: ChatRequest):
    return await copilot.chat(body.machineId, body.message, [h.model_dump() for h in body.history], body.lang)


class BriefingRequest(BaseModel):
    machineId: str
    lang: str = "en"


@app.post("/api/copilot/briefing", tags=["copilot"])
async def copilot_briefing(body: BriefingRequest):
    return await copilot.briefing(body.machineId, body.lang)


# ---------- site map ----------

@app.get("/api/site", tags=["site"])
def site():
    """Terrain grid, danger zones and machine start positions."""
    return {**site_map.grid(), "zones": site_map.ZONES, "start": site_map.START}


# ---------- pre-start inspection ----------

@app.get("/api/inspection/items", tags=["inspection"])
def inspection_items():
    return inspection.ITEMS


class InspectionItem(BaseModel):
    id: str
    ok: bool
    note: str = ""


class InspectionSubmit(BaseModel):
    machineId: str
    operatorId: Optional[str] = None
    items: List[InspectionItem]
    photo: Optional[str] = None     # small JPEG data URL of a defect


@app.post("/api/inspection", tags=["inspection"])
async def submit_inspection(body: InspectionSubmit):
    """Record the walk-around. Failed items create maintenance requests; failed critical items lock the machine."""
    result = inspection.evaluate([i.model_dump() for i in body.items])
    if result["missing"]:
        raise HTTPException(422, f"unanswered items: {', '.join(result['missing'])}")
    ms = engine.state(body.machineId)
    op = body.operatorId or (ms.operator or {}).get("id")
    iid = db.insert("inspections", {
        "ts": time.time(), "machine_id": body.machineId, "operator_id": op,
        "items": [i.model_dump() for i in body.items], "passed": int(result["passed"]),
        "defects": len(result["failed"]), "photo": body.photo,
    })
    for f in result["failed"]:
        db.insert("maintenance", {
            "ts": time.time(), "machine_id": body.machineId, "operator_id": op, "issue": f["label"],
            "priority": "urgent" if f["critical"] else "normal", "slot": "", "notes": f["note"],
            "source": f"inspection #{iid}", "status": "requested",
        })
    if result["lockout"]:
        ms.inspection = {"status": "locked", "id": iid, "failed": [f["label"] for f in result["failed"]]}
        ms.commands.append({"command": "set", "field": "engineOn", "value": False})   # interlock
        await engine.raise_alert(ms, "lockout", "critical",
                                 "Machine locked out: critical defect found in pre-start inspection")
    else:
        ms.inspection = {"status": "done", "id": iid, "defects": len(result["failed"])}
        await engine.clear_alert(ms, "no_inspection")
    await engine.hub.send("telemetry", engine.summary(ms))
    return {"id": iid, **result, "inspection": ms.inspection}


@app.post("/api/inspection/{machine_id}/clear-lockout", tags=["inspection"])
async def clear_lockout(machine_id: str):
    """Maintenance has fixed the defect: machine may start again."""
    ms = engine.state(machine_id)
    ms.inspection = {"status": "done", "clearedBy": "maintenance"}
    await engine.clear_alert(ms, "lockout")
    ms.commands.append({"command": "set", "field": "engineOn", "value": True})
    return {"ok": True}


@app.get("/api/inspections", tags=["inspection"])
def list_inspections(machineId: Optional[str] = None, limit: int = 20):
    sql, params = "SELECT id, ts, machine_id, operator_id, items, passed, defects, photo IS NOT NULL AS hasPhoto FROM inspections", []
    if machineId:
        sql, params = sql + " WHERE machine_id = ?", [machineId]
    rows = db.query(sql + " ORDER BY ts DESC LIMIT ?", params + [limit])
    for r in rows:
        r["items"] = json.loads(r["items"])
    return rows


# ---------- maintenance booking ----------

class MaintenanceRequest(BaseModel):
    machineId: str
    issue: str
    priority: Literal["normal", "urgent"] = "normal"
    slot: str = ""
    notes: str = ""
    operatorId: Optional[str] = None


@app.post("/api/maintenance", tags=["maintenance"])
def book_maintenance(body: MaintenanceRequest):
    mid = db.insert("maintenance", {
        "ts": time.time(), "machine_id": body.machineId,
        "operator_id": body.operatorId or (engine.state(body.machineId).operator or {}).get("id"),
        "issue": body.issue, "priority": body.priority, "slot": body.slot, "notes": body.notes,
        "source": "operator", "status": "requested",
    })
    return db.one("SELECT * FROM maintenance WHERE id = ?", [mid])


@app.get("/api/maintenance", tags=["maintenance"])
def list_maintenance(machineId: Optional[str] = None, status: Optional[str] = None):
    sql, params = "SELECT * FROM maintenance WHERE 1=1", []
    if machineId:
        sql, params = sql + " AND machine_id = ?", params + [machineId]
    if status:
        sql, params = sql + " AND status = ?", params + [status]
    return db.query(sql + " ORDER BY CASE priority WHEN 'urgent' THEN 0 ELSE 1 END, ts DESC", params)


class MaintenanceUpdate(BaseModel):
    status: Literal["requested", "scheduled", "in_progress", "done"]
    slot: Optional[str] = None


@app.patch("/api/maintenance/{mid}", tags=["maintenance"])
def update_maintenance(mid: int, body: MaintenanceUpdate):
    if body.slot is not None:
        db.execute("UPDATE maintenance SET status = ?, slot = ? WHERE id = ?", [body.status, body.slot, mid])
    else:
        db.execute("UPDATE maintenance SET status = ? WHERE id = ?", [body.status, mid])
    return db.one("SELECT * FROM maintenance WHERE id = ?", [mid])


# ---------- SOS ----------

class SosRequest(BaseModel):
    machineId: str
    reason: str = "Operator pressed SOS"


@app.post("/api/sos", tags=["sos"])
async def sos(body: SosRequest):
    """Emergency: alerts the supervisor and every machine within 300 m, with distance and direction."""
    return await engine.trigger_sos(engine.state(body.machineId), body.reason)


class SosRespond(BaseModel):
    machineId: str


@app.post("/api/sos/{sos_id}/respond", tags=["sos"])
async def sos_respond(sos_id: int, body: SosRespond):
    r = await engine.respond_sos(sos_id, body.machineId)
    if not r:
        raise HTTPException(404, "SOS not found")
    return r


@app.post("/api/sos/{sos_id}/resolve", tags=["sos"])
async def sos_resolve(sos_id: int):
    r = await engine.resolve_sos(sos_id)
    if not r:
        raise HTTPException(404, "SOS not found")
    return r


@app.get("/api/sos", tags=["sos"])
def list_sos(status: Optional[str] = "active"):
    rows = db.query("SELECT id FROM sos_events" + (" WHERE status = ?" if status else "") + " ORDER BY ts DESC",
                    [status] if status else [])
    return [engine.get_sos(r["id"]) for r in rows]


# ---------- supervisor ----------

@app.get("/api/impact", tags=["supervisor"])
def impact():
    return insights.impact()


@app.get("/api/leaderboard", tags=["supervisor"])
def leaderboard():
    return insights.leaderboard()


# ---------- meta ----------

@app.get("/health", tags=["meta"])
def health():
    return {"ok": True, "models": sorted(ml.MODELS), "copilot": "claude" if copilot.client() else "offline",
            "machinesOnline":
            [m.machine_id for m in engine.machines.values() if m.online]}


@app.get("/models", tags=["meta"])
def models():
    return ml.model_info()


# ---------- built frontend (single-container deploy) ----------

_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
