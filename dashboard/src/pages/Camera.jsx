import { useEffect, useRef, useState } from "react";
import { send } from "../api.js";

// Browser-only computer vision. Video never leaves the laptop; only alert events are sent to the backend.
//
// Drowsiness: two detectors, either one can raise the alert
//   1. MediaPipe Face Landmarker (pretrained, no training) -> Eye Aspect Ratio. Eyes closed > 1.5 s = drowsy.
//   2. Optional Teachable Machine image model (TensorFlow.js) with a class named like "drowsy".
// Proximity: COCO-SSD (pretrained TensorFlow.js object detector). A person filling a large part of the frame = close.

const MP_VERSION = "1.0.1"; // keep in sync with @mediapipe/tasks-vision in package.json
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const DROWSY_AFTER_MS = 1500;
const REPORT_EVERY_MS = 2000;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function ear(lm, [p1, p2, p3, p4, p5, p6]) {
  return (dist(lm[p2], lm[p6]) + dist(lm[p3], lm[p5])) / (2 * dist(lm[p1], lm[p4]));
}

function useDevices() {
  const [devices, setDevices] = useState([]);
  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((s) => {
        s.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((d) => setDevices(d.filter((x) => x.kind === "videoinput")))
      .catch(() => setDevices([]));
  }, []);
  return devices;
}

/** Start/stop a webcam into a <video>. Returns [running, start, stop]. */
function useCamera(videoRef) {
  const [running, setRunning] = useState(false);
  const stream = useRef(null);
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setRunning(false);
  };
  const start = async (deviceId) => {
    stop();
    stream.current = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    videoRef.current.srcObject = stream.current;
    await videoRef.current.play();
    setRunning(true);
  };
  useEffect(() => stop, []);
  return [running, start, stop];
}

function throttle(ref, fn) {
  const now = Date.now();
  if (now - ref.current > REPORT_EVERY_MS) {
    ref.current = now;
    fn();
  }
}

// ---------------- drowsiness ----------------

function DrowsinessPanel({ machineId, devices }) {
  const video = useRef(null);
  const canvas = useRef(null);
  const [running, start, stop] = useCamera(video);
  const [deviceId, setDeviceId] = useState("");
  const [threshold, setThreshold] = useState(0.21);
  const [tmUrl, setTmUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [view, setView] = useState({ ear: null, face: false, mp: false, tm: null, tmDrowsy: false });
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let raf;
    const lastReport = { current: 0 };
    let closedSince = null;
    let tmSince = null;
    let tm = null;
    let lastTm = 0;
    let tmProb = null;
    let landmarker;

    (async () => {
      setStatus("loading MediaPipe…");
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
      );
      landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });

      if (tmUrl.trim()) {
        setStatus("loading Teachable Machine model…");
        const tf = await import("@tensorflow/tfjs");
        const base = tmUrl.trim().replace(/\/?$/, "/");
        const [model, meta] = await Promise.all([
          tf.loadLayersModel(base + "model.json"),
          fetch(base + "metadata.json").then((r) => r.json()),
        ]);
        const idx = meta.labels.findIndex((l) => /drows|sleep|closed|tired/i.test(l));
        tm = { tf, model, labels: meta.labels, idx };
      }
      if (cancelled) return;
      setStatus("running");

      const loop = () => {
        if (cancelled) return;
        const v = video.current;
        const now = performance.now();
        const res = landmarker.detectForVideo(v, now);
        const lm = res.faceLandmarks?.[0];
        const ctx = canvas.current.getContext("2d");
        canvas.current.width = v.videoWidth;
        canvas.current.height = v.videoHeight;
        ctx.clearRect(0, 0, v.videoWidth, v.videoHeight);

        let e = null;
        if (lm) {
          e = (ear(lm, LEFT_EYE) + ear(lm, RIGHT_EYE)) / 2;
          ctx.fillStyle = e < thresholdRef.current ? "red" : "lime";
          [...LEFT_EYE, ...RIGHT_EYE].forEach((i) => ctx.fillRect(lm[i].x * v.videoWidth - 2, lm[i].y * v.videoHeight - 2, 4, 4));
          closedSince = e < thresholdRef.current ? closedSince ?? now : null;
        } else {
          closedSince = null;
        }
        const mpDrowsy = closedSince !== null && now - closedSince > DROWSY_AFTER_MS;

        if (tm && tm.idx >= 0 && now - lastTm > 400) {
          lastTm = now;
          const probs = tm.tf.tidy(() => {
            const img = tm.tf.browser.fromPixels(v);
            const s = Math.min(img.shape[0], img.shape[1]);
            const crop = img.slice([(img.shape[0] - s) >> 1, (img.shape[1] - s) >> 1, 0], [s, s, 3]);
            const x = tm.tf.image.resizeBilinear(crop, [224, 224]).toFloat().div(127.5).sub(1).expandDims(0);
            return tm.model.predict(x).dataSync();
          });
          tmProb = probs[tm.idx];
          tmSince = tmProb > 0.8 ? tmSince ?? now : null;
        }
        const tmDrowsy = tmSince !== null && now - tmSince > DROWSY_AFTER_MS;

        setView({ ear: e, face: !!lm, mp: mpDrowsy, tm: tmProb, tmDrowsy });
        if (mpDrowsy || tmDrowsy) {
          throttle(lastReport, () =>
            send("/api/events/camera", {
              machineId,
              kind: "drowsy",
              confidence: tmDrowsy ? tmProb : Math.min(1, (thresholdRef.current - (e ?? 0)) / thresholdRef.current + 0.6),
            }).catch(() => {})
          );
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })().catch((err) => setStatus("error: " + err.message));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      landmarker?.close();
    };
  }, [running, machineId]);

  const drowsy = view.mp || view.tmDrowsy;
  return (
    <div className={"card" + (drowsy ? " tile-bad" : "")}>
      <h3>Cab camera: drowsiness</h3>
      <div className="filters">
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">default camera</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 8)}
            </option>
          ))}
        </select>
        <input
          style={{ width: 320 }}
          placeholder="optional Teachable Machine model URL"
          value={tmUrl}
          onChange={(e) => setTmUrl(e.target.value)}
          disabled={running}
        />
        {running ? <button onClick={stop}>Stop</button> : <button onClick={() => start(deviceId)}>Start</button>}
        <span className="muted">{status}</span>
      </div>
      <div className="video-wrap">
        <video ref={video} muted playsInline />
        <canvas ref={canvas} />
      </div>
      <p>
        Eye openness (EAR): <b>{view.ear?.toFixed(3) ?? "–"}</b> · closed below{" "}
        <input type="range" min="0.12" max="0.3" step="0.01" value={threshold} onChange={(e) => setThreshold(+e.target.value)} />{" "}
        {threshold.toFixed(2)} · face {view.face ? "found" : "not found"}
      </p>
      <p>
        MediaPipe: <b className={view.mp ? "bad" : "ok"}>{view.mp ? "DROWSY" : "alert"}</b>
        {view.tm != null && (
          <>
            {" "}· Teachable Machine: <b className={view.tmDrowsy ? "bad" : "ok"}>{(view.tm * 100).toFixed(0)}% drowsy</b>
          </>
        )}
      </p>
    </div>
  );
}

