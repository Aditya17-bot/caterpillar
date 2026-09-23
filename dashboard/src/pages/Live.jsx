import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtTime } from "../api.js";

function Tile({ label, value, unit, bad }) {
  return (
    <div className={"tile" + (bad ? " tile-bad" : "")}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        {value ?? "–"} <small>{unit}</small>
      </div>
    </div>
  );
}

export default function Live({ live, machineId, machine, setMachineId }) {
  const t = machine?.telemetry || {};
  const p = machine?.predictions || {};
  const hist = (live.history[machineId] || []).slice();
  const lastInsight = live.insights.find((i) => i.machineId === machineId);

  return (
    <>
      <h2>Fleet</h2>
      <div className="fleet">
        {["EXC-001", "EXC-002", "LDR-001", "LDR-002", "DOZ-001"].map((id) => {
          const m = live.machines[id];
          const alerts = m?.activeAlerts || [];
          return (
            <div
              key={id}
              className={"card fleet-card" + (id === machineId ? " selected" : "")}
              onClick={() => setMachineId(id)}
            >
              <b>{id}</b> <span className={m?.online ? "ok" : "bad"}>●</span>
              <div>{m?.operator?.name || "no operator"}</div>
              <div className={alerts.length ? "bad" : "muted"}>{alerts.length} active alerts</div>
            </div>
          );
        })}
      </div>

      <h2>
        {machineId} · {machine?.machineType} · {machine?.operator ? `Operator: ${machine.operator.name}` : "not logged in"}
      </h2>
      {!machine?.online && <p className="muted">No live data. Start the simulator: python simulator/sim.py</p>}

      <div className="tiles">
        <Tile label="Speed" value={t.speedKmh} unit="km/h" bad={machine?.activeAlerts?.some((a) => a.type === "overspeed")} />
        <Tile label="ML advised speed" value={p.optimalSpeedKmh} unit="km/h" />
        <Tile label="Slope" value={t.slopeDeg?.toFixed(1)} unit="°" bad={Math.abs(t.slopeDeg) > 25} />
        <Tile label="Engine temp" value={t.engineTempC} unit="°C" bad={t.engineTempC > 100} />
        <Tile label="Obstacle" value={t.obstacleCm} unit="cm" bad={t.obstacleCm < 100} />
        <Tile label="Seatbelt" value={t.seatbelt ? "Fastened" : "OFF"} bad={t.engineOn && !t.seatbelt} />
        <Tile label="Engine" value={t.engineOn ? "On" : "Off"} unit={t.rpm ? `${t.rpm} rpm` : ""} />
        <Tile label="Oil pressure" value={t.oilPressurePsi} unit="psi" bad={t.oilPressurePsi < 20 && t.engineOn} />
        <Tile label="Vibration" value={t.vibration} unit="g" bad={t.vibration > 1} />
        <Tile
          label="ML engine health"
          value={p.fault ? p.fault.replace(/_/g, " ") : null}
          unit={p.faultProb ? `${Math.round(p.faultProb * 100)}%` : ""}
          bad={p.fault && p.fault !== "normal"}
        />
      </div>
      {p.advisory && <p className="advisory">Terrain advice: {p.advisory}</p>}

      <div className="grid2">
        <div className="card">
          <h3>Speed vs ML advised speed</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="speed" name="actual" dot={false} isAnimationActive={false} stroke="#333" />
              <Line dataKey="optimal" name="advised" dot={false} isAnimationActive={false} stroke="#e0a800" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Engine temp & slope</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="temp" name="temp °C" dot={false} isAnimationActive={false} stroke="#c0392b" />
              <Line dataKey="slope" name="slope °" dot={false} isAnimationActive={false} stroke="#2471a3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Active alerts ({machineId})</h3>
          {(machine?.activeAlerts || []).length === 0 && <p className="muted">None</p>}
          {(machine?.activeAlerts || []).map((a) => (
            <div key={a.type} className={"alert " + a.severity}>
              <b>{a.type}</b> {a.message}
            </div>
          ))}
          <h3>Usage pattern (anomaly model)</h3>
          {lastInsight ? (
            <p>
              {lastInsight.anomaly ? <b className="bad">Unusual: {lastInsight.reason}</b> : <span className="ok">Normal</span>}{" "}
              · idle {lastInsight.features.idleMin.toFixed(1)}/15 min · {lastInsight.features.loadCycles} load cycles ·
              score {lastInsight.score}
            </p>
          ) : (
            <p className="muted">Waiting for first usage window…</p>
          )}
        </div>
        <div className="card feed">
          <h3>Alert feed (all machines)</h3>
          {live.feed.length === 0 && <p className="muted">No alerts yet</p>}
          {live.feed.map((a, i) => (
            <div key={i} className={"alert " + a.severity}>
              <small>{fmtTime(a.ts)}</small> <b>{a.machineId}</b> {a.message}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
