import type { Machine, Operator } from '../types/domain'

export interface RFIDAuthResult {
  authorized: boolean
  operator: Operator
  reasonDenied?: string
}

// Simulated RFID authentication. No real hardware is involved — this is a
// mock gate used purely for the hackathon demo flow.
export function authenticateRFID(operator: Operator, machine: Machine): RFIDAuthResult {
  if (operator.trainingStatus === 'EXPIRED') {
    return {
      authorized: false,
      operator,
      reasonDenied: `Operator training certification has EXPIRED. Recertification is required before operating ${machine.model}.`,
    }
  }
  const certified = operator.certifiedMachineTypes.includes(machine.type) && operator.certificationTier >= 3
  if (!certified) {
    return {
      authorized: false,
      operator,
      reasonDenied: `Operator holds Tier-${operator.certificationTier} certification only. ${machine.model} requires Tier-3+ endorsement.`,
    }
  }
  return { authorized: true, operator }
}
