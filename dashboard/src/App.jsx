import { useEffect, useState } from "react";
import { send, useLive } from "./api.js";
import Live from "./pages/Live.jsx";
import SiteMap from "./pages/SiteMap.jsx";
import Camera from "./pages/Camera.jsx";
import Tasks from "./pages/Tasks.jsx";
import Incidents from "./pages/Incidents.jsx";
import Training from "./pages/Training.jsx";
import Simulator from "./pages/Simulator.jsx";
import Shift from "./pages/Shift.jsx";
import Supervisor from "./pages/Supervisor.jsx";
import Maintenance from "./pages/Maintenance.jsx";
import CoPilot from "./CoPilot.jsx";
import Inspection from "./Inspection.jsx";

const PAGES = ["Live", "Map", "Camera", "Tasks", "Shift", "Incidents", "Maintenance", "Training", "Supervisor", "Simulator"];
const MACHINE_IDS = ["EXC-001", "EXC-002", "LDR-001", "LDR-002", "DOZ-001"];

function SosButton({ machineId }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={"sos-btn" + (armed ? " armed" : "")}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        send("/api/sos", { machineId, reason: "Operator pressed SOS" });
      }}
    >
      {armed ? "Tap again to send SOS" : "SOS"}
    </button>
  );
}

function SosBanner({ sos, machineId }) {
  const list = Object.values(sos);
  if (!list.length) return null;
  return (
    <div className="sos-banner">
      {list.map((s) => {
        const me = s.nearby.find((n) => n.machineId === machineId);
        const responded = s.responders.some((r) => r.machineId === machineId);
        return (
          <div key={s.id}>
            🚨 <b>SOS {s.machine_id}</b>: {s.reason}.{" "}
            {me && <>You are {me.distanceM} m away (go {me.direction}). </>}
            Alerted {s.nearby.length} nearby machine(s) + supervisor.{" "}
            {s.responders.length > 0 && <>Responding: {s.responders.map((r) => r.machineId).join(", ")}. </>}
            {me && !responded && <button onClick={() => send(`/api/sos/${s.id}/respond`, { machineId })}>Respond with {machineId}</button>}{" "}
            <button onClick={() => send(`/api/sos/${s.id}/resolve`, {})}>Resolve</button>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const live = useLive();
  const [page, setPage] = useState("Live");
  const [machineId, setMachineId] = useState("EXC-001");
  const [skipInspection, setSkipInspection] = useState({});
  const machine = live.machines[machineId];
  const operatorId = machine?.operator?.id;
  const critical = Object.values(live.machines)
    .flatMap((m) => m.activeAlerts || [])
    .filter((a) => a.severity === "critical" && !a.type.startsWith("sos"));
  const inspectionPending = machine?.inspection?.status === "pending" && !skipInspection[machineId];

  const props = { live, machineId, machine, operatorId, setMachineId };

  return (
    <div className="app">
      <header>
        <strong>CAT Smart Operator Assistant</strong>
        <nav>
          {PAGES.map((p) => (
            <button key={p} className={p === page ? "active" : ""} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
        </nav>
        <span>
          Machine{" "}
          <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            {MACHINE_IDS.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>{" "}
          <span className={live.connected ? "ok" : "bad"}>{live.connected ? "● live" : "● offline"}</span>{" "}
          <SosButton machineId={machineId} />
        </span>
      </header>

      <SosBanner sos={live.sos} machineId={machineId} />
      {critical.length > 0 && (
        <div className="banner">
          {critical.map((a) => (
            <div key={a.machineId + a.type}>
              ⚠ {a.machineId}: {a.message}
            </div>
          ))}
        </div>
      )}
      {machine?.inspection?.status === "locked" && (
        <div className="banner">🔒 {machineId} locked out after pre-start inspection. See Maintenance.</div>
      )}
      {machine?.inspection?.status === "pending" && skipInspection[machineId] && (
        <div className="advisory" style={{ margin: 0 }}>
          Pre-start inspection not done for {machineId}.{" "}
          <button onClick={() => setSkipInspection({ ...skipInspection, [machineId]: false })}>Do it now</button>
        </div>
      )}

      <main>
        {page === "Live" && <Live {...props} />}
        {page === "Map" && <SiteMap {...props} />}
        {page === "Camera" && <Camera {...props} />}
        {page === "Tasks" && <Tasks {...props} />}
        {page === "Incidents" && <Incidents {...props} />}
        {page === "Training" && <Training {...props} />}
        {page === "Simulator" && <Simulator {...props} />}
        {page === "Shift" && <Shift {...props} />}
        {page === "Supervisor" && <Supervisor {...props} />}
        {page === "Maintenance" && <Maintenance {...props} />}
      </main>
      {inspectionPending && (
        <Inspection machineId={machineId} machine={machine} onClose={() => setSkipInspection({ ...skipInspection, [machineId]: true })} />
      )}
      <CoPilot machineId={machineId} feed={live.feed} />
    </div>
  );
}
