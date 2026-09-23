import { NavLink, useNavigate } from 'react-router-dom'
import Icon from '../common/Icon'
import { useAppStore } from '../../store/useAppStore'

const navItems = [
  { path: '/', label: 'Command Center', icon: 'dashboard' },
  { path: '/schedule', label: 'Schedule & Tasks', icon: 'calendar_month' },
  { path: '/fleet', label: 'Machines Fleet', icon: 'forklift' },
  { path: '/live-operation', label: 'Live Operation', icon: 'videocam' },
  { path: '/site-map', label: 'Site Map', icon: 'map' },
  { path: '/cameras', label: 'Cameras', icon: 'photo_camera' },
  { path: '/safety', label: 'Safety Center', icon: 'security' },
  { path: '/machine-health', label: 'Machine Health', icon: 'health_and_safety' },
  { path: '/maintenance', label: 'Maintenance', icon: 'build' },
  { path: '/analytics', label: 'Analytics', icon: 'monitoring' },
  { path: '/training', label: 'Operator Training', icon: 'model_training' },
  { path: '/incidents', label: 'Incident Log', icon: 'assignment_late' },
  { path: '/shift', label: 'Shift Report', icon: 'summarize' },
  { path: '/supervisor', label: 'Supervisor', icon: 'insights' },
  { path: '/notifications', label: 'Notifications & Alerts', icon: 'notification_important' },
]

const demoJumps: { label: string; to: string; action?: () => void }[] = [
  { label: '1. RFID Operator Scan', to: '/operation/rfid' },
  { label: '2. Schedule & Machine Select', to: '/schedule' },
  { label: '3. Pre-Operation Safety Check', to: '/operation/preop' },
  { label: '4. Live Operation / Simulation', to: '/live-operation' },
  { label: '5. Mission Debrief', to: '/operation/debrief' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const resetDemo = useAppStore((s) => s.resetDemo)

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-72 bg-surface-dim z-40 flex flex-col justify-between overflow-y-auto">
      <div className="p-space-md">
        <div className="font-label-sm text-label-sm text-outline tracking-widest uppercase px-space-sm mb-space-sm">
          Flight &amp; Machinery Operations
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-space-md py-2 transition-all rounded font-label-md text-label-md uppercase tracking-wider ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <Icon name={item.icon} className="text-[20px]" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-space-md bg-surface-container-lowest flex flex-col gap-space-sm">
        <div className="flex flex-col gap-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
            <Icon name="play_circle" className="text-[14px] text-secondary" />
            Demo Workflow Flowswitch
          </label>
          <select
            className="w-full bg-surface-container px-space-sm py-1.5 text-on-surface font-body-md text-body-md rounded focus:outline-none focus:ring-1 focus:ring-primary"
            onChange={(e) => {
              const target = demoJumps.find((d) => d.label === e.target.value)
              if (target) navigate(target.to)
            }}
            defaultValue={demoJumps[0].label}
          >
            {demoJumps.map((d) => (
              <option key={d.label}>{d.label}</option>
            ))}
          </select>
        </div>
        <button
          className="w-full py-2.5 px-space-md bg-error-container text-error hover:bg-error hover:text-on-error transition-all font-headline-md text-label-md tracking-wider uppercase font-bold rounded flex items-center justify-center gap-2"
          onClick={() => {
            resetDemo()
            navigate('/operation/rfid')
          }}
        >
          <Icon name="emergency" className="text-[20px]" />
          E-STOP / RESET DEMO
        </button>
      </div>
    </aside>
  )
}
