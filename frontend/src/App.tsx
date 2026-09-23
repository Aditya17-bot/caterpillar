import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Login from './pages/Login'
import CommandCenter from './pages/CommandCenter'
import ScheduleTasks from './pages/ScheduleTasks'
import MachinesFleet from './pages/MachinesFleet'
import LiveOperation from './pages/LiveOperation'
import SafetyCenter from './pages/SafetyCenter'
import MachineHealth from './pages/MachineHealth'
import Analytics from './pages/Analytics'
import OperatorTraining from './pages/OperatorTraining'
import IncidentLog from './pages/IncidentLog'
import Notifications from './pages/Notifications'
import RfidAuth from './pages/operation/RfidAuth'
import PreOpCheck from './pages/operation/PreOpCheck'
import Debrief from './pages/operation/Debrief'
import { Cameras, Maintenance, ShiftReport, SiteMap, Supervisor } from './pages/FeaturePages'
import { CONVEX_ENABLED } from './services/convex'

/** Seeds the Convex operator registry on boot (only rendered when Convex is configured). */
function ConvexSeeder() {
  const seedOperators = useMutation(api.operators.seed)
  useEffect(() => {
    seedOperators().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      {CONVEX_ENABLED && <ConvexSeeder />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<CommandCenter />} />
            <Route path="/schedule" element={<ScheduleTasks />} />
            <Route path="/fleet" element={<MachinesFleet />} />
            <Route path="/live-operation" element={<LiveOperation />} />
            <Route path="/safety" element={<SafetyCenter />} />
            <Route path="/machine-health" element={<MachineHealth />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/training" element={<OperatorTraining />} />
            <Route path="/incidents" element={<IncidentLog />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/site-map" element={<SiteMap />} />
            <Route path="/cameras" element={<Cameras />} />
            <Route path="/shift" element={<ShiftReport />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/supervisor" element={<Supervisor />} />
            <Route path="/operation/rfid" element={<RfidAuth />} />
            <Route path="/operation/preop" element={<PreOpCheck />} />
            <Route path="/operation/debrief" element={<Debrief />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
