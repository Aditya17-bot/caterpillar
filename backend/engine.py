"""Live pipeline: telemetry in -> ML predictions -> alert rules -> incidents -> WebSocket out.

One MachineState per machine keeps the latest reading, active alerts, and the
accumulators for the rolling usage window that feeds the anomaly model.
"""

import asyncio
import json
import math
import os
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional, Tuple

from fastapi import WebSocket
from starlette.concurrency import run_in_threadpool

import db
import ml
import site_map

# Demo-friendly timings; real-world values in comments.
WINDOW_SEC = float(os.getenv("WINDOW_SEC", 60))          # usage window (real: 900 = 15 min)
IDLE_ALERT_SEC = float(os.getenv("IDLE_ALERT_SEC", 45))  # idle before alert (real: 300)
SEATBELT_GRACE_SEC = 5
CAMERA_ALERT_TTL = 8        # camera alerts clear if the browser stops re-sending them
OFFLINE_AFTER_SEC = 5
FAULT_EVERY_SEC = 3

SEVERITY_RANK = {"info": 0, "warning": 1, "critical": 2}
OVERHEAT_C = 110
OVERHEAT_WARN_ETA_SEC = 180       # warn when the temperature trend reaches OVERHEAT_C within this
BUCKET_M3 = {"excavator": 1.5, "loader": 3.0, "dozer": 4.0}   # material moved per load cycle
PREDICTED_CLEAR_SEC = 15          # keep the overheat forecast alert this long after the trend eases
BLACKBOX_BEFORE_SEC = 60
BLACKBOX_AFTER_SEC = float(os.getenv("BLACKBOX_AFTER_SEC", 30))
MACHINE_WARN_M, MACHINE_CRIT_M = 20.0, 10.0   # machine-to-machine distance alerts
SOS_RADIUS_M = 300.0              # machines within this distance are asked to respond
ROLLOVER_DEG = 35.0
INSPECTION_GRACE_SEC = 30         # engine running this long without a pre-start inspection -> alert


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
class Shift:
    """Running totals for the current operator's shift on one machine."""
    start: float = field(default_factory=time.time)
    operator_id: Optional[str] = None
    ticks: int = 0
    engine_on_sec: float = 0.0
    idle_sec: float = 0.0
    moving_sec: float = 0.0
    distance_km: float = 0.0
    fuel_l: float = 0.0
    idle_fuel_l: float = 0.0
    load_cycles: int = 0
    sum_temp: float = 0.0
    sum_speed: float = 0.0
    sum_rpm: float = 0.0
    sum_abs_slope: float = 0.0
    sum_vibration: float = 0.0
    max_temp: float = 0.0
    max_tilt: float = 0.0
    max_speed: float = 0.0
    overspeed_sec: float = 0.0
    belt_off_sec: float = 0.0
    harsh_events: int = 0
    alerts: Dict[str, int] = field(default_factory=dict)

    def add(self, t: Dict, dt: float, overspeed: bool) -> None:
        if not t.get("engineOn"):
            return
        speed = t.get("speedKmh", 0)
        self.ticks += 1
        self.engine_on_sec += dt
        if speed < 0.5:
            self.idle_sec += dt
            self.idle_fuel_l += t.get("fuelRateLph", 0) * dt / 3600
        else:
            self.moving_sec += dt
        self.distance_km += speed * dt / 3600
        self.fuel_l += t.get("fuelRateLph", 0) * dt / 3600
        self.load_cycles += bool(t.get("loadCycle"))
        self.sum_temp += t.get("engineTempC", 0)
        self.sum_speed += speed
        self.sum_rpm += t.get("rpm", 0)
        self.sum_abs_slope += abs(t.get("slopeDeg", 0))
        self.sum_vibration += t.get("vibration", 0)
        self.max_temp = max(self.max_temp, t.get("engineTempC", 0))
        self.max_tilt = max(self.max_tilt, abs(t.get("slopeDeg", 0)))
        self.max_speed = max(self.max_speed, speed)
        self.overspeed_sec += dt if overspeed else 0
        self.belt_off_sec += dt if not t.get("seatbelt", True) else 0
        self.harsh_events += bool(t.get("harshEvent"))

    def report(self, machine_type: str, now: float) -> Dict:
        n = max(self.ticks, 1)
        on = max(self.engine_on_sec, 1)
        hours = on / 3600
        return {
            "start": self.start, "end": now, "operatorId": self.operator_id,
            "durationMin": round((now - self.start) / 60, 1),
            "engineOnMin": round(self.engine_on_sec / 60, 1),
            "idleMin": round(self.idle_sec / 60, 1),
            "movingMin": round(self.moving_sec / 60, 1),
            "idlePct": round(100 * self.idle_sec / on, 1),
            "distanceKm": round(self.distance_km, 2),
            "fuelL": round(self.fuel_l, 2),
            "idleFuelL": round(self.idle_fuel_l, 2),
            "fuelPerHourL": round(self.fuel_l / hours, 1) if hours > 0 else 0,
            "loadCycles": self.load_cycles,
            "materialM3": round(self.load_cycles * BUCKET_M3.get(machine_type, 1.5), 1),
            "cyclesPerHour": round(self.load_cycles / hours, 1) if hours > 0 else 0,
            "avgEngineTempC": round(self.sum_temp / n, 1),
            "maxEngineTempC": round(self.max_temp, 1),
            "avgSpeedKmh": round(self.sum_speed / n, 2),
            "maxSpeedKmh": round(self.max_speed, 1),
            "avgRpm": round(self.sum_rpm / n),
            "avgAbsSlopeDeg": round(self.sum_abs_slope / n, 1),
            "maxTiltDeg": round(self.max_tilt, 1),
            "avgVibration": round(self.sum_vibration / n, 3),
            "overspeedMin": round(self.overspeed_sec / 60, 1),
            "seatbeltOffMin": round(self.belt_off_sec / 60, 1),
            "seatbeltCompliancePct": round(100 * (1 - self.belt_off_sec / on), 1),
            "harshEvents": self.harsh_events,
            "alerts": dict(self.alerts),
            "alertCount": sum(self.alerts.values()),
        }


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
    shift: Shift = field(default_factory=Shift)
    task_cycles: int = 0                                      # load cycles since current task started
    predicted_soon_at: float = 0.0                            # last time the overheat forecast fired
    events: Deque[Dict] = field(default_factory=lambda: deque(maxlen=300))   # alert timeline (black box)
    pos: Optional[Dict] = None                                # {x, y, heading, elevation}
    zone: Optional[str] = None
    inspection: Dict = field(default_factory=lambda: {"status": "done", "auto": True})
    engine_on_since: Optional[float] = None
    sos_id: Optional[int] = None


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
        "pos": ms.pos,
        "zone": ms.zone,
        "inspection": ms.inspection,
        "sosId": ms.sos_id,
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
    ms.events.append({"ts": alert["ts"], "type": kind, "severity": severity, "message": message,
                      "event": "raised"})
    if severity != "info":
        snapshot = {k: v for k, v in ms.last.items() if k not in ("accel", "gyro")}
        alert["id"] = await run_in_threadpool(db.insert, "incidents", {
            "ts": alert["ts"], "machine_id": ms.machine_id, "operator_id": alert["operatorId"],
            "type": kind, "severity": severity, "message": message, "snapshot": snapshot,
            "blackbox": blackbox(ms, alert["ts"]),
        })
        asyncio.create_task(complete_blackbox(ms, alert["id"], alert["ts"]))
    ms.alerts[kind] = alert
    ms.shift.alerts[kind] = ms.shift.alerts.get(kind, 0) + 1
    await hub.send("alert", alert)


