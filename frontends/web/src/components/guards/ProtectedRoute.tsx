/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Preserves the requested path in ?next= so Login can redirect back after auth.
 * Must wrap all authenticated route subtrees in App.tsx.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  return <Outlet />
}
