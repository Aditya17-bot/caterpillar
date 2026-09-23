import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtTime, get } from "./api.js";

// Incident "flight recorder": replay the readings and alerts around an incident.

const SERIES = [
  ["speedKmh", "Speed km/h", "#333"],
  ["engineTempC", "Engine °C", "#c0392b"],
  ["slopeDeg", "Slope °", "#2471a3"],
  ["obstacleCm", "Obstacle cm", "#e0a800"],
];

export default function BlackBox({ incidentId, onClose }) {
  const [inc, setInc] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    get(`/api/incidents/${incidentId}`).then((r) => {
      setInc(r);
      setCursor(0);
    });
  }, [incidentId]);

  const rows = (inc?.blackbox?.readings || []).map((r) => ({ ...r, t: +(r.ts - inc.blackbox.incidentTs).toFixed(1) }));

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= rows.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 250);
    return () => clearInterval(timer.current);
  }, [playing, rows.length]);

  if (!inc) return null;
  const bb = inc.blackbox;
  const cur = rows[cursor] || {};
  const events = (bb?.events || []).map((e) => ({ ...e, t: +(e.ts - bb.incidentTs).toFixed(1) }));
  const trail = rows.filter((r) => r.posX != null);
  const xs = trail.map((r) => r.posX);
  const ys = trail.map((r) => r.posY);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 5, Math.max(...xs) + 5, Math.min(...ys) - 5, Math.max(...ys) + 5];
  const span = Math.max(x1 - x0, y1 - y0, 10);
  const px = (x) => ((x - x0) / span) * 180 + 10;
  const py = (y) => 190 - ((y - y0) / span) * 180;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>
          Black box · incident #{inc.id} · {inc.machine_id}
        </h2>
        <p>
          <b className={inc.severity === "critical" ? "bad" : ""}>{inc.type}</b> · {inc.message} · {fmtTime(inc.ts)} · operator{" "}
          {inc.operator_id || "–"}
        </p>
        {!bb || rows.length === 0 ? (
          <p className="muted">No recording for this incident (recordings exist for incidents captured live).</p>
        ) : (
          <>
            <div className="filters">
              <button onClick={() => { if (cursor >= rows.length - 1) setCursor(0); setPlaying(!playing); }}>{playing ? "Pause" : "▶ Play"}</button>
              <input type="range" min={0} max={rows.length - 1} value={cursor} onChange={(e) => { setPlaying(false); setCursor(+e.target.value); }} style={{ flex: 1 }} />
              <b>{cur.t > 0 ? "+" : ""}{cur.t}s</b>
              {!bb.complete && <span className="muted">(recording after the incident still being saved)</span>}
            </div>
            <div className="tiles">
              <div className="tile"><div className="tile-label">Speed</div><div className="tile-value">{cur.speedKmh ?? "–"}<small> km/h</small></div></div>
              <div className="tile"><div className="tile-label">Advised</div><div className="tile-value">{cur.optimalSpeedKmh ?? "–"}<small> km/h</small></div></div>
              <div className={"tile" + (cur.engineTempC > 100 ? " tile-bad" : "")}><div className="tile-label">Engine</div><div className="tile-value">{cur.engineTempC ?? "–"}<small> °C</small></div></div>
              <div className={"tile" + (Math.abs(cur.slopeDeg) > 25 ? " tile-bad" : "")}><div className="tile-label">Slope</div><div className="tile-value">{cur.slopeDeg ?? "–"}<small>°</small></div></div>
              <div className={"tile" + (cur.obstacleCm < 100 ? " tile-bad" : "")}><div className="tile-label">Obstacle</div><div className="tile-value">{cur.obstacleCm ?? "–"}<small> cm</small></div></div>
              <div className={"tile" + (cur.seatbelt === false ? " tile-bad" : "")}><div className="tile-label">Seatbelt</div><div className="tile-value">{cur.seatbelt === false ? "OFF" : "on"}</div></div>
              <div className="tile"><div className="tile-label">Engine</div><div className="tile-value">{cur.engineOn ? "running" : "off"}</div></div>
            </div>
            <div className="grid2">
              {SERIES.map(([key, label, color]) => (
                <div key={key} className="card">
                  <h3>{label}</h3>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={rows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} unit="s" />
                      <YAxis width={40} />
                      <Tooltip />
                      <ReferenceLine x={0} stroke="#c0392b" strokeWidth={2} label="incident" />
                      <ReferenceLine x={cur.t} stroke="#2471a3" />
                      <Line dataKey={key} dot={false} isAnimationActive={false} stroke={color} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
            <div className="grid2">
              <div className="card">
                <h3>Alert timeline</h3>
                {events.map((e, i) => (
                  <div key={i} className={"alert " + (e.event === "cleared" ? "" : e.severity)} style={{ opacity: e.t <= cur.t ? 1 : 0.35 }}>
                    <small>{e.t > 0 ? "+" : ""}{e.t}s</small> <b>{e.type}</b> {e.event === "cleared" ? "cleared" : e.message}
                  </div>
                ))}
              </div>
              {trail.length > 1 && (
                <div className="card">
                  <h3>Machine path</h3>
                  <svg viewBox="0 0 200 200" style={{ width: "100%", maxHeight: 220, background: "#c8b48a" }}>
                    <polyline fill="none" stroke="#333" strokeDasharray="3 3" points={trail.map((r) => `${px(r.posX)},${py(r.posY)}`).join(" ")} />
                    {cur.posX != null && <circle cx={px(cur.posX)} cy={py(cur.posY)} r="6" fill="#ffcd11" stroke="#000" />}
                    {(() => {
                      const at = trail.reduce((b, r) => (Math.abs(r.t) < Math.abs(b.t) ? r : b), trail[0]);
                      return <circle cx={px(at.posX)} cy={py(at.posY)} r="9" fill="none" stroke="#c0392b" strokeWidth="3" />;
                    })()}
                  </svg>
                  <div className="muted">Red circle: where the incident happened. {span.toFixed(0)} m across.</div>
                </div>
              )}
            </div>
          </>
        )}
        <p>
          <button onClick={onClose}>Close</button>
        </p>
      </div>
    </div>
  );
}
