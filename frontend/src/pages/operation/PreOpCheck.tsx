import { useNavigate } from 'react-router-dom'
import Icon from '../../components/common/Icon'
import SectionCard from '../../components/common/SectionCard'
import StatusPill from '../../components/common/StatusPill'
import SafetyChecklistItem from '../../components/domain/SafetyChecklistItem'
import AIInsightPanel from '../../components/domain/AIInsightPanel'
import { useAppStore, selectActiveMachine } from '../../store/useAppStore'
import { getTaskTimePrediction } from '../../services/predictionService'
import { useLiveData } from '../../services/useBackendSync'
import InspectionJsx from '../../legacy/Inspection.jsx'

const Inspection = InspectionJsx as any

export default function PreOpCheck() {
  const navigate = useNavigate()
  const machine = useAppStore(selectActiveMachine)
  const operator = useAppStore((s) => s.operator)
  const activeTask = useAppStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId))
  const checklist = useAppStore((s) => s.preOpChecklist)
  const startOperation = useAppStore((s) => s.startOperation)
  const backendOnline = useAppStore((s) => s.backendOnline)
  const live = useLiveData()
  const passCount = checklist.filter((c) => c.state === 'pass').length
  const inspection = machine.inspectionStatus
  // live: the walk-around must be done and nothing may be failing; warnings are allowed
  const allPass = backendOnline
    ? inspection !== 'pending' && inspection !== 'locked' && !checklist.some((c) => c.state === 'fail')
    : passCount === checklist.length
  const prediction = getTaskTimePrediction(activeTask)
  const slope = Math.abs(machine.telemetry.slopeDeg)

  return (
    <div className="p-space-lg flex flex-col gap-space-lg">
      <SectionCard className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <span className="px-2 py-0.5 bg-primary-container text-on-primary-container font-label-sm text-label-sm uppercase tracking-wider rounded font-bold self-start">
            Pre-Operation Safety Check &amp; Readiness
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            {machine.id} ({machine.model}) — {operator.name}
          </h1>
        </div>
        <div className="flex items-center gap-space-md bg-surface-container px-space-lg py-2.5 rounded shadow-sm">
          <StatusPill label={allPass ? 'Machine Ready // All Pre-Checks Passed' : 'Checks In Progress'} token={allPass ? 'tertiary' : 'primary'} pulse />
          <span className="font-telemetry-md text-telemetry-md text-tertiary font-bold">
            {passCount}/{checklist.length}
          </span>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className="xl:col-span-8 flex flex-col gap-space-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            {checklist.map((item) => (
              <SafetyChecklistItem key={item.id} item={item} />
            ))}
          </div>
          {backendOnline && inspection !== 'done' && (
            <div className="legacy">
              {inspection === 'locked' ? (
                <div className="card">
                  <h3>Machine locked out</h3>
                  <p>A critical defect was reported. Maintenance must release the machine (Maintenance page).</p>
                </div>
              ) : (
                <Inspection machineId={machine.id} machine={live?.machines?.[machine.id]} inline />
              )}
            </div>
          )}
        </div>

        <div className="xl:col-span-4 flex flex-col gap-space-lg">
          <AIInsightPanel
            title="AI Pre-Flight Prediction Deck"
            modelBadge="MODEL V4.9"
            reason={
              backendOnline
                ? `Task-time Random Forest and speed model on live conditions: ${activeTask?.soilType ?? ''} soil, ${activeTask?.weather ?? 'clear'} weather, slope ${machine.telemetry.slopeDeg}°.`
                : 'Neural model calibrated against historical cuts in this sector. Geological compaction factors folded into hydraulic duty cycle.'
            }
            metrics={[
              { label: 'Est. Duration', value: `${prediction.aiEstimateMin} min`, token: 'primary' },
              { label: 'Typical', value: `${prediction.historicalAverageMin} min` },
              { label: 'Rec. Speed', value: backendOnline ? `${machine.telemetry.recommendedSpeedKmh} km/h` : '18 km/h', token: 'secondary' },
              { label: 'Slip Risk', value: slope > 20 ? 'HIGH' : slope > 12 ? 'MEDIUM' : 'LOW', token: slope > 20 ? 'error' : slope > 12 ? 'primary' : 'tertiary' },
            ]}
          />
        </div>
      </div>

      <SectionCard variant="default" className="flex flex-col lg:flex-row items-center justify-between gap-space-lg shadow-xl">
        <div className="flex items-center gap-space-lg w-full lg:w-auto">
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md text-on-surface uppercase font-bold tracking-tight">
              {allPass ? 'Dispatch Authorization Granted' : 'Awaiting Full Interlock Clearance'}
            </span>
            <span className="font-body-md text-body-md text-on-surface-variant mt-1">
              {allPass
                ? 'All physical and digital interlocks cleared. Primary CAN-bus ignition relay primed for operator authorization.'
                : 'Resolve outstanding checklist items before starting the operation.'}
            </span>
          </div>
        </div>
        <button
          disabled={!allPass}
          onClick={() => {
            startOperation()
            navigate('/live-operation')
          }}
          className={`w-full lg:w-auto px-space-xl py-3.5 font-headline-md text-label-md tracking-wider uppercase font-bold rounded flex items-center justify-center gap-space-md shadow-md transition-all ${
            allPass ? 'bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary' : 'bg-surface-container-high text-outline cursor-not-allowed'
          }`}
        >
          <span>Start Operation // Engage Telemetry</span>
          <Icon name="arrow_forward" className="text-[22px]" />
        </button>
      </SectionCard>
    </div>
  )
}
