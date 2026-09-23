"""Pre-start walk-around inspection checklist (modelled on daily operator inspections).

`critical` items lock the machine out until maintenance clears them.
"""

from typing import Dict, List

ITEMS: List[Dict] = [
    {"id": "tracks", "group": "Walk-around", "label": "Tracks / tyres, rollers and sprockets: no damage or loose parts", "critical": False},
    {"id": "hydraulics", "group": "Walk-around", "label": "No hydraulic leaks at hoses, cylinders, fittings", "critical": True},
    {"id": "bucket", "group": "Walk-around", "label": "Bucket, teeth, pins and quick coupler secure", "critical": False},
    {"id": "fluids", "group": "Fluids", "label": "Engine oil, coolant, hydraulic oil at correct level", "critical": True},
    {"id": "fuel", "group": "Fluids", "label": "Fuel and DEF level sufficient for the shift", "critical": False},
    {"id": "lights", "group": "Cab", "label": "Lights, beacon and horn working", "critical": False},
    {"id": "mirrors", "group": "Cab", "label": "Mirrors and camera clean, correctly adjusted", "critical": False},
    {"id": "seatbelt", "group": "Cab", "label": "Seatbelt latches and is undamaged", "critical": True},
    {"id": "brakes", "group": "Cab", "label": "Brakes / swing lock and controls respond normally", "critical": True},
    {"id": "extinguisher", "group": "Safety", "label": "Fire extinguisher present and charged", "critical": False},
    {"id": "area", "group": "Safety", "label": "Work area checked: no people, overhead lines or trenches nearby", "critical": False},
]

BY_ID = {i["id"]: i for i in ITEMS}


def evaluate(results: List[Dict]) -> Dict:
    """results: [{id, ok, note}] -> summary with failed items and whether the machine is locked out."""
    by = {r["id"]: r for r in results}
    missing = [i["id"] for i in ITEMS if i["id"] not in by]
    failed = [{**BY_ID[r["id"]], "note": r.get("note", "")} for r in results
              if r["id"] in BY_ID and not r.get("ok")]
    lockout = any(f["critical"] for f in failed)
    return {"missing": missing, "failed": failed, "lockout": lockout,
            "passed": not missing and not failed}
