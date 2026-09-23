import { useLiveData } from '../services/useBackendSync'
import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import StatusPill from '../components/common/StatusPill'
import TelemetryStat from '../components/common/TelemetryStat'
import RadialGauge from '../components/common/RadialGauge'
import Sparkline from '../components/common/Sparkline'
import AIInsightPanel from '../components/domain/AIInsightPanel'
import { useAppStore } from '../store/useAppStore'
import { machineStatusToToken } from '../lib/statusColors'
import { getFaultDiagnosis } from '../services/predictionService'

export default function MachineHealth() {
  const live = useLiveData()
  const backendOnline = useAppStore(s => s.backendOnline)
  const machines = useAppStore((s) => s.machines)
  const selectedMachineId = useAppStore((s) => s.selectedMachineId)
  const selectMachine = useAppStore((s) => s.selectMachine)
  const machine = machines.find((m) => m.id === selectedMachineId) ?? machines[0]
  const diagnosis = getFaultDiagnosis(machine)

  const sorted = [...machines].sort((a, b) => a.telemetry.healthScore - b.telemetry.healthScore)

  return (
    <div className="flex flex-col w-full text-on-surface">
      <section className="p-space-lg bg-surface-container-lowest flex flex-col gap-space-md shadow-md">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center text-primary">
            <Icon name="vital_signs" className="text-[24px]" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface">Machine Health</h1>
            <span className="font-body-md text-body-md text-on-surface-variant">Predictive Telemetric Condition Monitoring</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
          <div className="bg-surface-container-low p-space-md rounded flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Fleet Health Index</span>
            <span className="font-telemetry-xl text-telemetry-xl text-primary mt-1">
              {Math.round(machines.reduce((a, m) => a + m.telemetry.healthScore, 0) / machines.length)}
            </span>
          </div>
          <div className="bg-surface-container-low p-space-md rounded flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Healthy Units</span>
            <span className="font-telemetry-xl text-telemetry-xl text-tertiary mt-1">
              {machines.filter((m) => m.telemetry.healthScore >= 85).length} / {machines.length}
            </span>
          </div>
          <div className="bg-surface-container-low p-space-md rounded flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Active Warnings</span>
            <span className="font-telemetry-xl text-telemetry-xl text-primary mt-1">
              {machines.filter((m) => m.telemetry.healthScore >= 60 && m.telemetry.healthScore < 85).length}
            </span>
          </div>
          <div className="bg-surface-container-low p-space-md rounded flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Critical Hardware</span>
            <span className="font-telemetry-xl text-telemetry-xl text-error mt-1">
              {machines.filter((m) => m.telemetry.healthScore < 60).length}
            </span>
          </div>
        </div>
      </section>

      <div className="p-space-lg grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
        <div className="xl:col-span-5 flex flex-col gap-space-md">
          {sorted.map((m) => (
            <div
              key={m.id}
              onClick={() => selectMachine(m.id)}
              className={`p-space-md rounded shadow-sm relative overflow-hidden cursor-pointer transition-all ${
                m.id === machine.id ? 'bg-surface-container-high' : 'bg-surface-container hover:bg-surface-bright/30'
              }`}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  m.telemetry.healthScore >= 85 ? 'bg-tertiary' : m.telemetry.healthScore >= 60 ? 'bg-primary' : 'bg-error'
                }`}
              />
              <div className="pl-2 flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-md text-headline-md text-on-surface font-bold">{m.id}</span>
                    <StatusPill label={m.status.replace('_', ' ')} token={machineStatusToToken[m.status]} />
                  </div>
                  <span className="font-body-md text-body-md text-on-surface font-semibold">{m.model}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">{m.engineHours.toLocaleString()} HRS</span>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-baseline gap-1 bg-surface-container-lowest px-2 py-1 rounded">
                    <span
                      className={`font-telemetry-md text-telemetry-md ${
                        m.telemetry.healthScore >= 85 ? 'text-tertiary' : m.telemetry.healthScore >= 60 ? 'text-primary' : 'text-error'
                      }`}
                    >
                      {m.telemetry.healthScore}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">/100</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="xl:col-span-7 flex flex-col gap-space-lg">
          <SectionCard className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-md">
                <div className="w-12 h-12 rounded bg-surface-container-lowest flex items-center justify-center text-primary-container">
                  <Icon name="hardware" className="text-[32px]" />
                </div>
                <div>
                  <span className="font-display-lg text-headline-lg text-primary tracking-tight font-extrabold">{machine.id}</span>
                  <div className="font-body-md text-body-md text-on-surface-variant">{machine.model}</div>
                </div>
              </div>
              <RadialGauge value={machine.telemetry.healthScore} label="Health" token="primary" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
              <TelemetryStat label="Coolant Temp" value={machine.telemetry.engineTempC} unit="°C" />
              <TelemetryStat label="Hyd. Pressure" value={machine.telemetry.hydraulicPressureBar} unit="BAR" token="secondary" />
              <TelemetryStat label="Vibration" value={machine.telemetry.vibrationG} unit="G" token={machine.telemetry.vibrationG > 1.5 ? 'error' : 'primary'} />
              <TelemetryStat label="RPM" value={machine.telemetry.rpm} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
              {(
                [
                  { label: 'Coolant · °C', field: 'temp', token: 'primary' },
                  { label: 'Speed · km/h', field: 'speed', token: 'secondary' },
                  { label: 'Slope · degrees', field: 'slope', token: 'tertiary' },
                  { label: 'Proximity · cm', field: 'obstacle', token: 'tertiary' },
                ] satisfies { label: string; field: string; token: 'primary' | 'secondary' | 'tertiary' | 'error' }[]
              ).map((t) => (
                <div key={t.label} className="bg-surface-container-lowest rounded p-3 flex flex-col gap-2 min-h-24">
                  <p className="text-xs text-on-surface-variant">{t.label}</p><div className="h-8 w-full">{backendOnline && (live?.history?.[machine.id]?.length ?? 0) > 1 ? <Sparkline points={live.history[machine.id].map((p: Record<string, number>) => p[t.field]).filter(Number.isFinite)} token={t.token} height={26} /> : <span className="text-xs text-on-surface-variant">{backendOnline ? 'Collecting readings…' : 'Live history unavailable'}</span>}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <AIInsightPanel
            title="AI Predictive Fault Classification"
            modelBadge="RANDOM FOREST · 96.6% ACC"
            reason={diagnosis.evidence}
            confidencePct={diagnosis.confidencePct}
            metrics={[
              { label: 'Fault', value: diagnosis.fault.replace('_', ' ').toUpperCase(), token: diagnosis.fault === 'normal' ? 'tertiary' : 'error' },
              { label: 'Remaining Life', value: diagnosis.estimatedRemainingHours >= 9999 ? '—' : `${diagnosis.estimatedRemainingHours} hrs` },
            ]}
          />
          <SectionCard variant="default">
            <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-wider flex items-center gap-1 font-bold">
              <Icon name="build_circle" className="text-[15px]" />
              Prescriptive Countermeasure
            </span>
            <p className="font-body-md text-body-md text-on-surface leading-relaxed mt-1">{diagnosis.recommendedAction}</p>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
