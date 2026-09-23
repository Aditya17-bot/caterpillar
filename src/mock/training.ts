import type { TrainingRecommendation } from '../types/domain'

export const mockTraining: TrainingRecommendation[] = [
  {
    id: 'TR-01',
    moduleCode: 'CAT-SIM-404B',
    title: 'Safe Heavy Machine Operation on Extreme Slopes (>12°)',
    category: 'terrain_handling',
    reason: 'Elevated speed delta (22 vs 15 km/h) detected on North Bench incline during heavy payload swing.',
    durationMin: 15,
    xp: 15,
    operatorId: 'OP-01',
    completed: false,
  },
  {
    id: 'TR-02',
    moduleCode: 'CAT-SIM-112A',
    title: 'Proximity Awareness & Blind Spot Management',
    category: 'safety',
    reason: '1 proximity auto-brake event recorded this shift.',
    durationMin: 10,
    xp: 10,
    operatorId: 'OP-01',
    completed: false,
  },
  {
    id: 'TR-03',
    moduleCode: 'CAT-SIM-221C',
    title: 'Fatigue Recognition & Cab Break Protocol',
    category: 'emergency_procedures',
    reason: '1 micro-sleep advisory logged during shift.',
    durationMin: 8,
    xp: 8,
    operatorId: 'OP-01',
    completed: true,
  },
]
