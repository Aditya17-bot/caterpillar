"""Operator co-pilot: answers questions, gives shift briefings and writes shift summaries.

Uses Claude when credentials are available (ANTHROPIC_API_KEY or an `ant auth login` profile);
otherwise falls back to rule-based answers built from the same live data, so the demo never breaks.
"""

import json
import logging
import os
import time
from typing import Dict, List, Optional

import db
import engine
import insights

log = logging.getLogger("copilot")

MODEL = os.getenv("COPILOT_MODEL", "claude-opus-5")
LANG_NAMES = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "mr": "Marathi",
              "kn": "Kannada", "bn": "Bengali", "es": "Spanish"}

SYSTEM = """You are the voice co-pilot inside the cab of a Caterpillar construction machine \
(excavator, wheel loader or dozer). The operator talks to you hands-free while working.

How to answer:
- Your reply is spoken aloud by text-to-speech. Keep it to 1-3 short sentences unless asked for a \
briefing or report. No markdown, lists, emoji or symbols that sound odd when spoken; say units in words.
- Answer only from the live machine data given in the <context> block of the latest message. If the \
data does not contain the answer, say so briefly. Never invent readings.
- Safety comes first. If there is an active critical alert, lead with the one action the operator \
should take right now, even if they asked about something else.
- Explain alerts in plain language: what triggered it, what it means, what to do.
- For machine limits: the tilt limit is 25 degrees, engine overheat is 110 degrees Celsius, seatbelt \
must be worn whenever the engine runs, keep people outside 1 metre of the machine.
- Be encouraging and practical, like an experienced site supervisor who respects the operator."""


def _has_credentials() -> bool:
    if os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_PROFILE"):
        return True
    return os.path.isdir(os.path.expanduser("~/.config/anthropic"))   # `ant auth login` profile


def _client():
    if not _has_credentials():
        log.info("No Anthropic credentials: co-pilot runs in offline mode")
        return None
    try:
        import anthropic
        return anthropic.AsyncAnthropic(timeout=25.0, max_retries=1)
    except Exception as e:   # missing package or no credentials
        log.info("Claude unavailable: %s", e)
        return None


_CLIENT = None


def client():
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = _client() or False
    return _CLIENT or None


# ---------- context ----------

def build_context(machine_id: str) -> Dict:
    ms = engine.state(machine_id)
    t = ms.last or {}
    op = ms.operator or {}
    tasks = insights.tasks_for(machine_id=machine_id)
    recent = db.query("SELECT ts, type, severity, message FROM incidents WHERE machine_id = ? "
                      "ORDER BY ts DESC LIMIT 8", [machine_id])
    shift = ms.shift.report(ms.machine_type, time.time())
    return {
        "machine": {"id": machine_id, "type": ms.machine_type, "online": ms.online},
        "operator": {"id": op.get("id"), "name": op.get("name"), "experienceYears": op.get("experience_yrs")},
        "now": {k: t.get(k) for k in ("engineOn", "seatbelt", "engineTempC", "obstacleCm", "slopeDeg",
                                      "speedKmh", "rpm", "oilPressurePsi", "vibration", "surface", "loadPct")},
        "mlPredictions": ms.predictions,
        "activeAlerts": [{"type": a["type"], "severity": a["severity"], "message": a["message"]}
                         for a in ms.alerts.values()],
        "recentIncidents": [{"minutesAgo": round((time.time() - r["ts"]) / 60), "type": r["type"],
                             "severity": r["severity"], "message": r["message"]} for r in recent],
        "tasksToday": [{"id": x["id"], "task": x["task_type"], "site": x["site"], "volumeM3": x["volume_m3"],
                        "status": x["status"], "predictedMinutes": x["predicted_minutes"],
                        "range": [x["predicted_low"], x["predicted_high"]],
                        "mainFactors": (x.get("factors") or [])[:3], "pace": x.get("pace")} for x in tasks],
        "position": {**(ms.pos or {}), "zone": ms.zone},
        "nearbyMachines": engine.nearby(ms, 150),
        "shiftSoFar": {k: shift[k] for k in ("durationMin", "idlePct", "fuelL", "loadCycles",
                                             "seatbeltCompliancePct", "overspeedMin", "alertCount")},
        "safetyScore": insights.safety_score(op["id"]) if op.get("id") else None,
    }


