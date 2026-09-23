import { useEffect, useRef, useState } from "react";
import { send } from "./api.js";

// Hands-free co-pilot: browser speech recognition -> backend (Claude or offline) -> speech synthesis.
// Also speaks new alerts out loud, instantly, without waiting for the AI.

const LANGS = [
  ["en", "en-IN", "English"],
  ["hi", "hi-IN", "हिन्दी"],
  ["ta", "ta-IN", "தமிழ்"],
  ["te", "te-IN", "తెలుగు"],
  ["mr", "mr-IN", "मराठी"],
];

const SPOKEN_ALERT = {
  seatbelt: "Fasten your seatbelt.",
  proximity: "Warning. Object close to the machine.",
  camera_person: "Stop. Person near the machine.",
  overheat: "Engine overheating. Reduce load.",
  overheat_predicted: "Engine heating up. Ease off the load.",
  unsafe_tilt: "Danger. Slope too steep.",
  engine_fault: "Engine fault predicted. Check the screen.",
  overspeed: "Slow down for this terrain.",
  idling: "Engine idling. Consider shutting down.",
  drowsy: "Wake up. Stop the machine and take a break.",
  anomaly: "Unusual operating pattern detected.",
  geofence: null, // message itself names the zone
  machine_proximity: "Another machine is very close. Stop and radio.",
  lockout: "Machine locked out. Critical defect found.",
  sos: "SOS sent. Help is on the way.",
  sos_nearby: null, // message has distance and direction
};

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function speak(text, bcp47, onEnd) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp47;
  const voice = speechSynthesis.getVoices().find((v) => v.lang === bcp47) ||
    speechSynthesis.getVoices().find((v) => v.lang.startsWith(bcp47.slice(0, 2)));
  if (voice) u.voice = voice;
  if (onEnd) u.onend = onEnd;
  speechSynthesis.speak(u);
}

export default function CoPilot({ machineId, feed, hideFab = false }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [voiceOut, setVoiceOut] = useState(true);
  const [alertsOut, setAlertsOut] = useState(true);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(null);
  const rec = useRef(null);
  const lastAlert = useRef(null);
  const logRef = useRef(null);
  const bcp47 = LANGS.find((l) => l[0] === lang)[1];

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [msgs]);

  // the header's "Operator AI" button opens the panel
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener("copilot:toggle", toggle);
    return () => window.removeEventListener("copilot:toggle", toggle);
  }, []);

  // speak new alerts for this machine
  useEffect(() => {
    const a = feed[0];
    if (!a || a === lastAlert.current) return;
    lastAlert.current = a;
    if (alertsOut && a.machineId === machineId && (a.severity === "critical" || a.type === "overheat_predicted")) {
      speechSynthesis.cancel();
      speak(SPOKEN_ALERT[a.type] || a.message.replace(/°/g, " degrees"), "en-IN");
    }
  }, [feed, alertsOut, machineId]);

  const ask = async (question, path = "/api/copilot/chat") => {
    if (!question && path === "/api/copilot/chat") return;
    setBusy(true);
    const history = msgs.slice(-8).map(({ role, content }) => ({ role, content }));
    if (question) setMsgs((m) => [...m, { role: "user", content: question }]);
    try {
      const res = await send(path, { machineId, message: question, history, lang });
      setSource(res.source);
      setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
      if (voiceOut) {
        speechSynthesis.cancel();
        speak(res.reply, bcp47);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: "Co-pilot unavailable: " + e.message }]);
    }
    setBusy(false);
  };

  const listen = () => {
    if (!Recognition) {
      setMsgs((m) => [...m, { role: "assistant", content: "Voice input needs Chrome or Edge. Type instead." }]);
      return;
    }
    if (listening) {
      rec.current?.stop();
      return;
    }
    speechSynthesis.cancel();
    const r = new Recognition();
    r.lang = bcp47;
    r.interimResults = false;
    r.onresult = (e) => ask(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  if (!open && hideFab) return null;
  if (!open)
    return (
      <button className="copilot-fab" onClick={() => setOpen(true)}>
        🎙 Co-pilot
      </button>
    );

  return (
    <div className="copilot">
      <div className="copilot-head">
        <b>🎙 Co-pilot · {machineId}</b>
        <span className="muted">{source === "claude" ? "Claude" : source === "offline" ? "offline mode" : ""}</span>
        <button onClick={() => setOpen(false)}>–</button>
      </div>
      <div className="copilot-log" ref={logRef}>
        {msgs.length === 0 && (
          <p className="muted">
            Tap the mic and ask: "Why is there an alert?", "How long is left on my task?", "Is this slope safe?",
            "How is my shift going?"
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={"bubble " + m.role}>
            {m.content}
          </div>
        ))}
        {busy && <div className="bubble assistant muted">…</div>}
      </div>
      <form
        className="copilot-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text.trim());
          setText("");
        }}
      >
        <button type="button" className={listening ? "mic on" : "mic"} onClick={listen} title="Speak">
          {listening ? "● listening" : "🎤"}
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything…" />
        <button disabled={busy}>Send</button>
      </form>
      <div className="copilot-opts">
        <button onClick={() => ask("", "/api/copilot/briefing")} disabled={busy}>
          Shift briefing
        </button>
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map(([id, , label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={voiceOut} onChange={(e) => setVoiceOut(e.target.checked)} /> speak replies
        </label>
        <label>
          <input type="checkbox" checked={alertsOut} onChange={(e) => setAlertsOut(e.target.checked)} /> speak alerts
        </label>
      </div>
    </div>
  );
}
