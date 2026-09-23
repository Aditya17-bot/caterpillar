import { useEffect, useRef, useState } from "react";
import { get } from "../api.js";

// Game-style site map: shaded terrain (elevation or slope), danger zones, every machine with heading,
// trails, proximity rings, SOS pulses. Camera follows your machine; scroll to zoom, drag to pan.

const PX_PER_M = 2; // resolution of the pre-rendered terrain image
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function bilinear(site, x, y) {
  const { step, nx, ny, heights: h } = site;
  const fx = Math.min(Math.max(x / step, 0), nx - 1.001);
  const fy = Math.min(Math.max(y / step, 0), ny - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const a = h[j][i] * (1 - tx) + h[j][i + 1] * tx;
  const b = h[j + 1][i] * (1 - tx) + h[j + 1][i + 1] * tx;
  return a * (1 - ty) + b * ty;
}

function slopeAt(site, x, y) {
  const d = 1.5;
  const gx = (bilinear(site, x + d, y) - bilinear(site, x - d, y)) / (2 * d);
  const gy = (bilinear(site, x, y + d) - bilinear(site, x, y - d)) / (2 * d);
  return (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
}

function elevColor(t) {
  // t in 0..1: low (tan) -> mid (olive) -> high (brown/light)
  const stops = [[0, [150, 120, 80]], [0.35, [196, 170, 120]], [0.6, [160, 170, 100]], [0.8, [130, 140, 85]], [1, [215, 205, 180]]];
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const [t0, c0] = stops[k - 1];
      const [t1, c1] = stops[k];
      const u = (t - t0) / (t1 - t0);
      return c0.map((c, i) => c + (c1[i] - c) * u);
    }
  }
  return stops[stops.length - 1][1];
}

function slopeColor(deg) {
  if (deg < 8) return [90, 170, 90];
  if (deg < 15) return [200, 200, 80];
  if (deg < 20) return [235, 150, 50];
  if (deg < 25) return [225, 90, 50];
  return [170, 30, 30];
}

function renderTerrain(site, mode) {
  const W = Math.round(site.width * PX_PER_M);
  const H = Math.round(site.height * PX_PER_M);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(W, H);
  const flat = site.heights.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  const elev = new Float32Array(W * H);
  for (let py = 0; py < H; py++) {
    const y = site.height - py / PX_PER_M;
    for (let px = 0; px < W; px++) elev[py * W + px] = bilinear(site, px / PX_PER_M, y);
  }
  const CONTOUR = 2; // metres between contour lines
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const k = py * W + px;
      const e = elev[k];
      const ex = elev[k + (px < W - 1 ? 1 : 0)] - elev[k - (px > 0 ? 1 : 0)];
      const ey = elev[k - (py > 0 ? W : 0)] - elev[k + (py < H - 1 ? W : 0)];
      const shade = Math.max(0.55, Math.min(1.25, 1 + (-ex * 0.7 + ey * 0.7) * 2.2)); // light from north-west
      let rgb;
      if (mode === "slope") {
        const s = (Math.atan(Math.hypot(ex, ey) * PX_PER_M / 2) * 180) / Math.PI;
        rgb = slopeColor(s);
      } else {
        rgb = elevColor((e - lo) / (hi - lo || 1));
      }
      const right = px < W - 1 ? elev[k + 1] : e;
      const down = py < H - 1 ? elev[k + W] : e;
      const contour = Math.floor(e / CONTOUR) !== Math.floor(right / CONTOUR) || Math.floor(e / CONTOUR) !== Math.floor(down / CONTOUR);
      const major = contour && Math.floor(e / 10) !== Math.floor(Math.max(right, down) / 10);
      const f = contour ? (major ? 0.55 : 0.78) : 1;
      img.data[k * 4] = Math.min(255, rgb[0] * shade * f);
      img.data[k * 4 + 1] = Math.min(255, rgb[1] * shade * f);
      img.data[k * 4 + 2] = Math.min(255, rgb[2] * shade * f);
      img.data[k * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, lo, hi };
}

