import type { ChangeEvent } from 'react'

export interface AccountFields {
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  password2: string
}

interface Props {
  form: AccountFields
  errors: Partial<Record<keyof AccountFields, string>>
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

export default function AccountStep({ form, errors, onChange }: Props) {
  function cls(name: keyof AccountFields) {
    return [
      'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors',
      errors[name]
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-gray-300 focus:ring-blue-500',
    ].join(' ')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
          <input
            type="text"
            name="first_name"
            required
            autoComplete="given-name"
            placeholder="Jane"
            value={form.first_name}
            onChange={onChange}
            className={cls('first_name')}
          />
          {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
          <input
            type="text"
            name="last_name"
            required
            autoComplete="family-name"
            placeholder="Mwangi"
            value={form.last_name}
            onChange={onChange}
            className={cls('last_name')}
          />
          {errors.last_name && <p className="mt-1 text-xs text-red-600">{errors.last_name}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="jane@company.com"
          value={form.email}
          onChange={onChange}
          className={cls('email')}
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Phone <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder="+254 700 000 000"
          value={form.phone}
          onChange={onChange}
          className={cls('phone')}
        />
        {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <input
            type="password"
            name="password"
            required
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={onChange}
            className={cls('password')}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
          <input
            type="password"
            name="password2"
            required
            autoComplete="new-password"
            placeholder="Repeat password"
            value={form.password2}
            onChange={onChange}
            className={cls('password2')}
          />
          {errors.password2 && <p className="mt-1 text-xs text-red-600">{errors.password2}</p>}
        </div>
      </div>
    </div>
  )
}
