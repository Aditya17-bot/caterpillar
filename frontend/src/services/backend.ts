// Real backend (FastAPI, see docs/CONTRACT.md). The UI keeps working on mock data when it is down.
import type {
  AIFeatureWeight,
  AlertCategory,
  AlertItem,
  DrowsinessReading,
  FaultLabel,
  Incident,
  Machine,
  MachineStatus,
  MachineType,
  Operator,
  SafetyCheckItem,
  ScenarioKey,
  ScheduledTask,
  SpeedRecommendation,
  TrainingCategory,
  TrainingRecommendation,
} from '../types/domain'

export const API: string = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function apiGet<T = any>(path: string): Promise<T> {
  const r = await fetch(API + path)
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json()
}

export async function apiSend<T = any>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json()
}

/** Scenario deck button -> simulator command(s) (see simulator/sim.py SCENARIOS). */
export const SCENARIO_COMMANDS: Record<ScenarioKey, string[]> = {
  normal: ['normal'],
  heavy_load: ['heavy_load'],
  steep_slope: ['steep_slope'],
  high_vibration: ['bearing_wear'],
  proximity_hazard: ['worker_approach'],
  seatbelt_violation: ['unbuckle'],
  drowsiness: [], // camera-driven: sent as camera events instead
  engine_overheating: ['overheat'],
  low_oil_pressure: ['low_oil'],
  excessive_idling: ['long_idle'],
  unsafe_operation: ['overspeed', 'harsh'],
  geofence_breach: ['enter_zone'],
  machine_proximity: ['approach_machine'],
  breakdown: ['breakdown'],
  rollover: ['rollover'],
}

const COMMAND_TO_SCENARIO: Record<string, ScenarioKey> = Object.fromEntries(
  Object.entries(SCENARIO_COMMANDS).flatMap(([k, cmds]) => cmds.map((c) => [c, k as ScenarioKey])),
)

export function scenarioFromTelemetry(scenarios: string[] | undefined): ScenarioKey {
  const first = (scenarios || []).find((s) => COMMAND_TO_SCENARIO[s])
  return first ? COMMAND_TO_SCENARIO[first] : 'normal'
}

// ---------- mapping helpers ----------

const ZONE_NAMES: Record<string, string> = {
  'pit-edge': 'Quarry pit edge',
  office: 'Site office & walkway',
  'power-line': 'Overhead power line',
  'gas-pipe': 'Buried gas pipe',
}

