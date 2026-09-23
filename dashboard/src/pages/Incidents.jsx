import { useEffect, useState } from "react";
import { fmtTime, get } from "../api.js";

const TYPES = ["", "seatbelt", "proximity", "overheat", "unsafe_tilt", "engine_fault", "overspeed", "idling",
  "anomaly", "drowsy", "camera_person"];

export default function Incidents({ live, machineId }) {
  const [rows, setRows] = useState([]);
  const [onlyThis, setOnlyThis] = useState(true);
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");

  useEffect(() => {
    const q = new URLSearchParams();
    if (onlyThis) q.set("machineId", machineId);
    if (type) q.set("type", type);
    if (severity) q.set("severity", severity);
    get(`/api/incidents?${q}`).then(setRows).catch(() => setRows([]));
  }, [machineId, onlyThis, type, severity, live.feed.length]);

  return (
    <>
      <h2>Incident log</h2>
      <div className="filters">
        <label>
          <input type="checkbox" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} /> only {machineId}
        </label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t || "all types"}
            </option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">all severities</option>
          <option>warning</option>
          <option>critical</option>
        </select>
        <span className="muted">{rows.length} incidents</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Machine</th>
            <th>Operator</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{fmtTime(r.ts)}</td>
              <td>{r.machine_id}</td>
              <td>{r.operator_id || "–"}</td>
              <td>{r.type}</td>
              <td className={r.severity === "critical" ? "bad" : ""}>{r.severity}</td>
              <td>{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
