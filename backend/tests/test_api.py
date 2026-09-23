import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import os  # noqa: E402

os.environ.setdefault("BLACKBOX_AFTER_SEC", "0.2")
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


def test_task_factors_and_pace(client):
    t = client.get("/api/tasks?machineId=EXC-001").json()[1]
    assert isinstance(t["factors"], list)
    started = client.patch(f"/api/tasks/{t['id']}", json={"status": "in_progress"}).json()
    assert started["pace"]["doneM3"] == 0
    for _ in range(3):
        client.post("/api/telemetry", json=telemetry(loadCycle=True))
    t2 = next(x for x in client.get("/api/tasks?machineId=EXC-001").json() if x["id"] == t["id"])
    assert t2["pace"]["doneM3"] == 4.5 and t2["pace"]["projectedMinutes"] is not None


def test_overheat_forecast_warns_before_threshold(client):
    import engine
    ms = engine.state("EXC-002")
    import time as _t
    now = _t.time()
    ms.history.clear()
    for i in range(20):   # climbing 0.5 °C/s from 95 °C
        ms.history.append({"ts": now - 20 + i, "engineTempC": 95 + 0.5 * i})
    assert 0 < engine.overheat_eta(ms) < 60


def test_shift_report_and_end(client):
    rep = client.get("/api/shift/EXC-001").json()
    assert rep["stats"]["loadCycles"] >= 3 and "avgEngineTempC" in rep["stats"]
    assert rep["scores"]["grade"] in "ABCD"
    end = client.post("/api/shift/EXC-001/end", json={}).json()
    assert end["summary"] and end["source"] in ("claude", "offline")
    assert client.get("/api/shift-reports?machineId=EXC-001").json()[0]["id"] == end["id"]
    assert client.get("/api/shift/EXC-001").json()["stats"]["loadCycles"] == 0


def test_copilot_chat_and_briefing(client):
    r = client.post("/api/copilot/chat", json={"machineId": "EXC-001", "message": "why is there an alert?"}).json()
    assert r["reply"]
    b = client.post("/api/copilot/briefing", json={"machineId": "EXC-001"}).json()
    assert b["reply"]


def test_impact_and_leaderboard(client):
    assert "annualSavingIfIdleHalved" in client.get("/api/impact").json()
    client.post("/api/training/sim-result", json={"operatorId": "OP-02", "score": 80})
    board = client.get("/api/leaderboard").json()
    assert next(o for o in board if o["id"] == "OP-02")["simBest"] == 80


def test_site_grid_and_zones(client):
    site = client.get("/api/site").json()
    assert site["nx"] * site["ny"] == sum(len(r) for r in site["heights"])
    assert {z["id"] for z in site["zones"]} >= {"office", "pit-edge"}


def test_geofence_and_machine_proximity(client):
    client.post("/api/telemetry", json=telemetry(machineId="LDR-001", rfid="C3D4E5F6", posX=40, posY=30))
    active = client.get("/api/alerts/active").json()
    assert any(a["type"] == "geofence" and a["machineId"] == "LDR-001" and a["severity"] == "critical" for a in active)
    client.post("/api/telemetry", json=telemetry(machineId="LDR-002", rfid="D4E5F6A7", posX=45, posY=36))
    assert any(a["type"] == "machine_proximity" and a["machineId"] == "LDR-002"
               for a in client.get("/api/alerts/active").json())


def test_sos_reaches_nearby_and_resolves(client):
    client.post("/api/telemetry", json=telemetry(machineId="LDR-001", rfid="C3D4E5F6", posX=150, posY=150))
    client.post("/api/telemetry", json=telemetry(machineId="LDR-002", rfid="D4E5F6A7", posX=250, posY=150))
    sos = client.post("/api/sos", json={"machineId": "LDR-001", "reason": "test"}).json()
    near = {n["machineId"]: n for n in sos["nearby"]}
    assert near["LDR-002"]["distanceM"] == 100 and near["LDR-002"]["direction"] == "west"
    assert any(a["type"] == "sos_nearby" and a["machineId"] == "LDR-002" for a in client.get("/api/alerts/active").json())
    r = client.post(f"/api/sos/{sos['id']}/respond", json={"machineId": "LDR-002"}).json()
    assert r["responders"][0]["machineId"] == "LDR-002"
    client.post(f"/api/sos/{sos['id']}/resolve")
    assert client.get("/api/sos").json() == []


def test_rollover_triggers_auto_sos(client):
    client.post("/api/telemetry", json=telemetry(machineId="DOZ-001", rfid="E5F6A7B8", posX=300, posY=200, slopeDeg=38))
    sos = client.get("/api/sos").json()
    assert sos and sos[0]["machine_id"] == "DOZ-001" and sos[0]["auto"] == 1
    client.post(f"/api/sos/{sos[0]['id']}/resolve")


def test_voice_sos_from_copilot(client):
    r = client.post("/api/copilot/chat", json={"machineId": "EXC-001", "message": "SOS I am stuck"}).json()
    assert r["source"] == "sos" and r["sos"]["reason"].startswith("Operator called for help")
    client.post(f"/api/sos/{r['sos']['id']}/resolve")


def test_inspection_lockout_and_maintenance(client):
    items = client.get("/api/inspection/items").json()
    answers = [{"id": i["id"], "ok": i["id"] != "hydraulics", "note": "leak at boom cylinder"} for i in items]
    r = client.post("/api/inspection", json={"machineId": "EXC-002", "items": answers}).json()
    assert r["lockout"] and r["inspection"]["status"] == "locked"
    reqs = client.get("/api/maintenance?machineId=EXC-002").json()
    assert reqs[0]["priority"] == "urgent" and "hydraulic" in reqs[0]["issue"].lower()
    res = client.post("/api/telemetry", json=telemetry(machineId="EXC-002", rfid="B2C3D4E5")).json()
    assert {"command": "set", "field": "engineOn", "value": False} in res["commands"]
    client.post("/api/inspection/EXC-002/clear-lockout")
    upd = client.patch(f"/api/maintenance/{reqs[0]['id']}", json={"status": "scheduled", "slot": "2026-09-24T09:00"}).json()
    assert upd["status"] == "scheduled"
    booked = client.post("/api/maintenance", json={"machineId": "EXC-002", "issue": "Strange noise"}).json()
    assert booked["source"] == "operator"


def test_incident_black_box(client):
    import time as _t
    for _ in range(3):
        client.post("/api/telemetry", json=telemetry(machineId="EXC-001", obstacleCm=300))
    client.post("/api/telemetry", json=telemetry(machineId="EXC-001", obstacleCm=30))
    _t.sleep(0.5)
    client.post("/api/telemetry", json=telemetry(machineId="EXC-001", obstacleCm=300))
    inc = client.get("/api/incidents?machineId=EXC-001&type=proximity").json()[0]
    assert inc["hasBlackbox"]
    full = client.get(f"/api/incidents/{inc['id']}").json()
    assert len(full["blackbox"]["readings"]) >= 4
    assert any(e["type"] == "proximity" for e in full["blackbox"]["events"])


def test_safety_score_ignores_machine_faults(client):
    before = client.get("/api/operators/OP-03/score").json()["score"]
    import engine
    ms = engine.state("LDR-001")
    client.post("/api/telemetry", json=telemetry(machineId="LDR-001", rfid="C3D4E5F6", posX=150, posY=150,
                                                 engineTempC=118))
    assert "overheat" in ms.alerts
    assert client.get("/api/operators/OP-03/score").json()["score"] == before
