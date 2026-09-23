"""Virtual CAT machines: stream realistic telemetry to the backend every second, like an ESP32 would.

Usage:
    python simulator/sim.py                                  # all 5 machines, localhost:8000
    python simulator/sim.py --machines EXC-001,LDR-001
    python simulator/sim.py --chaos 45                       # random scenario every ~45 s
    python simulator/sim.py --scenario EXC-001:overheat      # start with a scenario

Each machine keeps a smoothly-evolving state (work / travel / idle phases, terrain, engine
temperature...) using the same ranges as data/generate.py, so ML predictions stay meaningful.
Scenarios can also be triggered from the dashboard: the backend queues commands and returns
them in the telemetry response.
"""

import argparse
import math
import random
import time
from typing import Dict, List, Optional

import httpx

G = 9.81

MACHINES = {
    "EXC-001": ("excavator", "A1B2C3D4"),
    "EXC-002": ("excavator", "B2C3D4E5"),
    "LDR-001": ("loader", "C3D4E5F6"),
    "LDR-002": ("loader", "D4E5F6A7"),
    "DOZ-001": ("dozer", "E5F6A7B8"),
}
NOMINAL_SPEED = {"excavator": 10.0, "loader": 30.0, "dozer": 8.5}   # ~85% of generate.py base speeds

SCENARIOS = {
    # name: duration seconds
    "overheat": 45,
    "worker_approach": 14,
    "steep_slope": 20,
    "unbuckle": 15,
    "long_idle": 90,
    "overspeed": 15,
    "bearing_wear": 30,
    "low_oil": 30,
    "fuel_waste": 75,
    "harsh": 10,
}


def approach(cur: float, target: float, rate: float) -> float:
    """First-order lag toward target."""
    return cur + (target - cur) * rate


