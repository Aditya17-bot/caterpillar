"""SQLite storage: operators, machines, tasks, incidents, usage windows, training.

One file (backend/app.db, gitignored). Deleted and re-seeded with `python seed.py`.
"""

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

DB_PATH = Path(__file__).resolve().parent / "app.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS operators (
    id TEXT PRIMARY KEY, name TEXT, rfid TEXT UNIQUE, experience_yrs REAL, certified TEXT
);
CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY, type TEXT, model TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id TEXT, machine_id TEXT, date TEXT, task_type TEXT, site TEXT,
    volume_m3 REAL, soil_type TEXT, weather TEXT, time_of_day TEXT, slope_deg REAL, temp_c REAL,
    status TEXT DEFAULT 'pending', predicted_minutes REAL, predicted_low REAL, predicted_high REAL,
    started_at REAL, finished_at REAL, actual_minutes REAL
);
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL, machine_id TEXT, operator_id TEXT, type TEXT, severity TEXT, message TEXT, snapshot TEXT
);
CREATE TABLE IF NOT EXISTS usage_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL, machine_id TEXT, operator_id TEXT, features TEXT,
    anomaly INTEGER, reason TEXT, score REAL
);
CREATE TABLE IF NOT EXISTS training_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id TEXT, module_id TEXT, score REAL, ts REAL
);
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id TEXT, instructor TEXT, slot TEXT, topic TEXT, ts REAL
);
"""

_local = threading.local()


def conn() -> sqlite3.Connection:
    c = getattr(_local, "conn", None)
    if c is None:
        c = sqlite3.connect(DB_PATH, check_same_thread=False)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        _local.conn = c
    return c


def init() -> None:
    conn().executescript(SCHEMA)
    conn().commit()


def query(sql: str, params: Iterable[Any] = ()) -> List[Dict[str, Any]]:
    return [dict(r) for r in conn().execute(sql, tuple(params)).fetchall()]


def one(sql: str, params: Iterable[Any] = ()) -> Optional[Dict[str, Any]]:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: Iterable[Any] = ()) -> int:
    c = conn()
    cur = c.execute(sql, tuple(params))
    c.commit()
    return cur.lastrowid


def insert(table: str, row: Dict[str, Any]) -> int:
    row = {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in row.items()}
    cols = ", ".join(row)
    marks = ", ".join("?" for _ in row)
    return execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", row.values())
