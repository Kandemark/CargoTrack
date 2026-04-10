import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard } from '@/lib/roleUtils'
import type { RegisterPayload } from '@/api/auth'

type FieldErrors = Partial<Record<keyof RegisterPayload | 'non_field_errors', string>>

function parseApiErrors(err: unknown): { fields: FieldErrors; general: string | null } {
  if (axios.isAxiosError(err) && err.response?.status === 400) {
    const raw = err.response.data as Record<string, string | string[]>
    const fields: FieldErrors = {}
    let general: string | null = null
    for (const [key, val] of Object.entries(raw)) {
      const msg = Array.isArray(val) ? val[0] : val
      if (key === 'non_field_errors' || key === 'detail') {
        general = msg
      } else {
        fields[key as keyof FieldErrors] = msg
      }
    }
    return { fields, general }
  }
  return { fields: {}, general: 'An unexpected error occurred. Please try again.' }
}

const ROLE_OPTIONS: { value: RegisterPayload['role']; label: string; description: string }[] = [
  { value: 'CLIENT',  label: 'Client',  description: 'Track shipments and view logistics data' },
  { value: 'CARRIER', label: 'Carrier', description: 'Log tracking events for assigned cargo' },
]

interface FormState {
  first_name: string
  last_name:  string
  email:      string
  company:    string
  phone:      string
  role:       RegisterPayload['role']
  password:   string
  password2:  string
}

const EMPTY: FormState = {
  first_name: '',
  last_name:  '',
  email:      '',
  company:    '',
  phone:      '',
  role:       'CLIENT',
  password:   '',
  password2:  '',
}

export default function Register() {
  const navigate  = useNavigate()
  const register  = useAuthStore((s) => s.register)

  const [form, setForm]         = useState<FormState>(EMPTY)
  const [fieldErrors, setFE]    = useState<FieldErrors>({})
  const [generalError, setGE]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  function field(name: keyof FormState) {
    return {
      value: form[name],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [name]: e.target.value }))
        setFE((prev) => ({ ...prev, [name]: undefined }))
      },
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFE({})
    setGE(null)

    if (form.password !== form.password2) {
      setFE({ password2: 'Passwords do not match.' })
      return
    }

    setLoading(true)
    console.log('[Register] submitting:', {
      email: form.email, role: form.role,
      first_name: form.first_name, last_name: form.last_name,
    })
    try {
      await register(form)
      console.log('[Register] register() done. Store state:', {
        isAuthenticated: useAuthStore.getState().isAuthenticated,
        user: useAuthStore.getState().user,
      })
      const user = useAuthStore.getState().user
      const destination = getRoleDashboard(user?.role)
      console.log('[Register] navigating to:', destination)
      navigate(destination, { replace: true })
    } catch (err: unknown) {
      console.error('[Register] FAILED:', err)
      const e = err as { response?: { status?: number; data?: Record<string, unknown> } }
      console.error('[Register] response status:', e?.response?.status)
      console.error('[Register] response data:', e?.response?.data)

      // Extract field-level errors (shows inline under each input)
      const { fields, general: parsedGeneral } = parseApiErrors(err)
      setFE(fields)

      // Always show a banner — fall back through progressively broader messages
      const data = e?.response?.data ?? {}
      const msg =
        parsedGeneral ??
        (data['detail'] as string | undefined) ??
        (data['email'] as string[] | undefined)?.[0] ??
        (data['password'] as string[] | undefined)?.[0] ??
        (data['non_field_errors'] as string[] | undefined)?.[0] ??
        (Object.keys(fields).length > 0
          ? 'Please correct the highlighted errors above.'
          : null) ??
        'Registration failed. Please try again.'
      setGE(msg)
    } finally {
      setLoading(false)
    }
  }

  function inputClass(name: keyof FormState) {
    return [
      'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors',
      fieldErrors[name]
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-gray-300 focus:ring-blue-500',
    ].join(' ')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">

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
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>

          {generalError && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  placeholder="Jane"
                  className={inputClass('first_name')}
                  {...field('first_name')}
                />
                {fieldErrors.first_name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.first_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  placeholder="Mwangi"
                  className={inputClass('last_name')}
                  {...field('last_name')}
                />
                {fieldErrors.last_name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.last_name}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="jane@company.com"
                className={inputClass('email')}
                {...field('email')}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Company + Phone row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                <input
                  type="text"
                  autoComplete="organization"
                  placeholder="Acme Freight Ltd"
                  className={inputClass('company')}
                  {...field('company')}
                />
                {fieldErrors.company && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.company}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+254 700 000 000"
                  className={inputClass('phone')}
                  {...field('phone')}
                />
                {fieldErrors.phone && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
                )}
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account type</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={[
                      'relative flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                      form.role === opt.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={form.role === opt.value}
                      onChange={() => setForm((p) => ({ ...p, role: opt.value }))}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-gray-800">{opt.label}</span>
                    <span className="text-xs text-gray-500 leading-snug">{opt.description}</span>
                  </label>
                ))}
              </div>
              {fieldErrors.role && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
              )}
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  className={inputClass('password')}
                  {...field('password')}
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  className={inputClass('password2')}
                  {...field('password2')}
                />
                {fieldErrors.password2 && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.password2}</p>
                )}
              </div>
            </div>

            {generalError && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {generalError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 mt-2"
              style={{ background: 'var(--ct-navy)' }}
            >
              {loading ? 'Creating account…' : 'Create account'}
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
