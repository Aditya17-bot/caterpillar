import { useEffect, useState } from 'react'
import Icon from '../common/Icon'
import { useAppStore } from '../../store/useAppStore'
import { mockWeather, siteInfo } from '../../mock/site'

export default function Header() {
  const operator = useAppStore((s) => s.operator)
  const notifications = useAppStore((s) => s.notifications)
  const alerts = useAppStore((s) => s.alerts)
  const unread = notifications.filter((n) => !n.read).length
  const machine = useAppStore((s) => s.machines.find((m) => m.id === s.selectedMachineId))
  const hasCriticalAlert = alerts.some((a) => !a.resolved && a.severity === 'critical')

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-surface-dim/95 backdrop-blur-md flex items-center justify-between px-space-lg shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-space-md min-w-[280px]">
        <div className="h-8 w-8 rounded bg-primary-container flex items-center justify-center text-on-primary-container font-headline-lg font-extrabold">
          C
        </div>
        <div className="flex flex-col">
          <span className="font-headline-md text-headline-md text-primary tracking-tight leading-none uppercase">
            Smart Operator Assistant
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase mt-1">
            Industrial Telemetry &amp; AI Copilot // Site: {siteInfo.name}
          </span>
        </div>
      </div>

      <div className="hidden xl:flex items-center gap-space-sm bg-surface-container-low px-space-md py-1.5 rounded">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface-container rounded">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          <span className="font-body-md text-[11px] text-on-surface font-medium">
            {operator.id} ({operator.name.split(' ')[0][0]}. {operator.name.split(' ')[1]})
          </span>
        </div>
        <div className="h-4 w-px bg-surface-variant" />
        <div className="flex items-center gap-1 px-2 py-0.5">
          <Icon name="precision_manufacturing" className="text-[15px] text-primary" />
          <span className="font-body-md text-[11px] text-on-surface font-semibold">
            {machine?.id ?? '—'} • {machine ? machine.status.replace('_', ' ').toUpperCase() : '—'}
          </span>
        </div>
        <div className="h-4 w-px bg-surface-variant" />
        <div className="flex items-center gap-1 px-2 py-0.5">
          <Icon name="cell_tower" className="text-[15px] text-secondary" />
          <span className="font-body-md text-[11px] text-on-surface">12ms 900MHz UHF</span>
        </div>
        <div className="h-4 w-px bg-surface-variant" />
        <div className="flex items-center gap-1 px-2 py-0.5">
          <Icon name="schedule" className="text-[15px] text-on-surface-variant" />
          <span className="font-body-md text-[11px] text-primary-fixed">
            {now.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
        <div className="h-4 w-px bg-surface-variant" />
        <div className="flex items-center gap-1 px-2 py-0.5">
          <Icon name="sunny" className="text-[15px] text-primary-container" />
          <span className="font-body-md text-[11px] text-on-surface">
            {mockWeather.condition.toUpperCase()} {mockWeather.tempC}°C / {mockWeather.windKt}KT
          </span>
        </div>
      </div>

      <div className="flex items-center gap-space-md">
        <div
          className={`hidden sm:flex items-center gap-2 px-space-md py-1 rounded ${
            hasCriticalAlert ? 'bg-error-container text-error' : 'bg-surface-container-high text-tertiary'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ring-2 animate-ping ${
              hasCriticalAlert ? 'bg-error ring-error' : 'bg-tertiary ring-tertiary-fixed-dim'
            }`}
          />
          <span className="font-label-sm text-label-sm tracking-widest uppercase">
            {hasCriticalAlert ? 'Critical Alert // Review Required' : 'System Armed // Zero Lockouts'}
          </span>
        </div>
        <button className="relative p-2 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors">
          <Icon name="notifications" className="text-[20px]" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-error text-on-error font-label-sm text-label-sm px-1.5 py-0.2 rounded font-bold">
              {unread}
            </span>
          )}
        </button>
        <button className="flex items-center gap-1.5 px-space-md py-1.5 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-colors rounded font-headline-md text-label-md tracking-wider uppercase font-bold">
          <Icon name="bolt" className="text-[18px]" />
          <span>Operator AI</span>
        </button>
        <div className="flex items-center gap-2 pl-space-xs">
          <div className="w-8 h-8 rounded-full bg-surface-container-high ring-2 ring-primary-container flex items-center justify-center text-[11px] font-bold text-primary">
            {operator.photoInitials}
          </div>
          <span className="hidden 2xl:inline font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            OP-SEC LEVEL {operator.certificationTier}
          </span>
        </div>
      </div>
    </header>
  )
}
