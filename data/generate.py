"""Generate synthetic training datasets for the Smart Operator Assistant.

Usage:
    python data/generate.py              # default sizes, seed 42
    python data/generate.py --seed 7 --scale 2

Writes to data/:
    speed_data.csv     smart speed estimation (regression)
    engine_fault.csv   engine fault detection (classification)
    task_history.csv   task time estimation (regression)
    usage_logs.csv     unusual behavior / anomaly detection
"""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

OUT_DIR = Path(__file__).resolve().parent
G = 9.81

MACHINES = {
    "EXC-001": "excavator",
    "EXC-002": "excavator",
    "LDR-001": "loader",
    "LDR-002": "loader",
    "DOZ-001": "dozer",
}
OPERATORS = [f"OP-{i:02d}" for i in range(1, 11)]


def speed_data(rng: np.random.Generator, n: int) -> pd.DataFrame:
    machine_type = rng.choice(["excavator", "loader", "dozer"], n, p=[0.4, 0.4, 0.2])
    slope = rng.uniform(-35, 35, n)
    rad = np.radians(slope)
    accel_x = G * np.sin(rad) + rng.normal(0, 0.15, n)
    accel_y = rng.normal(0, 0.2, n)
    accel_z = G * np.cos(rad) + rng.normal(0, 0.15, n)
    gyro = rng.normal(0, 1.5, (n, 3)).clip(-5, 5)
    vibration = rng.gamma(2.0, 0.2, n).clip(0, 2)
    load_pct = rng.uniform(0, 100, n)
    surface = rng.choice(["asphalt", "gravel", "sand", "mud"], n, p=[0.2, 0.4, 0.2, 0.2])

    base = pd.Series(machine_type).map({"excavator": 12.0, "loader": 35.0, "dozer": 10.0}).to_numpy()
    surface_f = pd.Series(surface).map({"asphalt": 1.0, "gravel": 0.85, "sand": 0.7, "mud": 0.55}).to_numpy()
    # uphill: power-limited, falls steadily; downhill: braking-limited, falls faster past ~10 deg
    slope_f = np.where(
        slope >= 0,
        1 - 0.022 * slope,
        1 - 0.008 * np.abs(slope) - 0.02 * np.clip(np.abs(slope) - 10, 0, None),
    )
    load_f = 1 - 0.003 * load_pct
    vib_f = 1 - 0.15 * vibration
    speed = base * surface_f * slope_f * load_f * vib_f
    speed = (speed * rng.normal(1, 0.06, n)).clip(0, 40)

    return pd.DataFrame({
        "machine_type": machine_type,
        "slope_deg": slope.round(2),
        "accel_x": accel_x.round(3), "accel_y": accel_y.round(3), "accel_z": accel_z.round(3),
        "gyro_x": gyro[:, 0].round(3), "gyro_y": gyro[:, 1].round(3), "gyro_z": gyro[:, 2].round(3),
        "vibration": vibration.round(3),
        "load_pct": load_pct.round(1),
        "surface": surface,
        "optimal_speed_kmh": speed.round(2),
    })


def engine_fault(rng: np.random.Generator, n: int) -> pd.DataFrame:
    classes = ["normal", "overheating", "bearing_wear", "low_oil_pressure", "sensor_fault"]
    fault = rng.choice(classes, n, p=[0.70, 0.09, 0.08, 0.08, 0.05])

    temp = rng.normal(88, 6, n)
    vibration = rng.gamma(2.0, 0.15, n)
    oil = rng.normal(50, 8, n)
    rpm = rng.normal(1600, 300, n)
    humidity = rng.uniform(20, 95, n)
    hours = rng.uniform(0, 20000, n)
    obstacle = rng.uniform(0, 400, n)

    m = fault == "overheating"
    temp[m] = rng.normal(112, 7, m.sum())          # overlaps normal tail on purpose
    rpm[m] += rng.normal(250, 100, m.sum())
    oil[m] -= rng.normal(6, 3, m.sum())

    m = fault == "bearing_wear"
    vibration[m] = rng.normal(1.3, 0.3, m.sum())
    hours[m] = rng.uniform(9000, 20000, m.sum())
    temp[m] += rng.normal(5, 3, m.sum())

    m = fault == "low_oil_pressure"
    oil[m] = rng.normal(18, 5, m.sum())
    temp[m] += rng.normal(8, 4, m.sum())

    m = fault == "sensor_fault"                     # erratic readings: implausible spikes
    k = m.sum()
    temp[m] = np.where(rng.random(k) < 0.5, rng.uniform(20, 50, k), rng.uniform(125, 140, k))
    oil[m] = rng.uniform(0, 90, k)

    return pd.DataFrame({
        "engine_temp_c": temp.clip(20, 140).round(1),
        "vibration": vibration.clip(0, 2.5).round(3),
        "oil_pressure_psi": oil.clip(0, 90).round(1),
        "rpm": rpm.clip(600, 2600).astype(int),
        "humidity": humidity.round(1),
        "engine_hours": hours.astype(int),
        "obstacle_cm": obstacle.round(1),
        "fault": fault,
    })


