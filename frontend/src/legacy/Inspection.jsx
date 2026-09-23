import { useEffect, useState } from "react";
import { get, send } from "./api.js";

// Pre-start walk-around. Shown over the app when the machine's inspection is pending (new operator login).
// Failed critical items lock the machine out and create urgent maintenance requests.

async function shrinkPhoto(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 480 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

export default function Inspection({ machineId, machine, onClose = undefined, inline = false, onDone = undefined }) {
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState({});
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    get("/api/inspection/items").then(setItems);
  }, []);

  const done = items.length > 0 && items.every((i) => answers[i.id] !== undefined);
  const failed = items.filter((i) => answers[i.id] === false);

  const submit = async () => {
    setError(null);
    try {
      const res = await send("/api/inspection", {
        machineId,
        operatorId: machine?.operator?.id,
        items: items.map((i) => ({ id: i.id, ok: answers[i.id], note: notes[i.id] || "" })),
        photo,
      });
      setResult(res);
      onDone?.(res);
    } catch (e) {
      setError(e.message);
    }
  };

  const groups = [...new Set(items.map((i) => i.group))];

  const Outer = "div";
  return (
    <Outer className={inline ? "" : "overlay"}>
      <div className={inline ? "card" : "modal"}>
        <h2>
          Pre-start inspection · {machineId} · {machine?.operator?.name || ""}
        </h2>
        {!result && (
          <>
            <p className="muted">Walk around the machine before starting. Items marked ⚠ lock the machine if they fail.</p>
            {groups.map((g) => (
              <div key={g}>
                <h3>{g}</h3>
                {items
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <div key={i.id} className="check-row">
                      <span>
                        {i.critical && "⚠ "}
                        {i.label}
                      </span>
                      <span>
                        <button className={answers[i.id] === true ? "pass on" : "pass"} onClick={() => setAnswers({ ...answers, [i.id]: true })}>
                          OK
                        </button>{" "}
                        <button className={answers[i.id] === false ? "fail on" : "fail"} onClick={() => setAnswers({ ...answers, [i.id]: false })}>
                          Defect
                        </button>
                      </span>
                      {answers[i.id] === false && (
                        <input
                          className="note"
                          placeholder="Describe the defect"
                          value={notes[i.id] || ""}
                          onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })}
                        />
                      )}
                    </div>
                  ))}
              </div>
            ))}
            {failed.length > 0 && (
              <p>
                Photo of defect:{" "}
                <input type="file" accept="image/*" capture="environment" onChange={async (e) => e.target.files[0] && setPhoto(await shrinkPhoto(e.target.files[0]))} />
                {photo && <img src={photo} alt="defect" className="thumb" />}
              </p>
            )}
            {error && <p className="bad">{error}</p>}
            <p>
              <button onClick={() => setAnswers(Object.fromEntries(items.map((i) => [i.id, true])))}>Mark all OK</button>{" "}
              <button disabled={!done} onClick={submit} className="primary">
                Submit inspection ({Object.keys(answers).length}/{items.length})
              </button>{" "}
              {!inline && <button onClick={onClose}>Later</button>}
            </p>
          </>
        )}
        {result && (
          <>
            {result.lockout ? (
              <div className="alert critical">
                <b>Machine locked out.</b> Critical defect: {result.failed.filter((f) => f.critical).map((f) => f.label).join("; ")}.
                The engine has been stopped and an urgent maintenance request was created.
              </div>
            ) : result.failed.length ? (
              <div className="alert warning">
                Inspection passed with {result.failed.length} minor defect(s). Maintenance request created. You may start the machine.
              </div>
            ) : (
              <div className="alert" style={{ borderColor: "#1e8449" }}>
                ✔ Inspection passed. Safe to start. Have a good shift.
              </div>
            )}
            {!inline && (
              <p>
                <button onClick={onClose}>Close</button>
              </p>
            )}
          </>
        )}
      </div>
    </Outer>
  );
}