function compass(dx, dy) {
  const ang = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(ang / 45) % 8];
}

export default function SiteMap({ live, machineId, setMachineId }) {
  const canvas = useRef(null);
  const wrap = useRef(null);
  const [site, setSite] = useState(null);
  const [mode, setMode] = useState("terrain");
  const [follow, setFollow] = useState(true);
  const [hover, setHover] = useState(null);
  const terrain = useRef(null);
  const view = useRef({ scale: 3, cx: 200, cy: 150 }); // px per metre, world centre
  const drag = useRef(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const selRef = useRef(machineId);
  selRef.current = machineId;
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    get("/api/site").then(setSite).catch(() => {});
  }, []);

  useEffect(() => {
    if (site) terrain.current = renderTerrain(site, mode);
  }, [site, mode]);

  // render loop
  useEffect(() => {
    if (!site) return;
    let raf;
    const draw = (tms) => {
      const cv = canvas.current;
      if (!cv) return;
      const W = (cv.width = wrap.current.clientWidth);
      const H = (cv.height = Math.max(420, Math.min(640, window.innerHeight - 220)));
      const ctx = cv.getContext("2d");
      const v = view.current;
      const L = liveRef.current;
      const me = L.machines[selRef.current];
      if (followRef.current && me?.pos) {
        v.cx += (me.pos.x - v.cx) * 0.15;
        v.cy += (me.pos.y - v.cy) * 0.15;
      }
      const sx = (x) => W / 2 + (x - v.cx) * v.scale;
      const sy = (y) => H / 2 - (y - v.cy) * v.scale;

      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(0, 0, W, H);
      if (terrain.current) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(terrain.current.canvas, sx(0), sy(site.height), site.width * v.scale, site.height * v.scale);
      }

      // 50 m grid
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let x = 0; x <= site.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(sx(x), sy(0));
        ctx.lineTo(sx(x), sy(site.height));
        ctx.stroke();
        ctx.fillText(`${x}m`, sx(x) + 2, sy(0) - 3);
      }
      for (let y = 0; y <= site.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(sx(0), sy(y));
        ctx.lineTo(sx(site.width), sy(y));
        ctx.stroke();
      }

      // zones
      for (const z of site.zones) {
        ctx.beginPath();
        z.polygon.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
        ctx.closePath();
        const nogo = z.kind === "no_go";
        ctx.fillStyle = nogo ? "rgba(200,30,30,0.28)" : "rgba(255,200,0,0.25)";
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = nogo ? "rgba(200,30,30,0.6)" : "rgba(255,200,0,0.6)";
        for (let d = -2000; d < 2000; d += 10) {
          ctx.beginPath();
          ctx.moveTo(d, 0);
          ctx.lineTo(d + H, H);
          ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 2;
        ctx.setLineDash(nogo ? [] : [6, 4]);
        ctx.strokeStyle = nogo ? "#c0392b" : "#e0a800";
        ctx.stroke();
        ctx.setLineDash([]);
        const [lx, ly] = z.polygon.reduce(([a, b], [x, y]) => [a + x / z.polygon.length, b + y / z.polygon.length], [0, 0]);
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText(z.name, sx(lx) - ctx.measureText(z.name).width / 2, sy(ly));
        ctx.fillText(z.name, sx(lx) - ctx.measureText(z.name).width / 2, sy(ly));
      }

      const machines = Object.values(L.machines).filter((m) => m.pos);

      // trails
      for (const m of machines) {
        const tr = L.trails[m.machineId] || [];
        ctx.strokeStyle = m.machineId === selRef.current ? "rgba(255,205,17,0.9)" : "rgba(255,255,255,0.45)";
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        tr.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // proximity rings around my machine
      if (me?.pos) {
        for (const [r, col] of [[20, "rgba(224,168,0,0.9)"], [10, "rgba(192,57,43,0.9)"]]) {
          ctx.beginPath();
          ctx.arc(sx(me.pos.x), sy(me.pos.y), r * v.scale, 0, Math.PI * 2);
          ctx.strokeStyle = col;
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // view cone
        const a = ((me.pos.heading - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(sx(me.pos.x), sy(me.pos.y));
        ctx.arc(sx(me.pos.x), sy(me.pos.y), 45 * v.scale, a - 0.5, a + 0.5);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,200,0.15)";
        ctx.fill();
      }

      // SOS
      const pulse = (Math.sin(tms / 200) + 1) / 2;
      for (const s of Object.values(L.sos)) {
        const origin = L.machines[s.machine_id]?.pos || (s.x != null ? { x: s.x, y: s.y } : null);
        if (!origin) continue;
        for (const n of s.nearby) {
          const p = L.machines[n.machineId]?.pos;
          if (!p) continue;
          const responding = s.responders.some((r) => r.machineId === n.machineId);
          ctx.strokeStyle = responding ? "#2ecc71" : "rgba(255,80,80,0.85)";
          ctx.setLineDash(responding ? [] : [8, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx(p.x), sy(p.y));
          ctx.lineTo(sx(origin.x), sy(origin.y));
          ctx.stroke();
          ctx.setLineDash([]);
          const mx = (sx(p.x) + sx(origin.x)) / 2;
          const my = (sy(p.y) + sy(origin.y)) / 2;
          ctx.fillStyle = "#000";
          ctx.fillRect(mx - 22, my - 9, 44, 16);
          ctx.fillStyle = "#fff";
          ctx.font = "11px sans-serif";
          ctx.fillText(`${n.distanceM} m`, mx - 18, my + 3);
        }
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(sx(origin.x), sy(origin.y), (12 + ((pulse + k / 3) % 1) * 40) * Math.max(1, v.scale / 2), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,0,0,${1 - ((pulse + k / 3) % 1)})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // machines
      for (const m of machines) {
        const { x, y, heading } = m.pos;
        const mine = m.machineId === selRef.current;
        const crit = (m.activeAlerts || []).some((a) => a.severity === "critical");
        ctx.save();
        ctx.translate(sx(x), sy(y));
        ctx.rotate((heading * Math.PI) / 180);
        const s = Math.max(0.8, v.scale / 3);
        const len = (m.machineType === "loader" ? 9 : 8) * s * 1.6;
        const wid = 4.5 * s * 1.6;
        ctx.fillStyle = "#222";
        ctx.fillRect(-wid / 2 - 2 * s, -len / 2, 2 * s, len);
        ctx.fillRect(wid / 2, -len / 2, 2 * s, len);
        ctx.fillStyle = !m.online ? "#888" : crit ? "#e74c3c" : "#ffcd11";
        ctx.fillRect(-wid / 2, -len / 2, wid, len);
        ctx.strokeStyle = mine ? "#fff" : "#000";
        ctx.lineWidth = mine ? 3 : 1.5;
        ctx.strokeRect(-wid / 2, -len / 2, wid, len);
        ctx.fillStyle = "#111";
        if (m.machineType === "excavator") ctx.fillRect(-1.5 * s, -len / 2 - 9 * s, 3 * s, 9 * s);
        if (m.machineType === "loader") ctx.fillRect(-wid / 2 - 2 * s, -len / 2 - 3 * s, wid + 4 * s, 3 * s);
        if (m.machineType === "dozer") ctx.fillRect(-wid / 2 - 3 * s, -len / 2 - 2.5 * s, wid + 6 * s, 2.5 * s);
        ctx.restore();

        const label = `${m.machineId}${m.operator ? " · " + m.operator.name.split(" ")[0] : ""}`;
        ctx.font = mine ? "bold 12px sans-serif" : "11px sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = mine ? "rgba(255,205,17,0.95)" : "rgba(0,0,0,0.7)";
        ctx.fillRect(sx(x) - tw / 2 - 4, sy(y) - 30, tw + 8, 16);
        ctx.fillStyle = mine ? "#000" : "#fff";
        ctx.fillText(label, sx(x) - tw / 2, sy(y) - 18);
      }

      // compass + scale bar
      ctx.save();
      ctx.translate(W - 40, 40);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(6, 0);
      ctx.lineTo(-6, 0);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(6, 0);
      ctx.lineTo(-6, 0);
      ctx.fill();
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("N", -4, -24 + 0);
      ctx.restore();
      const bar = 50 * v.scale;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(10, H - 30, bar + 20, 22);
      ctx.fillStyle = "#fff";
      ctx.fillRect(20, H - 16, bar, 4);
      ctx.font = "11px sans-serif";
      ctx.fillText("50 m", 20, H - 19);

      // minimap
      const mmW = 160;
      const mmH = (mmW * site.height) / site.width;
      const mx0 = W - mmW - 10;
      const my0 = H - mmH - 10;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(mx0 - 3, my0 - 3, mmW + 6, mmH + 6);
      if (terrain.current) ctx.drawImage(terrain.current.canvas, mx0, my0, mmW, mmH);
      const ms = mmW / site.width;
      for (const m of machines) {
        ctx.fillStyle = m.machineId === selRef.current ? "#fff" : "#ffcd11";
        ctx.fillRect(mx0 + m.pos.x * ms - 2, my0 + (site.height - m.pos.y) * ms - 2, 4, 4);
      }
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(mx0 + (v.cx - W / 2 / v.scale) * ms, my0 + (site.height - v.cy - H / 2 / v.scale) * ms, (W / v.scale) * ms, (H / v.scale) * ms);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [site]);

  const toWorld = (e) => {
    const r = canvas.current.getBoundingClientRect();
    const v = view.current;
    return { x: v.cx + (e.clientX - r.left - r.width / 2) / v.scale, y: v.cy - (e.clientY - r.top - r.height / 2) / v.scale };
  };

  const onWheel = (e) => {
    e.preventDefault();
    const v = view.current;
    v.scale = Math.min(12, Math.max(1, v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [site]);

  const onMove = (e) => {
    if (drag.current) {
      const v = view.current;
      v.cx -= (e.clientX - drag.current.x) / v.scale;
      v.cy += (e.clientY - drag.current.y) / v.scale;
      drag.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!site) return;
    const w = toWorld(e);
    if (w.x < 0 || w.y < 0 || w.x > site.width || w.y > site.height) return setHover(null);
    const zone = site.zones.find((z) => {
      let inside = false;
      for (let i = 0, j = z.polygon.length - 1; i < z.polygon.length; j = i++) {
        const [xi, yi] = z.polygon[i];
        const [xj, yj] = z.polygon[j];
        if (yi > w.y !== yj > w.y && w.x < ((xj - xi) * (w.y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
    setHover({ ...w, elev: bilinear(site, w.x, w.y), slope: slopeAt(site, w.x, w.y), zone: zone?.name });
  };

  const onClick = (e) => {
    const w = toWorld(e);
    const hit = Object.values(live.machines).find((m) => m.pos && Math.hypot(m.pos.x - w.x, m.pos.y - w.y) < 8);
    if (hit) {
      setMachineId(hit.machineId);
      setFollow(true);
    }
  };

  const me = live.machines[machineId];
  const others = Object.values(live.machines)
    .filter((m) => m.pos && me?.pos && m.machineId !== machineId)
    .map((m) => {
      const dx = m.pos.x - me.pos.x;
      const dy = m.pos.y - me.pos.y;
      return { ...m, dist: Math.hypot(dx, dy), dir: compass(dx, dy) };
    })
    .sort((a, b) => a.dist - b.dist);
  const zoneName = site?.zones.find((z) => z.id === me?.zone)?.name;

  return (
    <>
      <h2>Site map</h2>
      <div className="filters">
        <label>
          <input type="radio" checked={mode === "terrain"} onChange={() => setMode("terrain")} /> Terrain & contours
        </label>
        <label>
          <input type="radio" checked={mode === "slope"} onChange={() => setMode("slope")} /> Slope danger
        </label>
        <label>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow {machineId}
        </label>
        <span className="muted">Scroll to zoom, drag to pan, click a machine to select it.</span>
      </div>
      <div className="map-layout">
        <div className="map-wrap" ref={wrap}>
          <canvas
            ref={canvas}
            onMouseDown={(e) => {
              drag.current = { x: e.clientX, y: e.clientY };
              setFollow(false);
            }}
            onMouseUp={() => (drag.current = null)}
            onMouseLeave={() => {
              drag.current = null;
              setHover(null);
            }}
            onMouseMove={onMove}
            onClick={onClick}
          />
          {hover && (
            <div className="map-tip">
              {hover.x.toFixed(0)}, {hover.y.toFixed(0)} m · elev {hover.elev.toFixed(1)} m ·{" "}
              <b className={hover.slope > 25 ? "bad" : ""}>slope {hover.slope.toFixed(1)}°</b>
              {hover.zone && <b className="bad"> · {hover.zone}</b>}
            </div>
          )}
          {!site && <p className="muted" style={{ padding: 12 }}>Loading site…</p>}
        </div>
        <div className="map-side">
          <div className="card">
            <h3>{machineId}</h3>
            {me?.pos ? (
              <>
                <div>Position {me.pos.x.toFixed(0)}, {me.pos.y.toFixed(0)} m</div>
                <div>Elevation {me.pos.elevation?.toFixed(1)} m</div>
                <div>Heading {me.pos.heading.toFixed(0)}° ({compass(Math.sin((me.pos.heading * Math.PI) / 180), Math.cos((me.pos.heading * Math.PI) / 180))})</div>
                <div className={Math.abs(me.telemetry?.slopeDeg) > 25 ? "bad" : ""}>Slope under machine {me.telemetry?.slopeDeg?.toFixed(1)}°</div>
                <div className={zoneName ? "bad" : "ok"}>{zoneName ? `Inside: ${zoneName}` : "Outside danger zones"}</div>
              </>
            ) : (
              <span className="muted">No position yet</span>
            )}
          </div>
          <div className="card">
            <h3>Nearby equipment</h3>
            {others.length === 0 && <span className="muted">None</span>}
            {others.map((o) => (
              <div key={o.machineId} className={o.dist < 20 ? "bad" : ""} style={{ cursor: "pointer" }} onClick={() => setMachineId(o.machineId)}>
                <b>{o.machineId}</b> {o.operator?.name?.split(" ")[0] || ""} · {o.dist.toFixed(0)} m {o.dir}
              </div>
            ))}
          </div>
          <div className="card legend">
            <h3>Legend</h3>
            <div><span className="sw" style={{ background: "rgba(200,30,30,0.5)" }} /> No-go zone</div>
            <div><span className="sw" style={{ background: "rgba(255,200,0,0.5)" }} /> Caution zone</div>
            <div><span className="sw ring-y" /> 20 m / <span className="sw ring-r" /> 10 m machine distance</div>
            {mode === "slope" && (
              <div>
                Slope: <span className="sw" style={{ background: "rgb(90,170,90)" }} />&lt;8°
                <span className="sw" style={{ background: "rgb(200,200,80)" }} />&lt;15°
                <span className="sw" style={{ background: "rgb(235,150,50)" }} />&lt;20°
                <span className="sw" style={{ background: "rgb(225,90,50)" }} />&lt;25°
                <span className="sw" style={{ background: "rgb(170,30,30)" }} />25°+
              </div>
            )}
            <div>Dashed line: machine trail · Red pulse: SOS</div>
          </div>
        </div>
      </div>
    </>
  );
}
