import { tokenBarClass, type ColorToken } from '../../lib/statusColors'

interface ProgressBarProps {
  pct: number
  token?: ColorToken
  thin?: boolean
}

export default function ProgressBar({ pct, token = 'primary', thin = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className={`w-full bg-surface-container-high ${thin ? 'h-1.5' : 'h-2.5'} rounded-full overflow-hidden`}>
      <div className={`h-full ${tokenBarClass[token]} rounded-full transition-all duration-500`} style={{ width: `${clamped}%` }} />
    </div>
  )
}
