import { useEffect, useState } from "react";
import { get, send } from "../api.js";

export default function Tasks({ machineId }) {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);

  const load = () =>
    get(`/api/tasks?machineId=${machineId}`)
      .then(setTasks)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [machineId]);

  const setStatus = async (id, status) => {
    await send(`/api/tasks/${id}`, { status }, "PATCH");
    load();
  };

  const total = tasks.reduce((s, t) => s + (t.predicted_minutes || 0), 0);
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <>
      <h2>Today's tasks: {machineId}</h2>
      {error && <p className="bad">{error}</p>}
      <p>
        {done}/{tasks.length} done · ML-estimated total {Math.round(total)} min
      </p>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Site</th>
            <th>Conditions</th>
            <th>Predicted time</th>
            <th>Actual</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <b>{t.task_type}</b> · {t.volume_m3} m³ · {t.time_of_day}
              </td>
              <td>{t.site}</td>
              <td>
                {t.soil_type}, {t.weather}, slope {t.slope_deg}°, {t.temp_c}°C
              </td>
              <td>
                <b>{t.predicted_minutes} min</b>{" "}
                <small className="muted">
                  ({t.predicted_low}–{t.predicted_high})
                </small>
              </td>
              <td>{t.actual_minutes != null ? `${t.actual_minutes} min` : "–"}</td>
              <td>
                {t.status}{" "}
                {t.status === "pending" && <button onClick={() => setStatus(t.id, "in_progress")}>Start</button>}
                {t.status === "in_progress" && <button onClick={() => setStatus(t.id, "done")}>Complete</button>}
                {t.status === "done" && <button onClick={() => setStatus(t.id, "pending")}>Reset</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
