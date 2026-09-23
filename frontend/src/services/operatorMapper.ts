import type { CertificationTier, MachineType, Operator, OperatorSkill, TrainingStatus } from '../types/domain'
import type { Doc } from '../../convex/_generated/dataModel'

// Converts a Convex `operators` document (the login/identity source of
// truth) into the existing frontend `Operator` shape every page already
// reads from useAppStore — so no dashboard component needs to change.
export function operatorFromConvexDoc(doc: Doc<'operators'>): Operator {
  return {
    id: doc.operatorId,
    name: doc.name,
    badgeId: doc.rfidId,
    photoInitials: doc.photoInitials,
    certificationTier: doc.certificationTier as CertificationTier,
    certifiedMachineTypes: doc.certifiedMachineTypes as MachineType[],
    experienceYears: doc.experienceYears,
    medicalValidUntil: doc.medicalValidUntil,
    shift: doc.shift,
    siteRole: doc.role,
    email: doc.email,
    rfidId: doc.rfidId,
    skill: doc.skill as OperatorSkill,
    trainingStatus: doc.trainingStatus as TrainingStatus,
    faceVerificationEnabled: doc.faceVerificationEnabled,
  }
}
