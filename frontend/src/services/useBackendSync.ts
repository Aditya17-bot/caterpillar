import { createContext, useContext, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Machine, NotificationItem, Operator } from '../types/domain'
import {
  alertFromBackend,
  apiGet,
  apiSend,
  drowsinessFor,
  incidentFromBackend,
  interlocksFor,
  machineFromBackend,
  operatorFromBackend,
  preOpFor,
  scenarioFromTelemetry,
  speedRecommendationFor,
  tasksFromBackend,
  trainingFromBackend,
  type BackendSummary,
} from './backend'

/** The raw live feed (WebSocket) for the ported feature pages: map, cameras, co-pilot, SOS... */
export const LiveContext = createContext<any>(null)
export const useLiveData = () => useContext(LiveContext)

type Meta = { id: string; type: string; model?: string }

/**
 * Keeps the zustand store in sync with the FastAPI backend.
 * `live` comes from the WebSocket hook (legacy/api.js useLive). When the backend is unreachable
 * nothing is overwritten and the UI keeps running on its mock data.
 */
export function useBackendSync(live: any) {
  const meta = useRef<Meta[]>([])
  const r2 = useRef(0.982)
  const lastTs = useRef<Record<string, number>>({})
  const lastAdvisedAlert = useRef<string | null>(null)

  // one-off reference data
  useEffect(() => {
    const load = () =>
      Promise.all([apiGet('/api/machines'), apiGet('/api/operators'), apiGet('/models')])
        .then(([machines, operators, models]) => {
          meta.current = machines.map((m: any) => ({ id: m.id, type: m.type, model: m.model }))
          r2.current = models?.speed?.r2 ?? 0.982
          useAppStore.getState().applyBackend({ operators: operators.map(operatorFromBackend) })
        })
        .catch(() => setTimeout(load, 3000))
    load()
  }, [])

  // live telemetry -> machines, alerts, speed copilot, safety views
  useEffect(() => {
    const store = useAppStore.getState()
    const online = !!live.connected && Object.keys(live.machines).length > 0 && meta.current.length > 0
    if (!online) {
      if (store.backendOnline) store.applyBackend({ backendOnline: false })
      return
    }
    const prevById = Object.fromEntries(store.machines.map((m) => [m.id, m]))
    const machines: Machine[] = meta.current.map((mt) => {
      const s: BackendSummary | undefined = live.machines[mt.id]
      const ts = s?.telemetry?.ts ?? 0
      const prev = prevById[mt.id]
      if (prev && prev.online !== undefined && lastTs.current[mt.id] === ts && prev.online === s?.online) return prev
      lastTs.current[mt.id] = ts
      return machineFromBackend(mt, s, prev?.online !== undefined ? prev : undefined)
    })
    const knownIds = new Set(machines.map((m) => m.id))
    const selectedMachineId = knownIds.has(store.selectedMachineId ?? '') ? store.selectedMachineId! : machines[0].id
    const sel = machines.find((m) => m.id === selectedMachineId)!
    const selSummary: BackendSummary | undefined = live.machines[selectedMachineId]

    // alerts: active = currently raised on its machine
    const activeIds = new Set(
      Object.values(live.machines as Record<string, BackendSummary>).flatMap((m) =>
        (m.activeAlerts || []).map((a: any) => `${a.machineId}-${a.type}-${a.ts}`),
      ),
    )
    const acked = new Set(store.acknowledgedAlertIds)
    const alerts = (live.feed as any[]).map((a) => {
      const id = `${a.machineId}-${a.type}-${a.ts}`
      return alertFromBackend(a, activeIds.has(id), acked.has(id))
    })
    const readIds = new Set(store.notifications.filter((n) => n.read).map((n) => n.id))
    const notifications: NotificationItem[] = alerts.map((a) => ({
      id: `N-${a.id}`,
      kind: a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info',
      title: `${a.machineId} · ${a.title}`,
      message: a.message,
      timestamp: a.timestamp,
      read: readIds.has(`N-${a.id}`),
      sourcePage: a.category === 'system' ? 'Safety Center' : 'Live Operation',
    }))

    // after an RFID scan keep showing the scanned badge (e.g. a denied one) instead of the logged-in operator
    const operator: Operator =
      store.authStatus !== 'pending'
        ? store.operator
        : (sel.currentOperatorId && store.operators.find((o) => o.id === sel.currentOperatorId)) || store.operator
    const drowsiness = drowsinessFor(sel)
    const hasOpenAlert = (selSummary?.activeAlerts || []).length > 0

    store.applyBackend({
      backendOnline: true,
      machines,
      selectedMachineId,
      operator,
      liveTelemetry: sel.telemetry,
      speedRecommendation: speedRecommendationFor(sel, r2.current),
      drowsiness,
      alerts,
      notifications,
      interlockSensors: interlocksFor(sel),
      preOpChecklist: preOpFor(sel, operator, store.authStatus === 'authorized', drowsiness),
      activeScenario: scenarioFromTelemetry(selSummary?.telemetry?.scenarios),
      ...(!hasOpenAlert && sel.ml?.advisory
        ? { copilotMessage: `${sel.ml.advisory} Advised speed ${sel.telemetry.recommendedSpeedKmh} km/h; engine ${sel.telemetry.engineTempC}°C, fault model: ${sel.ml.fault ? sel.ml.fault.replace(/_/g, ' ') : 'engine off'}.` }
        : {}),
    })
  }, [live.machines, live.connected, live.feed])

  // new alert on the selected machine -> ask the co-pilot what to do
  useEffect(() => {
    const store = useAppStore.getState()
    if (!store.backendOnline) return
    const a = (live.feed as any[])[0]
    if (!a || a.machineId !== store.selectedMachineId) return
    const key = `${a.machineId}-${a.type}-${a.ts}`
    if (lastAdvisedAlert.current === key) return
    lastAdvisedAlert.current = key
    apiSend('/api/copilot/chat', { machineId: a.machineId, message: 'Why is there an alert and what should I do right now?' })
      .then((r) => useAppStore.getState().applyBackend({ copilotMessage: r.reply }))
      .catch(() => undefined)
  }, [live.feed])

  // slower REST data: tasks, incidents, shift report, training, safety score
  useEffect(() => {
    let stop = false
    const poll = async () => {
      const store = useAppStore.getState()
      if (!store.backendOnline || stop) return
      const machineId = store.selectedMachineId ?? 'EXC-001'
      try {
        const [taskRows, incidentRows, shift] = await Promise.all([
          apiGet('/api/tasks'),
          apiGet('/api/incidents?limit=60'),
          apiGet(`/api/shift/${machineId}`),
        ])
        const tasks = tasksFromBackend(taskRows)
        const s = useAppStore.getState()
        let selectedTaskId = s.selectedTaskId
        if (!tasks.some((t) => t.id === selectedTaskId && t.assignedMachineId === machineId)) {
          selectedTaskId =
            (tasks.find((t) => t.assignedMachineId === machineId && t.status === 'active') ??
              tasks.find((t) => t.assignedMachineId === machineId && t.status !== 'completed') ??
              tasks.find((t) => t.assignedMachineId === machineId))?.id ?? selectedTaskId
        }
        const task = tasks.find((t) => t.id === selectedTaskId)
        const selType = s.machines.find((m) => m.id === machineId)?.type
        const machines = s.machines.map((m) => ({
          ...m,
          aiMatchScore: task
            ? Math.round(
                (m.id === task.assignedMachineId ? 60 : m.type === selType ? 35 : 10) +
                  m.telemetry.healthScore * 0.35 +
                  (m.status === 'critical' || m.status === 'maintenance' ? -30 : 0),
              )
            : m.aiMatchScore,
        }))
        s.applyBackend({
          tasks,
          selectedTaskId,
          machines,
          incidents: incidentRows.map(incidentFromBackend),
          shiftReport: shift,
          operationRunning: task?.status === 'active',
          targetVolumeM3: task?.volumeM3 ?? 250,
          workCompletedM3: task?.pace?.doneM3 ?? (task?.status === 'completed' ? task.volumeM3 : 0),
          elapsedSec: Math.round(
            task?.pace ? task.pace.elapsedMin * 60 : task?.status === 'completed' && task.actualMin ? task.actualMin * 60 : 0,
          ),
        })
      } catch {
        /* backend hiccup: keep last data */
      }
    }
    const slow = async () => {
      const store = useAppStore.getState()
      if (!store.backendOnline || stop) return
      try {
        const opId = store.operator.id
        const [training, score, board] = await Promise.all([
          apiGet(`/api/training/modules?operatorId=${opId}`),
          apiGet(`/api/operators/${opId}/score`),
          apiGet('/api/leaderboard'),
        ])
        const avg = board.length ? board.reduce((a: number, o: any) => a + o.score, 0) / board.length : undefined
        useAppStore.getState().applyBackend({
          training: trainingFromBackend(training, opId, score.byType || {}),
          siteSafetyScore: avg !== undefined ? Math.round(avg * 10) / 10 : undefined,
        })
      } catch {
        /* ignore */
      }
    }
    const t1 = setInterval(poll, 4000)
    const t2 = setInterval(slow, 15000)
    const first = setTimeout(() => {
      poll()
      slow()
    }, 1200)
    return () => {
      stop = true
      clearInterval(t1)
      clearInterval(t2)
      clearTimeout(first)
    }
  }, [])

  // refresh tasks/incidents promptly when machine selection changes or new alerts arrive
  const selectedMachineId = useAppStore((s) => s.selectedMachineId)
  useEffect(() => {
    const store = useAppStore.getState()
    if (!store.backendOnline) return
    apiGet(`/api/shift/${selectedMachineId}`)
      .then((shift) => useAppStore.getState().applyBackend({ shiftReport: shift }))
      .catch(() => undefined)
  }, [selectedMachineId])
}
