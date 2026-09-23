// Core domain types shared across the CAT Smart Operator Assistant frontend.
// Mock data and (future) API services both produce these shapes so UI
// components never need to know whether data came from a mock or a real API.

export type Severity = 'info' | 'warning' | 'critical'
export type SafetyState = 'pass' | 'warning' | 'fail'

export type MachineType = 'excavator' | 'loader' | 'dozer' | 'hauler'

export type MachineStatus =
  | 'available'
  | 'reserved'
  | 'in_use'
  | 'maintenance'
  | 'offline'
  | 'warning'
  | 'critical'

export interface MachineTelemetry {
  engineTempC: number
  rpm: number
  oilPressurePsi: number
  hydraulicPressureBar: number
  vibrationG: number
  fuelPct: number
  loadPct: number
  speedKmh: number
  recommendedSpeedKmh: number
  slopeDeg: number
  idleMin: number
  healthScore: number
}

export interface Machine {
  id: string
  name: string
  type: MachineType
  model: string
  status: MachineStatus
  ageYears: number
  engineHours: number
  serviceDueHours: number
  location: string
  currentOperatorId?: string
  currentTaskId?: string
  bucketConfig?: string
  telemetry: MachineTelemetry
  aiMatchScore?: number
  /** Live extras from the backend (absent in mock mode). */
  online?: boolean
  engineOn?: boolean
  seatbelt?: boolean
  obstacleCm?: number
  surface?: string
  ml?: MachineML
  pos?: { x: number; y: number; heading: number; elevation?: number }
  zone?: string | null
  inspectionStatus?: 'done' | 'pending' | 'locked'
  activeAlertTypes?: string[]
  currentOperatorName?: string
}

export interface MachineML {
  fault?: FaultLabel | null
  faultProb?: number | null
  advisory?: string
  overheatEtaSec?: number | null
}

export type CertificationTier = 1 | 2 | 3 | 4

export type OperatorSkill = 'Expert' | 'Intermediate' | 'Trainee'
export type TrainingStatus = 'VALID' | 'EXPIRED'

export interface Operator {
  id: string
  name: string
  badgeId: string
  photoInitials: string
  certificationTier: CertificationTier
  certifiedMachineTypes: MachineType[]
  experienceYears: number
  medicalValidUntil: string
  shift: string
  siteRole: string
  // Populated for operators sourced from the Convex login/identity layer.
  // Optional so pre-existing mock/demo Operator records stay valid.
  email?: string
  rfidId?: string
  skill?: OperatorSkill
  trainingStatus?: TrainingStatus
  faceVerificationEnabled?: boolean
}

export type TaskStatus = 'queued' | 'active' | 'completed' | 'scheduled'

export interface ScheduledTask {
  id: string
  title: string
  type: string
  status: TaskStatus
  startTime: string
  endTime: string
  volumeM3: number
  soilType: string
  slopeDeg: number
  priority: 'standard' | 'high' | 'critical'
  minCertTier: CertificationTier
  assignedMachineId?: string
  assignedOperatorId?: string
  location: string
  /** Backend fields (absent in mock mode). */
  backendId?: number
  predictedMin?: number
  predictedLow?: number
  predictedHigh?: number
  factors?: { factor: string; label: string; deltaMin: number }[]
  pace?: { doneM3: number; progressPct: number; elapsedMin: number; projectedMinutes: number | null; deltaMin: number | null }
  weather?: string
  tempC?: number
  actualMin?: number | null
  startedAt?: number | null
}

export interface WeatherSnapshot {
  condition: 'sunny' | 'cloudy' | 'rain' | 'wind'
  tempC: number
  windKt: number
  humidityPct: number
  baroHpa: number
}

export interface SafetyCheckItem {
  id: string
  label: string
  description: string
  state: SafetyState
  value?: string
}

export type AlertCategory =
  | 'proximity'
  | 'slope'
  | 'vibration'
  | 'drowsiness'
  | 'seatbelt'
  | 'overheat'
  | 'oil_pressure'
  | 'overspeed'
  | 'idle'
  | 'system'
  | 'rfid'
  | 'engine'
  | 'unsafe_operation'

