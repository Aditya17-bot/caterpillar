import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { useAppStore } from '../../store/useAppStore'

export default function AppShell() {
  // Runs at the shell level (not per-page) so elapsed time and telemetry
  // keep advancing consistently while an operation is running, regardless
  // of which screen the operator navigates to.
  const tick = useAppStore((s) => s.tick)
  useEffect(() => {
    const id = setInterval(() => tick(), 1000)
    return () => clearInterval(id)
  }, [tick])

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <Sidebar />
      <div className="pl-72">
        <main className="w-full pt-16 bg-surface min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
