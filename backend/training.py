"""Operator training hub content: modules, quizzes, instructors.

`videoUrl` values are YouTube search links; swap in specific videos (embed URLs) when chosen.
`triggers` maps incident types to the module, used for "recommended for you".
"""

from typing import Dict, List

MODULES: List[Dict] = [
    {
        "id": "seatbelt",
        "title": "Seatbelt & Cab Safety",
        "minutes": 5,
        "videoUrl": "https://www.youtube.com/results?search_query=heavy+equipment+seatbelt+safety",
        "triggers": ["seatbelt"],
        "quiz": [
            {"q": "When must the seatbelt be fastened?",
             "options": ["Only when travelling", "Whenever the engine is running", "Only on slopes"],
             "answer": 1},
            {"q": "In a rollover, the safest action is to…",
             "options": ["Jump out of the cab", "Stay belted in the seat and hold on", "Open the door"],
             "answer": 1},
            {"q": "A worn seatbelt should be…",
             "options": ["Replaced before operating", "Used until the end of shift", "Tied in a knot"],
             "answer": 0},
        ],
    },
    {
        "id": "proximity",
        "title": "Working Around People: Blind Spots & Exclusion Zones",
        "minutes": 7,
        "videoUrl": "https://www.youtube.com/results?search_query=excavator+blind+spots+exclusion+zone",
        "triggers": ["proximity", "camera_person"],
        "quiz": [
            {"q": "Before swinging the excavator house you should…",
             "options": ["Sound the horn and check all mirrors/camera", "Swing slowly without looking",
                         "Wait for radio silence"], "answer": 0},
            {"q": "A worker enters the swing radius. You…",
             "options": ["Continue carefully", "Stop all movement until they leave", "Honk and continue"],
             "answer": 1},
            {"q": "The safest way to communicate with a ground worker is…",
             "options": ["Shouting", "Agreed hand signals or radio, with eye contact", "Flashing lights"],
             "answer": 1},
        ],
    },
    {
        "id": "slopes",
        "title": "Operating on Slopes & Uneven Terrain",
        "minutes": 8,
        "videoUrl": "https://www.youtube.com/results?search_query=operating+heavy+equipment+on+slopes",
        "triggers": ["unsafe_tilt", "overspeed"],
        "quiz": [
            {"q": "On a steep slope, travel…",
             "options": ["Across the slope", "Straight up or down the slope", "Diagonally at speed"],
             "answer": 1},
            {"q": "Going downhill with a loader, keep the bucket…",
             "options": ["Raised high", "Low, near the ground", "Fully curled up high"], "answer": 1},
            {"q": "The assistant's speed advisory drops on steep grades because…",
             "options": ["Fuel is expensive", "Braking distance and tip-over risk increase",
                         "The engine is weaker downhill"], "answer": 1},
        ],
    },
    {
        "id": "engine-care",
        "title": "Daily Walk-around & Engine Warning Signs",
        "minutes": 6,
        "videoUrl": "https://www.youtube.com/results?search_query=cat+excavator+daily+walkaround+inspection",
        "triggers": ["overheat", "engine_fault"],
        "quiz": [
            {"q": "Engine temperature is climbing past normal. First step?",
             "options": ["Push harder to finish the task", "Reduce load, idle down, and report",
                         "Turn off the radiator fan"], "answer": 1},
            {"q": "Low oil pressure warning means…",
             "options": ["Ignore until the end of shift", "Stop the engine safely and check",
                         "Increase RPM"], "answer": 1},
            {"q": "Unusual vibration can indicate…",
             "options": ["Bearing wear or loose components", "Good performance", "Full fuel tank"],
             "answer": 0},
        ],
    },
    {
        "id": "fuel-efficiency",
        "title": "Fuel-Efficient Operation & Idling",
        "minutes": 5,
        "videoUrl": "https://www.youtube.com/results?search_query=heavy+equipment+reduce+idling+fuel+efficiency",
        "triggers": ["idling", "anomaly"],
        "quiz": [
            {"q": "Idling for 1 hour burns roughly…",
             "options": ["No fuel", "Several litres of fuel and adds engine hours", "Only electricity"],
             "answer": 1},
            {"q": "If waiting more than ~5 minutes, you should…",
             "options": ["Keep high RPM", "Shut down the engine (after cool-down)", "Rev periodically"],
             "answer": 1},
            {"q": "High RPM with few load cycles usually means…",
             "options": ["Efficient work", "Wasted fuel", "Better cooling"], "answer": 1},
        ],
    },
    {
        "id": "fatigue",
        "title": "Fatigue & Alertness",
        "minutes": 4,
        "videoUrl": "https://www.youtube.com/results?search_query=operator+fatigue+construction+safety",
        "triggers": ["drowsy"],
        "quiz": [
            {"q": "An early sign of fatigue is…",
             "options": ["Frequent yawning and long blinks", "Feeling hungry", "Sharper focus"],
             "answer": 0},
            {"q": "The drowsiness alert fires. You should…",
             "options": ["Turn off the camera", "Stop safely and take a break", "Open the window and continue"],
             "answer": 1},
        ],
    },
]

INSTRUCTORS = ["S. Rao (Excavators)", "M. Fernandes (Loaders)", "K. Gupta (Safety)"]

BY_ID = {m["id"]: m for m in MODULES}


def public(module: Dict) -> Dict:
    """Module without quiz answers."""
    return {**{k: v for k, v in module.items() if k != "quiz"},
            "quiz": [{"q": q["q"], "options": q["options"]} for q in module["quiz"]]}


def grade(module_id: str, answers: List[int]) -> float:
    quiz = BY_ID[module_id]["quiz"]
    correct = sum(1 for q, a in zip(quiz, answers) if q["answer"] == a)
    return round(100 * correct / len(quiz), 1)


def recommended(incident_types: List[str]) -> List[str]:
    counts: Dict[str, int] = {}
    for t in incident_types:
        for m in MODULES:
            if t in m["triggers"]:
                counts[m["id"]] = counts.get(m["id"], 0) + 1
    return [mid for mid, _ in sorted(counts.items(), key=lambda kv: -kv[1])]
