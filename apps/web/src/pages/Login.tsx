/**
 * Login.tsx — Authenticated entry point for CargoTrack.
 */
import { useState, type FormEvent } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, LogIn, Shield, Truck, ArrowRight, AlertTriangle, Globe2, BarChart3 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard } from '@/lib/roleUtils'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((s) => s.login)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }
    setLoading(true)
    try {
      await login({ username: username.trim(), password })
      const user = useAuthStore.getState().user
      const next = searchParams.get('next')
      navigate(next ?? getRoleDashboard(user?.role), { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429) setError('Too many attempts. Please wait a moment and try again.')
      else if (status === 401 || status === 403) setError('Invalid username or password.')
      else if (status && status >= 500) setError('Server error. Please try again shortly.')
      else setError('Unable to connect. Check your network and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0f2d5e]">
      {/* Left: decorative brand panel */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] relative overflow-hidden bg-gradient-to-br from-[#0f2d5e] via-[#133568] to-[#0a2047]">
        {/* Animated gradient orbs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.06] blur-[100px]"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-20 w-64 h-64 rounded-full opacity-[0.04] blur-[80px]"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Decorative rings */}
        <div className="absolute top-1/4 right-1/4 w-40 h-40 rounded-full border border-white/[0.04]" />
        <div className="absolute bottom-1/3 left-1/4 w-28 h-28 rounded-full border border-white/[0.05]" />

        <div className="relative flex flex-col justify-center px-14 xl:px-20 w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f5801e] to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black text-white tracking-tight">CargoTrack</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.15] tracking-tight mb-5">
              Northern Corridor
              <br />
              <span className="bg-gradient-to-r from-[#f5801e] via-orange-400 to-amber-300 bg-clip-text text-transparent">
                Logistics Intelligence
              </span>
            </h1>

            <p className="text-blue-200/80 text-lg leading-relaxed max-w-md">
              Real-time freight tracking, ML-powered delay alerts, and complete audit
              trails across Kenya, Uganda, Tanzania, and Rwanda.
            </p>

            {/* Value props */}
            <div className="mt-12 space-y-4">
              {[
                { icon: Shield, text: 'Role-based access for all 9 logistics roles' },
                { icon: AlertTriangle, text: 'Proactive delay risk scoring and alerts' },
                { icon: Truck, text: 'Live GPS tracking from Mombasa to Kigali' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-blue-200/90">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 border border-white/[0.06]">
                    <Icon className="w-4 h-4 text-[#f5801e]" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>

            {/* Trust bar */}
            <div className="mt-14 pt-8 border-t border-white/[0.06]">
              <div className="flex items-center gap-4 text-blue-300/40 text-xs">
                <div className="flex items-center gap-1.5">
                  <Globe2 className="w-3 h-3" />
                  <span>6 Countries</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3 h-3" />
                  <span>99.7% Uptime</span>
                </div>
              </div>
              <p className="text-blue-300/40 text-xs mt-3">
                Trusted by freight forwarders, carriers, and shippers across East Africa.
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white dark:bg-gray-900 lg:rounded-l-[40px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#f5801e] to-orange-500 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-black text-gray-900 dark:text-white">CargoTrack</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1.5">
            Welcome back
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
            Sign in to your account.{' '}
            <Link to="/register" className="text-[#f5801e] hover:text-orange-600 font-semibold transition-colors">
              Create one &rarr;
            </Link>
          </p>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5"
              >
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null) }}
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-[#0f2d5e] dark:focus:ring-[#f5801e] focus:border-transparent
                  transition-all hover:border-gray-300 dark:hover:border-gray-600"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <a href="#" className="text-xs font-medium text-[#f5801e] hover:text-orange-600 transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                    text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-[#0f2d5e] dark:focus:ring-[#f5801e] focus:border-transparent
                    transition-all hover:border-gray-300 dark:hover:border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2
                transition-all disabled:opacity-60 mt-2 bg-gradient-to-r from-[#0f2d5e] to-[#1a4a8b]
                hover:from-[#0a2047] hover:to-[#153e7a] shadow-lg shadow-[#0f2d5e]/25
                hover:shadow-xl hover:shadow-[#0f2d5e]/30 hover:-translate-y-px"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
            &copy; {new Date().getFullYear()} CargoTrack Ltd &mdash; Enterprise Logistics Intelligence
          </p>
        </motion.div>
      </div>
    </div>
  )
}
