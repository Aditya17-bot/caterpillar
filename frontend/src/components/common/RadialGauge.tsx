import { tokenTextClass, type ColorToken } from '../../lib/statusColors'

interface RadialGaugeProps {
  value: number
  label?: string
  size?: number
  token?: ColorToken
}

export default function RadialGauge({ value, label, size = 96, token = 'tertiary' }: RadialGaugeProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const circumference = 2 * Math.PI * 15.9155
  const offset = circumference - (clamped / 100) * circumference
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          className="text-surface-container-highest"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          className={tokenTextClass[token]}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-telemetry-md font-bold ${tokenTextClass[token]}`} style={{ fontSize: size / 5.5 }}>
          {Math.round(clamped)}
        </span>
        {label && <span className="font-label-sm text-[8px] text-outline uppercase tracking-wider mt-0.5">{label}</span>}
      </div>
    </div>
  )
}
