import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
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
  {
    path: '/machine-health',
    label: 'Machine Health',
    icon: 'health_and_safety',
  },
  { path: '/maintenance', label: 'Maintenance', icon: 'build' },
  { path: '/analytics', label: 'Analytics', icon: 'monitoring' },
  { path: '/training', label: 'Operator Training', icon: 'model_training' },
  { path: '/incidents', label: 'Incident Log', icon: 'assignment_late' },
  { path: '/shift', label: 'Shift Report', icon: 'summarize' },
  { path: '/supervisor', label: 'Supervisor', icon: 'insights' },
  {
    path: '/notifications',
    label: 'Notifications & Alerts',
    icon: 'notification_important',
  },
]

const steps = [
  { label: 'RFID · Identify operator', to: '/operation/rfid' },
  { label: 'Schedule · Select a task', to: '/schedule' },
  { label: 'Pre-op · Inspect machine', to: '/operation/preop' },
  { label: 'Live · Operate safely', to: '/live-operation' },
  { label: 'Debrief · Review shift', to: '/operation/debrief' },
]
export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const resetDemo = useAppStore((s) => s.resetDemo)
  const [visited, setVisited] = useState<string[]>([])
  useEffect(() => {
    if (steps.some((s) => s.to === pathname))
      setVisited((v) => (v.includes(pathname) ? v : [...v, pathname]))
  }, [pathname])
  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 top-[72px] bg-black/60 z-30 min-[1101px]:hidden"
          onClick={onClose}
        />
      )}
      <aside
        id="app-navigation"
        className={`app-sidebar ${open ? 'is-open' : ''}`}
      >
        <div className="p-4 border-b border-surface-variant">
          <div className="flex justify-between items-center mb-2">
            <span className="eyebrow">Demo journey</span>
            <span className="text-xs text-on-surface-variant">
              {visited.length}/5 visited
            </span>
          </div>
          <nav aria-label="Demo journey">
            {steps.map((step, i) => (
              <Link
                key={step.to}
                to={step.to}
                onClick={onClose}
                aria-current={pathname === step.to ? 'step' : undefined}
                className="journey-step"
              >
                <span className="journey-dot">
                  {visited.includes(step.to) && pathname !== step.to ? (
                    <Icon name="check" className="text-sm" />
                  ) : (
                    i + 1
                  )}
                </span>
                {step.label}
              </Link>
            ))}
          </nav>
        </div>
        <nav aria-label="Main navigation" className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon name={item.icon} className="text-xl" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-surface-variant">
          <button
            className="btn-secondary w-full text-xs"
            onClick={() => {
              resetDemo()
              setVisited([])
              navigate('/operation/rfid')
              onClose()
            }}
          >
            <Icon name="restart_alt" className="text-lg" />
            Restart demo journey
          </button>
        </div>
      </aside>
    </>
  )
}
