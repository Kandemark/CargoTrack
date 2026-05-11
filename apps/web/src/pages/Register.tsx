import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Truck, Shield, Globe2, BarChart3, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard } from '@/lib/roleUtils'
import type { RegisterPayload } from '@/api/auth'
import StepIndicator from '@/components/onboarding/StepIndicator'
import AccountStep, { type AccountFields } from '@/components/onboarding/AccountStep'
import RoleOrgStep, { type RoleOrgFields } from '@/components/onboarding/RoleOrgStep'
import RoleProfileStep, { type RoleProfileFields } from '@/components/onboarding/RoleProfileStep'

// ─── Types ──────────────────────────────────────────────────────────────────────

type FieldErrors = Partial<Record<string, string>>

interface WizardForm {
  account: AccountFields
  roleOrg: RoleOrgFields
  profile: RoleProfileFields
}

const EMPTY_FORM: WizardForm = {
  account: { first_name: '', last_name: '', email: '', phone: '', password: '', password2: '' },
  roleOrg: { role: 'CLIENT', org_name: '', org_type: 'SHIPPER', join_code: '' },
  profile: { license_number: '', license_class: '', years_experience: 0, certifications: '', cargo_prefs: '', tax_id: '' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseApiErrors(err: unknown): { fields: FieldErrors; general: string | null } {
  if (axios.isAxiosError(err) && err.response?.status === 400) {
    const raw = err.response.data as Record<string, string | string[]>
    const fields: FieldErrors = {}
    let general: string | null = null
    for (const [key, val] of Object.entries(raw)) {
      const msg = Array.isArray(val) ? val[0] : val
      if (key === 'non_field_errors' || key === 'detail') general = msg
      else fields[key] = msg
    }
    return { fields, general }
  }
  return { fields: {}, general: 'An unexpected error occurred. Please try again.' }
}

function buildPayload(w: WizardForm): RegisterPayload {
  return {
    first_name: w.account.first_name,
    last_name: w.account.last_name,
    email: w.account.email,
    phone: w.account.phone,
    password: w.account.password,
    password2: w.account.password2,
    role: w.roleOrg.role,
    org_name: w.roleOrg.org_name || undefined,
    org_type: w.roleOrg.org_type || undefined,
    join_code: w.roleOrg.join_code || undefined,
    license_number: w.profile.license_number || undefined,
    license_class: w.profile.license_class || undefined,
    years_experience: w.profile.years_experience || undefined,
    certifications: w.profile.certifications
      ? w.profile.certifications.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    cargo_prefs: w.profile.cargo_prefs
      ? w.profile.cargo_prefs.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    tax_id: w.profile.tax_id || undefined,
  }
}

const STEP_TITLES: Record<number, string> = {
  1: 'Create your account',
  2: 'Choose your role',
  3: 'Complete your profile',
}

const STEP_SUBS: Record<number, string> = {
  1: 'Start with your name, email, and a secure password.',
  2: 'Tell us about your role in the logistics chain and your organization.',
  3: 'A few more role-specific details to tailor your experience.',
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate()
  const registerFn = useAuthStore((s) => s.register)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM)
  const [fieldErrors, setFE] = useState<FieldErrors>({})
  const [generalError, setGE] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [direction, setDirection] = useState(1)

  // ── Per-field change handler ──────────────────────────────────────────────────
  function updateField(
    section: keyof WizardForm,
    name: string,
    value: string | number,
  ) {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [name]: value },
    }))
    setFE((prev) => ({ ...prev, [name]: undefined }))
  }

  function accountOnChange(e: ChangeEvent<HTMLInputElement>) {
    updateField('account', e.target.name, e.target.value)
  }

  function roleOrgOnChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    updateField('roleOrg', e.target.name, e.target.value)
  }

  function onRoleChange(role: string) {
    updateField('roleOrg', 'role', role)
  }

  function profileOnChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    updateField('profile', e.target.name, val)
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  function validateStep1(): boolean {
    const errs: FieldErrors = {}
    if (!form.account.first_name.trim()) errs.first_name = 'First name is required.'
    if (!form.account.last_name.trim()) errs.last_name = 'Last name is required.'
    if (!form.account.email.trim()) errs.email = 'Email is required.'
    if (form.account.password.length < 8) errs.password = 'Must be at least 8 characters.'
    if (form.account.password !== form.account.password2) errs.password2 = 'Passwords do not match.'
    setFE(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean {
    if (!form.roleOrg.role) {
      setFE({ role: 'Please select a role.' })
      return false
    }
    setFE({})
    return true
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  function nextStep() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setDirection(1)
    setStep((s) => Math.min(s + 1, 3))
    setGE(null)
    setFE({})
  }

  function prevStep() {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 1))
    setGE(null)
    setFE({})
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFE({})
    setGE(null)
    setLoading(true)

    try {
      const payload = buildPayload(form)
      await registerFn(payload)
      const user = useAuthStore.getState().user
      navigate(getRoleDashboard(user?.role), { replace: true })
    } catch (err: unknown) {
      const { fields, general } = parseApiErrors(err)
      setFE(fields)

      const accountFields = ['first_name', 'last_name', 'email', 'password', 'password2']
      const roleOrgFields = ['role', 'org_name', 'org_type', 'join_code']
      if (Object.keys(fields).some((k) => accountFields.includes(k))) setStep(1)
      else if (Object.keys(fields).some((k) => roleOrgFields.includes(k))) setStep(2)

      const e2 = err as { response?: { data?: Record<string, unknown> } }
      const data = e2?.response?.data ?? {}
      setGE(
        general ??
        (data['detail'] as string | undefined) ??
        (Object.keys(fields).length > 0 ? 'Please correct the highlighted errors above.' : null) ??
        'Registration failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  // ── Slide variants ────────────────────────────────────────────────────────────
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-[#0f2d5e]">
      {/* Left: brand panel (matches Login) */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] relative overflow-hidden bg-gradient-to-br from-[#0f2d5e] via-[#133568] to-[#0a2047]">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.06] blur-[100px]"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-20 w-64 h-64 rounded-full opacity-[0.04] blur-[80px]"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />

        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex flex-col justify-center px-14 xl:px-20 w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f5801e] to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black text-white tracking-tight">CargoTrack</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.15] tracking-tight mb-5">
              Join the
              <br />
              <span className="bg-gradient-to-r from-[#f5801e] via-orange-400 to-amber-300 bg-clip-text text-transparent">
                East African
              </span>
              <br />
              Logistics Network
            </h1>

            <p className="text-blue-200/80 text-lg leading-relaxed max-w-md">
              Create your account in three simple steps and start tracking shipments
              across the Northern and Central corridors.
            </p>

            <div className="mt-12 space-y-4">
              {[
                { icon: Shield, text: 'Enterprise-grade security with TOTP MFA support' },
                { icon: Globe2, text: 'Coverage across Kenya, Uganda, Tanzania, and Rwanda' },
                { icon: BarChart3, text: 'ML-powered analytics from day one' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-blue-200/90">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 border border-white/[0.06]">
                    <Icon className="w-4 h-4 text-[#f5801e]" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-14 pt-8 border-t border-white/[0.06]">
              <p className="text-blue-300/40 text-xs">
                Already have an account?{' '}
                <Link to="/login" className="text-[#f5801e] hover:text-orange-400 font-semibold transition-colors">
                  Sign in &rarr;
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right: registration wizard */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white dark:bg-gray-900 lg:rounded-l-[40px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-[480px]"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#f5801e] to-orange-500 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-black text-gray-900 dark:text-white">CargoTrack</span>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    s < step
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : s === step
                        ? 'bg-[#0f2d5e] text-white shadow-lg shadow-[#0f2d5e]/25 ring-4 ring-[#0f2d5e]/10'
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                  <span className={`hidden sm:inline text-sm font-semibold transition-colors ${
                    s === step ? 'text-gray-900 dark:text-white' : s < step ? 'text-emerald-600' : 'text-gray-400'
                  }`}>
                    {s === 1 ? 'Account' : s === 2 ? 'Role' : 'Profile'}
                  </span>
                  {s < 3 && (
                    <div className="hidden sm:block w-8 h-0.5 mx-1">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ background: s < step ? '#22c55e' : '#e5e7eb' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Thin progress bar */}
            <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#0f2d5e] to-[#f5801e] rounded-full"
                initial={{ width: `${((step - 1) / 2) * 100}%` }}
                animate={{ width: `${((step - 1) / 2) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Step header */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`header-${step}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mb-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {STEP_TITLES[step]}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {STEP_SUBS[step]}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Error banner */}
          <AnimatePresence>
            {generalError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5"
              >
                <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-sm">
                  {generalError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form steps */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  {step === 1 && (
                    <AccountStep form={form.account} errors={fieldErrors} onChange={accountOnChange} />
                  )}
                  {step === 2 && (
                    <RoleOrgStep form={form.roleOrg} errors={fieldErrors} onChange={roleOrgOnChange} onRoleChange={onRoleChange} />
                  )}
                  {step === 3 && (
                    <RoleProfileStep role={form.roleOrg.role} form={form.profile} onChange={profileOnChange} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <span />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white
                    bg-gradient-to-r from-[#0f2d5e] to-[#1e3a5f] hover:from-[#0a2047] hover:to-[#15305a]
                    shadow-lg shadow-[#0f2d5e]/20 hover:shadow-xl hover:shadow-[#0f2d5e]/25 hover:-translate-y-px
                    transition-all"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white
                    bg-gradient-to-r from-[#f5801e] to-orange-500 hover:from-[#e06f12] hover:to-orange-600
                    shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25 hover:-translate-y-px
                    transition-all disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating account...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Create account
                    </>
                  )}
                </button>
              )}
            </div>
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
