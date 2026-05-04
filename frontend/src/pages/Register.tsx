import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, ArrowRight, Truck } from 'lucide-react'
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
      if (key === 'non_field_errors' || key === 'detail') {
        general = msg
      } else {
        fields[key] = msg
      }
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

// ─── Component ──────────────────────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate()
  const registerFn = useAuthStore((s) => s.register)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM)
  const [fieldErrors, setFE] = useState<FieldErrors>({})
  const [generalError, setGE] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // ── Per-field change handler (flat keys match backend field names) ────────────
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
    if (form.account.password.length < 8) errs.password = 'Password must be at least 8 characters.'
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
    if (step === 1) {
      if (!validateStep1()) return
    }
    if (step === 2) {
      if (!validateStep2()) return
    }
    setStep((s) => Math.min(s + 1, 3))
    setGE(null)
    setFE({})
  }

  function prevStep() {
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

      // If there are field-level errors, go back to the relevant step
      const accountFields = ['first_name', 'last_name', 'email', 'password', 'password2']
      const roleOrgFields = ['role', 'org_name', 'org_type', 'join_code']
      if (Object.keys(fields).some((k) => accountFields.includes(k))) {
        setStep(1)
      } else if (Object.keys(fields).some((k) => roleOrgFields.includes(k))) {
        setStep(2)
      }

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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Wordmark */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'var(--ct-orange)' }}>
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--ct-navy)' }}>CargoTrack</span>
          </div>
          <p className="text-gray-500 text-sm">Create your account in three easy steps</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <StepIndicator current={step} />

          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {step === 1 ? 'Account details' : step === 2 ? 'Role & Organization' : 'Role-specific profile'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {step === 1
              ? 'Start with your basic account information.'
              : step === 2
                ? 'Tell us about your role and organization.'
                : 'A few more details to complete your profile.'}
          </p>

          {generalError && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Step 1: Account */}
            {step === 1 && (
              <AccountStep form={form.account} errors={fieldErrors} onChange={accountOnChange} />
            )}

            {/* Step 2: Role & Organization */}
            {step === 2 && (
              <RoleOrgStep form={form.roleOrg} onChange={roleOrgOnChange} onRoleChange={onRoleChange} />
            )}

            {/* Step 3: Role-specific profile */}
            {step === 3 && (
              <RoleProfileStep role={form.roleOrg.role} form={form.profile} onChange={profileOnChange} />
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
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
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ background: 'var(--ct-navy)' }}
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--ct-navy)' }}
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              )}
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-4">
          &copy; {new Date().getFullYear()} CargoTrack Ltd &mdash; Enterprise Logistics Intelligence
        </p>
      </div>
    </div>
  )
}
