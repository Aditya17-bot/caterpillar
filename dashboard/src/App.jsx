import { useState } from "react";
import { useLive } from "./api.js";
import Live from "./pages/Live.jsx";
import Camera from "./pages/Camera.jsx";
import Tasks from "./pages/Tasks.jsx";
import Incidents from "./pages/Incidents.jsx";
import Training from "./pages/Training.jsx";
import Simulator from "./pages/Simulator.jsx";

const PAGES = ["Live", "Camera", "Tasks", "Incidents", "Training", "Simulator"];
const MACHINE_IDS = ["EXC-001", "EXC-002", "LDR-001", "LDR-002", "DOZ-001"];

export default function App() {
  const live = useLive();
  const [page, setPage] = useState("Live");
  const [machineId, setMachineId] = useState("EXC-001");
  const machine = live.machines[machineId];
  const operatorId = machine?.operator?.id;
  const critical = Object.values(live.machines)
    .flatMap((m) => m.activeAlerts || [])
    .filter((a) => a.severity === "critical");

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
          <span className={live.connected ? "ok" : "bad"}>{live.connected ? "● live" : "● offline"}</span>
        </span>
      </header>

      {critical.length > 0 && (
        <div className="banner">
          {critical.map((a) => (
            <div key={a.machineId + a.type}>
              ⚠ {a.machineId}: {a.message}
            </div>
          ))}
        </div>
      )}

      <main>
        {page === "Live" && <Live {...props} />}
        {page === "Camera" && <Camera {...props} />}
        {page === "Tasks" && <Tasks {...props} />}
        {page === "Incidents" && <Incidents {...props} />}
        {page === "Training" && <Training {...props} />}
        {page === "Simulator" && <Simulator {...props} />}
      </main>
    </div>
  );
}
