# Operator-first UI refresh

All implementation changes are inside `frontend/`. The backend adapter, backend sync,
zustand state/actions, domain types, API endpoints, payloads, and bundled fonts are unchanged.
No dependencies were added.

## Design decisions

- CAT yellow identifies primary actions; green/red always include labels and icons.
- Inter is for reading; JetBrains Mono is for measured values. Controls have visible
  focus states, and CSS motion respects reduced-motion preferences.
- Command Center starts with the operator, safety posture, machine readiness, and a
  single primary action: **Start shift → RFID**.
- Live Operation prioritizes speed/advised speed, engine forecast, attitude, proximity,
  and operator status. Cab view hides navigation; Escape restores it.
- Critical hazards stay visible while scrolling. Acknowledgement never clears a hazard
  or sends a simulator command. Resetting a simulation is explicitly a demo control.
- The stepper tracks **visited** pages, not completed safety checks. The restart control
  is no longer misleadingly labeled as an emergency stop.
- Legacy screens share the native palette, spacing, controls, tables, and modal styling.
- Empty backend-dependent views explain their connection requirement. No fake service
  records or safety readings are introduced. Missing sensor values display as unavailable.
- Schedule visualizes AI ranges and pace. Machine Health uses the existing WebSocket
  session history (up to 90 readings), replacing generated sparkline data.

## Verification — 2026-09-23

- `npm run build`: passes (TypeScript + Vite).
- All 19 routes checked in LIVE with the backend and all five simulated machines,
  then in DEMO with backend and simulator stopped. No uncaught application errors,
  horizontal page overflow, or axe WCAG 2 A/AA violations at 1280×800.
- Routes: `/`, `/schedule`, `/fleet`, `/live-operation`, `/safety`, `/machine-health`,
  `/analytics`, `/training`, `/incidents`, `/notifications`, `/site-map`, `/cameras`,
  `/shift`, `/maintenance`, `/supervisor`, `/operation/rfid`, `/operation/preop`,
  `/operation/debrief`, `/login`.
- Command Center and Live Operation visually checked at 1920×1080, 1280×800,
  and 390×844. Collapsed navigation checked at 800px. Reduced-motion mode checked.
- LIVE and DEMO: seatbelt scenario → critical takeover → acknowledge (hazard remains)
  → reset simulation; cab view and Escape; navigation. LIVE: machine switching,
  new-login inspection submission, black-box focus/Escape, and co-pilot briefing.
- Upstream operator login is preserved: simulated RFID, denied badge, simulated face
  login, session persistence, and desktop/mobile logout checked. Convex remains optional
  and its cloud-backed path was not configured for these local checks.
- Test backend ran from a temporary copy so generated data/models did not change this repo.

## Limits and follow-ups

- The unchanged connection layer emits expected connection-refused/WebSocket browser
  diagnostics while offline. No application exceptions were observed. Vite retains
  its existing large-chunk advisory for the bundled charts/vision dependencies.
- Camera detection still needs its existing external model downloads and camera
  permission. Device inference and speech recognition were not hardware-tested.
- Full historical REST backfill, light theme, an alert drawer, first-visit tooltips,
  operator badge history, and a dedicated SOS responder screen remain future work.
- Cab view expands within the browser; it does not request OS/browser fullscreen.
- On disconnect, the existing sync layer can retain last-received values. The header
  identifies the disconnected mode; this refresh does not alter fallback semantics.
