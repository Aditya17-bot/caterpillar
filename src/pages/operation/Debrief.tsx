import { useNavigate } from 'react-router-dom'
import Icon from '../../components/common/Icon'
import SectionCard from '../../components/common/SectionCard'
import KPICard from '../../components/common/KPICard'
import StatusPill from '../../components/common/StatusPill'
import { useAppStore, selectActiveMachine } from '../../store/useAppStore'
import { formatMin } from '../../lib/format'
import { getTaskTimePrediction } from '../../services/predictionService'

export default function Debrief() {
  const navigate = useNavigate()
  const machine = useAppStore(selectActiveMachine)
  const operator = useAppStore((s) => s.operator)
  const activeTask = useAppStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId))
  const elapsedSec = useAppStore((s) => s.elapsedSec)
  const workCompleted = useAppStore((s) => s.workCompletedM3)
  const target = useAppStore((s) => s.targetVolumeM3)
  const incidents = useAppStore((s) => s.incidents)
  const training = useAppStore((s) => s.training)
  const resetDemo = useAppStore((s) => s.resetDemo)

  const actualMin = Math.round(elapsedSec / 60) || 64
  const prediction = getTaskTimePrediction(activeTask?.id ?? 'TSK-8821', actualMin)
  const sessionIncidents = incidents.slice(0, 2)
  const newTraining = training.find((t) => !t.completed)

  return (
    <div className="p-space-lg flex flex-col gap-space-lg max-w-[1400px] mx-auto w-full">
      <SectionCard className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="bg-primary text-on-primary font-label-sm text-label-sm px-space-sm py-0.5 rounded tracking-widest font-extrabold uppercase">
              Mission Debrief
            </span>
            <StatusPill label="Mission Verified Complete" token="tertiary" pulse />
          </div>
          <h1 className="font-display-lg text-headline-lg text-primary tracking-tight uppercase mt-1">
            {activeTask?.title ?? 'Task'} — {machine.id}
          </h1>
          <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 text-on-surface-variant font-body-md text-body-md">
            <span>{activeTask?.id}</span>
            <span className="text-outline-variant">/</span>
            <span>{machine.model}</span>
            <span className="text-outline-variant">/</span>
            <span>{operator.name}</span>
            <span className="text-outline-variant">/</span>
            <span className="text-primary-fixed">Duration: {formatMin(elapsedSec)}</span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <div className="bg-surface-container px-space-md py-space-sm rounded flex flex-col justify-center">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Overall Grade</span>
            <span className="font-telemetry-xl text-telemetry-xl text-primary leading-none">98.4</span>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <KPICard label="Excavated Payload" value={workCompleted.toFixed(0)} unit="m³" icon="layers" token="secondary" progressPct={(workCompleted / target) * 100} sub={`Target: ${target} m³`} />
        <KPICard
          label="Model Prediction Accuracy"
          value={prediction.predictionErrorPct !== undefined ? `${(100 - Math.abs(prediction.predictionErrorPct)).toFixed(1)}%` : '—'}
          icon="psychology"
          token="primary"
          sub={`Pred: ${prediction.aiEstimateMin}m | Act: ${actualMin}m`}
        />
        <KPICard label="Fuel Burn" value={machine.telemetry.fuelPct} unit="%" icon="local_gas_station" token="tertiary" sub="Below baseline" />
        <KPICard label="Safety Interventions" value={sessionIncidents.length} unit="Events" icon="warning" token={sessionIncidents.length > 0 ? 'primary' : 'tertiary'} sub="Mitigated" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className="xl:col-span-7 flex flex-col gap-space-lg">
          <SectionCard>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-primary rounded-full" />
              <span className="font-headline-md text-headline-md text-on-surface uppercase">AI Prediction vs. Actual Performance</span>
            </div>
            <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-sm mt-space-md">
              <div className="flex justify-between text-[11px] font-body-md">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  AI Predicted Duration
                </span>
                <span className="font-mono text-secondary font-bold">{prediction.aiEstimateMin} min</span>
              </div>
              <div className="w-full bg-surface-container-highest h-3 rounded overflow-hidden">
                <div className="bg-secondary h-full rounded" style={{ width: '88%' }} />
              </div>
              <div className="flex justify-between text-[11px] font-body-md mt-1">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Actual Completion Time
                </span>
                <span className="font-mono text-primary font-bold">{actualMin} min</span>
              </div>
              <div className="w-full bg-surface-container-highest h-3 rounded overflow-hidden">
                <div className="bg-primary h-full rounded" style={{ width: '91%' }} />
              </div>
            </div>
          </SectionCard>

          {sessionIncidents.map((i) => (
            <SectionCard key={i.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="assignment_late" className="text-primary text-[20px]" />
                  <span className="font-headline-md text-headline-md text-on-surface uppercase">Automated Incident Record</span>
                </div>
                <span className="bg-error-container text-error font-label-sm text-label-sm px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                  {i.id}
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface mt-space-sm">{i.description}</p>
              <div className="bg-surface-container-low px-space-sm py-1.5 rounded flex items-center justify-between text-[11px] font-body-md mt-space-sm">
                <span className="text-tertiary flex items-center gap-1 font-bold">
                  <Icon name="task_alt" className="text-[15px]" />
                  {i.status === 'resolved' ? 'RESOLVED // ZERO DAMAGE // NO INJURY' : 'UNDER REVIEW'}
                </span>
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="xl:col-span-5 flex flex-col gap-space-lg">
          {newTraining && (
            <SectionCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="school" className="text-primary text-[20px]" />
                  <span className="font-headline-md text-headline-md text-on-surface uppercase">AI Adaptive Training Recommendation</span>
                </div>
              </div>
              <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs mt-space-sm">
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-bold">{newTraining.moduleCode}</span>
                <h4 className="font-headline-md text-[16px] text-on-surface">{newTraining.title}</h4>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  <strong className="text-on-surface">Trigger Reason:</strong> {newTraining.reason}
                </p>
              </div>
              <button
                onClick={() => navigate('/training')}
                className="w-full mt-space-sm py-2.5 px-space-md bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-all font-headline-md text-label-md tracking-wider uppercase font-bold rounded flex items-center justify-center gap-2"
              >
                <Icon name="play_arrow" className="text-[18px]" />
                Enroll in Training Module
              </button>
            </SectionCard>
          )}
        </div>
      </div>

      <SectionCard variant="low" className="flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm">
          <Icon name="flag" className="text-primary text-[24px]" />
          <span className="font-headline-md text-[14px] text-on-surface uppercase tracking-wide">
            Full end-to-end demo loop verified: Authentication → Scheduling → Telemetry → Auto-Mitigation → Debrief.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm shrink-0 w-full md:w-auto">
          <button
            onClick={() => {
              resetDemo()
              navigate('/operation/rfid')
            }}
            className="flex-1 md:flex-none py-2 px-space-md bg-surface-container-high text-primary hover:bg-surface-bright transition-all font-headline-md text-label-md tracking-wider uppercase font-bold rounded flex items-center justify-center gap-1.5"
          >
            <Icon name="replay" className="text-[18px]" />
            Replay Demo
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 md:flex-none py-2 px-space-md bg-primary text-on-primary hover:bg-primary-fixed transition-all font-headline-md text-label-md tracking-wider uppercase font-bold rounded flex items-center justify-center gap-1.5"
          >
            <Icon name="dashboard" className="text-[18px]" />
            Return to Command Center
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