export interface AlertItem {
  id: string
  severity: Severity
  category: AlertCategory
  title: string
  message: string
  machineId?: string
  operatorId?: string
  timestamp: string
  acknowledged: boolean
  resolved: boolean
}

export type IncidentStatus = 'open' | 'resolved' | 'under_review'

export interface Incident {
  id: string
  timestamp: string
  machineId: string
  operatorId: string
  location: string
  category: AlertCategory
  severity: Severity
  description: string
  sensorEvidence: string
  actionTaken: string
  resolution: string
  status: IncidentStatus
  backendId?: number
  hasBlackbox?: boolean
  alertType?: string
}

export interface AIFeatureWeight {
  label: string
  weightPct: number
  colorToken: 'primary' | 'error' | 'secondary' | 'tertiary'
}

export interface SpeedRecommendation {
  machineId: string
  currentSpeedKmh: number
  recommendedSpeedKmh: number
  reason: string
  confidencePct: number
  factors: AIFeatureWeight[]
  slopeDeg: number
  loadPct: number
  vibrationG: number
  surface: string
}

export type FaultLabel = 'normal' | 'overheating' | 'bearing_wear' | 'low_oil_pressure' | 'sensor_fault'

export interface FaultDiagnosis {
  machineId: string
  fault: FaultLabel
  confidencePct: number
  evidence: string
  recommendedAction: string
  component: string
  estimatedRemainingHours: number
}

export interface TaskTimePrediction {
  taskId: string
  aiEstimateMin: number
  historicalAverageMin: number
  actualMin?: number
  predictionErrorPct?: number
}

export type BehaviorCategory = 'normal' | 'excessive_idling' | 'unsafe_operation' | 'fuel_waste'

export interface AnomalyReport {
  machineId: string
  category: BehaviorCategory
  idleMin: number
  normalIdleMin: number
  fuelWasteL: number
  harshEvents: number
  overspeedEvents: number
  seatbeltOffSec: number
  proximityAlerts: number
  recommendation: string
}

export type DrowsinessState = 'alert' | 'drowsy' | 'no_face'

export interface DrowsinessReading {
  state: DrowsinessState
  confidencePct: number
  earValue: number
  blinkRatePerMin: number
  headPitchDeg: number
}

export type TrainingCategory =
  | 'safety'
  | 'machine_operation'
  | 'emergency_procedures'
  | 'fuel_efficiency'
  | 'terrain_handling'
  | 'maintenance_awareness'

export interface TrainingRecommendation {
  id: string
  moduleCode: string
  title: string
  category: TrainingCategory
  reason: string
  durationMin: number
  xp: number
  operatorId: string
  completed: boolean
}

export type NotificationKind = 'info' | 'warning' | 'critical' | 'resolved' | 'system' | 'ai'

export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  message: string
  timestamp: string
  read: boolean
  sourcePage?: string
}

export type ScenarioKey =
  | 'geofence_breach'
  | 'machine_proximity'
  | 'breakdown'
  | 'rollover'
  | 'normal'
  | 'heavy_load'
  | 'steep_slope'
  | 'high_vibration'
  | 'proximity_hazard'
  | 'seatbelt_violation'
  | 'drowsiness'
  | 'engine_overheating'
  | 'low_oil_pressure'
  | 'excessive_idling'
  | 'unsafe_operation'

export interface ScenarioDefinition {
  key: ScenarioKey
  label: string
  icon: string
  severity: Severity
  description: string
}

export interface ScenarioEffect {
  key: ScenarioKey
  telemetry: Partial<MachineTelemetry>
  speedRecommendation: SpeedRecommendation
  drowsiness: DrowsinessReading
  copilotMessage: string
  alert?: {
    severity: Severity
    category: AlertCategory
    title: string
    message: string
  }
  safetyOverrides?: Record<string, { state: SafetyState; value?: string }>
  createsIncident?: {
    category: AlertCategory
    severity: Severity
    description: string
    sensorEvidence: string
    actionTaken: string
  }
}
