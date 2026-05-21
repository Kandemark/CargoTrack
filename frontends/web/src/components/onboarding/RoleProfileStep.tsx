import type { ChangeEvent } from 'react'
import { FileText, Shield, Truck } from 'lucide-react'

export interface RoleProfileFields {
  license_number: string
  license_class: string
  years_experience: number
  certifications: string
  cargo_prefs: string
  tax_id: string
}

interface Props {
  role: string
  form: RoleProfileFields
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}

const LICENSE_CLASSES = [
  { value: 'A',  label: 'Class A — Motorcycle' },
  { value: 'B',  label: 'Class B — Light vehicle' },
  { value: 'C',  label: 'Class C — Light truck' },
  { value: 'D',  label: 'Class D — Heavy truck (van)' },
  { value: 'E',  label: 'Class E — Heavy articulated' },
  { value: 'F',  label: 'Class F — Special (forklift, etc.)' },
  { value: 'G',  label: 'Class G — Industrial plant' },
]

export default function RoleProfileStep({ role, form, onChange }: Props) {
  return (
    <div className="space-y-5">
      {/* CARRIER / DRIVER — license & experience */}
      {role === 'CARRIER' && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-[#f5801e]" />
            <span className="text-sm font-semibold text-gray-800">Driver credentials</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">License number</label>
            <input
              type="text"
              name="license_number"
              placeholder="e.g. DL-12345678"
              value={form.license_number}
              onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">License class</label>
              <select
                name="license_class"
                value={form.license_class}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select class</option>
                {LICENSE_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Years of experience</label>
              <input
                type="number"
                name="years_experience"
                min={0}
                max={60}
                placeholder="0"
                value={form.years_experience || ''}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Certifications <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <textarea
              name="certifications"
              placeholder="ADR, HAZMAT, Cold Chain, ..."
              value={form.certifications}
              onChange={onChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </>
      )}

      {/* CLIENT — cargo preferences */}
      {role === 'CLIENT' && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-[#f5801e]" />
            <span className="text-sm font-semibold text-gray-800">Shipping preferences</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cargo type preferences <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <textarea
              name="cargo_prefs"
              placeholder="General cargo, Perishables, Hazardous, Fragile, ..."
              value={form.cargo_prefs}
              onChange={onChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </>
      )}

      {/* MANAGEMENT ROLES — tax ID for business verification */}
      {(role === 'ADMIN' || role === 'LOGISTICS_MGR' || role === 'DISPATCHER' ||
        role === 'CUSTOMS_BROKER' || role === 'WAREHOUSE_MGR' || role === 'PORT_AGENT' ||
        role === 'FINANCE_OFFICER') && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-[#f5801e]" />
            <span className="text-sm font-semibold text-gray-800">Business verification</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tax ID / Business registration number
            </label>
            <input
              type="text"
              name="tax_id"
              placeholder="e.g. P051234567X"
              value={form.tax_id}
              onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </>
      )}

      <p className="text-xs text-gray-400 mt-2">
        This information helps us verify your identity and tailor the platform to your role. You can update these details later from your account settings.
      </p>
    </div>
  )
}