def task_history(rng: np.random.Generator, n: int) -> pd.DataFrame:
    # machine type -> task types it can do
    capable = {
        "excavator": ["trenching", "digging", "loading", "backfilling"],
        "loader": ["loading", "hauling", "backfilling"],
        "dozer": ["grading", "backfilling", "hauling"],
    }
    # minutes per m3 for a 5-year operator in clear weather on flat clay/gravel
    rate = {"trenching": 0.30, "digging": 0.22, "loading": 0.12, "backfilling": 0.10,
            "hauling": 0.15, "grading": 0.08}
    soil_f = {"sand": 0.85, "gravel": 1.0, "clay": 1.15, "rock": 1.6}
    weather_f = {"clear": 1.0, "dust": 1.1, "fog": 1.15, "rain": 1.3}
    tod_f = {"morning": 0.95, "afternoon": 1.0, "night": 1.15}

    # fixed skill profile per operator
    exp = dict(zip(OPERATORS, rng.uniform(0.5, 20, len(OPERATORS)).round(1)))

    machine_ids = rng.choice(list(MACHINES), n)
    rows = []
    for i, mid in enumerate(machine_ids):
        mtype = MACHINES[mid]
        task = rng.choice(capable[mtype])
        op = rng.choice(OPERATORS)
        volume = rng.uniform(10, 500)
        soil = rng.choice(list(soil_f), p=[0.3, 0.3, 0.25, 0.15])
        slope = rng.uniform(-20, 20)
        temp = rng.uniform(5, 45)
        weather = rng.choice(list(weather_f), p=[0.6, 0.15, 0.1, 0.15])
        tod = rng.choice(list(tod_f), p=[0.45, 0.4, 0.15])

        exp_f = 1.35 - 0.35 * np.log1p(exp[op]) / np.log1p(20)   # 1.35 (novice) .. 1.0 (expert)
        slope_f = 1 + 0.015 * abs(slope)
        heat_f = 1 + 0.01 * max(temp - 35, 0)
        minutes = (10 + rate[task] * volume) * soil_f[soil] * weather_f[weather] * tod_f[tod] \
            * exp_f * slope_f * heat_f
        minutes *= rng.lognormal(0, 0.1)

        rows.append({
            "task_id": f"T-{i + 1:05d}",
            "machine_id": mid,
            "machine_type": mtype,
            "operator_id": op,
            "operator_experience_yrs": exp[op],
            "task_type": task,
            "volume_m3": round(volume, 1),
            "soil_type": soil,
            "slope_deg": round(slope, 1),
            "temp_c": round(temp, 1),
            "weather": weather,
            "time_of_day": tod,
            "duration_min": round(minutes, 1),
        })
    return pd.DataFrame(rows)


def usage_logs(rng: np.random.Generator, n: int) -> pd.DataFrame:
    window_min = 15
    machine_ids = rng.choice(list(MACHINES), n)
    operator_ids = rng.choice(OPERATORS, n)
    start = pd.Timestamp("2026-08-01 06:00")
    timestamps = start + pd.to_timedelta(np.sort(rng.integers(0, 60 * 24 * 45, n)), unit="min")
    engine_hours = rng.uniform(500, 15000, n)

    label = rng.choice(
        ["normal", "excessive_idling", "unsafe_operation", "fuel_waste"],
        n, p=[0.90, 0.04, 0.04, 0.02],
    )

    idle = rng.gamma(2.0, 1.0, n).clip(0, 6)                 # normal: a few idle minutes
    load_cycles = rng.poisson(22, n)
    avg_rpm = rng.normal(1550, 150, n)
    tilt = np.abs(rng.normal(8, 5, n))
    harsh = rng.poisson(0.5, n)
    overspeed = rng.poisson(0.2, n)
    belt_off = np.where(rng.random(n) < 0.05, rng.integers(5, 60, n), 0)
    proximity = rng.poisson(0.4, n)

    m = label == "excessive_idling"
    idle[m] = rng.uniform(10, 15, m.sum())
    load_cycles[m] = rng.poisson(4, m.sum())
    avg_rpm[m] = rng.normal(850, 60, m.sum())

    m = label == "unsafe_operation"
    k = m.sum()
    tilt[m] = rng.uniform(22, 35, k)
    harsh[m] = rng.poisson(6, k)
    overspeed[m] = rng.poisson(4, k)
    belt_off[m] = np.where(rng.random(k) < 0.6, rng.integers(120, 900, k), belt_off[m])
    proximity[m] = rng.poisson(3, k)

    m = label == "fuel_waste"
    avg_rpm[m] = rng.normal(2200, 150, m.sum())
    load_cycles[m] = rng.poisson(10, m.sum())

    idle = idle.clip(0, window_min)
    working = window_min - idle
    # litres per window: idle burn + working burn scaled by rpm
    fuel = idle * 0.05 + working * 0.35 * (avg_rpm / 1550) ** 2
    fuel *= rng.normal(1, 0.08, n)

    return pd.DataFrame({
        "machine_id": machine_ids,
        "operator_id": operator_ids,
        "timestamp": timestamps,
        "engine_hours": engine_hours.round(1),
        "fuel_used_l": fuel.clip(0).round(2),
        "load_cycles": load_cycles,
        "idle_min": idle.round(2),
        "idle_ratio": (idle / window_min).round(3),
        "avg_rpm": avg_rpm.clip(700, 2600).astype(int),
        "max_tilt_deg": tilt.clip(0, 40).round(1),
        "harsh_events": harsh,
        "overspeed_events": overspeed,
        "seatbelt_off_sec": belt_off,
        "proximity_alerts": proximity,
        "label": label,
    })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--scale", type=float, default=1.0, help="multiply all row counts")
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    size = lambda base: int(base * args.scale)  # noqa: E731

    datasets = {
        "speed_data.csv": speed_data(rng, size(5000)),
        "engine_fault.csv": engine_fault(rng, size(5000)),
        "task_history.csv": task_history(rng, size(3000)),
        "usage_logs.csv": usage_logs(rng, size(5000)),
    }
    for name, df in datasets.items():
        df.to_csv(OUT_DIR / name, index=False)
        print(f"{name:18s} {len(df):6d} rows  {df.shape[1]:2d} cols")


if __name__ == "__main__":
    main()