class Machine:
    def __init__(self, machine_id: str, rng: random.Random) -> None:
        self.id = machine_id
        self.type, self.rfid = MACHINES[machine_id]
        self.rng = rng
        self.engine_on = True
        self.seatbelt = True
        self.logged_in = True
        self.phase, self.phase_left = "work", rng.uniform(20, 40)
        self.slope, self.slope_target, self.slope_left = 0.0, rng.uniform(-8, 8), 30.0
        self.surface = rng.choice(["gravel", "gravel", "sand", "mud", "asphalt"])
        self.temp = 80.0
        self.humidity = rng.uniform(40, 70)
        self.obstacle = rng.uniform(250, 400)
        self.speed = 0.0
        self.rpm = 1500.0
        self.oil = 50.0
        self.vibration = 0.3
        self.load = 40.0
        self.hours = rng.uniform(2000, 12000)
        self.cycle_timer = 0.0
        self.scenarios: Dict[str, float] = {}   # name -> seconds left

    # ----- commands -----

    def apply(self, cmd: Dict) -> None:
        name = cmd.get("command")
        if name == "normal":
            self.scenarios.clear()
            self.seatbelt, self.engine_on = True, True
        elif name == "set":
            f, v = cmd.get("field"), cmd.get("value")
            if f == "engineOn":
                self.engine_on = bool(v)
            elif f == "seatbelt":
                self.seatbelt = bool(v)
            elif f == "login":
                self.logged_in = bool(v)
        elif name in SCENARIOS:
            self.scenarios[name] = SCENARIOS[name]
            if name == "worker_approach":
                self.obstacle = 300
        print(f"[{self.id}] command: {cmd}", flush=True)

    def active(self, name: str) -> bool:
        return self.scenarios.get(name, 0) > 0

    # ----- physics step -----

    def step(self, dt: float) -> Dict:
        r = self.rng
        for k in list(self.scenarios):
            self.scenarios[k] -= dt
            if self.scenarios[k] <= 0:
                del self.scenarios[k]
                if k == "unbuckle":
                    self.seatbelt = True

        # phase machine: work -> travel -> (short idle) -> work ...
        self.phase_left -= dt
        if self.phase_left <= 0:
            self.phase = r.choices(["work", "travel", "idle"], [0.55, 0.35, 0.10])[0]
            self.phase_left = {"work": r.uniform(25, 50), "travel": r.uniform(10, 25),
                               "idle": r.uniform(5, 15)}[self.phase]
        phase = "idle" if self.active("long_idle") else self.phase
        if not self.engine_on:
            phase = "off"

        # terrain
        self.slope_left -= dt
        if self.slope_left <= 0:
            self.slope_target = r.uniform(-15, 15)
            self.slope_left = r.uniform(20, 40)
            if r.random() < 0.2:
                self.surface = r.choice(["gravel", "sand", "mud", "asphalt"])
        target = 28.0 if self.active("steep_slope") else self.slope_target
        self.slope = approach(self.slope, target, 0.15 if self.active("steep_slope") else 0.05)
        self.slope += r.gauss(0, 0.3)

        # speed: operator drives roughly at a terrain-appropriate speed
        nominal = NOMINAL_SPEED[self.type]
        terrain = max(0.2, 1 - 0.022 * abs(self.slope)) * {"asphalt": 1, "gravel": 0.85, "sand": 0.7,
                                                            "mud": 0.55}[self.surface]
        want = {"work": nominal * 0.25, "travel": nominal * terrain * r.uniform(0.8, 1.0),
                "idle": 0.0, "off": 0.0}[phase]
        if self.active("overspeed"):
            want = nominal * 2.0
        self.speed = max(0.0, approach(self.speed, want, 0.3) + r.gauss(0, 0.1))
        if phase in ("idle", "off"):
            self.speed = 0.0 if self.speed < 0.3 else self.speed * 0.5

        # engine
        rpm_target = {"work": 1750, "travel": 1600, "idle": 850, "off": 0}[phase]
        if self.active("fuel_waste") and phase != "off":
            rpm_target = 2250
        self.rpm = max(0.0, approach(self.rpm, rpm_target, 0.3) + r.gauss(0, 20) * (phase != "off"))

        temp_target = 45 if phase == "off" else 82 + 8 * (self.rpm / 1750) + 0.1 * self.humidity
        if self.active("overheat"):
            temp_target = 120
        self.temp = approach(self.temp, temp_target, 0.06) + r.gauss(0, 0.2)

        oil_target = 14.0 if self.active("low_oil") else 50.0 if phase != "off" else 0.0
        self.oil = approach(self.oil, oil_target, 0.2) + r.gauss(0, 0.5)

        vib_target = {"work": 0.45, "travel": 0.35, "idle": 0.15, "off": 0.0}[phase]
        if self.active("bearing_wear"):
            vib_target = 1.4
        self.vibration = max(0.0, approach(self.vibration, vib_target, 0.2) + r.gauss(0, 0.03))

        # surroundings
        if self.active("worker_approach"):
            left = self.scenarios["worker_approach"]
            obstacle_target = 30 if left > 4 else 300
            self.obstacle = approach(self.obstacle, obstacle_target, 0.35)
        else:
            self.obstacle = min(400.0, max(120.0, self.obstacle + r.gauss(0, 8)))
            if self.obstacle < 150:
                self.obstacle += 10   # drift back to a clear area

        # bucket load cycles while working
        load_cycle = False
        if phase == "work" and not self.active("fuel_waste"):
            self.cycle_timer += dt
            if self.cycle_timer >= r.uniform(15, 25):
                self.cycle_timer, load_cycle = 0.0, True
        self.load = approach(self.load, 80 if phase == "work" else 30, 0.1)

        harsh = self.active("harsh") and r.random() < 0.6 or (phase == "travel" and r.random() < 0.01)
        if self.engine_on:
            self.hours += dt / 3600

        fuel_rate = 0.0 if phase == "off" else 3.0 if phase == "idle" else 20 * (self.rpm / 1550) ** 2

        rad = math.radians(self.slope)
        jolt = 2.5 if harsh else 0.15
        return {
            "machineId": self.id,
            "machineType": self.type,
            "rfid": self.rfid if self.logged_in else None,
            "ts": time.time(),
            "engineOn": self.engine_on,
            "seatbelt": self.seatbelt and not self.active("unbuckle"),
            "engineTempC": round(self.temp, 1),
            "humidity": round(self.humidity, 1),
            "obstacleCm": round(self.obstacle, 1),
            "accel": {"x": round(G * math.sin(rad) + r.gauss(0, jolt), 3),
                      "y": round(r.gauss(0, jolt), 3),
                      "z": round(G * math.cos(rad) + r.gauss(0, 0.1), 3)},
            "gyro": {"x": round(r.gauss(0, 1), 3), "y": round(r.gauss(0, 1), 3),
                     "z": round(r.gauss(0, 1), 3)},
            "slopeDeg": round(self.slope, 2),
            "vibration": round(self.vibration, 3),
            "speedKmh": round(self.speed, 2),
            "rpm": int(self.rpm),
            "oilPressurePsi": round(max(0.0, self.oil), 1),
            "engineHours": round(self.hours, 2),
            "loadPct": round(self.load, 1),
            "surface": self.surface,
            "fuelRateLph": round(fuel_rate, 2),
            "loadCycle": load_cycle,
            "harshEvent": bool(harsh),
            "phase": phase,
            "scenarios": sorted(self.scenarios),
        }


def run(url: str, ids: List[str], chaos: Optional[float], start: List[str], seed: int) -> None:
    rng = random.Random(seed)
    machines = [Machine(mid, random.Random(rng.random())) for mid in ids]
    by_id = {m.id: m for m in machines}
    for s in start:
        mid, name = s.split(":")
        by_id[mid].apply({"command": name})

    next_chaos = time.time() + (chaos or 0)
    client = httpx.Client(base_url=url, timeout=3)
    print(f"streaming {', '.join(ids)} to {url}  (Ctrl+C to stop)", flush=True)
    last = time.time()
    while True:
        now = time.time()
        dt, last = now - last, now
        for m in machines:
            payload = m.step(dt)
            try:
                res = client.post("/api/telemetry", json=payload)
                res.raise_for_status()
                for cmd in res.json().get("commands", []):
                    m.apply(cmd)
            except httpx.HTTPError as e:
                print(f"[{m.id}] backend unreachable: {e.__class__.__name__}", flush=True)
        if chaos and now >= next_chaos:
            m = rng.choice(machines)
            m.apply({"command": rng.choice(list(SCENARIOS))})
            next_chaos = now + rng.uniform(0.6, 1.4) * chaos
        time.sleep(max(0.0, 1.0 - (time.time() - now)))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", default="http://localhost:8000")
    p.add_argument("--machines", default=",".join(MACHINES))
    p.add_argument("--chaos", type=float, default=None, help="seconds between random scenarios")
    p.add_argument("--scenario", action="append", default=[], help="MACHINE:SCENARIO at start")
    p.add_argument("--seed", type=int, default=1)
    a = p.parse_args()
    try:
        run(a.url.rstrip("/"), a.machines.split(","), a.chaos, a.scenario, a.seed)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
