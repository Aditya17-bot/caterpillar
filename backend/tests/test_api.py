import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import db  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db.DB_PATH = tmp_path_factory.mktemp("db") / "test.db"   # never touch the real app.db
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


def telemetry(**over):
    t = {"machineId": "EXC-001", "machineType": "excavator", "rfid": "A1B2C3D4", "engineOn": True,
         "seatbelt": True, "engineTempC": 88, "humidity": 50, "obstacleCm": 300, "slopeDeg": 2,
         "vibration": 0.3, "speedKmh": 3, "rpm": 1700, "oilPressurePsi": 50, "engineHours": 5000,
         "loadPct": 50, "surface": "gravel", "fuelRateLph": 20}
    t.update(over)
    return t


def test_telemetry_raises_and_clears_proximity(client):
    assert client.post("/api/telemetry", json=telemetry(obstacleCm=40)).status_code == 200
    active = client.get("/api/alerts/active").json()
    assert any(a["type"] == "proximity" and a["severity"] == "critical" for a in active)
    client.post("/api/telemetry", json=telemetry(obstacleCm=300))
    assert not any(a["type"] == "proximity" for a in client.get("/api/alerts/active").json())
    inc = client.get("/api/incidents?type=proximity&machineId=EXC-001").json()
    assert inc and inc[0]["operator_id"] == "OP-01"


def test_websocket_receives_telemetry(client):
    with client.websocket_connect("/ws") as ws:
        assert ws.receive_json()["event"] == "snapshot"
        client.post("/api/telemetry", json=telemetry())
        events = [ws.receive_json()["event"] for _ in range(1)]
        assert "telemetry" in events


def test_sim_command_returned_in_telemetry_response(client):
    client.post("/api/sim/command", json={"machineId": "EXC-001", "command": "overheat"})
    res = client.post("/api/telemetry", json=telemetry()).json()
    assert res["commands"][0]["command"] == "overheat"


def test_camera_drowsy_alert(client):
    client.post("/api/events/camera", json={"machineId": "EXC-001", "kind": "drowsy", "confidence": 0.9})
    assert any(a["type"] == "drowsy" for a in client.get("/api/alerts/active").json())


def test_tasks_have_predictions(client):
    tasks = client.get("/api/tasks?operatorId=OP-01").json()
    assert len(tasks) == 4
    assert all(t["predicted_minutes"] > 0 for t in tasks)
    done = client.patch(f"/api/tasks/{tasks[0]['id']}", json={"status": "done"}).json()
    assert done["status"] == "done"


def test_training_quiz_and_score(client):
    mods = client.get("/api/training/modules?operatorId=OP-01").json()
    assert "answer" not in mods["modules"][0]["quiz"][0]
    res = client.post("/api/training/progress",
                      json={"operatorId": "OP-01", "moduleId": "seatbelt", "answers": [1, 1, 0]}).json()
    assert res == {"score": 100.0, "passed": True}
    assert client.get("/api/operators/OP-01/score").json()["trainingCompleted"] == 1
