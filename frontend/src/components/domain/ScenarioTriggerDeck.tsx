import Icon from '../common/Icon'
import { scenarioDefinitions } from '../../mock/scenarios'
import { severityToToken, tokenClasses } from '../../lib/statusColors'
import type { ScenarioKey } from '../../types/domain'

interface ScenarioTriggerDeckProps {
  activeScenario: ScenarioKey
  onTrigger: (key: ScenarioKey) => void
}

export default function ScenarioTriggerDeck({ activeScenario, onTrigger }: ScenarioTriggerDeckProps) {
  return (
    <div className="bg-surface-container-lowest rounded p-space-lg shadow-2xl flex flex-col gap-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low px-space-md py-space-sm rounded">
        <div className="flex items-center gap-2">
          <Icon name="tune" className="text-[26px] text-primary-container" />
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md uppercase text-on-surface font-bold">
              Hackathon Demo Control Deck
            </span>
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Simulated scenarios only — does not control real machinery
            </span>
          </div>
        </div>
        <span className="font-label-sm text-label-sm uppercase text-outline px-2 py-1 bg-surface-container rounded">
          SIMULATION ENGINE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-space-sm">
        {scenarioDefinitions.map((s) => {
          const active = activeScenario === s.key
          const token = severityToToken[s.severity]
          const c = tokenClasses[token]
          return (
            <button
              key={s.key}
              onClick={() => onTrigger(s.key)}
              className={`p-space-sm rounded flex flex-col items-center justify-center text-center gap-1 transition-all ${
                active ? `${c.bg} ${c.text} shadow-md` : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
              }`}
            >
              <Icon name={s.icon} className={`text-[20px] ${active && s.severity === 'critical' ? 'animate-pulse' : ''}`} />
              <span className="font-label-md text-label-sm font-bold uppercase">{s.label}</span>
              <span className="font-body-md text-[10px] opacity-80">{s.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
