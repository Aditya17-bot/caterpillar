"""Live pipeline: telemetry in -> ML predictions -> alert rules -> incidents -> WebSocket out.

One MachineState per machine keeps the latest reading, active alerts, and the
accumulators for the rolling usage window that feeds the anomaly model.
"""

import asyncio
import json
import os
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional

from fastapi import WebSocket
from starlette.concurrency import run_in_threadpool

import db
import ml

# Demo-friendly timings; real-world values in comments.
WINDOW_SEC = float(os.getenv("WINDOW_SEC", 60))          # usage window (real: 900 = 15 min)
IDLE_ALERT_SEC = float(os.getenv("IDLE_ALERT_SEC", 45))  # idle before alert (real: 300)
SEATBELT_GRACE_SEC = 5
CAMERA_ALERT_TTL = 8        # camera alerts clear if the browser stops re-sending them
OFFLINE_AFTER_SEC = 5
FAULT_EVERY_SEC = 3

SEVERITY_RANK = {"info": 0, "warning": 1, "critical": 2}


# ---------- WebSocket hub ----------

class Hub:
    def __init__(self) -> None:
        self.clients: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.clients:
            self.clients.remove(ws)

    async def send(self, event: str, data: Any) -> None:
        msg = json.dumps({"event": event, "data": data}, default=str)
        for ws in list(self.clients):
            try:
                await ws.send_text(msg)
            except Exception:
                self.disconnect(ws)


hub = Hub()


# ---------- per-machine state ----------

@dataclass
class Window:
    start: float = field(default_factory=time.time)
    ticks: int = 0
    idle_ticks: int = 0
    rpm_sum: float = 0.0
    max_tilt: float = 0.0
    harsh: int = 0
    overspeed: int = 0
    belt_off_sec: float = 0.0
    proximity: int = 0
    load_cycles: int = 0
    fuel_l: float = 0.0


@dataclass
class MachineState:
    machine_id: str
    machine_type: str = "excavator"
    operator: Optional[Dict] = None
    last: Dict = field(default_factory=dict)
    last_seen: float = 0.0
    online: bool = False
    predictions: Dict = field(default_factory=dict)
    last_fault_at: float = 0.0
    alerts: Dict[str, Dict] = field(default_factory=dict)     # type -> active alert
    camera_expiry: Dict[str, float] = field(default_factory=dict)
    belt_off_since: Optional[float] = None
    idle_since: Optional[float] = None
    window: Window = field(default_factory=Window)
    history: Deque[Dict] = field(default_factory=lambda: deque(maxlen=180))
    commands: List[Dict] = field(default_factory=list)       # queued for the simulator


machines: Dict[str, MachineState] = {}


def state(machine_id: str) -> MachineState:
    if machine_id not in machines:
        row = db.one("SELECT type FROM machines WHERE id = ?", [machine_id])
        machines[machine_id] = MachineState(machine_id, row["type"] if row else "excavator")
    return machines[machine_id]


def summary(ms: MachineState) -> Dict:
    return {
        "machineId": ms.machine_id,
        "machineType": ms.machine_type,
        "online": ms.online,
        "operator": ms.operator,
        "telemetry": ms.last,
        "predictions": ms.predictions,
        "activeAlerts": list(ms.alerts.values()),
    }


# ---------- alerts ----------

async def raise_alert(ms: MachineState, kind: str, severity: str, message: str) -> None:
    current = ms.alerts.get(kind)
    if current and SEVERITY_RANK[current["severity"]] >= SEVERITY_RANK[severity]:
        return
    alert = {
        "machineId": ms.machine_id,
        "operatorId": (ms.operator or {}).get("id"),
        "type": kind, "severity": severity, "message": message, "ts": time.time(),
    }
    if severity != "info":
        snapshot = {k: v for k, v in ms.last.items() if k not in ("accel", "gyro")}
        alert["id"] = await run_in_threadpool(db.insert, "incidents", {
            "ts": alert["ts"], "machine_id": ms.machine_id, "operator_id": alert["operatorId"],
            "type": kind, "severity": severity, "message": message, "snapshot": snapshot,
        })
    ms.alerts[kind] = alert
    await hub.send("alert", alert)


async def clear_alert(ms: MachineState, kind: str) -> None:
    if ms.alerts.pop(kind, None):
        ms.camera_expiry.pop(kind, None)
        await hub.send("alert_cleared", {"machineId": ms.machine_id, "type": kind})


