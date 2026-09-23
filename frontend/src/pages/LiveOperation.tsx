import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import PageHeader from '../components/common/PageHeader'
import ProgressBar from '../components/common/ProgressBar'
import ScenarioTriggerDeck from '../components/domain/ScenarioTriggerDeck'
import {
  SpeedGauge,
  TiltIndicator,
  ProximityRadar,
  StatusLight,
} from '../components/instruments/Instruments'
import { useAppStore, selectActiveMachine } from '../store/useAppStore'
import { formatHMS } from '../lib/format'
import { alertFromBackend } from '../services/backend'
import { useLiveData } from '../services/useBackendSync'
import SiteMapJsx from '../legacy/pages/SiteMap.jsx'
import type { AlertCategory, AlertItem } from '../types/domain'

const SiteMap = SiteMapJsx as any
const instructions: Partial<Record<AlertCategory, string>> = {
  seatbelt: 'Stop safely and fasten your seatbelt.',
  proximity: 'Stop movement and check the surrounding area.',
  slope: 'Stop safely and reposition on stable ground.',
  drowsiness: 'Stop safely and take a rest break.',
  overheat: 'Reduce load and stop safely to check the engine.',
  oil_pressure: 'Stop safely and request maintenance.',
  overspeed: 'Reduce speed to the AI-advised limit.',
  engine: 'Stop safely and review the engine fault.',
}
export default function LiveOperation() {
  const navigate = useNavigate()
  const machine = useAppStore(selectActiveMachine)
  const activeTask = useAppStore((s) =>
    s.tasks.find((t) => t.id === s.selectedTaskId),
  )
  const telemetry = useAppStore((s) => s.liveTelemetry)
  const speedRec = useAppStore((s) => s.speedRecommendation)
  const drowsiness = useAppStore((s) => s.drowsiness)
  const copilotMessage = useAppStore((s) => s.copilotMessage)
  const elapsedSec = useAppStore((s) => s.elapsedSec)
  const workCompleted = useAppStore((s) => s.workCompletedM3)
  const target = useAppStore((s) => s.targetVolumeM3)
  const operationRunning = useAppStore((s) => s.operationRunning)
  const activeScenario = useAppStore((s) => s.activeScenario)
  const acknowledgedIds = useAppStore(s => s.acknowledgedAlertIds)
  const alerts = useAppStore((s) => s.alerts)
  const triggerScenario = useAppStore((s) => s.triggerScenario)
  const acknowledgeAlert = useAppStore((s) => s.acknowledgeAlert)
  const resolveActiveEvent = useAppStore((s) => s.resolveActiveEvent)
  const startOperation = useAppStore((s) => s.startOperation)
  const completeTask = useAppStore((s) => s.completeTask)
  const backendOnline = useAppStore((s) => s.backendOnline)
  const selectMachine = useAppStore((s) => s.selectMachine)
  const interlocks = useAppStore((s) => s.interlockSensors)
  const live = useLiveData()
  useEffect(() => {
    if (!operationRunning) startOperation()
  }, [])
  // The snapshot may contain hazards raised before this browser connected.
  const snapshotAlerts: AlertItem[] = backendOnline
    ? (live?.machines?.[machine.id]?.activeAlerts ?? []).map((a: any) => {
        const id = `${a.machineId}-${a.type}-${a.ts}`
        return alertFromBackend(a, true, acknowledgedIds.includes(id))
      })
    : []
  const activeAlerts = [...snapshotAlerts, ...alerts.filter(a => !snapshotAlerts.some((item: { id: string }) => item.id === a.id))]
    .filter(a => !a.resolved && (!a.machineId || a.machineId === machine.id))
  const critical = activeAlerts.find(
    (a) => a.severity === 'critical' && !a.acknowledged,
  )
  const eta = machine.ml?.overheatEtaSec
  const belt = backendOnline
    ? machine.seatbelt == null
      ? undefined
      : machine.seatbelt
    : interlocks.find((i) => i.id === 'seatbelt')?.state === 'pass'
  const zone = backendOnline
    ? !!machine.zone
    : interlocks.find((i) => i.id === 'geofence')?.state === 'fail'
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        eyebrow={`${machine.id} / ${machine.model}`}
        title="Live operation"
        description={activeTask?.title ?? 'Select a task from your schedule.'}
        action={
          <button
            className="btn-secondary"
            onClick={() => window.dispatchEvent(new Event('cab:toggle'))}
          >
            <Icon name="fullscreen" className="text-xl" />
            Cab view
          </button>
        }
      />
      {machine.online === false && backendOnline && (
        <div className="panel rounded-xl p-4 text-primary" role="status">
          Telemetry interrupted for {machine.id}. Readings may be stale; check
          the machine connection.
        </div>
      )}
      {critical && (
        <section
          className="alert-takeover flex flex-wrap items-center gap-5"
          role="alert"
          aria-label="Critical safety alert"
        >
          <Icon name="report" filled className="text-5xl" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs uppercase font-bold tracking-widest">
              Critical · {critical.title}
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold mt-2">
              {instructions[critical.category] ??
                'Stop safely and review the hazard.'}
            </h2>
            <p className="mt-2 text-white/90">{critical.message}</p>
          </div>
          <button
            className="bg-white text-[#8b1720] rounded-xl px-6 py-4 font-bold"
            onClick={() => acknowledgeAlert(critical.id)}
          >
            Acknowledge
          </button>
        </section>
      )}
      {activeAlerts.filter((a) => a.id !== critical?.id).length > 0 && (
        <div className="space-y-2" aria-label="Active hazards">
          {activeAlerts
            .filter((a) => a.id !== critical?.id)
            .map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-3 flex flex-wrap items-center gap-3 ${a.severity === 'critical' ? 'border-error/50 bg-error-container/25 text-error' : 'border-primary/30 bg-primary/5 text-primary'}`}
              >
                <Icon name="warning" className="text-xl" />
                <span className="font-semibold text-sm">{a.title}</span>
                <span className="text-sm text-on-surface-variant flex-1">
                  {a.message}
                </span>
                <span className="text-xs font-bold">
                  {a.acknowledged
                    ? 'Acknowledged · hazard still active'
                    : a.severity.toUpperCase()}
                </span>
                {!a.acknowledged && (
                  <button
                    className="text-sm underline px-2"
                    onClick={() => acknowledgeAlert(a.id)}
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
      {!activeAlerts.length && (
        <div className="flex items-center gap-2 text-tertiary text-sm">
          <Icon name="verified_user" className="text-lg" />
          No active alerts for {machine.id}
          <span className="text-on-surface-variant ml-auto text-xs">
            {backendOnline ? 'Live telemetry' : 'Demo readings'} ·{' '}
            {formatHMS(elapsedSec)} elapsed
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusLight
          label="Seatbelt"
          value={belt == null ? 'No reading' : belt ? 'Fastened' : 'Unfastened'}
          state={belt == null ? 'unknown' : belt ? 'ok' : 'warn'}
        />
        <StatusLight
          label="Work zone"
          value={zone ? 'Zone alert · check map' : 'No zone alert'}
          state={zone ? 'warn' : 'ok'}
        />
        <StatusLight
          label="Operator attention"
          value={
            drowsiness.state === 'alert'
              ? 'No fatigue alert'
              : drowsiness.state === 'drowsy'
                ? 'Drowsiness detected'
                : 'Face not detected'
          }
          state={
            drowsiness.state === 'alert'
              ? 'ok'
              : drowsiness.state === 'no_face'
                ? 'unknown'
                : 'warn'
          }
        />
      </div>
      <div className="hud-grid">
        <SectionCard className="!bg-[#151d28]">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Speed guidance</h2>
            <span className="eyebrow text-tertiary flex items-center gap-1">
              <Icon name="psychology" className="text-lg" />
              AI advised
            </span>
          </div>
          <SpeedGauge
            speed={telemetry.speedKmh}
            advised={speedRec.recommendedSpeedKmh}
          />
          <div className="bg-tertiary/10 border border-tertiary/25 rounded-xl px-5 py-3 flex items-center justify-between">
            <span className="text-tertiary text-sm font-semibold">
              Advised for current terrain
            </span>
            <span className="instrument-value text-3xl text-tertiary font-bold">
              {speedRec.recommendedSpeedKmh.toFixed(1)}{' '}
              <small className="text-sm">km/h</small>
            </span>
          </div>
          <p className="mt-4 text-sm text-on-surface-variant leading-relaxed">
            {speedRec.reason}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {speedRec.factors.slice(0, 3).map((f) => (
              <span
                key={f.label}
                className="text-xs px-2 py-1 rounded bg-surface-container-high text-on-surface-variant"
              >
                {f.label}
              </span>
            ))}
          </div>
        </SectionCard>
        <div className="grid grid-cols-2 gap-4">
          <SectionCard className="col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">Engine temperature</h2>
              <Icon
                name="device_thermostat"
                className="text-primary text-2xl"
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div
                className={`instrument-value text-5xl font-bold ${telemetry.engineTempC > 100 ? 'text-error' : ''}`}
              >
                {telemetry.engineTempC.toFixed(0)}
                <span className="text-xl text-on-surface-variant"> °C</span>
              </div>
              <div className="text-right">
                <p className="eyebrow">Overheat forecast</p>
                <p
                  className={`instrument-value text-2xl mt-1 ${eta != null ? 'text-error' : 'text-on-surface-variant'}`}
                >
                  {eta != null
                    ? `${Math.floor(Math.max(0, eta) / 60)}:${String(Math.floor(Math.max(0, eta) % 60)).padStart(2, '0')}`
                    : '—'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar
                pct={Math.min(100, (telemetry.engineTempC / 120) * 100)}
                token={telemetry.engineTempC > 100 ? 'error' : 'primary'}
              />
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant mt-2">
              <span>
                {eta != null
                  ? 'Estimated time to 110°C'
                  : 'No overheat forecast available'}
              </span>
              <span>Critical &gt;110°C</span>
            </div>
          </SectionCard>
          <SectionCard>
            <h2 className="font-bold mb-2">Machine attitude</h2>
            <TiltIndicator slope={telemetry.slopeDeg} />
          </SectionCard>
          <SectionCard>
            <h2 className="font-bold mb-2">Proximity radar</h2>
            <ProximityRadar distance={machine.obstacleCm} />
          </SectionCard>
        </div>
      </div>
      <section className="panel rounded-xl p-5 flex items-start gap-4 bg-primary/5">
        <div className="bg-primary text-on-primary p-2 rounded-lg">
          <Icon name="graphic_eq" className="text-2xl" />
        </div>
        <div className="flex-1">
          <h2 className="eyebrow text-primary mb-2">Your co-pilot</h2>
          <p className="text-lg leading-relaxed">{copilotMessage}</p>
        </div>
        <button
          className="btn-secondary hidden md:inline-flex"
          onClick={() => window.dispatchEvent(new Event('copilot:toggle'))}
        >
          Ask co-pilot
        </button>
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <SectionCard>
          <div className="flex justify-between mb-4">
            <h2 className="font-bold">Live site map</h2>
            <button
              onClick={() => navigate('/site-map')}
              className="text-sm text-primary"
            >
              Open map ↗
            </button>
          </div>
          {backendOnline && live ? (
            <div className="legacy">
              <SiteMap
                live={live}
                machineId={machine.id}
                setMachineId={selectMachine}
                compact
                height={300}
              />
            </div>
          ) : (
            <div className="relative w-full h-[300px] bg-surface-container-lowest overflow-hidden rounded flex items-center justify-center">
              <svg
                className="absolute inset-0 w-full h-full opacity-40 text-secondary"
                viewBox="0 0 700 380"
              >
                <defs>
                  <pattern
                    id="grid"
                    width="35"
                    height="35"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 35 0 L 0 0 0 35"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="2,2"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                <path
                  d="M0,300 Q180,260 350,200 T700,90"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
                <path
                  d="M0,340 Q220,300 420,240 T700,150"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="1"
                />
              </svg>
              <svg
                overflow="visible"
                className="absolute"
                style={{ left: '38%', top: '48%' }}
                width="110"
                height="90"
                viewBox="0 0 120 70"
              >
                <circle
                  cx="20"
                  cy="20"
                  r="38"
                  fill="none"
                  className="text-primary-fixed"
                  stroke="currentColor"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
                <rect
                  x="2"
                  y="-4"
                  width="36"
                  height="10"
                  rx="2"
                  className="text-primary-container"
                  fill="#262a33"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <rect
                  x="6"
                  y="4"
                  width="28"
                  height="32"
                  rx="3"
                  fill="#f59e0b"
                />
                <line
                  x1="28"
                  y1="20"
                  x2="68"
                  y2="12"
                  stroke="#ffc174"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <line
                  x1="68"
                  y1="12"
                  x2="88"
                  y2="2"
                  stroke="#ffc174"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <text
                  x="-24"
                  y="66"
                  fill="#ffc174"
                  fontFamily="JetBrains Mono"
                  fontSize="11"
                  fontWeight="700"
                >
                  {machine.id}
                </text>
              </svg>
              {activeScenario === 'proximity_hazard' && (
                <svg
                  overflow="visible"
                  className="absolute"
                  style={{ left: '58%', top: '32%' }}
                  width="60"
                  height="60"
                  viewBox="0 0 32 32"
                >
                  <circle
                    cx="16"
                    cy="16"
                    r="22"
                    fill="#93000a"
                    fillOpacity="0.3"
                    className="animate-ping"
                  />
                  <rect
                    x="0"
                    y="2"
                    width="32"
                    height="28"
                    rx="3"
                    fill="#181c24"
                    stroke="#ffb4ab"
                    strokeWidth="2"
                  />
                  <text
                    x="-14"
                    y="-6"
                    fill="#ffb4ab"
                    fontFamily="Inter"
                    fontSize="10"
                    fontWeight="700"
                  >
                    TRK-04
                  </text>
                </svg>
              )}
              {(activeScenario === 'steep_slope' ||
                activeScenario === 'unsafe_operation') && (
                <div className="absolute top-4 left-4 bg-surface-container-high/90 px-space-md py-space-sm rounded">
                  <span className="font-headline-md text-label-md text-primary font-bold">
                    GRADE: +{telemetry.slopeDeg}° UPHILL
                  </span>
                </div>
              )}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between font-mono text-[10px] text-on-surface-variant">
                <span>SITE OVERVIEW</span>
                <span>ILLUSTRATIVE DEMO MAP</span>
              </div>
            </div>
          )}
        </SectionCard>
        <SectionCard className="flex flex-col gap-5">
          <h2 className="font-bold">Shift progress</h2>
          <div>
            <div className="flex justify-between text-sm mb-3">
              <span>Material moved</span>
              <span className="instrument-value">
                {workCompleted.toFixed(0)} / {target} m³
              </span>
            </div>
            <ProgressBar
              pct={
                target > 0 ? Math.min(100, (workCompleted / target) * 100) : 0
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Fuel', `${telemetry.fuelPct.toFixed(0)}%`],
              ['Oil', `${telemetry.oilPressurePsi.toFixed(0)} psi`],
              ['Vibration', `${telemetry.vibrationG.toFixed(2)} g`],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="eyebrow">{label}</p>
                <p className="instrument-value text-lg mt-2">{value}</p>
              </div>
            ))}
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/cameras')}
          >
            <Icon name="videocam" className="text-xl" />
            Open safety cameras
          </button>
          <button
            className="btn-primary mt-auto"
            onClick={() => {
              completeTask()
              navigate('/operation/debrief')
            }}
          >
            <Icon name="flag" className="text-xl" />
            Complete task & review
          </button>
        </SectionCard>
      </div>
      <details className="demo-controls panel rounded-xl p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Demo controls · introduce a scenario
        </summary>
        <div className="mt-4">
          <ScenarioTriggerDeck
            activeScenario={activeScenario}
            onTrigger={triggerScenario}
          />
          {activeAlerts.length > 0 && (
            <button className="btn-secondary mt-4" onClick={resolveActiveEvent}>
              Reset simulated hazard
            </button>
          )}
        </div>
      </details>
    </div>
  )
}
