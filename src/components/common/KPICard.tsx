import Icon from './Icon'
import ProgressBar from './ProgressBar'
import { tokenTextClass, type ColorToken } from '../../lib/statusColors'

interface KPICardProps {
  label: string
  value: string | number
  unit?: string
  icon?: string
  token?: ColorToken
  sub?: string
  progressPct?: number
}

export default function KPICard({ label, value, unit, icon, token = 'primary', sub, progressPct }: KPICardProps) {
  return (
    <div className="p-space-md bg-surface-container-low rounded-xl shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between text-on-surface-variant">
        <span className="font-label-sm text-label-sm uppercase tracking-widest">{label}</span>
        {icon && <Icon name={icon} className={`text-[18px] ${tokenTextClass[token]}`} />}
      </div>
      <div className="my-2 flex items-baseline gap-2">
        <span className={`font-telemetry-xl text-telemetry-xl ${tokenTextClass[token]}`}>{value}</span>
        {unit && <span className="font-headline-md text-body-lg text-on-surface-variant">{unit}</span>}
      </div>
      {progressPct !== undefined && <ProgressBar pct={progressPct} token={token} thin />}
      {sub && <div className="font-body-md text-[11px] text-on-surface-variant mt-1">{sub}</div>}
    </div>
  )
}
