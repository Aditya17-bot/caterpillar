import { useEffect, useState } from "react";
import { get, send } from "../api.js";

export default function Training({ operatorId: liveOperator }) {
  const [operators, setOperators] = useState([]);
  const [operatorId, setOperatorId] = useState(liveOperator || "OP-01");
  const [data, setData] = useState(null);
  const [score, setScore] = useState(null);
  const [open, setOpen] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [booking, setBooking] = useState({ instructor: "", slot: "", topic: "" });

  const load = () => {
    get(`/api/training/modules?operatorId=${operatorId}`).then(setData);
    get(`/api/operators/${operatorId}/score`).then(setScore);
    get(`/api/training/bookings?operatorId=${operatorId}`).then(setBookings);
  };

  useEffect(() => {
    get("/api/operators").then(setOperators);
  }, []);
  useEffect(load, [operatorId]);

  const submit = async (m) => {
    const res = await send("/api/training/progress", {
      operatorId,
      moduleId: m.id,
      answers: m.quiz.map((_, i) => answers[i] ?? -1),
    });
    setResult(res);
    load();
  };

  const book = async (e) => {
    e.preventDefault();
    await send("/api/training/bookings", { operatorId, ...booking });
    setBooking({ instructor: "", slot: "", topic: "" });
    load();
  };

  if (!data) return <p>Loading…</p>;

  return (
    <>
      <h2>
        Training hub ·{" "}
        <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
          {operators.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id} {o.name}
            </option>
          ))}
        </select>
      </h2>

      {score && (
        <div className="card">
          <b>Safety score: {score.score}/100</b> · {score.incidents7d} incidents in 7 days · {score.trainingCompleted}{" "}
          modules passed
          <div className="muted">
            {Object.entries(score.byType)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </div>
        </div>
      )}

      {data.recommended.length > 0 && (
        <p>
          <b>Recommended for you</b> (based on recent incidents):{" "}
          {data.recommended.map((id) => data.modules.find((m) => m.id === id)?.title).join(", ")}
        </p>
      )}

      <div className="modules">
        {data.modules.map((m) => (
          <div key={m.id} className={"card" + (data.recommended.includes(m.id) ? " selected" : "")}>
            <b>{m.title}</b>
            <div className="muted">
              {m.minutes} min · {m.bestScore != null ? `best score ${m.bestScore}%` : "not taken"}
            </div>
            <a href={m.videoUrl} target="_blank" rel="noreferrer">
              Watch videos
            </a>{" "}
            <button
              onClick={() => {
                setOpen(open === m.id ? null : m.id);
                setAnswers({});
                setResult(null);
              }}
            >
              {open === m.id ? "Close quiz" : "Take quiz"}
            </button>
            {open === m.id && (
              <div className="quiz">
                {m.quiz.map((q, i) => (
                  <div key={i}>
                    <p>{q.q}</p>
                    {q.options.map((o, j) => (
                      <label key={j} className="option">
                        <input
                          type="radio"
                          name={`${m.id}-${i}`}
                          checked={answers[i] === j}
                          onChange={() => setAnswers({ ...answers, [i]: j })}
                        />{" "}
                        {o}
                      </label>
                    ))}
                  </div>
                ))}
                <button onClick={() => submit(m)}>Submit</button>
                {result && (
                  <p className={result.passed ? "ok" : "bad"}>
                    Score {result.score}% · {result.passed ? "passed" : "try again"}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Book an instructor</h3>
        <form onSubmit={book} className="filters">
          <select required value={booking.instructor} onChange={(e) => setBooking({ ...booking, instructor: e.target.value })}>
            <option value="">instructor…</option>
            {data.instructors.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
          <input
            required
            type="datetime-local"
            value={booking.slot}
            onChange={(e) => setBooking({ ...booking, slot: e.target.value })}
          />
          <input placeholder="topic" value={booking.topic} onChange={(e) => setBooking({ ...booking, topic: e.target.value })} />
          <button>Book</button>
        </form>
        {bookings.map((b) => (
          <div key={b.id}>
            {b.slot.replace("T", " ")} · {b.instructor} · {b.topic}
          </div>
        ))}
      </div>
    </>
  );
}
