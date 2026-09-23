import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import StatusPill from '../components/common/StatusPill'
import { useAppStore } from '../store/useAppStore'
import type { NotificationKind } from '../types/domain'

const kindToken: Record<NotificationKind, 'primary' | 'error' | 'secondary' | 'tertiary' | 'neutral'> = {
  info: 'secondary',
  warning: 'primary',
  critical: 'error',
  resolved: 'tertiary',
  system: 'neutral',
  ai: 'secondary',
}

export default function Notifications() {
  const notifications = useAppStore((s) => s.notifications)
  const markRead = useAppStore((s) => s.markNotificationRead)

  return (
    <div className="p-space-lg flex flex-col gap-space-lg">
      <SectionCard variant="low" className="flex items-center justify-between">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded bg-primary-container text-on-primary-container flex items-center justify-center">
            <Icon name="notification_important" className="text-[24px]" />
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-tight">Notifications &amp; Alerts</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Unified feed of system, safety and AI events.</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-label-sm font-bold">
          {notifications.filter((n) => !n.read).length} UNREAD
        </span>
      </SectionCard>

      <div className="flex flex-col gap-space-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`p-space-md rounded-xl flex items-start gap-space-md cursor-pointer transition-colors ${
              n.read ? 'bg-surface-container-low' : 'bg-surface-container-high'
            }`}
          >
            <StatusPill label={n.kind} token={kindToken[n.kind]} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-headline-md text-body-lg text-on-surface font-bold truncate">{n.title}</span>
                <span className="font-body-md text-[11px] text-outline shrink-0">{n.timestamp}</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">{n.message}</p>
              {n.sourcePage && <span className="font-label-sm text-label-sm text-outline uppercase mt-1 inline-block">{n.sourcePage}</span>}
            </div>
            {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}