def blackbox(ms: MachineState, ts: float) -> Dict:
    """Readings and alert timeline around an incident, like a flight recorder."""
    lo, hi = ts - BLACKBOX_BEFORE_SEC, ts + BLACKBOX_AFTER_SEC
    return {
        "incidentTs": ts,
        "readings": [h for h in ms.history if lo <= h["ts"] <= hi],
        "events": [e for e in ms.events if lo <= e["ts"] <= hi],
        "complete": time.time() >= hi,
    }


async def complete_blackbox(ms: MachineState, incident_id: int, ts: float) -> None:
    """Re-save the recording once the seconds after the incident have been captured."""
    await asyncio.sleep(BLACKBOX_AFTER_SEC)
    await run_in_threadpool(db.execute, "UPDATE incidents SET blackbox = ? WHERE id = ?",
                            [json.dumps(blackbox(ms, ts), default=str), incident_id])


async def clear_alert(ms: MachineState, kind: str) -> None:
    if kind in ms.alerts:
        ms.events.append({"ts": time.time(), "type": kind, "severity": ms.alerts[kind]["severity"],
                          "message": "cleared", "event": "cleared"})
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


async def run_site_rules(ms: MachineState, t: Dict, now: float) -> None:
    """Position-based rules: danger zones, machines too close, rollover/breakdown SOS, inspection."""
    if ms.pos:
        z = site_map.zone_at(ms.pos["x"], ms.pos["y"])
        ms.zone = z["id"] if z else None
        await level(ms, "geofence", ("critical" if z["kind"] == "no_go" else "warning") if z else None,
                    f"{z['name']}: {z['message']}" if z else "")

        nearest, dist = None, 1e9
        for other in machines.values():
            if other is ms or not other.online or not other.pos:
                continue
            d = math.hypot(other.pos["x"] - ms.pos["x"], other.pos["y"] - ms.pos["y"])
            if d < dist:
                nearest, dist = other, d
        sev = "critical" if dist < MACHINE_CRIT_M else "warning" if dist < MACHINE_WARN_M else None
        await level(ms, "machine_proximity", sev,
                    f"{nearest.machine_id if nearest else ''} is {dist:.0f} m away. Keep clear, radio before moving.")

    engine_on = t.get("engineOn", False)
    was_on = ms.last.get("engineOn", False)
    if abs(t.get("slopeDeg", 0)) >= ROLLOVER_DEG and not ms.sos_id:
        await trigger_sos(ms, f"Possible rollover: machine tilted {abs(t['slopeDeg']):.0f}°", auto=True)
    elif was_on and not engine_on and not ms.sos_id:
        faults = [a for a in ms.alerts.values()
                  if a["type"] in ("engine_fault", "overheat") and a["severity"] == "critical"]
        if faults or t.get("oilPressurePsi", 50) < 10:
            reason = faults[0]["message"] if faults else "oil pressure lost"
            await trigger_sos(ms, f"Machine breakdown: engine stopped ({reason})", auto=True)

    ms.engine_on_since = (ms.engine_on_since or now) if engine_on else None
    pending = ms.inspection.get("status") == "pending"
    running = ms.engine_on_since is not None and now - ms.engine_on_since > INSPECTION_GRACE_SEC
    await level(ms, "no_inspection", "warning" if pending and running else None,
                "Engine running without today's pre-start inspection")


