import type { ChangeEvent } from 'react'
import { Building2, Users } from 'lucide-react'

export interface RoleOrgFields {
  role: string
  org_name: string
  org_type: string
  join_code: string
}

interface Props {
  form: RoleOrgFields
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onRoleChange: (role: string) => void
}

const ROLES = [
  { value: 'CLIENT',         label: 'Client',         desc: 'Track shipments and view logistics data' },
  { value: 'CARRIER',        label: 'Carrier / Driver', desc: 'Log tracking events and manage fleet' },
  { value: 'LOGISTICS_MGR',  label: 'Logistics Manager', desc: 'Oversee shipments, routes, and carriers' },
  { value: 'ADMIN',          label: 'Administrator',   desc: 'Full platform control and user management' },
  { value: 'DISPATCHER',     label: 'Dispatcher',      desc: 'Assign and coordinate shipments' },
  { value: 'CUSTOMS_BROKER', label: 'Customs Broker',  desc: 'Process customs clearance documents' },
  { value: 'WAREHOUSE_MGR',  label: 'Warehouse Manager', desc: 'Manage storage, inventory, and staging' },
  { value: 'PORT_AGENT',     label: 'Port Agent',      desc: 'Handle port operations and documentation' },
  { value: 'FINANCE_OFFICER', label: 'Finance Officer',  desc: 'Manage invoices, payments, and financial reports' },
]

const ORG_TYPES = [
  { value: 'SHIPPER',    label: 'Shipper' },
  { value: 'CARRIER',    label: 'Carrier' },
  { value: 'BROKER',     label: 'Freight Broker' },
  { value: 'WAREHOUSE',  label: 'Warehouse' },
  { value: 'FORWARDER',  label: 'Freight Forwarder' },
]

export default function RoleOrgStep({ form, onChange, onRoleChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Role selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Select your role</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {ROLES.map((r) => {
            const selected = form.role === r.value
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => onRoleChange(r.value)}
                className={[
                  'text-left p-3 rounded-lg border-2 transition-colors',
                  selected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{r.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Organization section */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Organization</span>
        </div>

        {/* Join existing */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Users className="w-4 h-4 text-gray-400" />
            Join an existing organization
          </label>
          <input
            type="text"
            name="join_code"
            placeholder="Enter invite code"
            value={form.join_code}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">
            Ask your admin for the organization invite code.
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Create new org */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Create a new organization</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Organization name</label>
            <input
              type="text"
              name="org_name"
              placeholder="Acme Freight Ltd"
              value={form.org_name}
              onChange={onChange}
              disabled={!!form.join_code}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Organization type</label>
            <select
              name="org_type"
              value={form.org_type}
              onChange={onChange}
              disabled={!!form.join_code}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
            >
              {ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
