import { useEffect, useRef, useState } from "react";
import { send } from "./api.js";

// Hazard-response simulator: a 60-second top-down drill. Hazards pop up; the operator must
// respond with the right action before the deadline. Result feeds the safety score.

const ROUND_MS = 60000;
const W = 640;
const H = 400;
const HAZARDS = {
  worker: { key: " ", keyLabel: "SPACE", action: "STOP", deadline: 3500, text: "Worker entering swing radius!" },
  belt: { key: "b", keyLabel: "B", action: "FASTEN BELT", deadline: 3000, text: "Seatbelt unfastened!" },
  slope: { key: "s", keyLabel: "S", action: "SLOW / REPOSITION", deadline: 3000, text: "Slope approaching 25°!" },
  heat: { key: "i", keyLabel: "I", action: "IDLE DOWN", deadline: 4000, text: "Engine temperature rising fast!" },
};
const TYPES = Object.keys(HAZARDS);

function newGame() {
  return { start: performance.now(), active: [], results: [], falseAlarms: 0, nextSpawn: 1500, flash: null, arm: 0 };
}

export default function HazardSim({ operatorId, onDone }) {
  const canvas = useRef(null);
  const game = useRef(null);
  const [phase, setPhase] = useState("intro"); // intro | running | done
  const [result, setResult] = useState(null);

  const respond = (type) => {
    const g = game.current;
    if (!g) return;
    const now = performance.now() - g.start;
    const hit = g.active.find((h) => h.type === type);
    if (hit) {
      g.active = g.active.filter((h) => h !== hit);
      g.results.push({ type, ok: true, reaction: now - hit.at });
      g.flash = { ok: true, until: now + 400, text: `${HAZARDS[type].action} ✔ ${((now - hit.at) / 1000).toFixed(2)}s` };
    } else {
      g.falseAlarms += 1;
      g.flash = { ok: false, until: now + 400, text: "No such hazard" };
    }
  };

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e) => {
      const type = TYPES.find((t) => HAZARDS[t].key === e.key.toLowerCase());
      if (type) {
        e.preventDefault();
        respond(type);
      }
    };
    window.addEventListener("keydown", onKey);

    let raf;
    const ctx = canvas.current.getContext("2d");
    const loop = () => {
      const g = game.current;
      const now = performance.now() - g.start;

      // spawn
      if (now >= g.nextSpawn && g.active.length < 2 && now < ROUND_MS - 3000) {
        const free = TYPES.filter((t) => !g.active.some((h) => h.type === t));
        const type = free[Math.floor(Math.random() * free.length)];
        const angle = Math.random() * Math.PI * 2;
        g.active.push({ type, at: now, angle });
        g.nextSpawn = now + 1500 + Math.random() * 2500;
      }
      // misses
      for (const h of [...g.active]) {
        if (now - h.at > HAZARDS[h.type].deadline) {
          g.active = g.active.filter((x) => x !== h);
          g.results.push({ type: h.type, ok: false });
          g.flash = { ok: false, until: now + 700, text: `MISSED: ${HAZARDS[h.type].text}` };
        }
      }
      draw(ctx, g, now);

      if (now >= ROUND_MS) {
        finish();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase]);

  const finish = async () => {
    const g = game.current;
    const ok = g.results.filter((r) => r.ok);
    const avg = ok.length ? ok.reduce((s, r) => s + r.reaction, 0) / ok.length : null;
    const points = g.results.reduce((s, r) => s + (r.ok ? Math.max(40, 100 - r.reaction / 40) : 0), 0);
    const score = Math.max(0, Math.min(100, Math.round(points / Math.max(g.results.length, 1) - 5 * g.falseAlarms)));
    const res = {
      score,
      hazards: g.results.length,
      caught: ok.length,
      missed: g.results.length - ok.length,
      falseAlarms: g.falseAlarms,
      avgReactionMs: avg && Math.round(avg),
      byType: TYPES.map((t) => ({
        type: t,
        caught: g.results.filter((r) => r.type === t && r.ok).length,
        total: g.results.filter((r) => r.type === t).length,
      })),
    };
    setResult(res);
    setPhase("done");
    try {
      await send("/api/training/sim-result", {
        operatorId, score, avgReactionMs: res.avgReactionMs, hazards: res.hazards, missed: res.missed,
      });
      onDone?.();
    } catch {
      /* offline: result still shown */
    }
  };

  const start = () => {
    game.current = newGame();
    setResult(null);
    setPhase("running");
  };

  return (
    <div className="card">
      <h3>Hazard response simulator</h3>
      {phase === "intro" && (
        <>
          <p>
            60-second drill. React before the deadline: <b>SPACE</b> stop for a worker, <b>B</b> fasten seatbelt,{" "}
            <b>S</b> slow down on a steep slope, <b>I</b> idle down when the engine overheats. Faster reactions score
            higher; wrong keys cost points. Passing (60+) counts as a completed training module.
          </p>
          <button onClick={start}>Start drill as {operatorId}</button>
        </>
      )}
      <canvas ref={canvas} width={W} height={H} className="sim-canvas" style={{ display: phase === "running" ? "block" : "none" }} />
      {phase === "running" && (
        <div className="buttons">
          {TYPES.map((t) => (
            <button key={t} onClick={() => respond(t)}>
              {HAZARDS[t].action} ({HAZARDS[t].keyLabel})
            </button>
          ))}
        </div>
      )}
      {phase === "done" && result && (
        <>
          <p>
            <b className={result.score >= 60 ? "ok" : "bad"}>Score {result.score}/100</b> · caught {result.caught}/{result.hazards} ·
            avg reaction {result.avgReactionMs ? (result.avgReactionMs / 1000).toFixed(2) + " s" : "–"} · false alarms{" "}
            {result.falseAlarms}
          </p>
          <p className="muted">
            {result.byType.map((b) => `${HAZARDS[b.type].action.toLowerCase()}: ${b.caught}/${b.total}`).join(" · ")}
          </p>
          <button onClick={start}>Try again</button>
        </>
      )}
    </div>
  );
}

