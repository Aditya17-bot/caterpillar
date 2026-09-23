import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import TelemetryStat from '../components/common/TelemetryStat'
import ProgressBar from '../components/common/ProgressBar'
import StatusPill from '../components/common/StatusPill'
import AlertBanner from '../components/domain/AlertBanner'
import AIInsightPanel from '../components/domain/AIInsightPanel'
import ScenarioTriggerDeck from '../components/domain/ScenarioTriggerDeck'
import { useAppStore, selectActiveMachine } from '../store/useAppStore'
import { formatHMS } from '../lib/format'
import { getScenarioDefinition } from '../mock/scenarios'

export default function LiveOperation() {
  const navigate = useNavigate()
  const machine = useAppStore(selectActiveMachine)
  const activeTask = useAppStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId))
  const operator = useAppStore((s) => s.operator)
  const telemetry = useAppStore((s) => s.liveTelemetry)
  const speedRec = useAppStore((s) => s.speedRecommendation)
  const drowsiness = useAppStore((s) => s.drowsiness)
  const copilotMessage = useAppStore((s) => s.copilotMessage)
  const elapsedSec = useAppStore((s) => s.elapsedSec)
  const workCompleted = useAppStore((s) => s.workCompletedM3)
  const target = useAppStore((s) => s.targetVolumeM3)
  const operationRunning = useAppStore((s) => s.operationRunning)
  const activeScenario = useAppStore((s) => s.activeScenario)
  const alerts = useAppStore((s) => s.alerts)
  const triggerScenario = useAppStore((s) => s.triggerScenario)
  const resolveActiveEvent = useAppStore((s) => s.resolveActiveEvent)
  const startOperation = useAppStore((s) => s.startOperation)
  const completeTask = useAppStore((s) => s.completeTask)

  useEffect(() => {
    if (!operationRunning) startOperation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openAlert = alerts.find((a) => !a.resolved)
  const scenarioDef = getScenarioDefinition(activeScenario)
  const speedExceeded = telemetry.speedKmh > speedRec.recommendedSpeedKmh + 2

  return (
    <div className="flex flex-col w-full">
      {openAlert ? (
        <AlertBanner severity={openAlert.severity} title={openAlert.title} message={openAlert.message} tag="OVERRIDE ENGAGED" />
      ) : (
        <AlertBanner severity="info" title="All Systems Nominal" message="No active hazards detected across monitored subsystems." />
      )}

      <section className="w-full bg-surface-container-lowest px-margin-lg py-space-md shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-lg flex-wrap">
            <div className="flex items-center gap-space-sm bg-surface-container-high px-space-md py-space-xs rounded">
              <Icon name="forklift" className="text-primary text-[22px]" />
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">Active Machinery</span>
                <span className="font-headline-md text-headline-md text-primary leading-tight font-bold">
                  {machine.model.split(' ').slice(0, 2).join(' ')} <span className="font-body-md text-body-md text-on-surface-variant font-normal">#{machine.id}</span>
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">Current Job / Task</span>
              <span className="font-headline-md text-headline-md text-on-surface leading-tight font-bold">{activeTask?.title ?? '—'}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">Operator In Cab</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                <span className="font-headline-md text-headline-md text-on-surface font-semibold">{operator.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-space-xl flex-wrap">
            <div className="flex flex-col min-w-[200px]">
              <div className="flex justify-between font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1">
                <span>Payload Target</span>
                <span className="font-telemetry-md text-body-md text-primary font-bold">
                  {Math.round((workCompleted / target) * 100)}% ({workCompleted.toFixed(0)} / {target} m³)
                </span>
              </div>
              <ProgressBar pct={(workCompleted / target) * 100} />
            </div>
            <div className="flex items-center gap-space-md bg-surface-container-low px-space-md py-1.5 rounded">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase">Elapsed</span>
                <span className="font-telemetry-md text-telemetry-md text-on-surface">{formatHMS(elapsedSec)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="p-margin-lg grid grid-cols-12 gap-gutter-lg">
        <div className="col-span-12 xl:col-span-7 flex flex-col gap-space-md">
          <SectionCard variant="lowest" padding="md" className="relative overflow-hidden">
            <div className="flex items-center justify-between mb-space-sm px-space-sm">
              <div className="flex items-center gap-2">
                <Icon name="radar" className="text-secondary text-[20px]" />
                <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface font-bold">
                  Tactical LiDAR &amp; Site Viewport // {scenarioDef.label}
                </span>
              </div>
              <StatusPill label="LiDAR Active" token="primary" />
            </div>
            <div className="relative w-full h-[380px] bg-surface-container-lowest overflow-hidden rounded flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full opacity-40 text-secondary" viewBox="0 0 700 380">
                <defs>
                  <pattern id="grid" width="35" height="35" patternUnits="userSpaceOnUse">
                    <path d="M 35 0 L 0 0 0 35" fill="none" stroke="currentColor" strokeDasharray="2,2" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                <path d="M0,300 Q180,260 350,200 T700,90" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
                <path d="M0,340 Q220,300 420,240 T700,150" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" />
              </svg>
              <svg className="absolute" style={{ left: '38%', top: '48%' }} width="110" height="90" viewBox="0 0 120 70">
                <circle cx="20" cy="20" r="38" fill="none" className="text-primary-fixed" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
                <rect x="2" y="-4" width="36" height="10" rx="2" className="text-primary-container" fill="#262a33" stroke="currentColor" strokeWidth="1" />
                <rect x="6" y="4" width="28" height="32" rx="3" fill="#f59e0b" />
                <line x1="28" y1="20" x2="68" y2="12" stroke="#ffc174" strokeWidth="5" strokeLinecap="round" />
                <line x1="68" y1="12" x2="88" y2="2" stroke="#ffc174" strokeWidth="4" strokeLinecap="round" />
                <text x="-24" y="66" fill="#ffc174" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">
                  {machine.id}
                </text>
              </svg>
              {activeScenario === 'proximity_hazard' && (
                <svg className="absolute" style={{ left: '58%', top: '32%' }} width="60" height="60" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="22" fill="#93000a" fillOpacity="0.3" className="animate-ping" />
                  <rect x="0" y="2" width="32" height="28" rx="3" fill="#181c24" stroke="#ffb4ab" strokeWidth="2" />
                  <text x="-14" y="-6" fill="#ffb4ab" fontFamily="Inter" fontSize="10" fontWeight="700">
                    TRK-04
                  </text>
                </svg>
              )}
              {(activeScenario === 'steep_slope' || activeScenario === 'unsafe_operation') && (
                <div className="absolute top-4 left-4 bg-surface-container-high/90 px-space-md py-space-sm rounded">
                  <span className="font-headline-md text-label-md text-primary font-bold">GRADE: +{telemetry.slopeDeg}° UPHILL</span>
                </div>
              )}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between font-mono text-[10px] text-on-surface-variant">
                <span>SITE: 42°18'04.2"N 89°22'19.1"W</span>
                <span>SAT LOCK: 18 SVs</span>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-2 rounded">
            {['Blind Right', 'Trench Load', 'Cabin Cognitive'].map((label) => (
              <div key={label} className="relative bg-surface-container-lowest h-24 rounded overflow-hidden flex items-center justify-center">
                <Icon name="videocam" className="text-[28px] text-outline" />
                <div className="absolute top-1 left-2 flex items-center gap-1 bg-surface-container-high/90 px-1.5 py-0.2 rounded font-label-sm text-[9px] text-on-surface uppercase">
                  CAM // {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-5 flex flex-col gap-gutter-lg">
          <SectionCard variant="lowest" className="relative overflow-hidden">
            <div className="flex items-center justify-between pb-space-sm mb-space-md">
              <div className="flex items-center gap-2">
                <Icon name="psychology" className="text-primary-container text-[22px]" />
                <span className="font-headline-md text-headline-md uppercase text-primary font-bold">AI Smart Speed Copilot</span>
              </div>
              <span className="px-2 py-0.5 bg-surface-container-highest text-primary-fixed-dim font-label-sm text-label-sm rounded uppercase font-bold tracking-widest">
                MODEL: RF-CAT-V4.2
              </span>
            </div>

            <div className="grid grid-cols-2 gap-space-md mb-space-md">
              <div className={`p-space-md rounded flex flex-col items-center justify-center text-center ${speedExceeded ? 'bg-error-container' : 'bg-surface-container-high'}`}>
                <span className={`font-label-sm text-label-sm uppercase tracking-wider mb-1 ${speedExceeded ? 'text-on-error-container' : 'text-on-surface-variant'}`}>
                  Current Speed
                </span>
                <span className={`font-telemetry-xl text-display-lg font-bold ${speedExceeded ? 'text-error animate-pulse' : 'text-on-surface'}`}>
                  {Math.round(telemetry.speedKmh)}
                </span>
                <span className="font-telemetry-md text-telemetry-md text-on-surface-variant font-semibold">km/h</span>
              </div>
              <div className="bg-primary text-on-primary p-space-md rounded flex flex-col items-center justify-center text-center shadow-lg">
                <span className="font-label-sm text-label-sm uppercase tracking-wider mb-1 font-bold">AI Recommended</span>
                <span className="font-telemetry-xl text-display-lg font-extrabold">{Math.round(speedRec.recommendedSpeedKmh)}</span>
                <span className="font-telemetry-md text-telemetry-md font-bold">km/h</span>
              </div>
            </div>

            <AIInsightPanel
              title="Random Forest Explainability"
              modelBadge="LIVE"
              reason={speedRec.reason}
              confidencePct={speedRec.confidencePct}
              factors={speedRec.factors}
              metrics={[
                { label: 'Slope', value: `${speedRec.slopeDeg}°`, token: 'primary' },
                { label: 'Load', value: `${speedRec.loadPct}%`, token: 'secondary' },
                { label: 'Vibration', value: `${speedRec.vibrationG}G`, token: speedRec.vibrationG > 1.5 ? 'error' : 'tertiary' },
              ]}
            />

            <div className="mt-space-md p-space-md bg-surface-container-high rounded flex items-start gap-space-md shadow-inner">
              <div className="w-10 h-10 rounded bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                <Icon name="smart_toy" className="text-[24px]" />
              </div>
              <p className="font-body-lg text-body-lg text-on-surface font-medium leading-relaxed">{copilotMessage}</p>
            </div>
          </SectionCard>

          <SectionCard variant="lowest" className="grid grid-cols-2 gap-space-md">
            <TelemetryStat label="Engine Temp" value={`${Math.round(telemetry.engineTempC)}°C`} token={telemetry.engineTempC > 100 ? 'error' : 'primary'} />
            <TelemetryStat label="Oil Pressure" value={`${telemetry.oilPressurePsi} PSI`} token={telemetry.oilPressurePsi < 20 ? 'error' : 'tertiary'} />
            <TelemetryStat label="Vibration" value={`${telemetry.vibrationG.toFixed(2)}G`} token={telemetry.vibrationG > 1.5 ? 'error' : 'tertiary'} />
            <TelemetryStat label="Fuel" value={`${Math.round(telemetry.fuelPct)}%`} />
          </SectionCard>

          <SectionCard variant="lowest" className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between p-2 bg-surface-container rounded">
              <span className="font-label-md text-label-md uppercase text-on-surface flex items-center gap-2">
                <Icon name="psychology_alt" className="text-tertiary text-[20px]" />
                Drowsiness Engine
              </span>
              <StatusPill
                label={drowsiness.state === 'alert' ? `Alert ${drowsiness.confidencePct}%` : drowsiness.state.toUpperCase()}
                token={drowsiness.state === 'alert' ? 'tertiary' : 'error'}
              />
            </div>
          </SectionCard>

          <div className="flex flex-col gap-space-sm">
            {openAlert && (
              <button
                onClick={resolveActiveEvent}
                className="w-full py-3 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-headline-md text-label-md uppercase tracking-wider font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <Icon name="check_circle" className="text-[20px]" />
                Apply AI Recommendation &amp; Resolve
              </button>
            )}
            <button
              onClick={() => {
                completeTask()
                navigate('/operation/debrief')
              }}
              className="w-full py-3 bg-surface-container-high text-on-surface hover:bg-surface-bright font-headline-md text-label-md uppercase tracking-wider font-bold rounded flex items-center justify-center gap-2 transition-all"
            >
              <Icon name="flag" className="text-[20px]" />
              Complete Task &amp; View Debrief
            </button>
          </div>
        </div>
      </div>

      <div className="px-margin-lg pb-margin-lg">
        <ScenarioTriggerDeck activeScenario={activeScenario} onTrigger={triggerScenario} />
      </div>
    </div>
  )
}
