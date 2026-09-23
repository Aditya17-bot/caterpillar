import { useEffect, useState } from "react";
import { get } from "../api.js";

function Stat({ label, value, sub }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function Supervisor({ live, setMachineId }) {
  const [impact, setImpact] = useState(null);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    const load = () => {
      get("/api/impact").then(setImpact).catch(() => {});
      get("/api/leaderboard").then(setBoard).catch(() => {});
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const fleet = Object.values(live.machines).sort((a, b) => a.machineId.localeCompare(b.machineId));
  const c = impact?.currency || "";

  return (
    <>
      <h2>Business impact</h2>
      {impact && (
        <>
          <div className="tiles">
            <Stat label="Fleet engine hours (session)" value={impact.engineHours} />
            <Stat label="Fuel burnt idling" value={`${impact.idleFuelL} L`} sub={`${c}${impact.idleCost} · ${impact.idleCo2Kg} kg CO₂`} />
            <Stat label="Safety alerts caught (24 h)" value={impact.alerts24h} sub={`${impact.criticalAlerts24h} critical`} />
            <Stat label="Projected yearly idle fuel" value={`${impact.annualIdleFuelL.toLocaleString()} L`} />
            <Stat label="Saving if idling halved" value={`${c}${impact.annualSavingIfIdleHalved.toLocaleString()}`} sub="per year" />
            <Stat label="CO₂ avoided" value={`${(impact.annualCo2SavedKg / 1000).toFixed(1)} t`} sub="per year" />
          </div>
          <p className="muted">Assumptions: {impact.assumptions}</p>
        </>
      )}

      <h2>Fleet</h2>
      <table>
        <thead>
          <tr><th>Machine</th><th>Status</th><th>Operator</th><th>Engine</th><th>Slope</th><th>ML health</th><th>Active alerts</th></tr>
        </thead>
        <tbody>
          {fleet.map((m) => (
            <tr key={m.machineId} onClick={() => setMachineId(m.machineId)} style={{ cursor: "pointer" }}>
              <td><b>{m.machineId}</b> {m.machineType}</td>
              <td className={m.online ? "ok" : "bad"}>{m.online ? "online" : "offline"}</td>
              <td>{m.operator?.name || "–"}</td>
              <td>{m.telemetry?.engineTempC} °C</td>
              <td>{m.telemetry?.slopeDeg?.toFixed(1)}°</td>
              <td>{m.predictions?.fault?.replace(/_/g, " ")}</td>
              <td className={m.activeAlerts?.some((a) => a.severity === "critical") ? "bad" : ""}>
                {(m.activeAlerts || []).map((a) => a.type).join(", ") || "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Operator safety ranking</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Operator</th><th>Experience</th><th>Safety score</th><th>Incidents (7 d)</th><th>Modules passed</th><th>Hazard sim best</th></tr>
        </thead>
        <tbody>
          {board.map((o, i) => (
            <tr key={o.id}>
              <td>{i + 1}</td>
              <td>{o.name} <span className="muted">{o.id}</span></td>
              <td>{o.experience_yrs} yrs</td>
              <td>
                <div className="bar"><div style={{ width: `${o.score}%`, background: o.score >= 80 ? "#1e8449" : o.score >= 60 ? "#e0a800" : "#c0392b" }} /></div>
                {o.score}
              </td>
              <td>{o.incidents7d}</td>
              <td>{o.trainingCompleted}</td>
              <td>{o.simBest ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
