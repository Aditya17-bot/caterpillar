import type { ScenarioDefinition } from '../types/domain'

export const scenarioDefinitions: ScenarioDefinition[] = [
  { key: 'normal', label: 'Normal Operation', icon: 'check_circle', severity: 'info', description: 'Baseline nominal operation.' },
  { key: 'heavy_load', label: 'Heavy Load', icon: 'weight', severity: 'warning', description: 'Bucket payload above 90% capacity.' },
  { key: 'steep_slope', label: 'Steep Slope', icon: 'landscape', severity: 'warning', description: '+14.2° uphill grade alert.' },
  { key: 'high_vibration', label: 'High Vibration', icon: 'vibration', severity: 'warning', description: 'Chassis vibration above 2.0G.' },
  { key: 'proximity_hazard', label: 'Proximity Hazard', icon: 'crisis_alert', severity: 'critical', description: 'Obstacle detected within 2.4m.' },
  { key: 'seatbelt_violation', label: 'Seatbelt Violation', icon: 'no_transfer', severity: 'critical', description: 'Seatbelt disengaged mid-operation.' },
  { key: 'drowsiness', label: 'Drowsiness', icon: 'bedtime', severity: 'critical', description: 'Operator microsleep risk detected.' },
  { key: 'engine_overheating', label: 'Engine Overheating', icon: 'local_fire_department', severity: 'critical', description: 'Coolant temperature exceeds redline.' },
  { key: 'low_oil_pressure', label: 'Low Oil Pressure', icon: 'oil_barrel', severity: 'critical', description: 'Oil pressure collapse detected.' },
  { key: 'excessive_idling', label: 'Excessive Idling', icon: 'hourglass_bottom', severity: 'warning', description: 'Idle time exceeds efficiency target.' },
  { key: 'unsafe_operation', label: 'Unsafe Operation', icon: 'dangerous', severity: 'critical', description: 'Multiple safety envelopes breached.' },
]

export function getScenarioDefinition(key: string) {
  return scenarioDefinitions.find((s) => s.key === key) ?? scenarioDefinitions[0]
}
