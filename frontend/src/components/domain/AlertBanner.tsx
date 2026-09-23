import Icon from '../common/Icon'
import type { Severity } from '../../types/domain'

interface AlertBannerProps {
  severity: Severity
  title: string
  message: string
  tag?: string
}

const styles: Record<Severity, { bg: string; text: string; icon: string }> = {
  info: { bg: 'bg-surface-container-high', text: 'text-secondary', icon: 'info' },
  warning: { bg: 'bg-primary-container', text: 'text-on-primary-container', icon: 'warning' },
  critical: { bg: 'bg-error-container', text: 'text-on-error-container', icon: 'dangerous' },
}

export default function AlertBanner({ severity, title, message, tag }: AlertBannerProps) {
  const s = styles[severity]
  return (
    <div className={`w-full px-margin-lg py-2.5 flex flex-wrap items-center justify-between gap-space-md shadow-md ${s.bg} ${s.text}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Icon name={s.icon} className={`text-[22px] ${severity === 'critical' ? 'animate-pulse' : ''}`} filled />
        <span className="font-headline-md text-label-md uppercase font-bold tracking-wide truncate">{title}</span>
        <span className="font-body-md text-body-md opacity-90 hidden md:inline truncate">{message}</span>
      </div>
      {tag && (
        <span className="bg-surface-container-lowest/80 font-label-md text-label-sm uppercase px-2 py-1 rounded font-bold shrink-0">
          {tag}
        </span>
      )}
    </div>
  )
}
