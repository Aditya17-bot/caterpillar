import type { NotificationItem } from '../types/domain'

export const mockNotifications: NotificationItem[] = [
  {
    id: 'NOTIF-001',
    kind: 'system',
    title: 'Operator Authenticated: S. Jenkins',
    message: 'Zero interlocks active. Breathalyzer lockout cleared (0.00 BAC). Hydraulic joysticks unlocked.',
    timestamp: '08:30:19',
    read: true,
    sourcePage: 'Safety Center',
  },
  {
    id: 'NOTIF-002',
    kind: 'info',
    title: 'Hydraulic Filter Differential Pressure Nominal',
    message: 'Main pump inlet filter delta holding at 310 bar under peak payload torque.',
    timestamp: '08:45:00',
    read: true,
    sourcePage: 'Machine Health',
  },
  {
    id: 'NOTIF-003',
    kind: 'warning',
    title: 'Terrain Slope Exceeded Preset Limit (+12°)',
    message: 'Smart copilot reduced crawler transit ceiling from 22 km/h to 16 km/h.',
    timestamp: '08:58:12',
    read: false,
    sourcePage: 'Live Operation',
  },
  {
    id: 'NOTIF-004',
    kind: 'critical',
    title: 'Proximity Radar: Unregistered Service Vehicle',
    message: 'LV-302 breached 4.1m rear right blindspot. Slew speed curtailed instantly.',
    timestamp: '09:12:44',
    read: false,
    sourcePage: 'Live Operation',
  },
]
