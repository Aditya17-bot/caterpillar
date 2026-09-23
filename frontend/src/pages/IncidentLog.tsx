import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import StatusPill from '../components/common/StatusPill'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import BlackBoxJsx from '../legacy/BlackBox.jsx'

const BlackBox = BlackBoxJsx as any

export default function IncidentLog() {
  const incidents = useAppStore((s) => s.incidents)
  const [replay, setReplay] = useState<number | null>(null)

  return (
    <div className="p-space-lg flex flex-col gap-space-lg">
      <SectionCard variant="low" className="flex items-center justify-between">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded bg-error-container text-error flex items-center justify-center">
            <Icon name="assignment_late" className="text-[24px]" />
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-tight">Incident Log</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">ISO 45001 / MSHA compliant incident register.</p>
          </div>
        </div>
        <span className="font-label-sm text-label-sm text-outline uppercase">{incidents.length} Total Records</span>
      </SectionCard>

      <div className="flex flex-col gap-space-md">
        {incidents.map((i) => (
          <SectionCard key={i.id} className="flex flex-col gap-space-sm">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex items-center gap-2">
                <span className="font-headline-md text-body-lg text-on-surface font-bold">{i.id}</span>
                <StatusPill label={i.category.replace('_', ' ')} token={i.severity === 'critical' ? 'error' : 'primary'} />
                <StatusPill label={i.status.replace('_', ' ')} token={i.status === 'resolved' ? 'tertiary' : 'secondary'} />
              </div>
              <span className="font-body-md text-[11px] text-outline font-mono">{i.timestamp}</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface">{i.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm font-body-md text-body-md text-on-surface-variant">
              <span>
                <strong className="text-on-surface">Machine:</strong> {i.machineId}
              </span>
              <span>
                <strong className="text-on-surface">Operator:</strong> {i.operatorId}
              </span>
              <span>
                <strong className="text-on-surface">Location:</strong> {i.location}
              </span>
              <span>
                <strong className="text-on-surface">Sensor Evidence:</strong> {i.sensorEvidence}
              </span>
            </div>
            <div className="bg-surface-container p-space-sm rounded flex items-center justify-between text-[11px] font-body-md">
              <span className="text-tertiary flex items-center gap-1 font-bold">
                <Icon name="task_alt" className="text-[15px]" />
                {i.actionTaken}
              </span>
              <span className="text-outline flex items-center gap-space-sm">
                {i.resolution}
                {i.hasBlackbox && i.backendId != null && (
                  <button
                    onClick={() => setReplay(i.backendId!)}
                    className="px-space-md py-1 rounded bg-primary-container text-on-primary-container font-label-md text-label-sm uppercase font-bold flex items-center gap-1 hover:bg-primary"
                  >
                    <Icon name="play_circle" className="text-[16px]" />
                    Black-box replay
                  </button>
                )}
              </span>
            </div>
          </SectionCard>
        ))}
      </div>
      {replay != null && (
        <div className="legacy">
          <BlackBox incidentId={replay} onClose={() => setReplay(null)} />
        </div>
      )}
    </div>
  )
}
