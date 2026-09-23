import type { SafetyCheckItem } from '../types/domain'

export const interlockSensors: SafetyCheckItem[] = [
  { id: 'seatbelt', label: 'Operator Seatbelt Interlock', description: 'Microswitch contact verified', state: 'pass', value: 'SECURE' },
  { id: 'cabin_door', label: 'Cabin Door Seal', description: 'Solenoid magnetic seal active', state: 'pass', value: 'LATCHED' },
  { id: 'geofence', label: 'Exclusion Geofence', description: 'RTK GPS 2cm tolerance', state: 'pass', value: 'ZONE 3 PIT' },
  { id: 'speed_slope', label: 'Speed vs. Grade Slope', description: '15 km/h on +14° slope limit', state: 'pass', value: 'COMPLIANT' },
  { id: 'hydraulic', label: 'Hydraulic Line Pressure', description: 'Safe envelope: 280 - 360 bar', state: 'pass', value: '320 BAR' },
  { id: 'fire', label: 'Fire Suppression System', description: 'Dual-loop nitrogen canisters', state: 'pass', value: 'ARMED' },
  { id: 'radar', label: 'Proximity Radar (360°)', description: 'Quad mmWave 77GHz active', state: 'pass', value: 'SCANNING' },
  { id: 'oil', label: 'Engine Oil & Coolant', description: '88°C block / 4.4 bar pressure', state: 'pass', value: 'NOMINAL' },
]

export const preOpChecklist: SafetyCheckItem[] = [
  { id: 'rfid', label: 'RFID Operator Authentication', description: 'OP-01 Verified', state: 'pass', value: 'L-4 AUTH' },
  { id: 'seatbelt', label: 'Seatbelt Switch Interlock', description: 'Latching Hall-Sensor', state: 'pass', value: 'ENGAGED' },
  { id: 'hydraulic', label: 'Circuit Accumulator Pressure', description: 'Window: 280-350 bar', state: 'pass', value: '320.0 BAR' },
  { id: 'oil', label: 'Engine Oil Pressure & Feed', description: 'Nominal Baseline: >20 PSI', state: 'pass', value: '58.4 PSI' },
  { id: 'coolant', label: 'Coolant Core Temperature', description: 'Safe Band: 75°C - 95°C', state: 'pass', value: '86.4°C' },
  { id: 'vibration', label: 'Triaxial Vibration Baseline', description: 'Harmonic Floor Normal', state: 'pass', value: '0.82 G' },
  { id: 'radar', label: 'Autonomous Collision Radar', description: 'mmWave 77GHz Active Array', state: 'pass', value: '360° CLEAR' },
  { id: 'fatigue', label: 'Cabin Operator Fatigue IR', description: 'Eye Aspect Ratio Baseline', state: 'pass', value: 'EAR 0.32' },
  { id: 'terrain', label: 'Pit Weather & Terrain Envelope', description: '31°C Sunny / Dry Clay', state: 'pass', value: 'GRADE μ 0.88' },
  { id: 'geofence', label: 'Geofence & Blast Operations', description: 'Zone 3 Pit Perimeter', state: 'pass', value: 'CORRIDOR GREEN' },
]
