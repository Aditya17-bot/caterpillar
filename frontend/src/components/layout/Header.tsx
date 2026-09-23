import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiSend } from '../../services/backend'
import Icon from '../common/Icon'
import { useAppStore } from '../../store/useAppStore'

function SosButton({ machineId }: { machineId?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      onClick={() => {
        if (!armed) return setArmed(true)
        setArmed(false)
        if (machineId)
          apiSend('/api/sos', {
            machineId,
            reason: 'Operator pressed SOS',
          }).catch(() => undefined)
      }}
      title="Emergency: alerts supervisor and all machines within 300 m"
      className={`flex items-center gap-1 px-space-md py-1.5 rounded font-headline-md text-label-md uppercase font-extrabold tracking-wider transition-colors ${
        armed
          ? 'bg-on-surface text-error animate-pulse'
          : 'bg-error text-on-error hover:bg-error-container hover:text-error'
      }`}
    >
      <Icon name="sos" className="text-[18px]" filled />
      {armed ? 'Tap again to send' : 'SOS'}
    </button>
  )
}

export default function Header({
  menuOpen,
  onMenuToggle,
}: {
  menuOpen: boolean
  onMenuToggle: () => void
}) {
  const navigate = useNavigate()
  const backendOnline = useAppStore((s) => s.backendOnline)
  const machines = useAppStore((s) => s.machines)
  const selectedMachineId = useAppStore((s) => s.selectedMachineId)
  const selectMachine = useAppStore((s) => s.selectMachine)
  const operator = useAppStore((s) => s.operator)
  const notifications = useAppStore((s) => s.notifications)
  const unread = notifications.filter((n) => !n.read).length
  return (
    <header className="app-header">
      <button
        className="mobile-menu-button p-2"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        aria-controls="app-navigation"
        onClick={onMenuToggle}
      >
        <Icon name="menu" className="text-2xl" />
      </button>
      <button
        className="flex items-center gap-3 text-left shrink-0"
        onClick={() => navigate('/')}
        aria-label="CAT Command Center"
      >
        <span className="bg-primary text-on-primary font-extrabold text-xl px-2 py-1 rounded">
          CAT<span className="text-primary">.</span>
        </span>
        <span className="header-brand-detail">
          <span className="font-bold text-sm block">Smart Operator</span>
          <span className="eyebrow text-[9px]">Operator assistant</span>
        </span>
      </button>
      <div className="h-7 w-px bg-surface-variant header-secondary" />
      <label className="flex items-center gap-2 text-xs">
        <Icon
          name="precision_manufacturing"
          className="text-primary text-xl header-secondary"
        />
        <span className="sr-only">Active machine</span>
        <select
          className="bg-surface-container-high border border-surface-variant rounded-lg px-2 font-semibold max-w-[110px]"
          value={selectedMachineId ?? ''}
          onChange={(e) => selectMachine(e.target.value)}
        >
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
      </label>
      <span
        className={`mode-badge ${backendOnline ? 'text-tertiary' : 'text-primary'}`}
        title={
          backendOnline
            ? 'Connected to live telemetry'
            : 'Backend unavailable. Demo or last received readings.'
        }
      >
        <Icon
          name={backendOnline ? 'sensors' : 'cloud_off'}
          className="text-base"
        />
        {backendOnline ? 'LIVE' : 'DEMO DATA'}
      </span>
      <div className="flex-1" />
      <span className="header-secondary text-xs text-on-surface-variant">
        {operator.name}
      </span>
      <button
        className="header-secondary btn-secondary !px-3 !py-2"
        onClick={() => window.dispatchEvent(new Event('copilot:toggle'))}
      >
        <Icon name="graphic_eq" className="text-primary text-xl" />
        <span className="hidden xl:inline">Co-pilot</span>
      </button>
      <button
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => navigate('/notifications')}
        className="header-secondary relative p-2"
      >
        <Icon name="notifications" className="text-xl" />
        {unread > 0 && (
          <span className="absolute -top-1 right-0 text-[10px] text-on-primary bg-primary rounded px-1">
            {unread}
          </span>
        )}
      </button>
      <SosButton machineId={selectedMachineId} />
    </header>
  )
}
