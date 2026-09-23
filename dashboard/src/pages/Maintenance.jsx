import { useEffect, useState } from "react";
import { fmtTime, get, send } from "../api.js";

const ISSUES = [
  "Engine overheating",
  "Low oil pressure / oil leak",
  "Hydraulic leak",
  "Unusual vibration or noise",
  "Tracks / tyres / undercarriage",
  "Electrical, lights or camera",
  "Brakes / swing lock",
  "Scheduled service (250 h)",
  "Other",
];
const NEXT = { requested: "scheduled", scheduled: "in_progress", in_progress: "done" };

export default function Maintenance({ machineId, machine }) {
  const [list, setList] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [form, setForm] = useState({ issue: "", priority: "normal", slot: "", notes: "" });
  const [photo, setPhoto] = useState(null);

  const load = () => {
    get(`/api/maintenance?machineId=${machineId}`).then(setList);
    get(`/api/inspections?machineId=${machineId}`).then(setInspections);
  };
  useEffect(load, [machineId]);

  // suggest an issue from what the machine is reporting right now
  const alerts = machine?.activeAlerts || [];
  const fault = machine?.predictions?.fault;
  const suggestion =
    fault && fault !== "normal"
      ? { issue: fault === "low_oil_pressure" ? ISSUES[1] : fault === "bearing_wear" ? ISSUES[3] : fault === "overheating" ? ISSUES[0] : "Other", notes: `ML fault model: ${fault.replace(/_/g, " ")} (${Math.round((machine.predictions.faultProb || 0) * 100)}%)` }
      : alerts.some((a) => a.type === "overheat")
        ? { issue: ISSUES[0], notes: "Overheat alert active" }
        : null;

  const book = async (e) => {
    e.preventDefault();
    await send("/api/maintenance", { machineId, operatorId: machine?.operator?.id, ...form });
    setForm({ issue: "", priority: "normal", slot: "", notes: "" });
    load();
  };

  const advance = async (m) => {
    await send(`/api/maintenance/${m.id}`, { status: NEXT[m.status] }, "PATCH");
    load();
  };

  const locked = machine?.inspection?.status === "locked";

  return (
    <>
      <h2>Maintenance · {machineId}</h2>
      {locked && (
        <div className="alert critical">
          <b>Machine locked out</b> after inspection: {(machine.inspection.failed || []).join("; ")}.{" "}
          <button
            onClick={async () => {
              await send(`/api/inspection/${machineId}/clear-lockout`, {});
              load();
            }}
          >
            Defect fixed: release machine
          </button>
        </div>
      )}
      {suggestion && (
        <div className="advisory">
          Machine is reporting: <b>{suggestion.notes}</b>{" "}
          <button onClick={() => setForm({ ...form, issue: suggestion.issue, priority: "urgent", notes: suggestion.notes })}>
            Book service for this
          </button>
        </div>
      )}
      <div className="card">
        <h3>Book maintenance</h3>
        <form onSubmit={book} className="filters">
          <select required value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}>
            <option value="">issue…</option>
            {ISSUES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="normal">normal</option>
            <option value="urgent">urgent</option>
          </select>
          <input type="datetime-local" value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} />
          <input style={{ minWidth: 260 }} placeholder="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button>Book</button>
        </form>
      </div>

      <h3>Requests</h3>
      <table>
        <thead>
          <tr>
            <th>Created</th>
            <th>Issue</th>
            <th>Priority</th>
            <th>Slot</th>
            <th>Source</th>
            <th>Notes</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id}>
              <td>{fmtTime(m.ts)}</td>
              <td>{m.issue}</td>
              <td className={m.priority === "urgent" ? "bad" : ""}>{m.priority}</td>
              <td>{m.slot ? m.slot.replace("T", " ") : "–"}</td>
              <td>{m.source}</td>
              <td>{m.notes}</td>
              <td>
                {m.status} {NEXT[m.status] && <button onClick={() => advance(m)}>→ {NEXT[m.status].replace("_", " ")}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p className="muted">No requests</p>}

      <h3>Pre-start inspections</h3>
      {inspections.length === 0 && <p className="muted">None recorded yet</p>}
      {inspections.map((i) => (
        <div key={i.id} className="card">
          <b>{fmtTime(i.ts)}</b> · {i.operator_id} ·{" "}
          {i.passed ? <span className="ok">passed</span> : <span className="bad">{i.defects} defect(s)</span>}
          {i.items.filter((x) => !x.ok).map((x) => (
            <div key={x.id} className="bad">
              • {x.id}: {x.note}
            </div>
          ))}
          {i.hasPhoto ? <div className="muted">photo attached</div> : null}
        </div>
      ))}
    </>
  );
}
