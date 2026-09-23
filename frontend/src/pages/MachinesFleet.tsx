import Icon from '../components/common/Icon'
import RadialGauge from '../components/common/RadialGauge'
import TelemetryStat from '../components/common/TelemetryStat'
import ProgressBar from '../components/common/ProgressBar'
import MachineCard from '../components/domain/MachineCard'
import AIInsightPanel from '../components/domain/AIInsightPanel'
import { useAppStore } from '../store/useAppStore'
import { getFaultDiagnosis } from '../services/predictionService'

import type { Machine } from '../types/domain'

// Subsystem integrity from live readings (engine temp/fault, hydraulics, vibration)
function subsystemsFor(m: Machine) {
  const t = m.telemetry
  const clamp = (v: number) => Math.max(5, Math.min(100, Math.round(v)))
  const faulty = m.ml?.fault && m.ml.fault !== 'normal'
  return [
    { label: 'Engine', value: clamp((faulty ? 100 - (m.ml?.faultProb ?? 0.6) * 60 : 98) - Math.max(0, t.engineTempC - 95) * 2) },
    { label: 'Lubrication', value: clamp(t.oilPressurePsi && m.engineOn ? Math.min(100, (t.oilPressurePsi / 50) * 100) : 95) },
    { label: 'Hydraulic Pump', value: clamp(t.hydraulicPressureBar ? 100 - Math.abs(t.hydraulicPressureBar - 320) / 2 : 95) },
    { label: 'Final Drive & Undercarriage', value: clamp(100 - t.vibrationG * 25) },
    { label: 'Electrical & Telematics', value: m.online === false ? 20 : 98 },
  ]
}

export default function MachinesFleet() {
  const machines = useAppStore((s) => s.machines)
  const selectedMachineId = useAppStore((s) => s.selectedMachineId)
  const selectMachine = useAppStore((s) => s.selectMachine)
  const machine = machines.find((m) => m.id === selectedMachineId) ?? machines[0]
  const diagnosis = getFaultDiagnosis(machine)
  const subsystems = subsystemsFor(machine)
  const online = machines.filter((m) => m.online ?? (m.status === 'available' || m.status === 'in_use')).length

  return (
    <div className="flex flex-col w-full">
      <section className="p-space-lg bg-surface-container-lowest">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-space-lg">
          <div className="flex flex-col gap-1">
            <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm uppercase tracking-widest font-bold">
              Telemetry Grid Active
            </span>
            <div className="flex items-baseline gap-space-md">
              <h2 className="font-display-lg text-display-lg text-on-surface tracking-tight uppercase">Fleet Management</h2>
              <span className="font-headline-md text-headline-md text-primary font-bold">{machines.length} Assets Deployed</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm w-full xl:w-auto">
            <div className="bg-surface-container-low p-space-md rounded flex flex-col">
              <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Active Fleet</span>
              <span className="font-telemetry-xl text-telemetry-xl text-tertiary">{online}</span>
              <span className="font-body-md text-body-md text-on-surface-variant">/ {machines.length} Online</span>
            </div>
            <div className="bg-surface-container-low p-space-md rounded flex flex-col">
              <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Fleet Health Avg</span>
              <span className="font-telemetry-xl text-telemetry-xl text-primary">
                {Math.round(machines.reduce((a, m) => a + m.telemetry.healthScore, 0) / machines.length)}
              </span>
            </div>
            <div className="bg-surface-container-low p-space-md rounded flex flex-col">
              <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Avg Fuel</span>
              <span className="font-telemetry-xl text-telemetry-xl text-secondary">
                {Math.round(machines.reduce((a, m) => a + m.telemetry.fuelPct, 0) / machines.length)}%
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="p-space-lg flex flex-col gap-space-md">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
          {machines.map((m) => (
            <div key={m.id} onClick={() => selectMachine(m.id)} className="cursor-pointer">
              <MachineCard machine={m} selected={m.id === machine.id} />
            </div>
          ))}
        </div>
      </section>

      <section className="p-space-lg bg-surface-container-lowest flex flex-col gap-space-lg">
        <div className="flex items-center gap-space-md">
          <div className="p-2.5 rounded bg-primary-container text-on-primary-container">
            <Icon name="precision_manufacturing" className="text-[28px]" />
          </div>
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight uppercase">{machine.id} Live Telemetry Stream</h2>
            <div className="font-body-md text-body-md text-on-surface-variant mt-0.5">{machine.model} • CAN-BUS Link 50Hz</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-4 bg-surface-container p-space-lg rounded flex flex-col items-center gap-space-md">
            <span className="font-label-sm text-label-sm text-outline tracking-widest uppercase self-start">Subsystem Integrity Matrix</span>
            <RadialGauge value={machine.telemetry.healthScore} label="Health Score" size={160} token="tertiary" />
            <div className="flex flex-col gap-space-sm w-full">
              {subsystems.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between font-label-sm text-label-sm uppercase mb-1">
                    <span className="text-on-surface">{s.label}</span>
                    <span className="text-primary font-bold">{s.value}%</span>
                  </div>
                  <ProgressBar pct={s.value} token={s.value < 88 ? 'primary' : 'tertiary'} thin />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-space-md content-start">
            <TelemetryStat label="Coolant Temp" value={machine.telemetry.engineTempC} unit="°C" token="primary" />
            <TelemetryStat label="Engine RPM" value={machine.telemetry.rpm} unit="RPM" />
            <TelemetryStat label="Oil Pressure" value={machine.telemetry.oilPressurePsi} unit="PSI" token="tertiary" />
            <TelemetryStat label="Hydraulic Pump" value={machine.telemetry.hydraulicPressureBar} unit="BAR" token="secondary" />
            <TelemetryStat label="Fuel" value={`${machine.telemetry.fuelPct}%`} />
            <TelemetryStat label="Vibration" value={machine.telemetry.vibrationG} unit="G" token={machine.telemetry.vibrationG > 1.5 ? 'error' : 'primary'} />
          </div>

          <div className="lg:col-span-3">
            <AIInsightPanel
              title="AI Predictive Fault Diagnostic"
              modelBadge="RANDOM FOREST"
              reason={diagnosis.evidence}
              confidencePct={diagnosis.confidencePct}
              metrics={[
                { label: 'Fault', value: diagnosis.fault.replace('_', ' ').toUpperCase(), token: diagnosis.fault === 'normal' ? 'tertiary' : 'error' },
                { label: 'Component', value: diagnosis.component },
              ]}
            />
            <p className="font-body-md text-body-md text-on-surface-variant mt-space-sm bg-surface-container p-space-sm rounded">
              <strong className="text-primary">Recommended Action:</strong> {diagnosis.recommendedAction}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
