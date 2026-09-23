import { Navigate, Outlet } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

export default function ProtectedRoute() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
