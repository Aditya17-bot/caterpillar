import { Skeleton } from '../../components/common/EmptyState'
import { useEffect, useState } from "react";
import { fmtTime, get, send } from "../api.js";

const ROWS = [
  ["Time", [["Shift length", "durationMin", "min"], ["Engine on", "engineOnMin", "min"], ["Moving", "movingMin", "min"], ["Idle", "idleMin", "min"], ["Idle share", "idlePct", "%"]]],
  ["Productivity", [["Load cycles", "loadCycles", ""], ["Cycles per hour", "cyclesPerHour", ""], ["Material moved", "materialM3", "m³"], ["Distance", "distanceKm", "km"]]],
  ["Fuel", [["Fuel used", "fuelL", "L"], ["Fuel per engine hour", "fuelPerHourL", "L/h"], ["Fuel burnt idling", "idleFuelL", "L"]]],
  ["Averages", [["Avg engine temp", "avgEngineTempC", "°C"], ["Avg speed", "avgSpeedKmh", "km/h"], ["Avg RPM", "avgRpm", ""], ["Avg slope", "avgAbsSlopeDeg", "°"], ["Avg vibration", "avgVibration", "g"]]],
  ["Peaks", [["Max engine temp", "maxEngineTempC", "°C"], ["Max speed", "maxSpeedKmh", "km/h"], ["Max tilt", "maxTiltDeg", "°"]]],
  ["Safety", [["Seatbelt compliance", "seatbeltCompliancePct", "%"], ["Seatbelt off", "seatbeltOffMin", "min"], ["Overspeed", "overspeedMin", "min"], ["Harsh events", "harshEvents", ""], ["Alerts", "alertCount", ""]]],
];

function Report({ r }) {
  const s = r.stats;
  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="tile-label">Grade</div><div className="tile-value">{r.scores.grade}</div></div>
        <div className="tile"><div className="tile-label">Shift safety</div><div className="tile-value">{r.scores.safety}<small>/100</small></div></div>
        <div className="tile"><div className="tile-label">Efficiency</div><div className="tile-value">{r.scores.efficiency}<small>/100</small></div></div>
        <div className="tile"><div className="tile-label">Tasks done</div><div className="tile-value">{r.tasks.done}<small>/{r.tasks.total}</small></div></div>
        <div className="tile"><div className="tile-label">Fuel cost</div><div className="tile-value">{r.cost.currency}{r.cost.fuel}</div></div>
        <div className="tile"><div className="tile-label">Idle cost</div><div className="tile-value">{r.cost.currency}{r.cost.idleFuel}</div></div>
        <div className="tile"><div className="tile-label">CO₂</div><div className="tile-value">{r.cost.co2Kg}<small> kg</small></div></div>
      </div>
      {(r.highlights.length > 0 || r.improve.length > 0) && (
        <div className="grid2">
          <div className="card"><h3>Went well</h3>{r.highlights.map((h) => <div key={h} className="ok">✔ {h}</div>)}</div>
          <div className="card"><h3>To improve</h3>{r.improve.length ? r.improve.map((h) => <div key={h} className="bad">• {h}</div>) : <span className="muted">Nothing flagged</span>}</div>
        </div>
      )}
      <div className="stat-groups">
        {ROWS.map(([group, rows]) => (
          <div className="card" key={group}>
            <h3>{group}</h3>
            <table>
              <tbody>
                {rows.map(([label, key, unit]) => (
                  <tr key={key}><td>{label}</td><td><b>{s[key]}</b> {unit}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="card">
          <h3>Alerts by type</h3>
          {Object.keys(s.alerts).length === 0 && <span className="muted">None</span>}
          <table><tbody>{Object.entries(s.alerts).map(([k, v]) => <tr key={k}><td>{k}</td><td><b>{v}</b></td></tr>)}</tbody></table>
        </div>
      </div>
    </>
  );
}

export default function Shift({ machineId, live }) {
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [final, setFinal] = useState(null);
  const [past, setPast] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => get(`/api/shift/${machineId}`).then(r => { setCurrent(r); setError(null); }).catch(() => setError("Shift data unavailable. Retrying automatically…"));
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [machineId]);

  useEffect(() => {
    get(`/api/shift-reports?machineId=${machineId}`).then(setPast).catch(() => {});
  }, [machineId, final]);

  const endShift = async () => {
    setBusy(true);
    try {
      setFinal(await send(`/api/shift/${machineId}/end`, {}));
    } catch {
      setError("Unable to generate report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (final) {
    return (
      <div className="report">
        <h2>
          Shift report · {final.operator?.name || "unknown operator"} · {final.machineId}
        </h2>
        <p className="muted">
          {fmtTime(final.stats.start)} → {fmtTime(final.stats.end)} · summary by {final.source === "claude" ? "Claude" : "offline co-pilot"}
        </p>
        <div className="card advisory"><b>Summary</b><p>{final.summary}</p></div>
        <Report r={final} />
        <p className="no-print">
          <button onClick={() => window.print()}>Print / save PDF</button>{" "}
          <button onClick={() => setFinal(null)}>Back to live shift</button>
        </p>
      </div>
    );
  }

  return (
    <>
      <h2>
        Current shift · {machineId} · {live.machines[machineId]?.operator?.name || "no operator"}
      </h2>
      <p>
        Live totals and averages since login (updates every 5 s).{" "}
        <button onClick={endShift} disabled={busy}>{busy ? "Generating report…" : "End shift & generate report"}</button>
      </p>
      {error && <p role="alert" className="advisory">{error}</p>}
      {current ? <Report r={current} /> : !error && <Skeleton label="Loading shift report" />}

      <h2>Past shift reports</h2>
      {past.length === 0 && <p className="muted">None yet</p>}
      {past.map((p) => (
        <div className="card" key={p.id}>
          <b>{fmtTime(p.end)}</b> · {p.operator_id} · grade {p.stats.scores.grade} · {p.stats.stats.durationMin} min ·{" "}
          {p.stats.stats.fuelL} L · <button onClick={() => setFinal({ ...p.stats, summary: p.summary, source: p.source })}>Open</button>
        </div>
      ))}
    </>
  );
}
