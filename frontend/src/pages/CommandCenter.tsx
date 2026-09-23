import { Link } from 'react-router-dom'
import Icon from '../components/common/Icon'
import KPICard from '../components/common/KPICard'
import SectionCard from '../components/common/SectionCard'
import ProgressBar from '../components/common/ProgressBar'
import TelemetryStat from '../components/common/TelemetryStat'
import Timeline, { type TimelineEntry } from '../components/domain/Timeline'
import StatusPill from '../components/common/StatusPill'
import { useAppStore, selectActiveMachine } from '../store/useAppStore'
import { mockWeather } from '../mock/site'

export default function CommandCenter() {
  const operator = useAppStore((s) => s.operator)
  const machine = useAppStore(selectActiveMachine)
  const alerts = useAppStore((s) => s.alerts)
  const workCompleted = useAppStore((s) => s.workCompletedM3)
  const target = useAppStore((s) => s.targetVolumeM3)
  const activeTask = useAppStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId))
  const allTasks = useAppStore((s) => s.tasks)
  const backendOnline = useAppStore((s) => s.backendOnline)
  const shift = useAppStore((s) => s.shiftReport)
  const copilotMessage = useAppStore((s) => s.copilotMessage)
  const tasks = backendOnline ? allTasks.filter((t) => t.assignedMachineId === machine.id) : allTasks
  const shiftTimeline: TimelineEntry[] = tasks.map((t) => ({
    id: t.id,
    time: `${t.startTime} - ${t.endTime}`,
    title: t.title,
    detail: `${t.volumeM3} m³ • ${t.soilType} • ${t.location}${t.predictedMin ? ` • AI est. ${Math.round(t.predictedMin)} min` : ''}`,
    tag: t.soilType,
    state: t.status === 'completed' ? 'done' : t.status === 'active' ? 'active' : 'upcoming',
  }))
  const count = (st: string) => tasks.filter((t) => t.status === st).length
  const stats = shift?.stats
  const openAlerts = alerts.filter((a) => !a.resolved && (!backendOnline || a.machineId === machine.id))
  const slope = Math.abs(machine.telemetry.slopeDeg)

  return (
    <div className="flex flex-col w-full text-on-surface">
      <section className="p-gutter-lg bg-surface-container-lowest flex flex-col xl:flex-row gap-gutter-lg justify-between items-stretch shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-space-lg">
          <div className="relative">
            <div className="w-20 h-20 rounded-xl bg-surface-container-high flex items-center justify-center text-2xl font-bold text-primary shadow-md">
              {operator.photoInitials}
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-tertiary flex items-center justify-center text-on-tertiary">
              <Icon name="verified" className="text-[14px]" />
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                Good morning, {operator.name.split(' ')[0]}
              </h1>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-sm text-label-sm uppercase tracking-widest">
                {operator.id}
              </span>
              <StatusPill label="RFID Authenticated" token="tertiary" />
            </div>
            <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 mt-1.5 text-on-surface-variant font-body-md text-body-md">
              <span className="flex items-center gap-1">
                <Icon name="badge" className="text-[15px] text-primary" />
                Tier-{operator.certificationTier} {operator.siteRole}
              </span>
              <span className="text-surface-variant">/</span>
              <span className="flex items-center gap-1">
                <Icon name="pace" className="text-[15px] text-secondary" />
                Shift {operator.shift}
              </span>
              <span className="text-surface-variant">/</span>
              <span className="flex items-center gap-1 text-on-surface">
                <Icon name="pin_drop" className="text-[15px] text-primary-fixed" />
                {machine.location}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-gutter bg-surface-container-low p-space-md rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md">
            <div className="flex flex-col bg-surface-container p-2 rounded">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Weather</span>
              <span className="font-telemetry-md text-telemetry-md text-primary mt-0.5 flex items-center gap-1">
                <Icon name="sunny" className="text-[18px]" />
                {mockWeather.tempC}°C
              </span>
            </div>
            <TelemetryStat label="Humidity" value={`${mockWeather.humidityPct}%`} />
            <TelemetryStat label="Barometric" value={mockWeather.baroHpa} unit="hPa" />
            <TelemetryStat label="Wind" value={mockWeather.windKt} unit="KT" token="secondary" />
          </div>
          <div className="flex items-center gap-space-sm w-full sm:w-auto">
            <Link
              to="/operation/preop"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-space-md py-2.5 rounded bg-primary-container text-on-primary-container font-headline-md text-label-md uppercase tracking-wider hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
            >
              <Icon name="fact_check" className="text-[18px]" />
              Pre-Check Protocol
            </Link>
          </div>
        </div>
      </section>

      <div className="p-gutter-lg flex flex-col gap-gutter-lg">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <KPICard label="Today's Tasks" value={tasks.length} unit="Assigned" icon="assignment" token="primary" sub={`${count('active')} Active • ${count('scheduled') + count('queued')} Queued • ${count('completed')} Done`} />
          <KPICard label="Active Machinery" value={machine.id} icon="precision_manufacturing" token="primary" sub={machine.model} />
          <KPICard label="Machine Health" value={machine.telemetry.healthScore} unit="/ 100" icon="health_and_safety" token={machine.telemetry.healthScore < 70 ? 'error' : 'tertiary'} sub={machine.ml?.fault && machine.ml.fault !== 'normal' ? `AI: ${machine.ml.fault.replace(/_/g, ' ')}` : 'Nominal Parameters'} />
          <KPICard label="Safety Posture" value={openAlerts.some((a) => a.severity === 'critical') ? 'ALERT' : openAlerts.length ? 'CAUTION' : 'GREEN'} icon="shield" token={openAlerts.length ? 'error' : 'tertiary'} sub={stats ? `${stats.seatbeltCompliancePct}% Belt Compliance` : '100% Belt Compliance'} />
          <KPICard label="Fuel" value={machine.telemetry.fuelPct} unit="%" icon="local_gas_station" token="primary" sub={stats ? `${stats.fuelL} L this shift • ${stats.fuelPerHourL} L/h` : '-8% vs Fleet Avg'} />
          <KPICard label="Idle Share" value={stats ? stats.idlePct : machine.telemetry.idleMin} unit={stats ? '%' : 'min'} icon="hourglass_bottom" token={stats && stats.idlePct > 15 ? 'error' : 'secondary'} sub={stats ? `${stats.idleMin} min idle • target < 15%` : 'Target < 10% Compliant'} />
          <KPICard label="Excavation Rate" value={stats ? Math.round((stats.materialM3 / Math.max(stats.engineOnMin, 1)) * 60) : 284} unit="m³/h" icon="speed" token="primary" sub={stats ? `${stats.materialM3} m³ moved • ${stats.loadCycles} cycles` : '+12% Above Benchmark'} />
          <KPICard label="Terrain Risk Index" value={slope > 20 ? 'HIGH' : slope > 12 ? 'MEDIUM' : 'LOW'} icon="landscape" token={slope > 20 ? 'error' : slope > 12 ? 'primary' : 'tertiary'} sub={`Slope ${machine.telemetry.slopeDeg}° • ${machine.surface ?? 'Dense Clay'}`} />
        </section>

        <SectionCard className="flex flex-col lg:flex-row gap-gutter-lg justify-between items-stretch">
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-sm">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-primary-container text-on-primary-container font-label-sm text-label-sm font-bold uppercase rounded">
                    Active Mission
                  </span>
                  <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    Task ID: {activeTask?.id ?? '—'}
                  </span>
                </div>
                <StatusPill label="Running // In Progress" token="tertiary" pulse />
              </div>
              <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">{activeTask?.title ?? 'No active task'}</h2>
              <p className="text-on-surface-variant font-body-md text-body-md mt-1">
                Machine: <span className="text-on-surface font-semibold">{machine.id} ({machine.model})</span> • Age: {machine.ageYears}{' '}
                yrs • Rig: {machine.bucketConfig}
              </p>
              <div className="mt-space-lg">
                <div className="flex justify-between items-baseline mb-1 font-body-md text-body-md">
                  <span className="text-on-surface-variant">Volumetric Quota Progress</span>
                  <span className="text-on-surface font-bold">
                    <span className="text-primary text-telemetry-md">{workCompleted.toFixed(0)}</span> / {target} m³{' '}
                    <span className="text-tertiary font-normal">({Math.round((workCompleted / target) * 100)}%)</span>
                  </span>
                </div>
                <ProgressBar pct={(workCompleted / target) * 100} token="primary" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm mt-space-lg">
                <TelemetryStat label="Engine Temp" value={`${machine.telemetry.engineTempC}°C`} />
                <TelemetryStat label="Engine Speed" value={machine.telemetry.rpm} unit="RPM" />
                <TelemetryStat label="Hydr. Pressure" value={machine.telemetry.hydraulicPressureBar} unit="bar" token="secondary" />
                <TelemetryStat label="Lateral Slope" value={`+${machine.telemetry.slopeDeg}°`} token="tertiary" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-space-md mt-space-lg pt-space-md">
              <Link
                to="/live-operation"
                className="flex items-center gap-2 px-space-lg py-3 rounded bg-primary-container text-on-primary-container font-headline-md text-label-md tracking-widest uppercase font-bold hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
              >
                <Icon name="view_in_ar" className="text-[20px]" />
                Enter Live Operation Simulator
              </Link>
            </div>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg">
          <SectionCard className="lg:col-span-7 flex flex-col">
            <div className="flex items-center justify-between pb-space-md mb-space-md">
              <div className="flex items-center gap-2">
                <Icon name="schedule" className="text-[20px] text-primary" />
                <h3 className="font-headline-md text-headline-md text-on-surface">Shift Operational Schedule</h3>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Shift: 12 Hours</span>
            </div>
            <Timeline entries={shiftTimeline} />
          </SectionCard>

          <SectionCard className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-md mb-space-md">
                <div className="flex items-center gap-2">
                  <Icon name="notification_important" className="text-[20px] text-error" />
                  <h3 className="font-headline-md text-headline-md text-on-surface">Live Telemetry Incident Log</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-label-sm font-bold">
                  {alerts.filter((a) => !a.acknowledged).length} NEW
                </span>
              </div>
              <div className="flex flex-col gap-space-md">
                {alerts.length === 0 && (
                  <div className="p-space-md rounded-xl bg-surface-container text-on-surface-variant font-body-md text-body-md">
                    No active alerts. Trigger a scenario from Live Operation to see the AI copilot react.
                  </div>
                )}
                {(backendOnline ? openAlerts.concat(alerts.filter((a) => a.resolved && a.machineId === machine.id)) : alerts).slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className={`p-space-md rounded-xl flex flex-col gap-1.5 ${
                      a.severity === 'critical' ? 'bg-error-container/20' : a.severity === 'warning' ? 'bg-primary-container/20' : 'bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusPill
                          label={a.severity}
                          token={a.severity === 'critical' ? 'error' : a.severity === 'warning' ? 'primary' : 'secondary'}
                        />
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">{a.timestamp}</span>
                      </div>
                    </div>
                    <div className="font-headline-md text-body-lg text-on-surface font-bold">{a.title}</div>
                    <p className="font-body-md text-body-md text-on-surface-variant">{a.message}</p>
                  </div>
                ))}
              </div>
            </div>
            <Link
              to="/notifications"
              className="mt-space-md w-full py-2.5 bg-surface-container-high hover:bg-surface-variant text-on-surface font-headline-md text-label-md tracking-wider uppercase rounded flex items-center justify-center gap-1 transition-colors"
            >
              <Icon name="history" className="text-[18px]" />
              View Full Notification Center
            </Link>
          </SectionCard>
        </div>

        <SectionCard className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 shadow-sm">
              <Icon name="psychology" className="text-[24px]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-headline-md text-body-lg text-primary font-bold">CAT AI Copilot • Operational Advisor Active</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[9px] uppercase font-bold">
                  MODEL V4.2
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                {backendOnline ? copilotMessage : 'Bucket load trajectory is optimal. Dig angle adjustment suggested for upcoming bench transition.'}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