// ---------------- object detection ----------------

function ProximityPanel({ machineId, devices }) {
  const video = useRef(null);
  const canvas = useRef(null);
  const [running, start, stop] = useCamera(video);
  const [deviceId, setDeviceId] = useState("");
  const [nearFrac, setNearFrac] = useState(0.15);
  const [status, setStatus] = useState("idle");
  const [dets, setDets] = useState([]);
  const [near, setNear] = useState(false);
  const nearRef = useRef(nearFrac);
  nearRef.current = nearFrac;

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let timer;
    const lastReport = { current: 0 };

    (async () => {
      setStatus("loading COCO-SSD…");
      await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      if (cancelled) return;
      setStatus("running");

      const tick = async () => {
        if (cancelled) return;
        const v = video.current;
        const found = await model.detect(v, 10, 0.5);
        const W = v.videoWidth;
        const H = v.videoHeight;
        const ctx = canvas.current.getContext("2d");
        canvas.current.width = W;
        canvas.current.height = H;
        ctx.clearRect(0, 0, W, H);
        ctx.font = "16px sans-serif";
        let closest = null;
        for (const d of found) {
          const [x, y, w, h] = d.bbox;
          const frac = (w * h) / (W * H);
          const isNear = d.class === "person" && frac > nearRef.current;
          ctx.strokeStyle = isNear ? "red" : "yellow";
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fillText(`${d.class} ${(d.score * 100).toFixed(0)}%`, x + 4, y + 18);
          if (isNear && (!closest || frac > closest.frac)) closest = { ...d, frac };
        }
        setDets(found.map((d) => `${d.class} ${(d.score * 100).toFixed(0)}%`));
        setNear(!!closest);
        if (closest) {
          throttle(lastReport, () =>
            send("/api/events/camera", { machineId, kind: "person", confidence: closest.score }).catch(() => {})
          );
        }
        timer = setTimeout(tick, 300);
      };
      tick();
    })().catch((err) => setStatus("error: " + err.message));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [running, machineId]);

  return (
    <div className={"card" + (near ? " tile-bad" : "")}>
      <h3>Proximity camera: object detection</h3>
      <div className="filters">
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">default camera</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 8)}
            </option>
          ))}
        </select>
        {running ? <button onClick={stop}>Stop</button> : <button onClick={() => start(deviceId)}>Start</button>}
        <span className="muted">{status}</span>
      </div>
      <div className="video-wrap">
        <video ref={video} muted playsInline />
        <canvas ref={canvas} />
      </div>
      <p>
        Person counts as "near" when it fills more than{" "}
        <input type="range" min="0.05" max="0.5" step="0.01" value={nearFrac} onChange={(e) => setNearFrac(+e.target.value)} />{" "}
        {Math.round(nearFrac * 100)}% of the frame ·{" "}
        <b className={near ? "bad" : "ok"}>{near ? "PERSON NEAR MACHINE" : "clear"}</b>
      </p>
      <p className="muted">Detected: {dets.join(", ") || "nothing"}</p>
    </div>
  );
}

export default function Camera({ machineId }) {
  const devices = useDevices();
  return (
    <>
      <h2>Cameras: {machineId}</h2>
      <p className="muted">
        Runs fully in the browser. With one webcam, run one panel at a time (the operator's own face would count as a
        person near the machine).
      </p>
      <div className="grid2">
        <DrowsinessPanel machineId={machineId} devices={devices} />
        <ProximityPanel machineId={machineId} devices={devices} />
      </div>
    </>
  );
}
