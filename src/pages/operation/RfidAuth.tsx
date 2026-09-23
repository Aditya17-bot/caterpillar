import { useNavigate } from 'react-router-dom'
import Icon from '../../components/common/Icon'
import SectionCard from '../../components/common/SectionCard'
import StatusPill from '../../components/common/StatusPill'
import { useAppStore, selectActiveMachine } from '../../store/useAppStore'
import { mockOperators } from '../../mock/operators'

export default function RfidAuth() {
  const navigate = useNavigate()
  const machine = useAppStore(selectActiveMachine)
  const operator = useAppStore((s) => s.operator)
  const authStatus = useAppStore((s) => s.authStatus)
  const authDenialReason = useAppStore((s) => s.authDenialReason)
  const authenticateOperator = useAppStore((s) => s.authenticateOperator)

  const authorized = authStatus === 'authorized'
  const denied = authStatus === 'denied'

  return (
    <div className="w-full p-space-lg flex flex-col gap-space-lg max-w-5xl mx-auto">
      <SectionCard className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <div className="w-12 h-12 bg-primary-container text-on-primary-container flex items-center justify-center rounded">
            <Icon name="badge" className="text-[28px]" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md text-on-surface uppercase tracking-tight">RFID Operator Authentication</span>
            <span className="font-body-md text-body-md text-on-surface-variant">Simulated CheckMate Industrial RFID Reader — no real hardware involved.</span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            onClick={() => authenticateOperator('OP-01')}
            className="px-space-md py-2 bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary font-label-md text-label-md uppercase tracking-wider font-bold rounded transition-all"
          >
            Simulate Authorized Badge
          </button>
          <button
            onClick={() => authenticateOperator('OP-07')}
            className="px-space-md py-2 bg-error-container text-error hover:bg-error hover:text-on-error font-label-md text-label-md uppercase tracking-wider font-bold rounded flex items-center gap-1.5 transition-all"
          >
            <Icon name="block" className="text-[16px]" />
            Simulate Unauthorized Badge
          </button>
        </div>
      </SectionCard>

      <SectionCard className={`flex flex-col gap-space-md ${denied ? 'bg-error-container/10' : ''}`}>
        <div className="flex items-center justify-between">
          <StatusPill
            label={authorized ? 'RFID Authenticated // Zero Lockouts' : denied ? 'Access Denied // Critical Lockout' : 'Awaiting Badge Scan'}
            token={authorized ? 'tertiary' : denied ? 'error' : 'secondary'}
            pulse
          />
        </div>
        <h2 className={`font-headline-lg text-headline-lg uppercase tracking-tight ${denied ? 'text-error' : 'text-on-surface'}`}>
          {authorized
            ? `Machine Access Granted to ${machine.id}`
            : denied
              ? `Access Denied: ${operator.id} Not Certified for ${machine.id}`
              : 'Scan badge to continue'}
        </h2>
        {denied && <p className="font-body-lg text-body-lg text-on-surface-variant">{authDenialReason}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md mt-space-sm">
          <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Operator Credentials</span>
            <div className="flex items-center gap-space-md my-2">
              <div className="w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center text-lg font-bold text-primary">
                {operator.photoInitials}
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-surface">{operator.name}</span>
                <span className="font-body-md text-body-md text-primary font-mono">{operator.id}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">Badge: {operator.badgeId}</span>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Machinery Certification</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {mockOperators
                .find((o) => o.id === operator.id)
                ?.certifiedMachineTypes.map((t) => (
                  <span key={t} className="px-2 py-1 bg-surface-container-high text-primary font-body-md text-body-md font-mono rounded font-semibold">
                    {t.toUpperCase()} APPROVED
                  </span>
                ))}
              {operator.certifiedMachineTypes.length === 0 && (
                <span className="px-2 py-1 bg-error-container text-error font-body-md text-body-md font-mono rounded font-bold">
                  NO ENDORSEMENTS ON FILE
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono pt-2 text-on-surface-variant">
              <span>
                Target: <span className="text-on-surface font-bold">{machine.model}</span>
              </span>
              <span className={authorized ? 'text-tertiary font-bold' : 'text-error font-bold'}>
                {authorized ? 'MATCH CONFIRMED' : denied ? 'CLASS REJECTED' : 'PENDING'}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="flex flex-col sm:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm">
          <Icon name={authorized ? 'arrow_forward_ios' : 'lock'} className={`text-[24px] ${authorized ? 'text-primary' : 'text-error'}`} />
          <span className="font-body-md text-body-md text-on-surface-variant">
            {authorized ? 'Proceed to schedule and machine selection.' : 'Resolve authorization before continuing.'}
          </span>
        </div>
        <button
          disabled={!authorized}
          onClick={() => navigate('/schedule')}
          className={`px-space-xl py-3.5 font-headline-md text-label-md uppercase tracking-wider font-bold rounded flex items-center justify-center gap-space-sm shadow-md transition-all ${
            authorized
              ? 'bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary'
              : 'bg-surface-container-high text-outline cursor-not-allowed'
          }`}
        >
          <span>Proceed to Schedule &amp; Task Selection</span>
          <Icon name="arrow_forward" className="text-[20px]" />
        </button>
      </SectionCard>
    </div>
  )
}
