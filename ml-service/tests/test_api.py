import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["models"] == ["anomaly", "fault", "speed", "task_time"]


def test_speed_drops_uphill(client):
    flat = client.post("/predict/speed", json={"slopeDeg": 0, "machineType": "loader"}).json()
    steep = client.post("/predict/speed", json={"slopeDeg": 25, "machineType": "loader"}).json()
    assert flat["speedKmh"] > steep["speedKmh"] > 0
    assert "advisory" in flat


def test_speed_accepts_contract_payload(client):
    r = client.post("/predict/speed", json={
        "accel": {"x": 0.12, "y": -0.03, "z": 9.78},
        "gyro": {"x": 0.5, "y": 1.2, "z": -0.1},
        "slopeDeg": 7.3,
    })
    assert r.status_code == 200


def test_fault_overheating(client):
    r = client.post("/predict/fault", json={"engineTempC": 118, "vibration": 0.3}).json()
    assert r["fault"] == "overheating"
    assert 0 <= r["prob"] <= 1


def test_fault_normal(client):
    r = client.post("/predict/fault", json={"engineTempC": 88, "vibration": 0.3}).json()
    assert r["fault"] == "normal"


def test_task_time_rock_slower_than_sand(client):
    base = {"taskType": "trenching", "machineId": "EXC-001", "operatorId": "OP-01",
            "volumeM3": 200, "timeOfDay": "morning"}
    sand = client.post("/predict/task-time", json={**base, "soilType": "sand"}).json()
    rock = client.post("/predict/task-time", json={**base, "soilType": "rock"}).json()
    assert rock["minutes"] > sand["minutes"]
    assert sand["low"] <= sand["minutes"] <= sand["high"]


def test_task_time_rejects_unknown_task(client):
    assert client.post("/predict/task-time", json={"taskType": "flying"}).status_code == 422


def test_anomaly_idling(client):
    r = client.post("/predict/anomaly", json={"idleMin": 13, "loadCycles": 2, "avgRpm": 850}).json()
    assert r["anomaly"] is True
    assert r["reason"] == "excessive_idling"


def test_anomaly_normal(client):
    r = client.post("/predict/anomaly", json={"idleMin": 2}).json()
    assert r["anomaly"] is False
    assert r["reason"] == "normal"
