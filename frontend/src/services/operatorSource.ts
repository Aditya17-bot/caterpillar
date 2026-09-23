import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { CONVEX_ENABLED } from './convex'
import { apiGet } from './backend'
import { mockOperators } from '../mock/operators'

/** Shape the login page works with (same fields as the Convex `operators` table). */
export interface LoginOperator {
  _id: string
  operatorId: string
  name: string
  email: string
  role: string
  rfidId: string
  photoInitials: string
  certificationTier: number
  certifiedMachineTypes: string[]
  experienceYears: number
  skill: string
  trainingStatus: string
  medicalValidUntil: string
  shift: string
  faceVerificationEnabled: boolean
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function fromBackend(o: any): LoginOperator {
  const exp = Number(o.experience_yrs ?? 5)
  const certified: string[] = o.certified || []
  const parts = String(o.name).split(' ')
  return {
    _id: o.id,
    operatorId: o.id,
    name: o.name,
    email: `${parts[0].toLowerCase()}@catdemo.local`,
    role: certified.length ? `${certified.map(cap).join(' / ')} Operator` : 'Trainee Operator',
    rfidId: o.rfid,
    photoInitials: (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase(),
    certificationTier: exp >= 10 ? 4 : exp >= 3 ? 3 : exp >= 1.5 ? 2 : 1,
    certifiedMachineTypes: certified,
    experienceYears: exp,
    skill: exp >= 10 ? 'Expert' : exp >= 3 ? 'Intermediate' : 'Trainee',
    trainingStatus: 'VALID',
    medicalValidUntil: 'Dec 2026',
    shift: '06:00 - 18:00',
    faceVerificationEnabled: true,
  }
}

const fromMock = (): LoginOperator[] =>
  mockOperators.map((o) => ({
    _id: o.id,
    operatorId: o.id,
    name: o.name,
    email: `${o.name.split(' ')[0].toLowerCase()}@catdemo.local`,
    role: o.siteRole,
    rfidId: o.badgeId,
    photoInitials: o.photoInitials,
    certificationTier: o.certificationTier,
    certifiedMachineTypes: o.certifiedMachineTypes,
    experienceYears: o.experienceYears,
    skill: o.experienceYears >= 10 ? 'Expert' : o.experienceYears >= 3 ? 'Intermediate' : 'Trainee',
    trainingStatus: o.certificationTier < 2 ? 'EXPIRED' : 'VALID',
    medicalValidUntil: o.medicalValidUntil,
    shift: o.shift,
    faceVerificationEnabled: true,
  }))

function useConvexOperators(): LoginOperator[] | undefined {
  return useQuery(api.operators.list) as LoginOperator[] | undefined
}

/** Operators from our FastAPI backend (same people the simulator logs into the machines). */
function useBackendOperators(): LoginOperator[] | undefined {
  const [ops, setOps] = useState<LoginOperator[] | undefined>(undefined)
  useEffect(() => {
    apiGet('/api/operators')
      .then((rows: any[]) => setOps(rows.map(fromBackend)))
      .catch(() => setOps(fromMock())) // backend offline: demo operators
  }, [])
  return ops
}

/** Where the login registry comes from: Convex when configured, otherwise the backend. */
export const useLoginOperators = CONVEX_ENABLED ? useConvexOperators : useBackendOperators
export const OPERATOR_SOURCE = CONVEX_ENABLED ? 'Convex' : 'site backend'
