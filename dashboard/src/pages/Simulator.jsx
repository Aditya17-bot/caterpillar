import { send } from "../api.js";

const SCENARIOS = [
  ["normal", "Back to normal"],
  ["unbuckle", "Unbuckle seatbelt"],
  ["worker_approach", "Worker approaching"],
  ["overheat", "Overheating"],
  ["steep_slope", "Steep slope"],
  ["overspeed", "Overspeeding"],
  ["long_idle", "Long idle"],
  ["fuel_waste", "Fuel waste (high RPM)"],
  ["bearing_wear", "Bearing wear (vibration)"],
  ["low_oil", "Low oil pressure"],
  ["harsh", "Harsh operation"],
  ["enter_zone", "Drive into pedestrian zone"],
  ["approach_machine", "Drive towards nearest machine"],
  ["breakdown", "Breakdown (auto SOS)"],
  ["rollover", "Rollover risk (auto SOS)"],
];

export default function Simulator({ machineId, machine }) {
  const t = machine?.telemetry || {};
  const cmd = (command, field, value) => send("/api/sim/command", { machineId, command, field, value });

  return (
    <>
      <h2>Simulator control: {machineId}</h2>
      <p className="muted">
        Commands go to the backend and are delivered to <code>simulator/sim.py</code> with the next telemetry
        response (like a real machine receiving config). Run the simulator first.
      </p>
      <div className="card">
        <h3>Machine</h3>
        <button onClick={() => cmd("set", "engineOn", !t.engineOn)}>Engine {t.engineOn ? "OFF" : "ON"}</button>{" "}
        <button onClick={() => cmd("set", "seatbelt", !t.seatbelt)}>
          {t.seatbelt ? "Unfasten" : "Fasten"} seatbelt
        </button>{" "}
        <button onClick={() => cmd("set", "login", !t.rfid)}>{t.rfid ? "Operator logout" : "RFID tap (login)"}</button>
        <p>
          Phase: <b>{t.phase || "–"}</b> · running scenarios: <b>{(t.scenarios || []).join(", ") || "none"}</b>
        </p>
      </div>
      <div className="card">
        <h3>Scenarios</h3>
        <div className="buttons">
          {SCENARIOS.map(([id, label]) => (
            <button key={id} onClick={() => cmd(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