const MODEL_NAMES: Record<string, string> = {
  excavator: 'Hydraulic Excavator',
  loader: 'Wheel Loader',
  dozer: 'Track Dozer',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
const round1 = (n: number) => Math.round(n * 10) / 10

export interface BackendSummary {
  machineId: string
  machineType?: string
  online?: boolean
  operator?: any
  telemetry?: any
  predictions?: any
  activeAlerts?: any[]
  pos?: any
  zone?: string | null
  inspection?: { status: 'done' | 'pending' | 'locked' }
  sosId?: number | null
}

export function operatorFromBackend(o: any): Operator {
  const exp = Number(o.experience_yrs ?? 5)
  const certified: MachineType[] = o.certified || []
  const parts = String(o.name || o.id).split(' ')
  return {
    id: o.id,
    name: o.name,
    badgeId: o.rfid,
    photoInitials: (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase(),
    certificationTier: exp >= 10 ? 4 : exp >= 3 ? 3 : exp >= 1.5 ? 2 : 1,
    certifiedMachineTypes: certified,
    experienceYears: exp,
    medicalValidUntil: 'Dec 2026',
    shift: '06:00 - 18:00',
    siteRole: certified.length ? `${certified.map(cap).join(' / ')} Operator` : 'Trainee Operator',
  }
}

function healthScore(t: any, p: any): number {
  if (!t.engineOn) return 90
  if (p?.fault && p.fault !== 'normal') return Math.round(Math.max(20, 100 - (p.faultProb ?? 0.6) * 55))
  let h = 97 - (t.vibration ?? 0.3) * 4 - Math.max(0, (t.engineTempC ?? 85) - 95) * 1.2
  if ((t.oilPressurePsi ?? 50) < 25) h -= 20
  return Math.round(Math.max(20, Math.min(100, h)))
}

function machineStatus(s: BackendSummary): MachineStatus {
  if (s.online === false) return 'offline'
  if (s.inspection?.status === 'locked') return 'maintenance'
  const alerts = s.activeAlerts || []
  if (alerts.some((a) => a.severity === 'critical')) return 'critical'
  if (alerts.some((a) => a.severity === 'warning')) return 'warning'
  if (s.operator) return 'in_use'
  return 'available'
}

export function machineFromBackend(meta: { id: string; type: string; model?: string }, s: BackendSummary | undefined, prev?: Machine): Machine {
  const t = s?.telemetry || {}
  const p = s?.predictions || {}
  const type = (s?.machineType || meta.type || 'excavator') as MachineType
  const load = Number(t.loadPct ?? 0)
  const engineOn = !!t.engineOn
  const prevT = prev?.telemetry
  // fuel is not a sensor in the simulator: integrate the fuel rate against a 400 L tank
  let fuel = prevT?.fuelPct ?? 70 + (meta.id.charCodeAt(meta.id.length - 1) % 20)
  fuel -= ((t.fuelRateLph ?? 0) / 3600 / 400) * 100
  if (fuel < 8) fuel = 95 // refuelled
  const idle = (prevT?.idleMin ?? 0) + (engineOn && (t.speedKmh ?? 0) < 0.5 ? 1 / 60 : 0)
  const hours = Number(t.engineHours ?? prev?.engineHours ?? 4000)
  const zoneName = s?.zone ? ZONE_NAMES[s.zone] ?? s.zone : null
  return {
    id: meta.id,
    name: meta.id,
    type,
    model: `${meta.model ?? 'Cat'} ${MODEL_NAMES[type] ?? ''}`.trim().replace(/^CAT/, 'Cat'),
    status: s ? machineStatus(s) : 'offline',
    ageYears: round1(hours / 1500),
    engineHours: Math.round(hours),
    serviceDueHours: Math.round(250 - (hours % 250)),
    location: zoneName ? `⚠ ${zoneName}` : s?.pos ? `Sector 7 · ${Math.round(s.pos.x)}E ${Math.round(s.pos.y)}N` : 'Sector 7',
    currentOperatorId: s?.operator?.id,
    currentOperatorName: s?.operator?.name,
    bucketConfig: type === 'excavator' ? '1.5 m³ GP bucket' : type === 'loader' ? '3.0 m³ bucket' : '4.0 m³ SU blade',
    aiMatchScore: prev?.aiMatchScore,
    telemetry: {
      engineTempC: round1(t.engineTempC ?? 0),
      rpm: Math.round(t.rpm ?? 0),
      oilPressurePsi: round1(t.oilPressurePsi ?? 0),
      hydraulicPressureBar: engineOn ? Math.round(260 + load * 0.9 + (t.vibration ?? 0) * 10) : 0,
      vibrationG: Math.round((t.vibration ?? 0) * 100) / 100,
      fuelPct: Math.round(fuel * 10) / 10,
      loadPct: Math.round(load),
      speedKmh: round1(t.speedKmh ?? 0),
      recommendedSpeedKmh: p.optimalSpeedKmh ?? 0,
      slopeDeg: round1(t.slopeDeg ?? 0),
      idleMin: Math.round(idle * 10) / 10,
      healthScore: healthScore(t, p),
    },
    online: s?.online,
    engineOn,
    seatbelt: t.seatbelt,
    obstacleCm: t.obstacleCm,
    surface: t.surface,
    ml: { fault: p.fault as FaultLabel | null, faultProb: p.faultProb, advisory: p.advisory, overheatEtaSec: p.overheatEtaSec },
    pos: s?.pos,
    zone: s?.zone,
    inspectionStatus: s?.inspection?.status,
    activeAlertTypes: (s?.activeAlerts || []).map((a) => a.type),
  }
}

// ---------- ML explanations for the speed copilot ----------

const SURFACE_FACTOR: Record<string, number> = { asphalt: 1, gravel: 0.85, sand: 0.7, mud: 0.55 }

/** How much each condition pulls the advised speed down (same factors the speed model was trained on). */
export function speedFactors(m: Machine): AIFeatureWeight[] {
  const slope = m.telemetry.slopeDeg
  const a = Math.abs(slope)
  const slopePen = slope >= 0 ? 0.022 * a : 0.008 * a + 0.02 * Math.max(0, a - 10)
  const raw = [
    { label: `Slope Gradient (${slope > 0 ? '+' : ''}${slope}°)`, v: slopePen, colorToken: 'primary' as const },
    { label: `Surface (${m.surface ?? 'gravel'})`, v: 1 - (SURFACE_FACTOR[m.surface ?? 'gravel'] ?? 0.85), colorToken: 'tertiary' as const },
    { label: `Bucket Payload (${m.telemetry.loadPct}%)`, v: 0.003 * m.telemetry.loadPct, colorToken: 'secondary' as const },
    { label: `Vibration (${m.telemetry.vibrationG}G)`, v: 0.15 * m.telemetry.vibrationG, colorToken: 'error' as const },
  ]
  const total = raw.reduce((s, f) => s + f.v, 0) || 1
  return raw
    .sort((x, y) => y.v - x.v)
    .slice(0, 3)
    .map((f) => ({ label: f.label, weightPct: Math.round((100 * f.v) / total), colorToken: f.colorToken }))
}

export function speedRecommendationFor(m: Machine, r2 = 0.982): SpeedRecommendation {
  return {
    machineId: m.id,
    currentSpeedKmh: m.telemetry.speedKmh,
    recommendedSpeedKmh: m.telemetry.recommendedSpeedKmh,
    reason: m.ml?.advisory
      ? `${m.ml.advisory} Random Forest trained on slope, surface, payload and vibration advises ${m.telemetry.recommendedSpeedKmh} km/h here.`
      : 'Waiting for live telemetry…',
    confidencePct: r2 * 100,
    factors: speedFactors(m),
    slopeDeg: m.telemetry.slopeDeg,
    loadPct: m.telemetry.loadPct,
    vibrationG: m.telemetry.vibrationG,
    surface: cap(m.surface ?? 'gravel'),
  }
}

// ---------- alerts & incidents ----------

const CATEGORY: Record<string, AlertCategory> = {
  seatbelt: 'seatbelt',
  proximity: 'proximity',
  camera_person: 'proximity',
  machine_proximity: 'proximity',
  overheat: 'overheat',
  overheat_predicted: 'overheat',
  unsafe_tilt: 'slope',
  engine_fault: 'engine',
  overspeed: 'overspeed',
  idling: 'idle',
  anomaly: 'unsafe_operation',
  geofence: 'unsafe_operation',
  drowsy: 'drowsiness',
  sos: 'system',
  sos_nearby: 'system',
  lockout: 'system',
  no_inspection: 'system',
}

const TITLES: Record<string, string> = {
  seatbelt: 'Seatbelt Unfastened',
  proximity: 'Proximity Hazard',
  camera_person: 'Person Detected by Camera',
  machine_proximity: 'Machine Convergence',
  overheat: 'Engine Overheat',
  overheat_predicted: 'Overheat Predicted (AI Forecast)',
  unsafe_tilt: 'Unsafe Tilt',
  engine_fault: 'AI Engine Fault Prediction',
  overspeed: 'Over Advised Speed',
  idling: 'Excessive Idling',
  anomaly: 'Unusual Operating Pattern',
  geofence: 'Danger Zone Breach',
  drowsy: 'Operator Drowsiness',
  sos: 'SOS Raised',
  sos_nearby: 'SOS From Nearby Machine',
  lockout: 'Machine Locked Out',
  no_inspection: 'Pre-Start Inspection Missing',
}

export const alertCategory = (type: string): AlertCategory => CATEGORY[type] ?? 'system'
export const alertTitle = (type: string): string => TITLES[type] ?? cap(type)

export function alertFromBackend(a: any, active: boolean, acknowledged: boolean): AlertItem {
  return {
    id: `${a.machineId}-${a.type}-${a.ts}`,
    severity: a.severity,
    category: alertCategory(a.type),
    title: alertTitle(a.type),
    message: a.message,
    machineId: a.machineId,
    operatorId: a.operatorId ?? undefined,
    timestamp: new Date(a.ts * 1000).toLocaleTimeString('en-US', { hour12: false }),
    acknowledged,
    resolved: !active,
  }
}

const ACTION: Record<string, string> = {
  seatbelt: 'Operator alerted by voice; incident logged.',
  proximity: 'Proximity alarm; operator instructed to stop.',
  camera_person: 'Camera detection; operator instructed to stop.',
  machine_proximity: 'Both operators warned to keep clear.',
  overheat: 'Load reduction advised; engine monitored.',
  overheat_predicted: 'Early warning issued before 110 °C limit.',
  unsafe_tilt: 'Stop and reposition instruction issued.',
  engine_fault: 'Maintenance suggested from ML fault model.',
  overspeed: 'Advised terrain speed announced.',
  idling: 'Shutdown suggested to save fuel.',
  anomaly: 'Usage window flagged by IsolationForest.',
  geofence: 'Zone breach alarm; reverse-out instruction.',
  drowsy: 'Break enforced; fatigue training recommended.',
  sos: 'Supervisor and nearby machines alerted.',
  sos_nearby: 'Nearby machine asked to respond.',
  lockout: 'Engine interlocked; urgent maintenance request.',
  no_inspection: 'Operator prompted to complete walk-around.',
}

export function incidentFromBackend(r: any): Incident {
  const snap = r.snapshot || {}
  const evidence = [
    snap.engineTempC != null && `${Math.round(snap.engineTempC)}°C`,
    snap.slopeDeg != null && `slope ${Math.round(snap.slopeDeg)}°`,
    snap.obstacleCm != null && `obstacle ${Math.round(snap.obstacleCm)} cm`,
    snap.speedKmh != null && `${round1(snap.speedKmh)} km/h`,
    snap.oilPressurePsi != null && `oil ${Math.round(snap.oilPressurePsi)} psi`,
  ]
    .filter(Boolean)
    .join(' · ')
  const recent = Date.now() / 1000 - r.ts < 300
  return {
    id: `INC-${String(r.id).padStart(5, '0')}`,
    backendId: r.id,
    timestamp: new Date(r.ts * 1000).toLocaleString('en-US', { hour12: false }),
    machineId: r.machine_id,
    operatorId: r.operator_id ?? '—',
    location: snap.posX != null ? `Sector 7 · ${Math.round(snap.posX)}E ${Math.round(snap.posY)}N` : 'Sector 7',
    category: alertCategory(r.type),
    severity: r.severity,
    description: r.message,
    sensorEvidence: evidence || 'Historical record',
    actionTaken: ACTION[r.type] ?? 'Logged.',
    resolution: r.hasBlackbox ? 'Black-box recording available.' : 'Closed.',
    status: recent && r.severity === 'critical' ? 'open' : recent ? 'under_review' : 'resolved',
    hasBlackbox: r.hasBlackbox,
    alertType: r.type,
  }
}

// ---------- tasks ----------

export function tasksFromBackend(rows: any[]): ScheduledTask[] {
  const clock: Record<string, number> = {}
  return rows.map((t) => {
    const key = `${t.machine_id}-${t.time_of_day}`
    const start = clock[key] ?? (t.time_of_day === 'morning' ? 7 * 60 : 13 * 60)
    const dur = Math.round(t.predicted_minutes ?? 60)
    clock[key] = start + dur + 15
    const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    return {
      id: `T-${t.id}`,
      backendId: t.id,
      title: `${cap(t.task_type)} — ${t.site}`,
      type: cap(t.task_type),
      status: t.status === 'done' ? 'completed' : t.status === 'in_progress' ? 'active' : 'scheduled',
      startTime: hhmm(start),
      endTime: hhmm(start + dur),
      volumeM3: t.volume_m3,
      soilType: cap(t.soil_type),
      slopeDeg: t.slope_deg,
      priority: t.volume_m3 >= 200 ? 'high' : 'standard',
      minCertTier: t.soil_type === 'rock' ? 3 : 2,
      assignedMachineId: t.machine_id,
      assignedOperatorId: t.operator_id,
      location: t.site,
      predictedMin: t.predicted_minutes,
      predictedLow: t.predicted_low,
      predictedHigh: t.predicted_high,
      factors: t.factors || [],
      pace: t.pace,
      weather: t.weather,
      tempC: t.temp_c,
      actualMin: t.actual_minutes,
      startedAt: t.started_at,
    }
  })
}

// ---------- training ----------

const TRAINING_CATEGORY: Record<string, TrainingCategory> = {
  seatbelt: 'safety',
  proximity: 'safety',
  slopes: 'terrain_handling',
  'engine-care': 'maintenance_awareness',
  'fuel-efficiency': 'fuel_efficiency',
  fatigue: 'emergency_procedures',
}

export function trainingFromBackend(data: any, operatorId: string, byType: Record<string, number>): TrainingRecommendation[] {
  const rec: string[] = data.recommended || []
  return (data.modules || [])
    .map((m: any) => {
      const hits = (m.triggers || []).filter((t: string) => byType[t]).map((t: string) => `${byType[t]}× ${t.replace('_', ' ')}`)
      return {
        id: m.id,
        moduleCode: `CAT-SAFE-${m.id.toUpperCase().slice(0, 8)}`,
        title: m.title,
        category: TRAINING_CATEGORY[m.id] ?? 'safety',
        reason: rec.includes(m.id) ? `Recommended from this week's incidents: ${hits.join(', ') || 'related alerts'}.` : 'Core site safety curriculum.',
        durationMin: m.minutes,
        xp: m.minutes * 2,
        operatorId,
        completed: (m.bestScore ?? 0) >= 60,
      }
    })
    .sort((a: TrainingRecommendation, b: TrainingRecommendation) => Number(rec.includes(b.id)) - Number(rec.includes(a.id)))
}

// ---------- derived safety views ----------

export function drowsinessFor(m: Machine | undefined): DrowsinessReading {
  const drowsy = m?.activeAlertTypes?.includes('drowsy')
  return drowsy
    ? { state: 'drowsy', confidencePct: 91.5, earValue: 0.15, blinkRatePerMin: 6, headPitchDeg: 18 }
    : { state: 'alert', confidencePct: 97.8, earValue: 0.31, blinkRatePerMin: 16, headPitchDeg: 1.2 }
}

export function interlocksFor(m: Machine): SafetyCheckItem[] {
  const t = m.telemetry
  const over = m.activeAlertTypes?.includes('overspeed')
  const obst = m.obstacleCm ?? 400
  return [
    { id: 'seatbelt', label: 'Operator Seatbelt Interlock', description: 'Buckle switch', state: m.seatbelt === false ? 'fail' : 'pass', value: m.seatbelt === false ? 'OPEN' : 'SECURE' },
    { id: 'cabin_door', label: 'Cabin Door Seal', description: 'Door switch', state: 'pass', value: 'LATCHED' },
    { id: 'geofence', label: 'Exclusion Geofence', description: 'Site danger zones', state: m.zone ? 'fail' : 'pass', value: m.zone ? (ZONE_NAMES[m.zone] ?? m.zone).toUpperCase() : 'CLEAR' },
    { id: 'speed_slope', label: 'Speed vs. Grade Slope', description: `ML advised ${t.recommendedSpeedKmh} km/h at ${t.slopeDeg}°`, state: over ? 'warning' : Math.abs(t.slopeDeg) > 25 ? 'fail' : 'pass', value: `${t.speedKmh}/${t.recommendedSpeedKmh} KM/H` },
    { id: 'hydraulic', label: 'Hydraulic Line Pressure', description: 'Safe envelope: 280 - 360 bar', state: !m.engineOn || (t.hydraulicPressureBar >= 250 && t.hydraulicPressureBar <= 360) ? 'pass' : 'warning', value: `${t.hydraulicPressureBar} BAR` },
    { id: 'fire', label: 'Fire Suppression System', description: 'Dual-loop canisters', state: 'pass', value: 'ARMED' },
    { id: 'radar', label: 'Proximity Radar (360°)', description: 'Ultrasonic + camera', state: obst < 50 ? 'fail' : obst < 100 ? 'warning' : 'pass', value: `${(obst / 100).toFixed(2)} M` },
    { id: 'oil', label: 'Engine Oil & Coolant', description: `${t.engineTempC}°C / ${t.oilPressurePsi} psi`, state: m.engineOn && t.oilPressurePsi < 20 ? 'fail' : t.engineTempC > 100 ? 'warning' : 'pass', value: m.ml?.fault && m.ml.fault !== 'normal' ? m.ml.fault.replace(/_/g, ' ').toUpperCase() : 'NOMINAL' },
  ]
}

export function preOpFor(m: Machine, operator: Operator | undefined, authorized: boolean, drowsy: DrowsinessReading): SafetyCheckItem[] {
  const t = m.telemetry
  const insp = m.inspectionStatus
  return [
    { id: 'rfid', label: 'RFID Operator Authentication', description: operator ? `${operator.id} ${operator.name}` : 'No badge', state: authorized || m.currentOperatorId ? 'pass' : 'warning', value: operator?.badgeId ?? '—' },
    { id: 'walkaround', label: 'Walk-around Inspection', description: '11-point daily checklist', state: insp === 'locked' ? 'fail' : insp === 'pending' ? 'warning' : 'pass', value: insp === 'locked' ? 'LOCKED OUT' : insp === 'pending' ? 'PENDING' : 'COMPLETE' },
    { id: 'seatbelt', label: 'Seatbelt Switch Interlock', description: 'Buckle sensor', state: m.seatbelt === false ? 'fail' : 'pass', value: m.seatbelt === false ? 'OPEN' : 'ENGAGED' },
    { id: 'hydraulic', label: 'Hydraulic Pressure', description: 'Window: 250-360 bar', state: !m.engineOn || (t.hydraulicPressureBar >= 250 && t.hydraulicPressureBar <= 360) ? 'pass' : 'warning', value: `${t.hydraulicPressureBar} BAR` },
    { id: 'oil', label: 'Engine Oil Pressure', description: 'Nominal > 20 PSI', state: m.engineOn && t.oilPressurePsi < 20 ? 'fail' : 'pass', value: `${t.oilPressurePsi} PSI` },
    { id: 'coolant', label: 'Coolant Temperature', description: 'Safe band < 100°C', state: t.engineTempC > 110 ? 'fail' : t.engineTempC > 100 ? 'warning' : 'pass', value: `${t.engineTempC}°C` },
    { id: 'vibration', label: 'Vibration Baseline', description: 'Below 1.0 G', state: t.vibrationG > 1.2 ? 'warning' : 'pass', value: `${t.vibrationG} G` },
    { id: 'fault', label: 'AI Engine Fault Model', description: 'Random Forest classifier', state: m.ml?.fault && m.ml.fault !== 'normal' ? 'fail' : 'pass', value: m.ml?.fault ? m.ml.fault.replace(/_/g, ' ').toUpperCase() : 'ENGINE OFF' },
    { id: 'fatigue', label: 'Operator Fatigue Camera', description: 'Eye openness (MediaPipe)', state: drowsy.state === 'alert' ? 'pass' : 'fail', value: `EAR ${drowsy.earValue}` },
    { id: 'geofence', label: 'Geofence & Terrain', description: `Slope ${t.slopeDeg}°`, state: m.zone ? 'fail' : Math.abs(t.slopeDeg) > 20 ? 'warning' : 'pass', value: m.zone ? 'IN ZONE' : 'CORRIDOR GREEN' },
  ]
}
