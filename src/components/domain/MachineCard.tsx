import Icon from '../common/Icon'
import StatusPill from '../common/StatusPill'
import TelemetryStat from '../common/TelemetryStat'
import { machineStatusLabel, machineStatusToToken } from '../../lib/statusColors'
import type { Machine } from '../../types/domain'

const typeIcon: Record<Machine['type'], string> = {
  excavator: 'precision_manufacturing',
  loader: 'front_loader',
  dozer: 'agriculture',
  hauler: 'local_shipping',
}

interface MachineCardProps {
  machine: Machine
  selected?: boolean
  onSelect?: (id: string) => void
  dense?: boolean
}

export default function MachineCard({ machine, selected, onSelect, dense }: MachineCardProps) {
  const token = machineStatusToToken[machine.status]
  const disabled = machine.status === 'maintenance' || machine.status === 'offline' || machine.status === 'reserved'

  return (
    <div
      className={`rounded-lg p-space-md shadow-sm transition-all ${
        selected ? 'bg-surface-container-high' : 'bg-surface-container hover:bg-surface-container-high'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md min-w-0">
          <div className="w-12 h-12 rounded bg-surface-container-lowest flex items-center justify-center text-primary shrink-0">
            <Icon name={typeIcon[machine.type]} className="text-[28px]" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">{machine.id}</span>
              <span className="font-label-md text-label-md text-outline uppercase tracking-wider font-semibold truncate">
                {machine.model}
              </span>
              <StatusPill label={machineStatusLabel[machine.status]} token={token} pulse={machine.status === 'available'} />
            </div>
            {!dense && (
              <span className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1 mt-0.5">
                <Icon name="place" className="text-[15px]" />
                {machine.location}
                {machine.aiMatchScore ? ` • AI Match ${machine.aiMatchScore}%` : ''}
              </span>
            )}
          </div>
        </div>
        {onSelect && (
          <button
            disabled={disabled}
            onClick={() => onSelect(machine.id)}
            className={`px-space-lg py-2 font-headline-md text-label-md uppercase font-bold tracking-wider rounded shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              disabled
                ? 'bg-surface-container-lowest text-outline cursor-not-allowed'
                : selected
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container-lowest hover:bg-primary hover:text-on-primary text-on-surface'
            }`}
          >
            {selected ? <Icon name="done" className="text-[18px]" /> : null}
            {selected ? 'Selected' : disabled ? 'Locked' : 'Select'}
          </button>
        )}
      </div>
      {!dense && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-space-sm pt-space-md mt-space-sm bg-surface-container-lowest p-space-sm rounded">
          <TelemetryStat label="Health" value={`${machine.telemetry.healthScore}%`} token={token === 'error' ? 'error' : 'tertiary'} />
          <TelemetryStat label="Fuel" value={`${machine.telemetry.fuelPct}%`} token="primary" />
          <TelemetryStat label="Engine Hrs" value={machine.engineHours.toLocaleString()} unit="HRS" />
          <TelemetryStat label="Age" value={machine.ageYears} unit="YRS" />
          <TelemetryStat label="RPM" value={machine.telemetry.rpm} />
        </div>
      )}
    </div>
  )
}
