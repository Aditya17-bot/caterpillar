import { tokenTextClass, type ColorToken } from '../../lib/statusColors'

interface TelemetryStatProps {
  label: string
  value: string | number
  unit?: string
  token?: ColorToken
  sub?: string
}

export default function TelemetryStat({ label, value, unit, token = 'neutral', sub }: TelemetryStatProps) {
  return (
    <div className="flex flex-col bg-surface-container-lowest p-2 rounded">
      <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`font-telemetry-md text-body-lg font-bold ${tokenTextClass[token]}`}>{value}</span>
        {unit && <span className="font-label-sm text-[10px] text-on-surface-variant">{unit}</span>}
      </div>
      {sub && <span className="font-body-md text-[10px] text-outline mt-0.5">{sub}</span>}
    </div>
  )
}
