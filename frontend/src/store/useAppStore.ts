import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AlertItem,
  DrowsinessReading,
  Incident,
  Machine,
  MachineTelemetry,
  NotificationItem,
  Operator,
  ScenarioKey,
  ScheduledTask,
  SpeedRecommendation,
  TrainingRecommendation,
} from '../types/domain'
import { mockMachines } from '../mock/machines'
import { mockSchedule } from '../mock/schedule'
import { currentOperator } from '../mock/operators'
import { mockIncidents, nextIncidentId } from '../mock/incidents'
import { mockNotifications } from '../mock/notifications'
import { mockTraining } from '../mock/training'
import { interlockSensors, preOpChecklist } from '../mock/safetyChecks'
import { authenticateRFID } from '../services/rfidService'
import { getScenarioEffect } from '../services/scenarioEngine'
import type { SafetyCheckItem } from '../types/domain'
import { SCENARIO_COMMANDS, apiSend } from '../services/backend'

export type WorkflowStep = 'idle' | 'rfid' | 'schedule' | 'machine_select' | 'preop' | 'live' | 'debrief'

let idCounter = 1000
const nextId = (prefix: string) => `${prefix}-${idCounter++}`

interface AppState {
  /** true while the FastAPI backend streams live data; false = mock/demo mode */
  backendOnline: boolean
  operators: Operator[]
  shiftReport?: any
  siteSafetyScore?: number
  acknowledgedAlertIds: string[]
  applyBackend: (partial: Partial<AppState>) => void

  // Platform login (Convex-backed operator identity). Distinct from
  // `authStatus` below, which represents machine-operation authorization
  // (the existing RFID pre-op check) for whoever is currently logged in.
  isAuthenticated: boolean
  operator: Operator
  authStatus: 'pending' | 'authorized' | 'denied'
  authDenialReason?: string
  workflowStep: WorkflowStep

  machines: Machine[]
  tasks: ScheduledTask[]
  selectedTaskId?: string
  selectedMachineId?: string

  interlockSensors: SafetyCheckItem[]
  preOpChecklist: SafetyCheckItem[]

  activeScenario: ScenarioKey
  liveTelemetry: MachineTelemetry
  speedRecommendation: SpeedRecommendation
  drowsiness: DrowsinessReading
  copilotMessage: string
  elapsedSec: number
  operationRunning: boolean
  workCompletedM3: number
  targetVolumeM3: number

  alerts: AlertItem[]
  incidents: Incident[]
  notifications: NotificationItem[]
  training: TrainingRecommendation[]

  login: (operator: Operator) => void
  logout: () => void
  authenticateOperator: (forceDeny?: boolean) => void
  resetAuth: () => void
  selectTask: (taskId: string) => void
  selectMachine: (machineId: string) => void
  goToStep: (step: WorkflowStep) => void
  startOperation: () => void
  tick: () => void
  triggerScenario: (key: ScenarioKey) => void
  acknowledgeAlert: (id: string) => void
  resolveActiveEvent: () => void
  completeTask: () => void
  markNotificationRead: (id: string) => void
  resetDemo: () => void
}

function activeMachine(state: AppState): Machine {
  return state.machines.find((m) => m.id === state.selectedMachineId) ?? state.machines[0]
}

