import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="/operation/rfid" element={<RfidAuth />} />
          <Route path="/operation/preop" element={<PreOpCheck />} />
          <Route path="/operation/debrief" element={<Debrief />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
