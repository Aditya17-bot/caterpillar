import type { AnomalyReport, FaultDiagnosis, TaskTimePrediction } from '../types/domain'

// Mock implementations standing in for future ML/API calls. Swapping these
// bodies for real fetch() calls will not require any UI changes, since the
// return shapes match the domain types the components already consume.

export function getFaultDiagnosis(machineId: string): FaultDiagnosis {
  if (machineId === 'TRK-004') {
    return {
      machineId,
      fault: 'low_oil_pressure',
      confidencePct: 99.1,
      evidence: 'Oil pressure 1.8 PSI vs 45 PSI minimum, coolant 106.8°C, vibration 2.41G',
      recommendedAction: 'Immediate shutdown and workshop inspection required.',
      component: 'Engine Lubrication System',
      estimatedRemainingHours: 0,
    }
  }
  if (machineId === 'EXC-002') {
    return {
      machineId,
      fault: 'bearing_wear',
      confidencePct: 87.4,
      evidence: 'Elevated 224Hz harmonic vibration resonance (+0.22G delta vs 3,500hr baseline).',
      recommendedAction: 'Schedule ultrasonic bearing inspection at next 50-hour service window (~3 days).',
      component: 'Right Track Idler Bearing Assembly',
      estimatedRemainingHours: 68,
    }
  }
  return {
    machineId,
    fault: 'normal',
    confidencePct: 96.2,
    evidence: 'All subsystem telemetry within nominal operating bands.',
    recommendedAction: 'No action required. Continue standard maintenance interval.',
    component: 'All Subsystems',
    estimatedRemainingHours: 9999,
  }
}

export function getTaskTimePrediction(taskId: string, actualMin?: number): TaskTimePrediction {
  const aiEstimateMin = 62
  const historicalAverageMin = 67
  const predictionErrorPct = actualMin ? Number((((actualMin - aiEstimateMin) / aiEstimateMin) * 100).toFixed(1)) : undefined
  return { taskId, aiEstimateMin, historicalAverageMin, actualMin, predictionErrorPct }
}

export function getAnomalyReport(machineId: string): AnomalyReport {
  return {
    machineId,
    category: 'excessive_idling',
    idleMin: 11.4,
    normalIdleMin: 4.2,
    fuelWasteL: 3.8,
    harshEvents: 1,
    overspeedEvents: 2,
    seatbeltOffSec: 0,
    proximityAlerts: 2,
    recommendation: 'Reduce idle duration between haul cycles to cut fuel waste.',
  }
}
