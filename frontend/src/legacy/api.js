import { useEffect, useRef, useState } from "react";

export const API =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : "http://localhost:8000");

export async function get(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export async function send(path, body, method = "POST") {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

const HISTORY = 90; // seconds of chart history per machine

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* audio blocked until user interacts with page */
  }
}

/** Live state from the backend WebSocket: machines, alert feed, chart history. */
export function useLive() {
  const [machines, setMachines] = useState({});
  const [feed, setFeed] = useState([]);
  const [insights, setInsights] = useState([]);
  const [connected, setConnected] = useState(false);
  const [sos, setSos] = useState({}); // id -> SOS record
  const history = useRef({});
  const trails = useRef({}); // machineId -> last positions for the map

  useEffect(() => {
    let ws;
    let stopped = false;
    let retry;

    const upsert = (m) => setMachines((prev) => ({ ...prev, [m.machineId]: { ...prev[m.machineId], ...m } }));

    function connect() {
      ws = new WebSocket(API.replace(/^http/, "ws") + "/ws");
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) retry = setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => {
        const { event, data } = JSON.parse(e.data);
        if (event === "snapshot") data.forEach(upsert);
        if (event === "telemetry") {
          upsert(data);
          const h = (history.current[data.machineId] ||= []);
          const t = data.telemetry;
          h.push({
            time: new Date(t.ts * 1000).toLocaleTimeString(),
            temp: t.engineTempC,
            speed: t.speedKmh,
            optimal: data.predictions.optimalSpeedKmh,
            slope: t.slopeDeg,
            obstacle: t.obstacleCm,
          });
          if (h.length > HISTORY) h.shift();
          if (data.pos) {
            const tr = (trails.current[data.machineId] ||= []);
            const last = tr[tr.length - 1];
            if (!last || Math.hypot(last.x - data.pos.x, last.y - data.pos.y) > 0.5) tr.push({ x: data.pos.x, y: data.pos.y });
            if (tr.length > 120) tr.shift();
          }
        }
        if (event === "sos" || event === "sos_update") {
          setSos((prev) => {
            const next = { ...prev, [data.id]: data };
            if (data.status !== "active") delete next[data.id];
            return next;
          });
        }
        if (event === "alert") {
          setFeed((f) => [data, ...f].slice(0, 100));
          if (data.severity === "critical") beep();
        }
        if (event === "machine_offline") upsert({ machineId: data.machineId, online: false });
        if (event === "insight") setInsights((f) => [data, ...f].slice(0, 50));
      };
    }
    connect();
    get("/api/sos")
      .then((list) => setSos(Object.fromEntries(list.map((x) => [x.id, x]))))
      .catch(() => {});
    return () => {
      stopped = true;
      clearTimeout(retry);
      ws && ws.close();
    };
  }, []);

  return { machines, feed, insights, connected, sos, history: history.current, trails: trails.current };
}

export const fmtTime = (ts) => new Date(ts * 1000).toLocaleString();
