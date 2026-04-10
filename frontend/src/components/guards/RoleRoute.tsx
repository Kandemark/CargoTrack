/**
 * RoleRoute — allows only users whose role is in the `roles` list.
 * Wrong-role users are redirected to their own dashboard, not /login,
 * because they are authenticated — just not authorised for this section.
 * Always nest inside ProtectedRoute so `user` is guaranteed non-null.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard } from '@/lib/roleUtils'

interface RoleRouteProps {
  /** Roles that may access this subtree, e.g. ['ADMIN', 'LOGISTICS_MGR']. */
  roles: readonly string[]
}

export default function RoleRoute({ roles }: RoleRouteProps) {
  const user = useAuthStore((s) => s.user)

  if (!user || !roles.includes(user.role)) {
    return <Navigate to={getRoleDashboard(user?.role)} replace />
  }

  return <Outlet />
}
