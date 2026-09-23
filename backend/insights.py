"""Derived views over live state + DB: safety score, task pace, shift report, business impact."""

import json
import os
import time
from datetime import date
from typing import Dict, List, Optional

import db
import engine
import ml

FUEL_PRICE = float(os.getenv("FUEL_PRICE_PER_L", 95))      # diesel price per litre
CURRENCY = os.getenv("CURRENCY", "₹")
CO2_KG_PER_L = 2.68                                        # diesel combustion
WORK_HOURS_PER_YEAR = 8 * 300


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


# ---------- tasks ----------

def _task_request(t: Dict) -> ml.TaskTimeRequest:
    return ml.TaskTimeRequest(
        task_type=t["task_type"], machine_id=t["machine_id"], operator_id=t["operator_id"],
        volume_m3=t["volume_m3"], soil_type=t["soil_type"], slope_deg=t["slope_deg"],
        temp_c=t["temp_c"], weather=t["weather"], time_of_day=t["time_of_day"],
    )


def ensure_prediction(t: Dict) -> Dict:
    if t["predicted_minutes"] is None or t.get("factors") is None:
        req = _task_request(t)
        res = ml.predict_task_time(req)
        factors = ml.explain_task_time(req)
        db.execute("UPDATE tasks SET predicted_minutes=?, predicted_low=?, predicted_high=?, factors=? "
                   "WHERE id=?", [res.minutes, res.low, res.high, json.dumps(factors), t["id"]])
        t = {**t, "predicted_minutes": res.minutes, "predicted_low": res.low,
             "predicted_high": res.high, "factors": factors}
    elif isinstance(t["factors"], str):
        t = {**t, "factors": json.loads(t["factors"])}
    return t


def with_pace(t: Dict) -> Dict:
    """Live progress + projected finish for the task in progress (from load cycles)."""
    if t["status"] != "in_progress" or not t["started_at"]:
        return t
    ms = engine.machines.get(t["machine_id"])
    if not ms:
        return t
    bucket = engine.BUCKET_M3.get(ms.machine_type, 1.5)
    done_m3 = ms.task_cycles * bucket
    elapsed_min = (time.time() - t["started_at"]) / 60
    pace = {"doneM3": round(done_m3, 1), "progressPct": round(min(100, 100 * done_m3 / t["volume_m3"]), 1),
            "elapsedMin": round(elapsed_min, 1), "projectedMinutes": None, "deltaMin": None}
    if ms.task_cycles >= 2 and elapsed_min > 0:
        projected = elapsed_min * t["volume_m3"] / done_m3
        pace["projectedMinutes"] = round(projected, 1)
        pace["deltaMin"] = round(projected - t["predicted_minutes"], 1)   # + = behind schedule
    return {**t, "pace": pace}


def tasks_for(machine_id: Optional[str] = None, operator_id: Optional[str] = None,
              day: Optional[str] = None) -> List[Dict]:
    sql, params = "SELECT * FROM tasks WHERE date = ?", [day or date.today().isoformat()]
    if operator_id:
        sql, params = sql + " AND operator_id = ?", params + [operator_id]
    if machine_id:
        sql, params = sql + " AND machine_id = ?", params + [machine_id]
    rows = db.query(sql + " ORDER BY machine_id, CASE time_of_day WHEN 'morning' THEN 0 ELSE 1 END, id", params)
    return [with_pace(ensure_prediction(r)) for r in rows]


# ---------- shift report ----------

def _grade(score: float) -> str:
    return "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D"