# ---------- Claude call ----------

async def _ask_claude(messages: List[Dict], max_tokens: int = 600) -> Optional[str]:
    global _CLIENT
    c = client()
    if not c:
        return None
    import anthropic
    try:
        resp = await c.beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low"},   # voice needs fast answers; the task is lookup + explain
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=messages,
        )
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as e:
        log.warning("Claude auth failed, using offline co-pilot: %s", e)
        _CLIENT = False
        return None
    except anthropic.APIStatusError as e:
        log.warning("Claude API error %s: %s", e.status_code, e.message)
        return None
    except anthropic.APIConnectionError as e:
        log.warning("Claude unreachable: %s", e)
        return None
    except TypeError as e:              # no credentials configured at all
        log.info("Claude not configured: %s", e)
        _CLIENT = False
        return None
    if resp.stop_reason == "refusal":
        return None
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    return text or None


def _user_turn(context: Dict, text: str, lang: str) -> Dict:
    language = LANG_NAMES.get(lang, "English")
    return {"role": "user", "content": f"<context>\n{json.dumps(context, default=str)}\n</context>\n\n"
                                       f"Reply in {language}.\n\nOperator: {text}"}


# ---------- public API ----------

SOS_WORDS = ("sos", "emergency", "mayday", "help me", "call help", "i am hurt", "i'm hurt", "bachao", "madad")


async def chat(machine_id: str, message: str, history: List[Dict], lang: str = "en") -> Dict:
    if any(w in message.lower() for w in SOS_WORDS):
        ms = engine.state(machine_id)
        sos = await engine.trigger_sos(ms, f"Operator called for help by voice: \"{message}\"")
        n = len(sos["nearby"]) if sos else 0
        return {"reply": f"SOS sent to the supervisor and {n} nearby machine{'s' if n != 1 else ''}. "
                         "Stay in the cab with your seatbelt on unless there is fire. Help is coming.",
                "source": "sos", "sos": sos}
    ctx = build_context(machine_id)
    msgs = [{"role": h["role"], "content": h["content"]} for h in history[-8:]
            if h.get("role") in ("user", "assistant") and h.get("content")]
    msgs.append(_user_turn(ctx, message, lang))
    reply = await _ask_claude(msgs, 400)
    if reply:
        return {"reply": reply, "source": "claude"}
    return {"reply": offline_answer(ctx, message), "source": "offline"}


async def briefing(machine_id: str, lang: str = "en") -> Dict:
    ctx = build_context(machine_id)
    ask = ("Give me my start-of-shift briefing: greet me by name, today's tasks with estimated times "
           "and the biggest factor for each, total planned time, anything about the machine I should "
           "watch, and one safety reminder based on my recent incidents. Under 120 words.")
    reply = await _ask_claude([_user_turn(ctx, ask, lang)], 700)
    if reply:
        return {"reply": reply, "source": "claude"}
    return {"reply": offline_briefing(ctx), "source": "offline"}


async def shift_summary(report: Dict, lang: str = "en") -> Dict:
    ask = ("Write the end-of-shift summary for the operator and their supervisor from this shift "
           "report: 2 sentences on overall performance, then what went well, then 2 specific, "
           "actionable improvements for next shift, then a one-line coaching tip. Plain text, "
           "under 150 words. Use the numbers.")
    msg = {"role": "user", "content": f"<context>\n{json.dumps(report, default=str)}\n</context>\n\n"
                                      f"Reply in {LANG_NAMES.get(lang, 'English')}.\n\n{ask}"}
    reply = await _ask_claude([msg], 800)
    if reply:
        return {"summary": reply, "source": "claude"}
    return {"summary": offline_summary(report), "source": "offline"}


