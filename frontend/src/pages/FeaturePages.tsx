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
import PageHeader from '../components/common/PageHeader'
import EmptyState from '../components/common/EmptyState'
import { Link } from 'react-router-dom'

function Feature({
  Comp,
  title,
  icon,
  subtitle,
}: {
  Comp: ComponentType<any>
  title: string
  icon: string
  subtitle: string
}) {
  const live = useLiveData()
  const machineId = useAppStore((s) => s.selectedMachineId) ?? 'EXC-001'
  const selectMachine = useAppStore((s) => s.selectMachine)
  const backendOnline = useAppStore((s) => s.backendOnline)
  const machine = live?.machines?.[machineId]
  return (
    <div className="p-space-lg flex flex-col gap-space-md">
      <PageHeader
        eyebrow="Site operations"
        title={title}
        description={subtitle}
      />
      {!backendOnline && (
        <div
          className="panel rounded-xl p-4 text-primary text-sm"
          role="status"
        >
          Demo data · Live site services are disconnected. Your demo journey is
          still available.
        </div>
      )}
      {backendOnline || title === 'Cab & Proximity Cameras' ? (
        <div className="legacy">
          <Comp
            live={live}
            machineId={machineId}
            machine={machine}
            operatorId={machine?.operator?.id}
            setMachineId={selectMachine}
          />
        </div>
      ) : (
        <>
          <EmptyState
            icon={icon}
            title={`${title} awaits a live connection`}
            description="This view uses live site records. Connect the site service to see current information, or continue the guided demo with sample telemetry."
          />
          <Link to="/live-operation" className="btn-secondary self-start">
            Continue demo operation →
          </Link>
        </>
      )}
    </div>
  )
}

export const SiteMap = () => (
  <Feature
    Comp={SiteMapPage}
    title="Site Map"
    icon="map"
    subtitle="Terrain, slope danger, danger zones and every machine live — scroll to zoom, drag to pan."
  />
)
export const Cameras = () => (
  <Feature
    Comp={CameraPage}
    title="Cab & Proximity Cameras"
    icon="photo_camera"
    subtitle="Monitor operator attention and nearby people. Video stays on this device; detection models require an initial download."
  />
)
export const ShiftReport = () => (
  <Feature
    Comp={ShiftPage}
    title="Shift Report"
    icon="summarize"
    subtitle="Totals, averages, peaks, fuel cost, CO₂ and an AI-written end-of-shift summary."
  />
)
export const Maintenance = () => (
  <Feature
    Comp={MaintenancePage}
    title="Maintenance"
    icon="build"
    subtitle="Book service, track requests, release lockouts, review pre-start inspections."
  />
)
export const Supervisor = () => (
  <Feature
    Comp={SupervisorPage}
    title="Supervisor & Impact"
    icon="insights"
    subtitle="Fleet overview, operator safety ranking and business impact."
  />
)