const simCommand = (machineId: string, command: string, field?: string, value?: unknown) =>
  apiSend('/api/sim/command', { machineId, command, field, value }).catch(() => undefined)

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      backendOnline: false,
      operators: [],
      acknowledgedAlertIds: [],
      applyBackend: (partial) => set(partial),

      isAuthenticated: false,
      operator: currentOperator,
  authStatus: 'pending',
  workflowStep: 'idle',

  machines: mockMachines,
  tasks: mockSchedule,
  selectedTaskId: 'TSK-8821',
  selectedMachineId: 'EXC-001',

  interlockSensors,
  preOpChecklist,

  activeScenario: 'normal',
  liveTelemetry: mockMachines[0].telemetry,
  speedRecommendation: getScenarioEffect('normal', 'EXC-001').speedRecommendation,
  drowsiness: getScenarioEffect('normal', 'EXC-001').drowsiness,
  copilotMessage: getScenarioEffect('normal', 'EXC-001').copilotMessage,
  elapsedSec: 38 * 60 + 14,
  operationRunning: false,
  workCompletedM3: 185,
  targetVolumeM3: 250,

  alerts: [],
  incidents: mockIncidents,
  notifications: mockNotifications,
  training: mockTraining,

  login: (operator) => {
    set({ operator, isAuthenticated: true, authStatus: 'pending', authDenialReason: undefined })
    // live mode: select the machine this operator is logged into, if any
    const m = get().machines.find((x) => x.currentOperatorId === operator.id)
    if (m) get().selectMachine(m.id)
  },

  logout: () =>
    set({
      isAuthenticated: false,
      operator: currentOperator,
      authStatus: 'pending',
      authDenialReason: undefined,
      workflowStep: 'idle',
    }),

  // Machine-operation authorization (the existing RFID pre-op check) — runs
  // against whichever operator is currently logged in, never swaps identity.
  // `forceDeny` lets the demo show the "access denied" UI state on demand
  // without pretending a different operator scanned a badge.
  authenticateOperator: (forceDeny = false) => {
    const state = get()
    const operator = state.operator
    const machine = activeMachine(state)
    if (forceDeny) {
      set({
        authStatus: 'denied',
        authDenialReason: 'Badge read error — RFID signal could not be verified. Re-scan required.',
        workflowStep: 'rfid',
      })
      return
    }
    const result = authenticateRFID(operator, machine)
    if (result.authorized && state.backendOnline) simCommand(machine.id, 'set', 'login', true)
    set({
      authStatus: result.authorized ? 'authorized' : 'denied',
      authDenialReason: result.reasonDenied,
      workflowStep: result.authorized ? 'schedule' : 'rfid',
    })
  },

  resetAuth: () => set({ authStatus: 'pending', authDenialReason: undefined, workflowStep: 'rfid' }),

  selectTask: (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId)
    set({
      selectedTaskId: taskId,
      workflowStep: 'machine_select',
      ...(get().backendOnline && task?.assignedMachineId ? { selectedMachineId: task.assignedMachineId } : {}),
    })
  },

  selectMachine: (machineId) => {
    const state = get()
    const next = state.backendOnline
      ? state.tasks.find((t) => t.assignedMachineId === machineId && t.status === 'active') ??
        state.tasks.find((t) => t.assignedMachineId === machineId && t.status !== 'completed')
      : undefined
    set({ selectedMachineId: machineId, ...(next ? { selectedTaskId: next.id } : {}) })
  },

  goToStep: (step) => set({ workflowStep: step }),

  startOperation: () => {
    const state = get()
    const task = state.tasks.find((t) => t.id === state.selectedTaskId)
    if (state.backendOnline) {
      if (task?.backendId && task.status !== 'active' && task.status !== 'completed') {
        apiSend(`/api/tasks/${task.backendId}`, { status: 'in_progress' }, 'PATCH').catch(() => undefined)
      }
      set({ workflowStep: 'live', operationRunning: true })
      return
    }
    const machine = activeMachine(state)
    set({
      workflowStep: 'live',
      operationRunning: true,
      liveTelemetry: machine.telemetry,
      elapsedSec: 0,
      workCompletedM3: 0,
    })
  },

  tick: () => {
    const state = get()
    if (!state.operationRunning || state.backendOnline) return // live mode: backend drives telemetry
    const jitter = (n: number, spread: number) => Math.max(0, n + (Math.random() - 0.5) * spread)
    set({
      elapsedSec: state.elapsedSec + 1,
      workCompletedM3: Math.min(state.targetVolumeM3, state.workCompletedM3 + Math.random() * 0.12),
      liveTelemetry: {
        ...state.liveTelemetry,
        rpm: Math.round(jitter(state.liveTelemetry.rpm, 40)),
        engineTempC: Number(jitter(state.liveTelemetry.engineTempC, 0.6).toFixed(1)),
        hydraulicPressureBar: Math.round(jitter(state.liveTelemetry.hydraulicPressureBar, 6)),
      },
    })
  },

  triggerScenario: (key) => {
    const state = get()
    const machine = activeMachine(state)
    if (state.backendOnline) {
      for (const cmd of SCENARIO_COMMANDS[key]) simCommand(machine.id, cmd)
      if (key === 'drowsiness') {
        // the webcam normally sends these; simulate ~10 s of drowsy eyes
        let n = 0
        const send = () => apiSend('/api/events/camera', { machineId: machine.id, kind: 'drowsy', confidence: 0.92 }).catch(() => undefined)
        send()
        const id = setInterval(() => (++n >= 5 ? clearInterval(id) : send()), 2000)
      }
      set({ activeScenario: key })
      return
    }
    const effect = getScenarioEffect(key, machine.id)
    const newAlerts = [...state.alerts]
    const newNotifications = [...state.notifications]
    const newIncidents = [...state.incidents]
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })

    if (effect.alert) {
      const alert: AlertItem = {
        id: nextId('ALERT'),
        severity: effect.alert.severity,
        category: effect.alert.category,
        title: effect.alert.title,
        message: effect.alert.message,
        machineId: machine.id,
        operatorId: state.operator.id,
        timestamp,
        acknowledged: false,
        resolved: false,
      }
      newAlerts.unshift(alert)
      newNotifications.unshift({
        id: nextId('NOTIF'),
        kind: effect.alert.severity === 'critical' ? 'critical' : 'warning',
        title: effect.alert.title,
        message: effect.alert.message,
        timestamp,
        read: false,
        sourcePage: 'Live Operation',
      })
    }

    if (effect.createsIncident) {
      newIncidents.unshift({
        id: nextIncidentId(),
        timestamp,
        machineId: machine.id,
        operatorId: state.operator.id,
        location: machine.location,
        category: effect.createsIncident.category,
        severity: effect.createsIncident.severity,
        description: effect.createsIncident.description,
        sensorEvidence: effect.createsIncident.sensorEvidence,
        actionTaken: effect.createsIncident.actionTaken,
        resolution: 'Pending operator response.',
        status: 'open',
      })
    }

    const mergedInterlocks = state.interlockSensors.map((item) => {
      const override = effect.safetyOverrides?.[item.id]
      return override ? { ...item, state: override.state, value: override.value ?? item.value } : item
    })

    set({
      activeScenario: key,
      liveTelemetry: { ...state.liveTelemetry, ...effect.telemetry },
      speedRecommendation: effect.speedRecommendation,
      drowsiness: effect.drowsiness,
      copilotMessage: effect.copilotMessage,
      alerts: newAlerts,
      notifications: newNotifications,
      incidents: newIncidents,
      interlockSensors: mergedInterlocks,
    })
  },

  acknowledgeAlert: (id) =>
    set((state) => ({
      acknowledgedAlertIds: [...state.acknowledgedAlertIds, id],
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  resolveActiveEvent: () => {
    const state = get()
    if (state.backendOnline) {
      simCommand(activeMachine(state).id, 'normal')
      set({
        activeScenario: 'normal',
        acknowledgedAlertIds: [...state.acknowledgedAlertIds, ...state.alerts.map((a) => a.id)],
        alerts: state.alerts.map((a) => ({ ...a, acknowledged: true })),
      })
      return
    }
    set({
      alerts: state.alerts.map((a) => (!a.resolved ? { ...a, resolved: true, acknowledged: true } : a)),
      incidents: state.incidents.map((i) => (i.status === 'open' ? { ...i, status: 'resolved', resolution: 'Operator responded per AI guidance. Verified safe.' } : i)),
    })
    get().triggerScenario('normal')
  },

  completeTask: () => {
    const state = get()
    const task = state.tasks.find((t) => t.id === state.selectedTaskId)
    if (state.backendOnline && task?.backendId && task.status === 'active') {
      apiSend(`/api/tasks/${task.backendId}`, { status: 'done' }, 'PATCH').catch(() => undefined)
    }
    set({ workflowStep: 'debrief', operationRunning: false })
  },

  markNotificationRead: (id) =>
    set((state) => ({ notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

  resetDemo: () =>
    set({
      authStatus: 'pending',
      workflowStep: 'rfid',
      selectedTaskId: 'TSK-8821',
      selectedMachineId: 'EXC-001',
      activeScenario: 'normal',
      elapsedSec: 0,
      workCompletedM3: 0,
      operationRunning: false,
      alerts: [],
    }),
    }),
    {
      name: 'cat-soa-session',
      // Only the login identity survives a page reload; live simulation
      // state (telemetry, alerts, incidents, workflow step) always starts
      // fresh so a refresh can never leave the demo in a half-finished state.
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, operator: state.operator }),
    },
  ),
)

export const selectActiveMachine = (state: AppState) => activeMachine(state)