# ---------- offline fallback ----------

def _alerts_text(ctx: Dict) -> Optional[str]:
    alerts = sorted(ctx["activeAlerts"], key=lambda a: a["severity"] != "critical")
    if not alerts:
        return None
    a = alerts[0]
    action = {
        "seatbelt": "Fasten your seatbelt now.",
        "proximity": "Stop moving. Someone or something is very close to the machine.",
        "camera_person": "Stop. The camera sees a person near the machine.",
        "overheat": "Reduce load and let the engine idle down to cool.",
        "overheat_predicted": "Ease off the load now so the engine does not overheat.",
        "unsafe_tilt": "Stop and move to flatter ground. Keep the bucket low.",
        "geofence": "Stop and move out of the marked zone.",
        "machine_proximity": "Another machine is close. Stop and radio them before moving.",
        "no_inspection": "Complete the pre-start inspection on the screen.",
        "sos": "Help has been called. Stay in the cab with your seatbelt on unless there is fire.",
        "sos_nearby": "A nearby machine needs help. Make your machine safe, then respond on the screen.",
        "engine_fault": "Finish the current cycle safely and report the fault to maintenance.",
        "overspeed": "Slow down to the advised speed for this terrain.",
        "idling": "If you are waiting, shut the engine down to save fuel.",
        "drowsy": "Stop the machine safely and take a short break.",
        "anomaly": "Your recent operating pattern looks unusual. Check idling and smooth operation.",
    }.get(a["type"], "Check the alert on screen.")
    n = len(alerts) - 1
    more = f" There {'is' if n == 1 else 'are'} {n} other active alert{'s' if n > 1 else ''}." if n else ""
    msg = a["message"].rstrip(". ")
    if a["type"] == "overheat_predicted" and ctx["mlPredictions"].get("overheatEtaSec"):
        msg = f"Engine will reach 110 degrees in about {ctx['mlPredictions']['overheatEtaSec'] / 60:.1f} minutes"
    return f"{msg}. {action}{more}"


