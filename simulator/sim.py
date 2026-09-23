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
from typing import Dict, List, Optional, Tuple

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
    "overheat": 150,
    "worker_approach": 14,
    "steep_slope": 20,
    "unbuckle": 15,
    "long_idle": 90,
    "overspeed": 15,
    "bearing_wear": 30,
    "low_oil": 30,
    "fuel_waste": 75,
    "harsh": 10,
    "enter_zone": 40,        # drive into the pedestrian area
    "approach_machine": 40,  # drive towards the nearest machine
    "rollover": 20,          # tilt past 35 degrees -> automatic SOS
    "breakdown": 3600,       # oil pressure lost, engine stalls -> automatic SOS (until "normal")
}


class Site:
    """Terrain grid + zones downloaded from the backend (GET /api/site)."""

    def __init__(self, data: Optional[Dict] = None) -> None:
        self.data = data
        self.zones = (data or {}).get("zones", [])
        self.width = (data or {}).get("width", 400.0)
        self.height = (data or {}).get("height", 300.0)

    def elevation(self, x: float, y: float) -> float:
        d = self.data
        if not d:
            return 100.0
        step, nx, ny, h = d["step"], d["nx"], d["ny"], d["heights"]
        fx = min(max(x / step, 0), nx - 1.001)
        fy = min(max(y / step, 0), ny - 1.001)
        i, j = int(fx), int(fy)
        tx, ty = fx - i, fy - j
        top = h[j][i] * (1 - tx) + h[j][i + 1] * tx
        bottom = h[j + 1][i] * (1 - tx) + h[j + 1][i + 1] * tx
        return top * (1 - ty) + bottom * ty

    def slope_along(self, x: float, y: float, heading: float, d: float = 3.0) -> float:
        """Terrain slope in degrees in the direction of travel (+ = uphill)."""
        hx, hy = math.sin(math.radians(heading)), math.cos(math.radians(heading))
        rise = self.elevation(x + hx * d, y + hy * d) - self.elevation(x - hx * d, y - hy * d)
        return math.degrees(math.atan2(rise, 2 * d))

    def in_zone(self, x: float, y: float) -> bool:
        return any(point_in_polygon(x, y, z["polygon"]) for z in self.zones)

    def zone_center(self, zone_id: str) -> Optional[Tuple[float, float]]:
        for z in self.zones:
            if z["id"] == zone_id:
                xs, ys = zip(*z["polygon"])
                return sum(xs) / len(xs), sum(ys) / len(ys)
        return None


def point_in_polygon(x: float, y: float, poly) -> bool:
    inside, j = False, len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def heading_to(x: float, y: float, tx: float, ty: float) -> float:
    return (math.degrees(math.atan2(tx - x, ty - y)) + 360) % 360


def turn_towards(cur: float, target: float, max_step: float) -> float:
    diff = (target - cur + 540) % 360 - 180
    return (cur + max(-max_step, min(max_step, diff))) % 360


def approach(cur: float, target: float, rate: float) -> float:
    """First-order lag toward target."""
    return cur + (target - cur) * rate


