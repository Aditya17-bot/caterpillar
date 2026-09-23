import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import KPICard from '../components/common/KPICard'
import StatusPill from '../components/common/StatusPill'
import SafetyChecklistItem from '../components/domain/SafetyChecklistItem'
import { useAppStore } from '../store/useAppStore'

export default function SafetyCenter() {
  const operator = useAppStore((s) => s.operator)
  const authStatus = useAppStore((s) => s.authStatus)
  const interlocks = useAppStore((s) => s.interlockSensors)
  const drowsiness = useAppStore((s) => s.drowsiness)
  const incidents = useAppStore((s) => s.incidents)
  const passCount = interlocks.filter((i) => i.state === 'pass').length

  return (
    <div className="flex flex-col w-full text-on-surface">
      <div className="w-full bg-surface-container-lowest px-space-lg py-2.5 flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex items-center gap-3">
          <StatusPill label="Safety Interlock: Armed" token="tertiary" pulse />
          <span className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1.5">
            <Icon name="gavel" className="text-[16px] text-primary" />
            OSHA &amp; MSHA Compliance Protocol // Sector 7 Excavation Pit
          </span>
        </div>
      </div>

      <div className="p-space-lg lg:p-margin-lg flex flex-col gap-space-lg">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-space-md">
          <KPICard label="Site Safety Score" value={98.4} unit="/100" icon="verified_user" token="tertiary" sub="184d Clean Run" />
          <KPICard label="Active On-Duty" value={18} unit="OPS" icon="badge" token="secondary" sub="100% RFID Validated" />
          <KPICard label="Seatbelt Status" value="100%" icon="airline_seat_recline_extra" token="tertiary" sub="18/18 Interlocked" />
          <KPICard label="Fatigue Monitor" value={drowsiness.state.toUpperCase()} icon="visibility" token={drowsiness.state === 'alert' ? 'tertiary' : 'error'} />
          <KPICard label="Collision Events" value={incidents.filter((i) => i.category === 'proximity').length} unit="AVERTED" icon="radar" token="secondary" />
          <KPICard label="Active LOTO" value={0} unit="HOLDS" icon="lock_reset" token="tertiary" sub="Zero Active Lockouts" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            <SectionCard>
              <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-container text-on-primary-container rounded">
                    <Icon name="contactless" className="text-[24px]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-md text-headline-md text-on-surface leading-tight uppercase">Industrial RFID Interlock</span>
                    <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Access Controller Status</span>
                  </div>
                </div>
                <StatusPill
                  label={authStatus === 'authorized' ? `RFID Authenticated // ${operator.badgeId}` : 'Awaiting Authentication'}
                  token={authStatus === 'authorized' ? 'tertiary' : 'primary'}
                  pulse
                />
              </div>

              <div className="p-space-md bg-surface-container rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
                <div className="flex items-center gap-space-md">
                  <div className="w-16 h-16 rounded bg-surface-container-highest flex items-center justify-center text-xl font-bold text-primary">
                    {operator.photoInitials}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-md text-headline-md text-on-surface font-bold">{operator.name}</span>
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      {operator.siteRole} • {operator.id}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-2">
                  <Icon name="checklist" className="text-tertiary text-[22px]" />
                  <span className="font-headline-md text-headline-md text-on-surface uppercase">Real-Time Interlock Sensors</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-tertiary-container/20 text-tertiary font-label-sm text-label-sm font-bold uppercase">
                  {passCount} / {interlocks.length} Normal
                </span>
              </div>
              <div className="flex flex-col gap-2 mt-space-sm">
                {interlocks.map((s) => (
                  <SafetyChecklistItem key={s.id} item={s} />
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            <SectionCard>
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-2">
                  <Icon name="history_toggle_off" className="text-secondary text-[22px]" />
                  <span className="font-headline-md text-headline-md text-on-surface uppercase">Incident &amp; Near-Miss Log</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 mt-space-sm">
                {incidents.slice(0, 4).map((i) => (
                  <div key={i.id} className="p-space-sm bg-surface-container rounded flex flex-col gap-1.5 hover:bg-surface-container-high transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusPill label={i.category.replace('_', ' ')} token={i.severity === 'critical' ? 'error' : 'primary'} />
                        <span className="font-body-md text-body-md text-on-surface font-bold">{i.id}</span>
                      </div>
                      <span className="font-body-md text-[11px] text-outline">{i.timestamp}</span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant">{i.description}</p>
                    <div className="flex items-center justify-between text-outline font-label-sm text-label-sm pt-1">
                      <span>{i.sensorEvidence}</span>
                      <span className={`font-bold ${i.status === 'resolved' ? 'text-tertiary' : 'text-primary'}`}>
                        {i.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
