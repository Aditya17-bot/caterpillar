import type { AnomalyReport, FaultDiagnosis, Machine, ScheduledTask, TaskTimePrediction } from '../types/domain'

// Live mode: derived from the backend's ML outputs attached to machines/tasks (Random Forest fault
// classifier, task-time regressor + per-factor explanation). Mock mode (backend offline): the original
// canned values, so the demo still runs without a server.

const FAULT_INFO: Record<string, { component: string; action: string }> = {
  normal: { component: 'All Subsystems', action: 'No action required. Continue standard maintenance interval.' },
  overheating: { component: 'Cooling System / Radiator', action: 'Reduce load and idle down; inspect radiator, fan belt and coolant level at next stop.' },
  bearing_wear: { component: 'Rotating Assembly Bearings', action: 'Book a vibration / bearing inspection within the next 50 operating hours.' },
  low_oil_pressure: { component: 'Engine Lubrication System', action: 'Stop the engine safely now; check oil level and pump before restarting.' },
  sensor_fault: { component: 'Sensor Harness / ECM', action: 'Readings are implausible: have the sensor wiring and ECM checked.' },
}

export function getFaultDiagnosis(machine: Machine | string): FaultDiagnosis {
  if (typeof machine !== 'string' && machine.ml) {
    const t = machine.telemetry
    const fault = machine.ml.fault ?? 'normal'
    const info = FAULT_INFO[fault] ?? FAULT_INFO.normal
    const eta = machine.ml.overheatEtaSec
    return {
      machineId: machine.id,
      fault,
      confidencePct: Math.round((machine.ml.faultProb ?? 0.95) * 1000) / 10,
      evidence: machine.engineOn
        ? `Coolant ${t.engineTempC}°C, oil ${t.oilPressurePsi} psi, vibration ${t.vibrationG} G, ${t.rpm} rpm, ${machine.engineHours.toLocaleString()} engine hours.` +
          (eta ? ` Temperature trend reaches 110°C in ~${Math.round(eta / 60)} min.` : '')
        : 'Engine off: fault model paused (cold readings would mislead it).',
      recommendedAction: info.action,
      component: info.component,
      estimatedRemainingHours: fault === 'normal' ? machine.serviceDueHours : fault === 'bearing_wear' ? 50 : 0,
    }
  }
  const machineId = typeof machine === 'string' ? machine : machine.id
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

/**
 * aiEstimateMin: model prediction for today's conditions.
 * historicalAverageMin: live mode = the same model under typical conditions (prediction minus the
 * explained factor effects), i.e. "how long this job usually takes".
 */
export function getTaskTimePrediction(task: ScheduledTask | string | undefined, actualMin?: number): TaskTimePrediction {
  if (task && typeof task !== 'string' && task.predictedMin != null) {
    const aiEstimateMin = Math.round(task.predictedMin)
    const effects = (task.factors || []).reduce((s, f) => s + f.deltaMin, 0)
    const historicalAverageMin = Math.max(1, Math.round(task.predictedMin - effects))
    const actual = task.actualMin ?? actualMin
    const predictionErrorPct = actual ? Number((((actual - aiEstimateMin) / aiEstimateMin) * 100).toFixed(1)) : undefined
    return { taskId: task.id, aiEstimateMin, historicalAverageMin, actualMin: actual ?? undefined, predictionErrorPct }
  }
  const taskId = typeof task === 'string' ? task : (task?.id ?? 'TSK-8821')
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