def shift_report(machine_id: str) -> Dict:
    ms = engine.state(machine_id)
    now = time.time()
    stats = ms.shift.report(ms.machine_type, now)
    op_id = stats["operatorId"] or (ms.operator or {}).get("id")
    op = db.one("SELECT id, name, experience_yrs FROM operators WHERE id = ?", [op_id]) if op_id else None

    tasks = [ensure_prediction(t) for t in db.query(
        "SELECT * FROM tasks WHERE machine_id = ? AND date = ?", [machine_id, date.today().isoformat()])]
    done = [t for t in tasks if t["status"] == "done"]
    incidents = db.query("SELECT type, severity FROM incidents WHERE machine_id = ? AND ts >= ?",
                         [machine_id, stats["start"]])
    critical = sum(1 for i in incidents if i["severity"] == "critical")

    # shift safety score: same weights as the weekly score, applied to this shift only
    shift_safety = max(0, 100 - 5 * critical - 2 * (len(incidents) - critical))
    efficiency = max(0, 100 - stats["idlePct"] - 2 * stats["overspeedMin"])

    highlights, improve = [], []
    if stats["seatbeltCompliancePct"] >= 99:
        highlights.append("Seatbelt worn the whole shift")
    else:
        improve.append(f"Seatbelt off for {stats['seatbeltOffMin']} min")
    if stats["idlePct"] <= 15:
        highlights.append(f"Low idling ({stats['idlePct']}%)")
    else:
        improve.append(f"Idling {stats['idlePct']}% of engine time, {stats['idleFuelL']} L fuel wasted")
    if stats["overspeedMin"] > 0:
        improve.append(f"{stats['overspeedMin']} min above the advised terrain speed")
    if stats["maxTiltDeg"] > 25:
        improve.append(f"Operated at {stats['maxTiltDeg']}° tilt (limit 25°)")
    if critical == 0:
        highlights.append("No critical incidents")
    if len(done):
        highlights.append(f"{len(done)} task(s) completed")

    return {
        "machineId": machine_id,
        "machineType": ms.machine_type,
        "operator": op,
        "stats": stats,
        "tasks": {
            "total": len(tasks), "done": len(done),
            "predictedMinutesDone": round(sum(t["predicted_minutes"] or 0 for t in done), 1),
            "actualMinutesDone": round(sum(t["actual_minutes"] or 0 for t in done), 1),
        },
        "incidents": {"total": len(incidents), "critical": critical,
                      "byType": {k: sum(1 for i in incidents if i["type"] == k) for k in {i["type"] for i in incidents}}},
        "cost": {
            "currency": CURRENCY,
            "fuel": round(stats["fuelL"] * FUEL_PRICE),
            "idleFuel": round(stats["idleFuelL"] * FUEL_PRICE),
            "co2Kg": round(stats["fuelL"] * CO2_KG_PER_L, 1),
            "idleCo2Kg": round(stats["idleFuelL"] * CO2_KG_PER_L, 1),
        },
        "scores": {"safety": shift_safety, "efficiency": round(efficiency), "grade": _grade((shift_safety + efficiency) / 2),
                   "weeklySafety": safety_score(op_id)["score"] if op_id else None},
        "highlights": highlights,
        "improve": improve,
    }


def save_shift_report(report: Dict, summary: str, source: str) -> int:
    s = report["stats"]
    return db.insert("shift_reports", {
        "machine_id": report["machineId"], "operator_id": (report["operator"] or {}).get("id"),
        "start": s["start"], "end": s["end"], "stats": report, "summary": summary, "source": source,
    })


# ---------- fleet impact ----------

def impact() -> Dict:
    shifts = [(ms, ms.shift.report(ms.machine_type, time.time())) for ms in engine.machines.values()]
    engine_h = sum(s["engineOnMin"] for _, s in shifts) / 60
    idle_fuel = sum(s["idleFuelL"] for _, s in shifts)
    fuel = sum(s["fuelL"] for _, s in shifts)
    idle_min = sum(s["idleMin"] for _, s in shifts)
    since = time.time() - 86400
    inc = db.query("SELECT severity FROM incidents WHERE ts > ?", [since])
    critical = sum(1 for i in inc if i["severity"] == "critical")

    idle_fuel_per_engine_h = idle_fuel / engine_h if engine_h > 0 else 0
    fleet = max(len(shifts), 1)
    annual_idle_fuel = idle_fuel_per_engine_h * WORK_HOURS_PER_YEAR * fleet
    annual_saving = 0.5 * annual_idle_fuel * FUEL_PRICE        # if idling is halved
    done = db.query("SELECT predicted_minutes, actual_minutes FROM tasks "
                    "WHERE status = 'done' AND actual_minutes > 0 AND predicted_minutes > 0")
    return {
        "currency": CURRENCY,
        "fuelPricePerL": FUEL_PRICE,
        "machines": len(shifts),
        "engineHours": round(engine_h, 2),
        "fuelL": round(fuel, 1),
        "idleMin": round(idle_min, 1),
        "idleFuelL": round(idle_fuel, 2),
        "idleCost": round(idle_fuel * FUEL_PRICE),
        "idleCo2Kg": round(idle_fuel * CO2_KG_PER_L, 1),
        "alerts24h": len(inc),
        "criticalAlerts24h": critical,
        "annualIdleFuelL": round(annual_idle_fuel),
        "annualSavingIfIdleHalved": round(annual_saving),
        "annualCo2SavedKg": round(0.5 * annual_idle_fuel * CO2_KG_PER_L),
        "tasksDone": len(done),
        "assumptions": f"Diesel {CURRENCY}{FUEL_PRICE}/L, {CO2_KG_PER_L} kg CO2/L, "
                       f"{WORK_HOURS_PER_YEAR} engine hours/year per machine, idling cut by half.",
    }


def leaderboard() -> List[Dict]:
    ops = db.query("SELECT id, name, experience_yrs FROM operators ORDER BY id")
    best = {r["operator_id"]: r["best"] for r in db.query(
        "SELECT operator_id, MAX(score) AS best FROM training_progress WHERE module_id = 'hazard-sim' "
        "GROUP BY operator_id")}
    rows = [{**o, **safety_score(o["id"]), "simBest": best.get(o["id"])} for o in ops]
    return sorted(rows, key=lambda r: -r["score"])
