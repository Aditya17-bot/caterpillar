import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import StatusPill from '../components/common/StatusPill'
import { useAppStore } from '../store/useAppStore'
import TrainingHubJsx from '../legacy/pages/Training.jsx'

const TrainingHub = TrainingHubJsx as any

const categoryIcon: Record<string, string> = {
  safety: 'shield',
  machine_operation: 'precision_manufacturing',
  emergency_procedures: 'emergency',
  fuel_efficiency: 'local_gas_station',
  terrain_handling: 'landscape',
  maintenance_awareness: 'build_circle',
}

export default function OperatorTraining() {
  const training = useAppStore((s) => s.training)
  const operator = useAppStore((s) => s.operator)
  const backendOnline = useAppStore((s) => s.backendOnline)
  const openHub = () => document.getElementById('training-hub')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })

  return (
    <div className="p-space-lg flex flex-col gap-space-lg">
      <SectionCard variant="low" className="flex items-center justify-between">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded bg-primary-container text-on-primary-container flex items-center justify-center">
            <Icon name="school" className="text-[24px]" />
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-tight">Operator Training</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              AI-adaptive modules assigned to {operator.name} based on this shift's telemetry.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="font-label-sm text-label-sm text-outline uppercase">Safety Mastery XP</span>
          <div className="font-telemetry-xl text-telemetry-xl text-primary">{training.reduce((a, t) => a + (t.completed ? t.xp : 0), 0)}</div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        {training.map((t) => (
          <SectionCard key={t.id} className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Icon name={categoryIcon[t.category]} className="text-[16px]" />
                {t.moduleCode}
              </span>
              <StatusPill label={t.completed ? 'Completed' : 'New // Auto-Assigned'} token={t.completed ? 'tertiary' : 'primary'} />
            </div>
            <h4 className="font-headline-md text-body-lg text-on-surface font-bold">{t.title}</h4>
            <p className="font-body-md text-body-md text-on-surface-variant">
              <strong className="text-on-surface">Trigger Reason:</strong> {t.reason}
            </p>
            <div className="flex items-center gap-space-md text-on-surface-variant font-body-md text-[11px]">
              <span className="flex items-center gap-1">
                <Icon name="schedule" className="text-[14px] text-secondary" />
                {t.durationMin}-Minute Cab Simulator
              </span>
              <span className="flex items-center gap-1">
                <Icon name="military_tech" className="text-[14px] text-tertiary" />+{t.xp} XP
              </span>
            </div>
            {!t.completed && (
              <button disabled={!backendOnline} onClick={openHub} className="mt-1 w-full py-2.5 px-space-md bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-all font-headline-md text-label-md tracking-wider uppercase font-bold rounded flex items-center justify-center gap-2">
                <Icon name="play_arrow" className="text-[18px]" />
                {backendOnline ? 'Open training module' : 'Connect to access training'}
              </button>
            )}
          </SectionCard>
        ))}
      </div>

      {backendOnline && (
        <div id="training-hub" className="legacy">
          <TrainingHub operatorId={operator.id} />
        </div>
      )}
    </div>
  )
}
