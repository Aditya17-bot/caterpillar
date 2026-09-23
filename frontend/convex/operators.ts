import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('operators').collect()
  },
})

export const getByOperatorId = query({
  args: { operatorId: v.string() },
  handler: async (ctx, { operatorId }) => {
    return await ctx.db
      .query('operators')
      .withIndex('by_operatorId', (q) => q.eq('operatorId', operatorId))
      .unique()
  },
})

export const getByRfid = query({
  args: { rfidId: v.string() },
  handler: async (ctx, { rfidId }) => {
    return await ctx.db
      .query('operators')
      .withIndex('by_rfid', (q) => q.eq('rfidId', rfidId))
      .unique()
  },
})

const demoOperators = [
  {
    operatorId: 'OP-001',
    name: 'Aaditya Tripathi',
    email: 'aaditya@catdemo.local',
    role: 'Lead Equipment Operator',
    rfidId: 'RFID-001',
    photoInitials: 'AT',
    certificationTier: 4,
    certifiedMachineTypes: ['excavator', 'loader', 'dozer'],
    experienceYears: 4.8,
    skill: 'Expert',
    trainingStatus: 'VALID',
    medicalValidUntil: 'Dec 2026',
    shift: '06:00 - 18:00',
    faceVerificationEnabled: true,
  },
  {
    operatorId: 'OP-002',
    name: 'Sarah Jenkins',
    email: 'sarah@catdemo.local',
    role: 'Senior Heavy Excavator Specialist',
    rfidId: 'RFID-002',
    photoInitials: 'SJ',
    certificationTier: 4,
    certifiedMachineTypes: ['excavator', 'loader'],
    experienceYears: 6.2,
    skill: 'Expert',
    trainingStatus: 'VALID',
    medicalValidUntil: 'Dec 2026',
    shift: '06:00 - 18:00',
    faceVerificationEnabled: true,
  },
  {
    operatorId: 'OP-003',
    name: 'Daniel Miller',
    email: 'daniel@catdemo.local',
    role: 'Equipment Operator',
    rfidId: 'RFID-003',
    photoInitials: 'DM',
    certificationTier: 3,
    certifiedMachineTypes: ['loader', 'dozer'],
    experienceYears: 2.7,
    skill: 'Intermediate',
    trainingStatus: 'VALID',
    medicalValidUntil: 'Jul 2026',
    shift: '06:00 - 18:00',
    faceVerificationEnabled: true,
  },
  {
    operatorId: 'OP-004',
    name: 'Dave Miller',
    email: 'dave@catdemo.local',
    role: 'Trainee Operator',
    rfidId: 'RFID-004',
    photoInitials: 'DM',
    certificationTier: 1,
    certifiedMachineTypes: ['loader'],
    experienceYears: 1.1,
    skill: 'Intermediate',
    trainingStatus: 'EXPIRED',
    medicalValidUntil: 'Mar 2026',
    shift: '06:00 - 18:00',
    faceVerificationEnabled: false,
  },
]

// Idempotent: only inserts if the table is empty. Safe to call on every app
// boot (see src/main.tsx).
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('operators').collect()
    if (existing.length > 0) return { seeded: false, count: existing.length }
    for (const op of demoOperators) {
      await ctx.db.insert('operators', op)
    }
    return { seeded: true, count: demoOperators.length }
  },
})
