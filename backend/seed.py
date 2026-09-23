"""Reset the SQLite DB with demo operators, machines, today's tasks and some past incidents.

Usage (from backend/):  python seed.py
Also runs automatically when the server starts with an empty DB.
"""

import random
import time
from datetime import date

import pandas as pd

import db
import train

OPERATORS = [
    ("OP-01", "Ravi Kumar", "A1B2C3D4"),
    ("OP-02", "Priya Sharma", "B2C3D4E5"),
    ("OP-03", "Arjun Mehta", "C3D4E5F6"),
    ("OP-04", "Sneha Patil", "D4E5F6A7"),
    ("OP-05", "Vikram Singh", "E5F6A7B8"),
    ("OP-06", "Ananya Iyer", "F6A7B8C9"),
    ("OP-07", "Rahul Verma", "A7B8C9D0"),
    ("OP-08", "Kavya Reddy", "B8C9D0E1"),
    ("OP-09", "Imran Khan", "C9D0E1F2"),
    ("OP-10", "Meera Nair", "D0E1F2A3"),
]
MACHINES = [
    ("EXC-001", "excavator", "CAT 320"),
    ("EXC-002", "excavator", "CAT 336"),
    ("LDR-001", "loader", "CAT 950 GC"),
    ("LDR-002", "loader", "CAT 966"),
    ("DOZ-001", "dozer", "CAT D6"),
]
# who drives which machine today
ASSIGNMENT = {"EXC-001": "OP-01", "EXC-002": "OP-02", "LDR-001": "OP-03", "LDR-002": "OP-04",
              "DOZ-001": "OP-05"}
CAPABLE = {
    "excavator": ["trenching", "digging", "loading", "backfilling"],
    "loader": ["loading", "hauling", "backfilling"],
    "dozer": ["grading", "backfilling", "hauling"],
}
SITES = ["North Pit", "Road Cut B", "Foundation Block C", "Stockpile 2", "Drainage Line 4"]


def seed(rng: random.Random = None) -> None:
    rng = rng or random.Random(7)
    if db.DB_PATH.exists():
        db.conn().close()
        db._local.conn = None
        db.DB_PATH.unlink()
    db.init()

    hist = pd.read_csv(train.DATA_DIR / "task_history.csv") if (train.DATA_DIR / "task_history.csv").exists() else None
    exp = hist.groupby("operator_id")["operator_experience_yrs"].first().to_dict() if hist is not None else {}

    for oid, name, rfid in OPERATORS:
        db.insert("operators", {"id": oid, "name": name, "rfid": rfid,
                                "experience_yrs": exp.get(oid, round(rng.uniform(1, 15), 1)),
                                "certified": ["excavator", "loader", "dozer"][: rng.randint(1, 3)]})
    for mid, mtype, model in MACHINES:
        db.insert("machines", {"id": mid, "type": mtype, "model": model})

    today = date.today().isoformat()
    tods = ["morning", "morning", "afternoon", "afternoon"]
    for mid, mtype, _ in MACHINES:
        for tod in tods:
            db.insert("tasks", {
                "operator_id": ASSIGNMENT[mid], "machine_id": mid, "date": today,
                "task_type": rng.choice(CAPABLE[mtype]), "site": rng.choice(SITES),
                "volume_m3": rng.choice([50, 80, 120, 150, 200, 300]),
                "soil_type": rng.choice(["sand", "gravel", "clay", "rock"]),
                "weather": rng.choice(["clear", "clear", "dust", "rain"]),
                "time_of_day": tod, "slope_deg": round(rng.uniform(-10, 12), 1),
                "temp_c": round(rng.uniform(24, 38), 1),
            })

    # a few past incidents so history pages are not empty
    kinds = [("seatbelt", "critical", "Seatbelt unfastened while engine running"),
             ("proximity", "warning", "Object within 1 m of machine"),
             ("overheat", "warning", "Engine temperature above 100 °C"),
             ("idling", "warning", "Excessive idling detected"),
             ("unsafe_tilt", "critical", "Slope beyond 25°")]
    now = time.time()
    for _ in range(25):
        mid = rng.choice(list(ASSIGNMENT))
        kind, sev, msg = rng.choice(kinds)
        db.insert("incidents", {"ts": now - rng.uniform(3600, 7 * 86400), "machine_id": mid,
                                "operator_id": ASSIGNMENT[mid], "type": kind, "severity": sev,
                                "message": msg, "snapshot": {}})
    print(f"seeded {db.DB_PATH}")


if __name__ == "__main__":
    seed()
