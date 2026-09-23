import type { Incident } from '../types/domain'

export const mockIncidents: Incident[] = [
  {
    id: 'INC-00238',
    timestamp: '09:14:02',
    machineId: 'EXC-001',
    operatorId: 'OP-01',
    location: 'Sector 7 North Pit',
    category: 'proximity',
    severity: 'warning',
    description:
      'Light support vehicle LV-302 breached 4.1m rear right quadrant blindspot. Automated slew speed curtailed instantly.',
    sensorEvidence: 'mmWave Radar #04',
    actionTaken: 'Automatic hydraulic deceleration engaged.',
    resolution: 'Zero contact. Resolved & logged.',
    status: 'resolved',
  },
  {
    id: 'INC-00239',
    timestamp: '08:02:44',
    machineId: 'EXC-001',
    operatorId: 'OP-01',
    location: 'Sector 7 North Pit',
    category: 'drowsiness',
    severity: 'warning',
    description: 'EAR dropped to 0.19 for 1.8 seconds. In-cab tactile haptic seat vibration pulse activated.',
    sensorEvidence: 'Cab-Cam IR AI Mesh',
    actionTaken: '10-minute hydration break advised.',
    resolution: 'Operator acknowledged within 2s.',
    status: 'resolved',
  },
]

export function nextIncidentId(): string {
  const max = mockIncidents.reduce((acc, i) => Math.max(acc, Number(i.id.split('-')[1])), 238)
  return `INC-${String(max + 1).padStart(5, '0')}`
}