def offline_answer(ctx: Dict, message: str) -> str:
    m = message.lower()
    now, pred = ctx["now"], ctx["mlPredictions"]
    critical = [a for a in ctx["activeAlerts"] if a["severity"] == "critical"]
    prefix = (_alerts_text(ctx) + " ") if critical and not any(w in m for w in ("alert", "why", "warning")) else ""

    if any(w in m for w in ("alert", "why", "warning", "problem", "wrong")):
        return _alerts_text(ctx) or "No active alerts. Everything looks normal."
    if any(w in m for w in ("task", "time", "left", "finish", "long", "schedule")):
        pending = [t for t in ctx["tasksToday"] if t["status"] != "done"]
        if not pending:
            return prefix + "All of today's tasks are done. Good work."
        t = next((x for x in pending if x["status"] == "in_progress"), pending[0])
        pace = t.get("pace") or {}
        if pace.get("projectedMinutes"):
            d = pace["deltaMin"]
            state = f"{abs(d):.0f} minutes {'behind' if d > 0 else 'ahead of'} plan"
            return prefix + (f"{t['task']} at {t['site']} is {pace['progressPct']:.0f} percent done, "
                             f"on track for {pace['projectedMinutes']:.0f} minutes, {state}.")
        return prefix + (f"Next is {t['task']} at {t['site']}, estimated {t['predictedMinutes']:.0f} minutes. "
                         f"{len(pending)} tasks left today.")
    if any(w in m for w in ("slope", "speed", "safe", "terrain", "fast")):
        return prefix + (f"Slope is {now.get('slopeDeg') or 0:.0f} degrees. Advised speed is "
                         f"{pred.get('optimalSpeedKmh', 0)} kilometres per hour, you are at "
                         f"{now.get('speedKmh') or 0:.1f}. {pred.get('advisory', '')}")
    if any(w in m for w in ("engine", "temp", "heat", "oil", "fault")):
        eta = pred.get("overheatEtaSec")
        eta_txt = f" At this rate it reaches 110 degrees in about {eta / 60:.0f} minutes." if eta else ""
        return prefix + (f"Engine is at {now.get('engineTempC') or 0:.0f} degrees, oil pressure "
                         f"{now.get('oilPressurePsi') or 0:.0f} psi. The fault model says "
                         f"{(pred.get('fault') or 'normal').replace('_', ' ')}.{eta_txt}")
    if any(w in m for w in ("score", "training", "improve")):
        s = ctx["safetyScore"] or {}
        return prefix + (f"Your safety score is {s.get('score', 'not available')} out of 100 with "
                         f"{s.get('incidents7d', 0)} incidents this week. Check the Training page for "
                         f"recommended modules.")
    if any(w in m for w in ("shift", "summary", "report", "fuel", "idle")):
        s = ctx["shiftSoFar"]
        return prefix + (f"This shift: {s['durationMin']:.0f} minutes, idling {s['idlePct']:.0f} percent, "
                         f"{s['fuelL']:.1f} litres of fuel, {s['loadCycles']} load cycles, "
                         f"seatbelt compliance {s['seatbeltCompliancePct']:.0f} percent.")
    status = _alerts_text(ctx) or "No active alerts."
    return (f"{status} Engine {now.get('engineTempC') or 0:.0f} degrees, slope "
            f"{now.get('slopeDeg') or 0:.0f} degrees, obstacle {(now.get('obstacleCm') or 0) / 100:.1f} "
            f"metres away. Ask me about alerts, tasks, terrain, the engine or your shift.")


def offline_briefing(ctx: Dict) -> str:
    name = (ctx["operator"].get("name") or "operator").split()[0]
    tasks = [t for t in ctx["tasksToday"] if t["status"] != "done"]
    total = sum(t["predictedMinutes"] or 0 for t in tasks)
    parts = [f"Good morning {name}. You have {len(tasks)} tasks today, about {total / 60:.1f} hours of work."]
    for t in tasks[:4]:
        f = (t.get("mainFactors") or [{}])[0]
        why = f", mostly due to {f['label']}" if f.get("label") and f.get("deltaMin", 0) > 3 else ""
        parts.append(f"{t['task'].capitalize()} at {t['site']}, about {t['predictedMinutes']:.0f} minutes{why}.")
    s = ctx["safetyScore"] or {}
    by = s.get("byType") or {}
    if by:
        top = max(by, key=by.get)
        parts.append(f"Your most frequent alert this week was {top.replace('_', ' ')}. Stay alert to it.")
    parts.append("Wear your seatbelt and check your mirrors before every swing.")
    return " ".join(parts)


def offline_summary(r: Dict) -> str:
    s, sc = r["stats"], r["scores"]
    name = ((r.get("operator") or {}).get("name") or "The operator").split()[0]
    lines = [f"{name} worked {s['durationMin']:.0f} minutes on {r['machineId']} with grade {sc['grade']} "
             f"(safety {sc['safety']}, efficiency {sc['efficiency']}). "
             f"{r['tasks']['done']} of {r['tasks']['total']} tasks done, {s['loadCycles']} load cycles, "
             f"{s['fuelL']} L fuel."]
    if r["highlights"]:
        lines.append("Went well: " + "; ".join(r["highlights"]) + ".")
    if r["improve"]:
        lines.append("Improve: " + "; ".join(r["improve"][:2]) + ".")
    tip = ("Shut the engine down during waits longer than 5 minutes." if s["idlePct"] > 15 else
           "Keep to the advised speed on slopes." if s["overspeedMin"] > 0 else
           "Keep up the steady, safe operation.")
    lines.append("Tip: " + tip)
    return " ".join(lines)