# ---------- SOS ----------

def nearby(ms: MachineState, radius: float = SOS_RADIUS_M) -> List[Dict]:
    out = []
    if not ms.pos:
        return out
    for other in machines.values():
        if other is ms or not other.online or not other.pos:
            continue
        dx, dy = other.pos["x"] - ms.pos["x"], other.pos["y"] - ms.pos["y"]
        d = math.hypot(dx, dy)
        if d <= radius:
            out.append({"machineId": other.machine_id, "machineType": other.machine_type,
                        "operator": (other.operator or {}).get("name"), "distanceM": round(d),
                        "direction": site_map.bearing(-dx, -dy)})   # direction from responder to the SOS
    return sorted(out, key=lambda n: n["distanceM"])


def get_sos(sos_id: int) -> Optional[Dict]:
    r = db.one("SELECT * FROM sos_events WHERE id = ?", [sos_id])
    if r:
        r["nearby"] = json.loads(r["nearby"] or "[]")
        r["responders"] = json.loads(r["responders"] or "[]")
    return r


async def trigger_sos(ms: MachineState, reason: str, auto: bool = False) -> Dict:
    if ms.sos_id:
        return await run_in_threadpool(get_sos, ms.sos_id)
    near = nearby(ms)
    rec = {"ts": time.time(), "machine_id": ms.machine_id, "operator_id": (ms.operator or {}).get("id"),
           "reason": reason, "auto": int(auto), "x": (ms.pos or {}).get("x"), "y": (ms.pos or {}).get("y"),
           "status": "active", "nearby": near, "responders": []}
    ms.sos_id = await run_in_threadpool(db.insert, "sos_events", rec)
    await raise_alert(ms, "sos", "critical", f"SOS sent: {reason}")
    who = (ms.operator or {}).get("name", "operator")
    for n in near:
        await raise_alert(state(n["machineId"]), "sos_nearby", "critical",
                          f"SOS from {ms.machine_id} ({who}) {n['distanceM']} m to the {n['direction']}: {reason}")
    sos = await run_in_threadpool(get_sos, ms.sos_id)
    await hub.send("sos", sos)
    return sos


async def respond_sos(sos_id: int, machine_id: str) -> Optional[Dict]:
    sos = await run_in_threadpool(get_sos, sos_id)
    if not sos or sos["status"] != "active":
        return sos
    if machine_id not in [r["machineId"] for r in sos["responders"]]:
        ms = state(machine_id)
        sos["responders"].append({"machineId": machine_id, "operator": (ms.operator or {}).get("name"),
                                  "ts": time.time()})
        await run_in_threadpool(db.execute, "UPDATE sos_events SET responders = ? WHERE id = ?",
                                [json.dumps(sos["responders"]), sos_id])
        await clear_alert(ms, "sos_nearby")
    await hub.send("sos_update", sos)
    return sos


async def resolve_sos(sos_id: int) -> Optional[Dict]:
    sos = await run_in_threadpool(get_sos, sos_id)
    if not sos:
        return None
    await run_in_threadpool(db.execute, "UPDATE sos_events SET status = 'resolved' WHERE id = ?", [sos_id])
    sos["status"] = "resolved"
    origin = state(sos["machine_id"])
    origin.sos_id = None
    await clear_alert(origin, "sos")
    for n in sos["nearby"]:
        await clear_alert(state(n["machineId"]), "sos_nearby")
    await hub.send("sos_update", sos)
    return sos


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


