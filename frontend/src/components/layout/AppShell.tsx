import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import Icon from '../common/Icon'
import { useAppStore } from '../../store/useAppStore'
import { LiveContext, useBackendSync } from '../../services/useBackendSync'
import { apiSend } from '../../services/backend'
import { useLive } from '../../legacy/api.js'
import CoPilotJsx from '../../legacy/CoPilot.jsx'
import InspectionJsx from '../../legacy/Inspection.jsx'

// ported JS components: props are untyped
const CoPilot = CoPilotJsx as any
const Inspection = InspectionJsx as any

function SosBanner({
  sos,
  machineId,
}: {
  sos: Record<string, any>
  machineId?: string
}) {
  const list = Object.values(sos)
  if (!list.length) return null
  return (
    <div className="bg-error-container text-on-surface px-space-lg py-2 flex flex-col gap-1">
      {list.map((s: any) => {
        const me = s.nearby.find((n: any) => n.machineId === machineId)
        const responded = s.responders.some(
          (r: any) => r.machineId === machineId,
        )
        return (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-space-sm font-body-md text-body-md"
          >
            <Icon
              name="sos"
              className="text-[22px] text-error animate-pulse"
              filled
            />
            <span className="font-headline-md font-bold uppercase text-error">
              SOS {s.machine_id}
            </span>
            <span>{s.reason}.</span>
            {me && (
              <span className="font-bold">
                You are {me.distanceM} m away — head {me.direction}.
              </span>
            )}
            <span className="text-on-surface-variant">
              Alerted {s.nearby.length} nearby machine(s) + supervisor
              {s.responders.length > 0 &&
                ` · responding: ${s.responders.map((r: any) => r.machineId).join(', ')}`}
            </span>
            {me && !responded && (
              <button
                onClick={() =>
                  apiSend(`/api/sos/${s.id}/respond`, { machineId })
                }
                className="px-space-md py-1 rounded bg-error text-on-error font-label-md text-label-sm uppercase font-bold"
              >
                Respond with {machineId}
              </button>
            )}
            <button
              onClick={() => apiSend(`/api/sos/${s.id}/resolve`, {})}
              className="px-space-md py-1 rounded bg-surface-container-high text-on-surface font-label-md text-label-sm uppercase font-bold"
            >
              Resolve
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function AppShell() {
  // Runs at the shell level (not per-page) so elapsed time and telemetry
  // keep advancing consistently while an operation is running, regardless
  // of which screen the operator navigates to.
  const [menuOpen, setMenuOpen] = useState(false)
  const [cabMode, setCabMode] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    const toggle = () => setCabMode((v) => !v)
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCabMode(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('cab:toggle', toggle)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('cab:toggle', toggle)
      window.removeEventListener('keydown', escape)
    }
  }, [])
  useEffect(() => {
    setCabMode(false)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  const tick = useAppStore((s) => s.tick)
  useEffect(() => {
    const id = setInterval(() => tick(), 1000)
    return () => clearInterval(id)
  }, [tick])

  // One WebSocket to the backend feeds the store (and the ported feature pages via context).
  const live: any = useLive()
  useBackendSync(live)
  const machineId = useAppStore((s) => s.selectedMachineId)
  const machine = live.machines[machineId ?? '']
  const [skipInspection, setSkipInspection] = useState<Record<string, boolean>>(
    {},
  )
  const inspectionPending =
    machine?.inspection?.status === 'pending' &&
    !skipInspection[machineId ?? '']

  return (
    <LiveContext.Provider value={live}>
      <div className={`min-h-screen bg-surface ${cabMode ? 'cab-mode' : ''}`}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
        />
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="app-content">
          <main
            id="main-content"
            tabIndex={-1}
            className="w-full bg-surface min-h-screen"
          >
            {cabMode && (
              <div className="flex justify-end p-3">
                <button
                  className="btn-secondary"
                  onClick={() => setCabMode(false)}
                >
                  <Icon name="fullscreen_exit" />
                  Exit cab view · Esc
                </button>
              </div>
            )}
            <SosBanner sos={live.sos} machineId={machineId} />
            {machine?.inspection?.status === 'pending' &&
              skipInspection[machineId ?? ''] && (
                <div className="bg-primary-container/20 text-primary px-space-lg py-2 font-body-md text-body-md flex items-center gap-space-sm">
                  <Icon name="fact_check" className="text-[18px]" />
                  Pre-start inspection not done for {machineId}.
                  <button
                    onClick={() =>
                      setSkipInspection({
                        ...skipInspection,
                        [machineId ?? '']: false,
                      })
                    }
                    className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold uppercase text-label-sm"
                  >
                    Do it now
                  </button>
                </div>
              )}
            <Outlet />
          </main>
        </div>
        <div className="legacy">
          {inspectionPending && (
            <Inspection
              machineId={machineId}
              machine={machine}
              onClose={() =>
                setSkipInspection({
                  ...skipInspection,
                  [machineId ?? '']: true,
                })
              }
            />
          )}
          <CoPilot machineId={machineId} feed={live.feed} hideFab />
        </div>
      </div>
    </LiveContext.Provider>
  )
}
