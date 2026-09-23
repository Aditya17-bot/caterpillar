import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Convex owns operator identity/profile data only — authentication (via
// simulated RFID/face selection) and the operator records it looks up.
// Machine telemetry, scenarios, alerts, incidents, and analytics remain in
// the existing frontend mock/simulation layer (see src/store/useAppStore.ts).
export default defineSchema({
  operators: defineTable({
    operatorId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.string(),
    rfidId: v.string(),
    photoInitials: v.string(),
    certificationTier: v.number(),
    certifiedMachineTypes: v.array(v.string()),
    experienceYears: v.number(),
    skill: v.string(),
    trainingStatus: v.string(),
    medicalValidUntil: v.string(),
    shift: v.string(),
    faceVerificationEnabled: v.boolean(),
  })
    .index('by_operatorId', ['operatorId'])
    .index('by_rfid', ['rfidId']),
})
