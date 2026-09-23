"""FastAPI service serving the Smart Operator Assistant ML models.

Run from ml-service/:
    uvicorn main:app --reload --port 8000

Docs at http://localhost:8000/docs. Request/response formats: docs/CONTRACT.md section 3.
"""

import math
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Literal, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

import train

MachineType = Literal["excavator", "loader", "dozer"]
MODELS: Dict[str, dict] = {}


def load_models() -> None:
    names = ["speed", "fault", "task_time", "anomaly"]
    if not all((train.MODEL_DIR / f"{n}.joblib").exists() for n in names):
        train.main()
    for n in names:
        MODELS[n] = joblib.load(train.MODEL_DIR / f"{n}.joblib")


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_models()
    yield


app = FastAPI(title="CAT Operator Assistant ML", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Vec3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


# ---------- speed ----------

class SpeedRequest(CamelModel):
    slope_deg: float = Field(ge=-90, le=90)
    machine_type: MachineType = "excavator"
    accel: Optional[Vec3] = None
    gyro: Optional[Vec3] = None
    vibration: float = Field(0.3, ge=0)
    load_pct: float = Field(50, ge=0, le=100)
    surface: Literal["asphalt", "gravel", "sand", "mud"] = "gravel"


class SpeedResponse(CamelModel):
    speed_kmh: float
    slope_deg: float
    advisory: str


@app.post("/predict/speed", response_model=SpeedResponse, response_model_by_alias=True)
def predict_speed(req: SpeedRequest):
    rad = math.radians(req.slope_deg)
    accel = req.accel or Vec3(x=9.81 * math.sin(rad), z=9.81 * math.cos(rad))
    gyro = req.gyro or Vec3()
    row = pd.DataFrame([{
        "machine_type": req.machine_type, "surface": req.surface,
        "slope_deg": req.slope_deg,
        "accel_x": accel.x, "accel_y": accel.y, "accel_z": accel.z,
        "gyro_x": gyro.x, "gyro_y": gyro.y, "gyro_z": gyro.z,
        "vibration": req.vibration, "load_pct": req.load_pct,
    }])
    speed = max(0.0, float(MODELS["speed"]["model"].predict(row)[0]))

    s = req.slope_deg
    if abs(s) > 25:
        advisory = "Slope beyond safe limit. Stop and reposition."
    elif s > 10:
        advisory = "Steep uphill. Use low gear, keep bucket low."
    elif s < -10:
        advisory = "Steep downhill. Reduce speed, keep bucket low as a brake."
    else:
        advisory = "Normal terrain."
    return SpeedResponse(speed_kmh=round(speed, 1), slope_deg=s, advisory=advisory)


# ---------- engine fault ----------

class FaultRequest(CamelModel):
    engine_temp_c: float
    vibration: float = Field(ge=0)
    oil_pressure_psi: float = 50
    rpm: float = 1600
    humidity: float = 50
    engine_hours: float = 5000
    obstacle_cm: float = 200


class FaultResponse(CamelModel):
    fault: str
    prob: float
    probabilities: Dict[str, float]


@app.post("/predict/fault", response_model=FaultResponse, response_model_by_alias=True)
def predict_fault(req: FaultRequest):
    bundle = MODELS["fault"]
    row = pd.DataFrame([{
        "engine_temp_c": req.engine_temp_c, "vibration": req.vibration,
        "oil_pressure_psi": req.oil_pressure_psi, "rpm": req.rpm, "humidity": req.humidity,
        "engine_hours": req.engine_hours, "obstacle_cm": req.obstacle_cm,
    }])[bundle["features"]]
    probs = bundle["model"].predict_proba(row)[0]
    classes = bundle["model"].classes_
    best = int(np.argmax(probs))
    return FaultResponse(
        fault=str(classes[best]),
        prob=round(float(probs[best]), 3),
        probabilities={str(c): round(float(p), 3) for c, p in zip(classes, probs)},
    )


# ---------- task time ----------

class TaskTimeRequest(CamelModel):
    task_type: Literal["trenching", "digging", "loading", "backfilling", "hauling", "grading"]
    machine_id: Optional[str] = None
    machine_type: Optional[MachineType] = None
    operator_id: Optional[str] = None
    operator_experience_yrs: Optional[float] = Field(None, ge=0)
    volume_m3: float = Field(100, gt=0)
    soil_type: Literal["sand", "gravel", "clay", "rock"] = "gravel"
    slope_deg: float = 0
    temp_c: float = 25
    weather: Literal["clear", "dust", "fog", "rain"] = "clear"
    time_of_day: Optional[Literal["morning", "afternoon", "night"]] = None


class TaskTimeResponse(CamelModel):
    minutes: float
    low: float
    high: float
    operator_experience_yrs: float


def _time_of_day() -> str:
    h = datetime.now().hour
    return "morning" if 5 <= h < 12 else "afternoon" if 12 <= h < 19 else "night"


@app.post("/predict/task-time", response_model=TaskTimeResponse, response_model_by_alias=True)
def predict_task_time(req: TaskTimeRequest):
    b = MODELS["task_time"]
    exp = req.operator_experience_yrs
    if exp is None:
        exp = b["operators"].get(req.operator_id, b["default_experience"])
    mtype = req.machine_type or b["machines"].get(req.machine_id, "excavator")
    row = pd.DataFrame([{
        "machine_type": mtype, "task_type": req.task_type, "soil_type": req.soil_type,
        "weather": req.weather, "time_of_day": req.time_of_day or _time_of_day(),
        "operator_experience_yrs": exp, "volume_m3": req.volume_m3,
        "slope_deg": req.slope_deg, "temp_c": req.temp_c,
    }])
    pipe = b["model"]
    Xt = pipe.named_steps["enc"].transform(row)
    per_tree = np.array([t.predict(Xt)[0] for t in pipe.named_steps["rf"].estimators_])
    return TaskTimeResponse(
        minutes=round(float(per_tree.mean()), 1),
        low=round(float(np.percentile(per_tree, 10)), 1),
        high=round(float(np.percentile(per_tree, 90)), 1),
        operator_experience_yrs=round(float(exp), 1),
    )


# ---------- unusual behavior ----------

class AnomalyRequest(CamelModel):
    """Aggregates over one 15-minute window for one machine."""
    idle_min: float = Field(ge=0, le=15)
    fuel_used_l: float = 4.0
    load_cycles: int = 20
    avg_rpm: float = 1550
    max_tilt_deg: float = 8
    harsh_events: int = 0
    overspeed_events: int = 0
    seatbelt_off_sec: int = 0
    proximity_alerts: int = 0


class AnomalyResponse(CamelModel):
    anomaly: bool
    reason: str
    reasons: List[str]
    score: float


def _rule_reasons(r: AnomalyRequest) -> List[str]:
    reasons = []
    if r.idle_min / 15 > 0.5:
        reasons.append("excessive_idling")
    if (r.max_tilt_deg >= 20 or r.harsh_events >= 3 or r.overspeed_events >= 3
            or r.seatbelt_off_sec >= 120 or r.proximity_alerts >= 3):
        reasons.append("unsafe_operation")
    if r.avg_rpm >= 2000 and r.load_cycles <= 14:
        reasons.append("fuel_waste")
    return reasons


@app.post("/predict/anomaly", response_model=AnomalyResponse, response_model_by_alias=True)
def predict_anomaly(req: AnomalyRequest):
    b = MODELS["anomaly"]
    values = req.model_dump()
    values["idle_ratio"] = req.idle_min / 15
    row = pd.DataFrame([values])[b["features"]]
    score = float(b["model"].decision_function(row)[0])   # < 0 means outlier
    reasons = _rule_reasons(req)
    flagged = score < 0 or bool(reasons)
    reason = reasons[0] if reasons else ("unusual_pattern" if flagged else "normal")
    return AnomalyResponse(anomaly=flagged, reason=reason, reasons=reasons, score=round(score, 4))


# ---------- meta ----------

@app.get("/health")
def health():
    return {"ok": True, "models": sorted(MODELS)}


@app.get("/models")
def model_info():
    return {name: b["metrics"] for name, b in MODELS.items()}
