import type { Operator } from '../types/domain'

export const mockOperators: Operator[] = [
  {
    id: 'OP-01',
    name: 'Sarah Jenkins',
    badgeId: 'NFC-4821-BETA',
    photoInitials: 'SJ',
    certificationTier: 4,
    certifiedMachineTypes: ['excavator', 'loader'],
    experienceYears: 12,
    medicalValidUntil: 'Dec 2026',
    shift: '06:00 - 18:00',
    siteRole: 'Senior Heavy Excavator Specialist',
  },
  {
    id: 'OP-07',
    name: 'Dave Miller',
    badgeId: 'NFC-9901-REVOKED',
    photoInitials: 'DM',
    certificationTier: 1,
    certifiedMachineTypes: [],
    experienceYears: 1,
    medicalValidUntil: 'Mar 2026',
    shift: '06:00 - 18:00',
    siteRole: 'Uncertified Operator (Skid Steer Only)',
  },
  {
    id: 'OP-0312',
    name: 'M. Kowalski',
    badgeId: 'NFC-2210-ALPHA',
    photoInitials: 'MK',
    certificationTier: 3,
    certifiedMachineTypes: ['dozer'],
    experienceYears: 6,
    medicalValidUntil: 'Jul 2026',
    shift: '06:00 - 18:00',
    siteRole: 'Dozer Operator',
  },
]

// Pre-login/post-logout placeholder only. The real, dynamic operator comes
// from Convex via the Login page (see src/services/operatorMapper.ts) once
// authenticated — see useAppStore's `login`/`logout` actions.
export const currentOperator = mockOperators[0]