class Machine:
    def __init__(self, machine_id: str, rng: random.Random, site: Site, start: Optional[List[float]] = None) -> None:
        self.id = machine_id
        self.type, self.rfid = MACHINES[machine_id]
        self.rng = rng
        self.engine_on = True
        self.seatbelt = True
        self.logged_in = True
        self.phase, self.phase_left = "work", rng.uniform(20, 40)
        self.site = site
        self.x, self.y, self.heading = start or (rng.uniform(80, 320), rng.uniform(80, 220), rng.uniform(0, 360))
        self.slope = 0.0
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
            self.oil = 50.0
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

    def move(self, dt: float, phase: str, others: List["Machine"]) -> None:
        """Drive around the site: wander while travelling, avoid zones/machines unless a scenario says otherwise."""
        r = self.rng
        target = None
        if self.active("enter_zone"):
            target = self.site.zone_center("office")
        elif self.active("approach_machine") and others:
            o = min(others, key=lambda m: math.hypot(m.x - self.x, m.y - self.y))
            if math.hypot(o.x - self.x, o.y - self.y) > 6:
                target = (o.x, o.y)
        if target:
            self.heading = turn_towards(self.heading, heading_to(self.x, self.y, *target), 25 * dt)
        elif phase == "travel":
            self.heading = (self.heading + r.gauss(0, 6) * dt) % 360
            cx, cy = self.site.width / 2, self.site.height / 2
            margin = 25
            if not (margin < self.x < self.site.width - margin and margin < self.y < self.site.height - margin):
                self.heading = turn_towards(self.heading, heading_to(self.x, self.y, cx, cy), 30 * dt)
        if phase not in ("travel",) and not target:
            return
        step = self.speed / 3.6 * dt
        nx = self.x + math.sin(math.radians(self.heading)) * step
        ny = self.y + math.cos(math.radians(self.heading)) * step
        if not target:
            blocked = self.site.in_zone(nx, ny) or any(
                math.hypot(o.x - nx, o.y - ny) < 25 for o in others)
            if blocked:                       # operator steers away from hazards
                self.heading = (self.heading + 150 + r.uniform(-30, 30)) % 360
                return
        self.x = min(max(nx, 2), self.site.width - 2)
        self.y = min(max(ny, 2), self.site.height - 2)

    def step(self, dt: float, others: Optional[List["Machine"]] = None) -> Dict:
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
        if self.active("enter_zone") or self.active("approach_machine"):
            phase = "travel"
        if self.active("breakdown"):
            self.oil = max(0.0, self.oil - 20 * dt)       # oil pressure collapses...
            if self.oil < 8 and SCENARIOS["breakdown"] - self.scenarios["breakdown"] > 3:
                self.engine_on = False                     # ...and the engine stalls
        if not self.engine_on:
            phase = "off"

        # terrain: slope comes from the site's hills in the direction of travel
        self.move(dt, phase, others or [])
        if r.random() < 0.005:
            self.surface = r.choice(["gravel", "sand", "mud", "asphalt"])
        target = self.site.slope_along(self.x, self.y, self.heading)
        rate = 0.4
        if self.active("steep_slope"):
            target, rate = 28.0, 0.15
        if self.active("rollover"):
            target, rate = 38.0, 0.25
        self.slope = approach(self.slope, target, rate) + r.gauss(0, 0.3)

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
        if self.active("overheat"):   # steady climb (~9 °C/min) so the forecast has time to warn
            self.temp = min(122.0, self.temp + 0.15 * dt) + r.gauss(0, 0.1)
        else:
            self.temp = approach(self.temp, temp_target, 0.06) + r.gauss(0, 0.2)

        if not self.active("breakdown"):
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
            "posX": round(self.x, 1),
            "posY": round(self.y, 1),
            "heading": round(self.heading, 1),
            "elevation": round(self.site.elevation(self.x, self.y), 2),
        }


def run(url: str, ids: List[str], chaos: Optional[float], start: List[str], seed: int) -> None:
    rng = random.Random(seed)
    client = httpx.Client(base_url=url, timeout=3)
    site = Site()
    for _ in range(30):   # wait for the backend so machines drive on the real terrain
        try:
            site = Site(client.get("/api/site").json())
            break
        except httpx.HTTPError:
            print("waiting for backend /api/site ...", flush=True)
            time.sleep(2)
    start_pos = (site.data or {}).get("start", {})
    machines = [Machine(mid, random.Random(rng.random()), site, start_pos.get(mid)) for mid in ids]
    by_id = {m.id: m for m in machines}
    for s in start:
        mid, name = s.split(":")
        by_id[mid].apply({"command": name})

    next_chaos = time.time() + (chaos or 0)
    print(f"streaming {', '.join(ids)} to {url}  (Ctrl+C to stop)", flush=True)
    last = time.time()
    while True:
        now = time.time()
        dt, last = now - last, now
        for m in machines:
            payload = m.step(dt, [o for o in machines if o is not m])
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