# ---------- forecasting ----------

def _linfit(xs: List[float], ys: List[float]) -> Optional[Tuple[float, float]]:
    """Least-squares line y = a + b*x."""
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    var = sum((x - mx) ** 2 for x in xs)
    if var == 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / var
    return my - b * mx, b


def overheat_eta(ms: MachineState) -> Optional[float]:
    """Seconds until engine temp reaches OVERHEAT_C, or None if it won't.

    Engine temperature behaves like a first-order system: it rises quickly, then levels off at
    an equilibrium set by load and cooling (dT/dt = k * (T_eq - T)). Over the last ~40 s we
    regress the rate of change against temperature to estimate k and T_eq:
      - levelling off below 110 °C (normal warm-up)  -> no warning
      - levelling off above 110 °C                   -> time to 110 on the exponential curve
      - not levelling off (cooling failing, runaway)  -> straight-line extrapolation
    """
    pts = [(h["ts"], h["engineTempC"]) for h in list(ms.history)[-40:] if h.get("engineTempC") is not None]
    if len(pts) < 15:
        return None
    t0 = pts[0][0]
    ts = [p[0] - t0 for p in pts]
    temps = [p[1] for p in pts]
    # smooth, then rate of change over 5-sample spans
    sm = [sum(temps[max(0, i - 2):i + 3]) / len(temps[max(0, i - 2):i + 3]) for i in range(len(temps))]
    rates, levels = [], []
    for i in range(len(sm) - 5):
        dt = ts[i + 5] - ts[i]
        if dt > 0:
            rates.append((sm[i + 5] - sm[i]) / dt)
            levels.append((sm[i + 5] + sm[i]) / 2)
    current = sm[-1]
    recent = _linfit(ts[-15:], temps[-15:])
    if not rates or not recent or current >= OVERHEAT_C:
        return None
    rate_now = recent[1]
    if rate_now < 0.05:                       # rising slower than 3 °C/min: nothing to forecast
        return None
    fit = _linfit(levels, rates)              # rate = a + b*T  ->  k = -b, T_eq = -a/b
    if fit and fit[1] < -0.01:
        a, b = fit
        k, t_eq = -b, -a / b
        if t_eq <= OVERHEAT_C + 1:
            return None                       # settles below the limit
        return math.log((t_eq - current) / (t_eq - OVERHEAT_C)) / k
    return (OVERHEAT_C - current) / rate_now


async def run_forecasts(ms: MachineState, t: Dict) -> None:
    eta = overheat_eta(ms)
    ms.predictions["overheatEtaSec"] = round(eta) if eta is not None else None
    now = time.time()
    if eta is not None and eta <= OVERHEAT_WARN_ETA_SEC and t.get("engineTempC", 0) > 90:
        ms.predicted_soon_at = now
        await raise_alert(ms, "overheat_predicted", "warning",
                          f"Engine predicted to reach {OVERHEAT_C} °C in about {eta / 60:.1f} min. Reduce load now")
    elif now - ms.predicted_soon_at > PREDICTED_CLEAR_SEC or t.get("engineTempC", 0) >= OVERHEAT_C:
        await clear_alert(ms, "overheat_predicted")   # hysteresis: the noisy trend must stay calm first


def start_shift(ms: MachineState, operator_id: Optional[str]) -> None:
    ms.shift = Shift(operator_id=operator_id)


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
            start_shift(ms, op["id"])
            ms.inspection = {"status": "pending", "operatorId": op["id"]}
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

    if t.get("posX") is not None:
        ms.pos = {"x": t["posX"], "y": t["posY"], "heading": t.get("heading", 0),
                  "elevation": t.get("elevation")}
    ms.history.append({
        "ts": now, "engineTempC": t.get("engineTempC"), "slopeDeg": t.get("slopeDeg"),
        "speedKmh": t.get("speedKmh"), "optimalSpeedKmh": speed.speed_kmh,
        "obstacleCm": t.get("obstacleCm"), "rpm": t.get("rpm"), "seatbelt": t.get("seatbelt"),
        "engineOn": t.get("engineOn"), "vibration": t.get("vibration"),
        "oilPressurePsi": t.get("oilPressurePsi"), "posX": t.get("posX"), "posY": t.get("posY"),
    })
    accumulate(ms, t, dt)
    await run_rules(ms, t, now)
    await run_site_rules(ms, t, now)
    ms.shift.add(t, dt, "overspeed" in ms.alerts)
    ms.task_cycles += bool(t.get("loadCycle"))

    ms.last, ms.last_seen, ms.online = t, now, True
    await run_forecasts(ms, t)
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
