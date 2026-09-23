// Wraps the feature pages ported from the first dashboard (plain JSX) so they get live data and the
// selected machine from this app, and render with the dark `.legacy` styles.
import type { ComponentType } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useLiveData } from '../services/useBackendSync'
import SiteMapPage from '../legacy/pages/SiteMap.jsx'
import CameraPage from '../legacy/pages/Camera.jsx'
import ShiftPage from '../legacy/pages/Shift.jsx'
import MaintenancePage from '../legacy/pages/Maintenance.jsx'
import SupervisorPage from '../legacy/pages/Supervisor.jsx'
import Icon from '../components/common/Icon'

function Feature({ Comp, title, icon, subtitle }: { Comp: ComponentType<any>; title: string; icon: string; subtitle: string }) {
  const live = useLiveData()
  const machineId = useAppStore((s) => s.selectedMachineId) ?? 'EXC-001'
  const selectMachine = useAppStore((s) => s.selectMachine)
  const backendOnline = useAppStore((s) => s.backendOnline)
  const machine = live?.machines?.[machineId]
  return (
    <div className="p-space-lg flex flex-col gap-space-md">
      <div className="bg-surface-container-low rounded-xl p-space-md flex items-center gap-space-md shadow-md">
        <div className="w-10 h-10 rounded bg-primary-container text-on-primary-container flex items-center justify-center">
          <Icon name={icon} className="text-[24px]" />
        </div>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-tight">{title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
        </div>
      </div>
      {!backendOnline && (
        <div className="bg-error-container/30 text-error rounded p-space-md font-body-md text-body-md">
          Backend offline — start it with <code>uvicorn main:app --port 8000</code> in <code>backend/</code> and run{' '}
          <code>python simulator/sim.py</code>.
        </div>
      )}
      <div className="legacy">
        <Comp live={live} machineId={machineId} machine={machine} operatorId={machine?.operator?.id} setMachineId={selectMachine} />
      </div>
    </div>
  )
}

export const SiteMap = () => (
  <Feature Comp={SiteMapPage} title="Site Map" icon="map" subtitle="Terrain, slope danger, danger zones and every machine live — scroll to zoom, drag to pan." />
)
export const Cameras = () => (
  <Feature Comp={CameraPage} title="Cab & Proximity Cameras" icon="photo_camera" subtitle="Drowsiness (MediaPipe eye openness + optional Teachable Machine) and person detection (COCO-SSD), in the browser." />
)
export const ShiftReport = () => (
  <Feature Comp={ShiftPage} title="Shift Report" icon="summarize" subtitle="Totals, averages, peaks, fuel cost, CO₂ and an AI-written end-of-shift summary." />
)
export const Maintenance = () => (
  <Feature Comp={MaintenancePage} title="Maintenance" icon="build" subtitle="Book service, track requests, release lockouts, review pre-start inspections." />
)
export const Supervisor = () => (
  <Feature Comp={SupervisorPage} title="Supervisor & Impact" icon="insights" subtitle="Fleet overview, operator safety ranking and business impact." />
)