async def level(ms: MachineState, kind: str, severity: Optional[str], message: str = "") -> None:
    """Set a condition-driven alert to a severity, or clear it when severity is None."""
    if severity is None:
        await clear_alert(ms, kind)
    else:
        if kind in ms.alerts and ms.alerts[kind]["severity"] != severity:
            ms.alerts.pop(kind)   # severity changed: re-raise so it's logged/broadcast
        await raise_alert(ms, kind, severity, message)


async def run_rules(ms: MachineState, t: Dict, now: float) -> None:
    engine_on = t.get("engineOn", False)

    if engine_on and not t.get("seatbelt", True):
        ms.belt_off_since = ms.belt_off_since or now
        held = now - ms.belt_off_since
        await level(ms, "seatbelt", "critical" if held >= SEATBELT_GRACE_SEC else None,
                    f"Seatbelt unfastened for {held:.0f}s while engine running")
    else:
        ms.belt_off_since = None
        await level(ms, "seatbelt", None)

    d = t.get("obstacleCm", 999)
    await level(ms, "proximity",
                "critical" if engine_on and d < 50 else "warning" if engine_on and d < 100 else None,
                f"Obstacle {d:.0f} cm from machine")

    temp = t.get("engineTempC", 0)
    await level(ms, "overheat", "critical" if temp > 110 else "warning" if temp > 100 else None,
                f"Engine temperature {temp:.0f} °C")

    slope = abs(t.get("slopeDeg", 0))
    await level(ms, "unsafe_tilt", "critical" if slope > 25 else None,
                f"Machine tilt {slope:.0f}° exceeds safe limit (25°)")

    fault, prob = ms.predictions.get("fault"), ms.predictions.get("faultProb", 0)
    if fault and fault != "normal" and prob >= 0.6:
        sev = "critical" if fault in ("overheating", "low_oil_pressure") else "warning"
        await level(ms, "engine_fault", sev,
                    f"ML predicts {fault.replace('_', ' ')} ({prob:.0%} confidence)")
    elif fault == "normal":
        await level(ms, "engine_fault", None)

    speed, optimal = t.get("speedKmh", 0), ms.predictions.get("optimalSpeedKmh")
    over = optimal is not None and speed > 2 and speed > optimal * 1.25 + 1
    if over and "overspeed" not in ms.alerts:
        ms.window.overspeed += 1
    await level(ms, "overspeed", "warning" if over else None,
                f"Speed {speed:.1f} km/h above advised {optimal} km/h for this terrain")

    if engine_on and speed < 0.5:
        ms.idle_since = ms.idle_since or now
        idle = now - ms.idle_since
        await level(ms, "idling", "warning" if idle >= IDLE_ALERT_SEC else None,
                    f"Engine idling for {idle / 60:.1f} min. Consider shutting down.")
    else:
        ms.idle_since = None
        await level(ms, "idling", None)


# ---------- usage window -> anomaly model ----------

def accumulate(ms: MachineState, t: Dict, dt: float) -> None:
    w = ms.window
    if not t.get("engineOn"):
        return
    w.ticks += 1
    w.idle_ticks += t.get("speedKmh", 0) < 0.5
    w.rpm_sum += t.get("rpm", 0)
    w.max_tilt = max(w.max_tilt, abs(t.get("slopeDeg", 0)))
    w.harsh += bool(t.get("harshEvent"))
    w.load_cycles += bool(t.get("loadCycle"))
    w.fuel_l += t.get("fuelRateLph", 0) * dt / 3600
    if not t.get("seatbelt", True):
        w.belt_off_sec += dt
    if t.get("obstacleCm", 999) < 100 and ms.last.get("obstacleCm", 999) >= 100:
        w.proximity += 1


async def close_window(ms: MachineState, now: float) -> None:
    w = ms.window
    ms.window = Window(start=now)
    if w.ticks < 5:
        return
    scale = 900 / max(now - w.start, 1)      # express as a 15-minute window like the training data
    req = ml.AnomalyRequest(
        idle_min=min(15.0, 15 * w.idle_ticks / w.ticks),
        fuel_used_l=round(w.fuel_l * scale, 2),
        load_cycles=round(w.load_cycles * scale),
        avg_rpm=w.rpm_sum / w.ticks,
        max_tilt_deg=w.max_tilt,
        harsh_events=w.harsh,             # event counts stay raw: scaling 1 jolt to 15 is misleading
        overspeed_events=w.overspeed,
        seatbelt_off_sec=round(min(900, w.belt_off_sec * scale)),
        proximity_alerts=w.proximity,
    )
    res = await run_in_threadpool(ml.predict_anomaly, req)
    features = req.model_dump(by_alias=True)
    op = (ms.operator or {}).get("id")
    await run_in_threadpool(db.insert, "usage_windows", {
        "ts": now, "machine_id": ms.machine_id, "operator_id": op, "features": features,
        "anomaly": int(res.anomaly), "reason": res.reason, "score": res.score,
    })
    payload = {"machineId": ms.machine_id, "operatorId": op, "ts": now, "features": features,
               **res.model_dump(by_alias=True)}
    await hub.send("insight", payload)
    if res.anomaly:
        await level(ms, "anomaly", "warning",
                    f"Unusual usage pattern: {res.reason.replace('_', ' ')}")
    else:
        await level(ms, "anomaly", None)


