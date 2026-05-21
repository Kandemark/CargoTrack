/**
 * AccessDenied — full-page 403 screen shown when a user navigates to a
 * route their role cannot access.  Provides a link back to their own dashboard.
 */
import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard } from '@/lib/roleUtils'

export default function AccessDenied() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 mb-6">
          <ShieldX className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-sm text-gray-500 mb-8">
          You don&rsquo;t have permission to view this page. Contact your
          administrator if you believe this is an error.
        </p>
        <Link
          to={getRoleDashboard(user?.role)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--ct-navy)' }}
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
