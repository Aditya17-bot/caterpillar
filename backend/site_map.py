"""Construction site model: terrain, danger zones, geometry helpers.

Coordinates are metres: x east, y north, origin at the south-west corner.
The simulator downloads the terrain grid from GET /api/site, so machine slope readings
come from the same hills the dashboard map draws.
"""

import math
from typing import Dict, List, Optional, Tuple

WIDTH, HEIGHT = 400.0, 300.0
BASE_ELEVATION = 100.0
GRID_STEP = 5.0     # metres between grid samples sent to clients

# (x, y, height m, spread m): gaussian hills; negative height = pit
HILLS = [
    (90, 225, 14, 45),     # north-west hill
    (300, 235, 10, 40),    # north-east rise
    (325, 80, -22, 30),    # quarry pit
    (180, 115, 6, 30),     # central mound
    (40, 110, -5, 25),     # drainage hollow
]

ZONES: List[Dict] = [
    {"id": "pit-edge", "name": "Quarry pit edge", "kind": "no_go",
     "message": "Entered pit edge exclusion zone. Fall hazard, reverse out.",
     "polygon": [[300, 55], [350, 55], [352, 105], [298, 105]]},
    {"id": "office", "name": "Site office & walkway", "kind": "no_go",
     "message": "Machine inside pedestrian area. Stop immediately.",
     "polygon": [[15, 15], [75, 15], [75, 55], [15, 55]]},
    {"id": "power-line", "name": "Overhead power line", "kind": "caution",
     "message": "Under overhead power line. Keep boom and bucket lowered.",
     "polygon": [[200, 170], [214, 170], [214, 300], [200, 300]]},
    {"id": "gas-pipe", "name": "Buried gas pipe", "kind": "caution",
     "message": "Over buried gas pipe. No digging in this corridor.",
     "polygon": [[110, 38], [270, 38], [270, 46], [110, 46]]},
]

# where each machine starts (x, y, heading degrees clockwise from north)
START = {
    "EXC-001": (150, 150, 90), "EXC-002": (260, 130, 200), "LDR-001": (120, 80, 45),
    "LDR-002": (250, 210, 300), "DOZ-001": (340, 170, 180),
}


def elevation(x: float, y: float) -> float:
    h = BASE_ELEVATION
    for hx, hy, amp, s in HILLS:
        h += amp * math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (2 * s * s))
    return h


def gradient(x: float, y: float, d: float = 1.0) -> Tuple[float, float]:
    return ((elevation(x + d, y) - elevation(x - d, y)) / (2 * d),
            (elevation(x, y + d) - elevation(x, y - d)) / (2 * d))


def max_slope_deg(x: float, y: float) -> float:
    gx, gy = gradient(x, y)
    return math.degrees(math.atan(math.hypot(gx, gy)))


def grid() -> Dict:
    """Terrain samples for drawing (and for the simulator to interpolate)."""
    nx, ny = int(WIDTH / GRID_STEP) + 1, int(HEIGHT / GRID_STEP) + 1
    heights = [[round(elevation(i * GRID_STEP, j * GRID_STEP), 2) for i in range(nx)] for j in range(ny)]
    return {"width": WIDTH, "height": HEIGHT, "step": GRID_STEP, "nx": nx, "ny": ny, "heights": heights}


def point_in_polygon(x: float, y: float, poly: List[List[float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def zone_at(x: float, y: float) -> Optional[Dict]:
    """The most severe zone containing the point."""
    hits = [z for z in ZONES if point_in_polygon(x, y, z["polygon"])]
    hits.sort(key=lambda z: z["kind"] != "no_go")
    return hits[0] if hits else None


def bearing(dx: float, dy: float) -> str:
    """Compass direction for a displacement (x east, y north)."""
    names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
    ang = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    return names[int((ang + 22.5) // 45) % 8]
