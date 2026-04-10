/**
 * @file Login.tsx
 * @description Login page — unauthenticated entry point for the React SPA.
 *
 * Submits credentials via `useAuthStore.login()` which calls
 * `POST /api/auth/token/` and then `GET /api/v1/accounts/me/`.
 * On success, redirects to `/dashboard`.  On failure, displays an
 * inline error message without revealing which field was wrong.
 *
 * @route /login
 * @auth Public (AllowAny)
 */
import { useState, type FormEvent } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard } from '@/lib/roleUtils'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ username, password })
      const user = useAuthStore.getState().user
      const next = searchParams.get('next')
      navigate(next ?? getRoleDashboard(user?.role), { replace: true })
    } catch {
      setError('Invalid username or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: 'var(--ct-orange)' }}
            >
              <span className="text-white font-bold text-sm">CT</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--ct-navy)' }}>CargoTrack</span>
          </div>
          <p className="text-gray-500 text-sm">Northern Corridor Logistics Intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in to your account</h1>
          <p className="text-sm text-gray-500 mb-6">
            Don&rsquo;t have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">
              Create one
            </Link>
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                style={{ ['--tw-ring-color' as string]: 'var(--ct-navy)' }}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 mt-2"
              style={{ background: 'var(--ct-navy)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} CargoTrack Ltd &mdash; Enterprise Logistics Intelligence
        </p>
      </div>
    </div>
  )
}
