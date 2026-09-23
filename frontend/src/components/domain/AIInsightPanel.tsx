import Icon from '../common/Icon'
import { tokenBarClass, tokenTextClass } from '../../lib/statusColors'
import type { AIFeatureWeight } from '../../types/domain'

interface AIInsightPanelProps {
  title: string
  modelBadge: string
  reason: string
  confidencePct?: number
  factors?: AIFeatureWeight[]
  metrics?: { label: string; value: string; token?: 'primary' | 'error' | 'secondary' | 'tertiary' }[]
}

export default function AIInsightPanel({ title, modelBadge, reason, confidencePct, factors, metrics }: AIInsightPanelProps) {
  return (
    <div className="bg-surface-container p-space-md rounded flex flex-col gap-space-sm shadow-inner">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase font-bold tracking-wider text-secondary flex items-center gap-1">
          <Icon name="psychology" className="text-[16px]" />
          {title}
        </span>
        <span className="font-label-sm text-[10px] text-outline px-1.5 py-0.5 bg-surface-container-lowest rounded">{modelBadge}</span>
      </div>

      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col bg-surface-container-lowest p-2 rounded">
              <span className="font-label-sm text-[10px] text-outline uppercase">{m.label}</span>
              <span className={`font-telemetry-md text-body-lg font-bold mt-0.5 ${tokenTextClass[m.token ?? 'primary']}`}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      <p className="font-body-md text-body-md text-on-surface leading-relaxed">{reason}</p>

      {factors && factors.length > 0 && (
        <div
          className={`grid gap-2 pt-1 ${
            factors.length === 1 ? 'grid-cols-1' : factors.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}
        >
          {factors.map((f) => (
            <div key={f.label}>
              <div className="flex justify-between font-label-sm text-[10px] text-outline mb-0.5">
                <span className="truncate pr-1">{f.label}</span>
                <span className={`${tokenTextClass[f.colorToken]} font-bold shrink-0`}>{f.weightPct}%</span>
              </div>
              <div className="w-full h-1 bg-surface-container-high rounded overflow-hidden">
                <div className={`h-full ${tokenBarClass[f.colorToken]}`} style={{ width: `${f.weightPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {confidencePct !== undefined && (
        <div className="text-right font-label-sm text-[10px] text-outline">CONFIDENCE: {confidencePct.toFixed(1)}%</div>
      )}
    </div>
  )
}