function draw(ctx, g, now) {
  const cx = W / 2;
  const cy = H / 2 - 20;
  ctx.fillStyle = "#c8b48a";
  ctx.fillRect(0, 0, W, H);
  // exclusion zones
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#c0392b";
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#e0a800";
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // machine with swinging arm
  g.arm += 0.01;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#333";
  ctx.fillRect(-32, -26, 64, 12);
  ctx.fillRect(-32, 14, 64, 12);
  ctx.rotate(Math.sin(g.arm) * 0.9);
  ctx.fillStyle = "#ffcd11";
  ctx.fillRect(-22, -18, 44, 36);
  ctx.strokeStyle = "#111";
  ctx.strokeRect(-22, -18, 44, 36);
  ctx.fillStyle = "#111";
  ctx.fillRect(20, -5, 55, 10);
  ctx.fillRect(72, -10, 12, 20);
  ctx.restore();

  // hazards
  const labels = [];
  for (const h of g.active) {
    const hz = HAZARDS[h.type];
    const frac = Math.min(1, (now - h.at) / hz.deadline);
    if (h.type === "worker") {
      const r = 190 - frac * 140;
      const x = cx + Math.cos(h.angle) * r;
      const y = cy + Math.sin(h.angle) * r;
      ctx.fillStyle = "#ff6f00";
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
    labels.push(`${hz.text}  →  ${hz.keyLabel}  (${((hz.deadline - (now - h.at)) / 1000).toFixed(1)}s)`);
  }

  // HUD gauges
  const belt = g.active.some((h) => h.type === "belt");
  const slope = g.active.find((h) => h.type === "slope");
  const heat = g.active.find((h) => h.type === "heat");
  const tilt = slope ? 12 + 13 * Math.min(1, (now - slope.at) / HAZARDS.slope.deadline) : 6;
  const temp = heat ? 95 + 15 * Math.min(1, (now - heat.at) / HAZARDS.heat.deadline) : 88;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, H - 56, W, 56);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = belt ? "#ff5252" : "#7dff7d";
  ctx.fillText(belt ? "BELT OFF" : "BELT ON", 14, H - 22);
  gauge(ctx, 120, H - 36, "TILT", tilt, 30, 25, `${tilt.toFixed(0)}°`);
  gauge(ctx, 330, H - 36, "ENGINE", temp - 60, 60, 50, `${temp.toFixed(0)}°C`);
  ctx.fillStyle = "#fff";
  ctx.fillText(`${Math.max(0, (ROUND_MS - now) / 1000).toFixed(0)} s`, W - 60, H - 22);

  // prompts
  ctx.font = "bold 16px sans-serif";
  labels.forEach((l, i) => {
    ctx.fillStyle = "rgba(192,57,43,0.9)";
    ctx.fillRect(10, 10 + i * 30, ctx.measureText(l).width + 16, 26);
    ctx.fillStyle = "#fff";
    ctx.fillText(l, 18, 29 + i * 30);
  });
  if (g.flash && now < g.flash.until) {
    ctx.fillStyle = g.flash.ok ? "#1e8449" : "#c0392b";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(g.flash.text, W / 2 - ctx.measureText(g.flash.text).width / 2, H - 80);
  }
}

function gauge(ctx, x, y, label, value, max, danger, text) {
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.fillText(label, x, y - 4);
  ctx.fillStyle = "#555";
  ctx.fillRect(x, y, 150, 12);
  ctx.fillStyle = value >= danger ? "#ff5252" : "#ffcd11";
  ctx.fillRect(x, y, (150 * Math.min(value, max)) / max, 12);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + 158, y + 11);
}
