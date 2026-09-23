import { useState } from 'react'
import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import KPICard from '../components/common/KPICard'
import ProgressBar from '../components/common/ProgressBar'
import RadialGauge from '../components/common/RadialGauge'
import { useAppStore } from '../store/useAppStore'
import { getTaskTimePrediction } from '../services/predictionService'

export default function Analytics() {
  const machines = useAppStore((s) => s.machines)
  const incidents = useAppStore((s) => s.incidents)
  const operator = useAppStore((s) => s.operator)
  const activeTask = useAppStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId))
  const workCompleted = useAppStore((s) => s.workCompletedM3)
  const [siteFilter] = useState('Sector 7 North Pit')
  const prediction = getTaskTimePrediction(activeTask)
  const shift = useAppStore((s) => s.shiftReport)
  const siteSafety = useAppStore((s) => s.siteSafetyScore)
  const backendOnline = useAppStore((s) => s.backendOnline)
  const st = shift?.stats
  const utilization = machines.length ? (100 * machines.filter((m) => m.status === 'in_use' || m.engineOn).length) / machines.length : 78.4
  const safety = siteSafety ?? 98.4
  const cycleSec = st && st.cyclesPerHour ? (3600 / st.cyclesPerHour).toFixed(1) : '22.4'
  const stability = st ? Math.max(0, 100 - st.harshEvents * 5 - Math.round(st.overspeedMin * 4)) : 94
  const fuelScore = st ? Math.max(0, Math.round(100 - st.idlePct * 1.5)) : 92

  return (
    <div className="flex flex-col w-full text-on-surface">
      <section className="p-space-lg bg-surface-container-lowest flex flex-col gap-space-md">
        <div className="flex items-center gap-space-md">
          <div className="w-2.5 h-8 bg-primary-container rounded-xs" />
          <div>
            <span className="font-headline-lg text-headline-lg uppercase tracking-tight text-on-surface">Analytics</span>
            <p className="font-body-md text-body-md text-on-surface-variant uppercase tracking-wider mt-0.5">
              Fleet, Operator &amp; Productivity Intelligence // {siteFilter}
            </p>
          </div>
        </div>
      </section>

      <section className="px-space-lg py-space-md grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-space-sm bg-surface-dim">
        <KPICard label="Fleet Utilization" value={utilization.toFixed(1)} unit="%" icon="speed" token="tertiary" progressPct={utilization} />
        <KPICard label="Fuel Efficiency" value={st ? st.fuelPerHourL : 24.2} unit="L/h" icon="local_gas_station" token="secondary" progressPct={68} />
        <KPICard label="Task Estimate" value={prediction.aiEstimateMin} unit="min" icon="timer" token="primary" sub={`AI vs ${prediction.historicalAverageMin}m typical`} />
        <KPICard label="Safety Posture" value={safety} unit="/100" icon="shield" token="tertiary" progressPct={safety} sub={backendOnline ? 'Avg operator safety score' : undefined} />
        <KPICard label="Cumulative Idle" value={st ? st.idlePct : 6.8} unit="%" icon="hourglass_empty" token={st && st.idlePct > 15 ? 'error' : 'primary'} sub="Target < 15%" />
        <KPICard label="Total Earth Moved" value={st ? st.materialM3 : workCompleted.toFixed(0)} unit="m³" icon="inventory_2" token="primary" sub={st ? `${st.loadCycles} load cycles this shift` : undefined} />
      </section>

      <section className="p-space-lg grid grid-cols-1 xl:grid-cols-2 gap-space-lg bg-surface">
        <SectionCard>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-bold">
                WIDGET 01 // ML PREDICTIVE ENGINE
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface uppercase mt-1">Task Time Regression Intelligence</h3>
            </div>
          </div>
          <div className="flex flex-col gap-space-sm my-space-md">
            <div>
              <div className="flex justify-between items-center font-label-md text-label-md uppercase">
                <span className="text-secondary font-bold">AI Model Expected</span>
                <span className="font-body-lg text-body-lg text-secondary font-bold">{prediction.aiEstimateMin} min</span>
              </div>
              <ProgressBar pct={(prediction.aiEstimateMin / prediction.historicalAverageMin) * 100} token="secondary" />
            </div>
            <div>
              <div className="flex justify-between items-center font-label-md text-label-md uppercase">
                <span className="text-outline font-bold">Historical Fleet Average</span>
                <span className="font-body-lg text-body-lg text-on-surface-variant font-bold">{prediction.historicalAverageMin} min</span>
              </div>
              <ProgressBar pct={100} token="neutral" />
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-widest font-bold">
                WIDGET 02 // SAFETY RADAR &amp; COMPLIANCE
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface uppercase mt-1">Safety Telemetry Breakdown</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center my-space-md">
            <div className="md:col-span-5 flex flex-col items-center justify-center p-space-sm bg-surface-container-lowest rounded">
              <RadialGauge value={safety} label="Safety Index" token="tertiary" size={140} />
            </div>
            <div className="md:col-span-7 flex flex-col gap-1.5">
              <div className="flex items-center justify-between p-2 bg-surface-container rounded">
                <span className="font-body-md text-body-md text-on-surface">Proximity Alerts</span>
                <span className="font-body-md text-body-md font-bold text-primary">
                  {incidents.filter((i) => i.category === 'proximity').length} Logged
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-surface-container rounded">
                <span className="font-body-md text-body-md text-on-surface">Drowsiness Events</span>
                <span className="font-body-md text-body-md font-bold text-primary-fixed-dim">
                  {incidents.filter((i) => i.category === 'drowsiness').length} Advised
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-surface-container rounded">
                <span className="font-body-md text-body-md text-on-surface">Seatbelt Violations</span>
                <span className="font-body-md text-body-md font-bold text-error">
                  {incidents.filter((i) => i.category === 'seatbelt').length} Recorded
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-bold">
                WIDGET 03 // OPERATOR MASTERY BENCHMARK
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface uppercase mt-1">{operator.name}</h3>
            </div>
            <span className="px-2 py-0.5 bg-primary-container/20 text-primary font-label-sm text-label-sm rounded uppercase font-bold">
              Level {operator.certificationTier} Master Operator
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm my-space-md">
            <div className="bg-surface-container-lowest p-space-sm rounded flex flex-col">
              <span className="font-label-sm text-label-sm uppercase text-outline">Cycle Trench Time</span>
              <div className="mt-2 font-telemetry-xl text-telemetry-xl font-bold text-on-surface">{cycleSec}s</div>
            </div>
            <div className="bg-surface-container-lowest p-space-sm rounded flex flex-col">
              <span className="font-label-sm text-label-sm uppercase text-outline">G-Force Stability</span>
              <div className="mt-2 font-telemetry-xl text-telemetry-xl font-bold text-secondary">{stability}/100</div>
            </div>
            <div className="bg-surface-container-lowest p-space-sm rounded flex flex-col">
              <span className="font-label-sm text-label-sm uppercase text-outline">Fuel Conservation</span>
              <div className="mt-2 font-telemetry-xl text-telemetry-xl font-bold text-primary">{fuelScore}/100</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-space-sm">
            <Icon name="dataset" className="text-primary text-[20px]" />
            <span className="font-headline-md text-headline-md uppercase text-on-surface">Fleet Ledger</span>
          </div>
          <div className="overflow-x-auto rounded">
            <table className="w-full text-left font-body-md text-body-md">
              <thead>
                <tr className="bg-surface-container-lowest uppercase font-label-sm text-label-sm text-outline">
                  <th className="px-space-sm py-2">Machine</th>
                  <th className="px-space-sm py-2">Health</th>
                  <th className="px-space-sm py-2">Fuel</th>
                  <th className="px-space-sm py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/30">
                {machines.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-space-sm py-2 font-semibold text-on-surface">{m.id}</td>
                    <td className="px-space-sm py-2 text-tertiary">{m.telemetry.healthScore}%</td>
                    <td className="px-space-sm py-2 text-on-surface">{m.telemetry.fuelPct}%</td>
                    <td className="px-space-sm py-2 text-right text-on-surface-variant uppercase text-[11px]">{m.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </section>
    </div>
  )
}
