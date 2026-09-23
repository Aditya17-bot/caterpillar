import Icon from '../common/Icon'
import { safetyStateToToken, tokenClasses } from '../../lib/statusColors'
import type { SafetyCheckItem } from '../../types/domain'

const stateIcon = { pass: 'check_circle', warning: 'warning', fail: 'error' } as const

interface SafetyChecklistItemProps {
  item: SafetyCheckItem
  compact?: boolean
}

export default function SafetyChecklistItem({ item, compact = false }: SafetyChecklistItemProps) {
  const token = safetyStateToToken[item.state]
  const c = tokenClasses[token]

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 font-body-md text-[11px] ${c.text}`}>
        <Icon name={stateIcon[item.state]} className="text-[15px] shrink-0" filled />
        <span className="truncate">{item.label}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-2.5 bg-surface-container rounded">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={stateIcon[item.state]} className={`text-[18px] ${c.text} shrink-0`} filled />
        <div className="flex flex-col min-w-0">
          <span className="font-body-md text-body-md text-on-surface font-semibold truncate">{item.label}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{item.description}</span>
        </div>
      </div>
      {item.value && (
        <span className={`px-2 py-0.5 ${c.bg} ${c.text} font-label-sm text-label-sm font-bold uppercase rounded shrink-0`}>
          {item.value}
        </span>
      )}
    </div>
  )
}