# ---------- main entry ----------

async def ingest(t: Dict) -> Dict:
    now = time.time()
    ms = state(t["machineId"])
    ms.machine_type = t.get("machineType", ms.machine_type)
    dt = min(5.0, now - ms.last_seen) if ms.last_seen else 1.0

    rfid = t.get("rfid")
    if rfid and rfid != (ms.operator or {}).get("rfid"):
        op = await run_in_threadpool(db.one, "SELECT * FROM operators WHERE rfid = ?", [rfid])
        if op:
            op["certified"] = json.loads(op["certified"] or "[]")
            ms.operator = op
            await hub.send("login", {"machineId": ms.machine_id, "operator": op})
    elif not rfid and ms.operator:
        ms.operator = None
        await hub.send("logout", {"machineId": ms.machine_id})

    speed = await run_in_threadpool(ml.predict_speed, ml.SpeedRequest(
        slope_deg=t.get("slopeDeg", 0), machine_type=ms.machine_type,
        accel=t.get("accel"), gyro=t.get("gyro"), vibration=t.get("vibration", 0.3),
        load_pct=t.get("loadPct", 50), surface=t.get("surface", "gravel"),
    ))
    ms.predictions["optimalSpeedKmh"] = speed.speed_kmh
    ms.predictions["advisory"] = speed.advisory

    if now - ms.last_fault_at >= FAULT_EVERY_SEC:
        ms.last_fault_at = now
        fault = await run_in_threadpool(ml.predict_fault, ml.FaultRequest(
            engine_temp_c=t.get("engineTempC", 85), vibration=t.get("vibration", 0.3),
            oil_pressure_psi=t.get("oilPressurePsi", 50), rpm=t.get("rpm", 1600),
            humidity=t.get("humidity", 50), engine_hours=t.get("engineHours", 5000),
            obstacle_cm=t.get("obstacleCm", 200),
        ))
        ms.predictions["fault"] = fault.fault
        ms.predictions["faultProb"] = fault.prob

    accumulate(ms, t, dt)
    await run_rules(ms, t, now)

    ms.last, ms.last_seen, ms.online = t, now, True
    ms.history.append({
        "ts": now, "engineTempC": t.get("engineTempC"), "slopeDeg": t.get("slopeDeg"),
        "speedKmh": t.get("speedKmh"), "optimalSpeedKmh": speed.speed_kmh,
        "obstacleCm": t.get("obstacleCm"), "rpm": t.get("rpm"),
    })
    await hub.send("telemetry", summary(ms))

    if now - ms.window.start >= WINDOW_SEC:
        await close_window(ms, now)

    cmds, ms.commands = ms.commands, []
    return {"ok": True, "commands": cmds}


async def camera_event(machine_id: str, kind: str, confidence: float) -> None:
    ms = state(machine_id)
    if kind == "drowsy":
        await raise_alert(ms, "drowsy", "critical", f"Operator drowsiness detected ({confidence:.0%})")
    elif kind == "person":
        await raise_alert(ms, "camera_person", "warning", f"Person detected near machine by camera ({confidence:.0%})")
    else:
        return
    alert_type = "drowsy" if kind == "drowsy" else "camera_person"
    ms.camera_expiry[alert_type] = time.time() + CAMERA_ALERT_TTL


async def housekeeping() -> None:
    """Clear stale camera alerts and mark silent machines offline."""
    while True:
        await asyncio.sleep(1)
        now = time.time()
        for ms in list(machines.values()):
            for kind, exp in list(ms.camera_expiry.items()):
                if now > exp:
                    await clear_alert(ms, kind)
            if ms.online and now - ms.last_seen > OFFLINE_AFTER_SEC:
                ms.online = False
                await hub.send("machine_offline", {"machineId": ms.machine_id})
