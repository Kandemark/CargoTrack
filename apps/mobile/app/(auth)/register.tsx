import { useRef, useState } from 'react'
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import axios from 'axios'
import { authApi } from '@/lib/api'
import { Button, Input } from '@/components/ui'
import type { RegisterPayload } from '@shared/api/auth'

type FieldErrors = Partial<Record<keyof RegisterPayload | 'non_field_errors', string>>

function parseApiErrors(err: unknown): { fields: FieldErrors; general: string | null } {
  if (axios.isAxiosError(err) && err.response?.status === 400) {
    const raw = err.response.data as Record<string, string | string[]>
    const fields: FieldErrors = {}
    let general: string | null = null
    for (const [key, val] of Object.entries(raw)) {
      const msg = Array.isArray(val) ? val[0] : val
      if (key === 'non_field_errors' || key === 'detail') general = msg
      else fields[key as keyof FieldErrors] = msg
    }
    return { fields, general }
  }
  if (axios.isAxiosError(err) && !err.response)
    return { fields: {}, general: 'Cannot reach the server. Check your network connection.' }
  return { fields: {}, general: 'Registration failed. Please try again.' }
}

const ROLES: { value: RegisterPayload['role']; label: string; sub: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'CLIENT',          label: 'Client',           sub: 'Track shipments & view data',       icon: 'business-outline' },
  { value: 'CARRIER',         label: 'Carrier',          sub: 'Log tracking events for cargo',     icon: 'car-outline' },
  { value: 'DISPATCHER',      label: 'Dispatcher',       sub: 'Assign & coordinate shipments',     icon: 'git-compare-outline' },
  { value: 'LOGISTICS_MGR',   label: 'Logistics Mgr',    sub: 'Manage operations across corridor', icon: 'stats-chart-outline' },
  { value: 'CUSTOMS_BROKER',  label: 'Customs Broker',   sub: 'Process border clearance docs',     icon: 'document-text-outline' },
  { value: 'WAREHOUSE_MGR',   label: 'Warehouse Mgr',    sub: 'Manage storage & inventory',        icon: 'cube-outline' },
  { value: 'PORT_AGENT',      label: 'Port Agent',       sub: 'Coordinate port operations',        icon: 'boat-outline' },
  { value: 'FINANCE_OFFICER', label: 'Finance Officer',  sub: 'Invoicing & payment management',    icon: 'card-outline' },
  { value: 'ADMIN',           label: 'Administrator',    sub: 'Full system configuration',         icon: 'shield-checkmark-outline' },
]

export default function RegisterScreen() {
  const [form, setForm] = useState<RegisterPayload>({
    first_name: '', last_name: '', email: '', phone: '', role: 'CLIENT', password: '', password2: '', org_name: '',
  })
  const [fieldErrors, setFE] = useState<FieldErrors>({})
  const [generalError, setGE] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set<K extends keyof RegisterPayload>(key: K, value: RegisterPayload[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    setFE((p) => ({ ...p, [key]: undefined }))
    if (generalError) setGE(null)
  }

  async function handleSubmit() {
    setFE({}); setGE(null)
    if (form.password !== form.password2) {
      setFE({ password2: 'Passwords do not match.' }); return
    }
    setLoading(true)
    try {
      await authApi.register(form)
      router.replace('/(auth)/login')
    } catch (err) {
      const { fields, general } = parseApiErrors(err)
      setFE(fields)
      setGE(general ?? (Object.keys(fields).length > 0 ? 'Please correct the errors above.' : 'Registration failed. Please try again.'))
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-ct-navy" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <SafeAreaView edges={['top']} className="bg-ct-navy overflow-hidden">
          {/* Decorative rings */}
          <View pointerEvents="none" className="absolute w-[240px] h-[240px] rounded-full border-[44px] border-white/[0.07] -top-[90px] -right-[70px]" />
          <View pointerEvents="none" className="absolute w-[150px] h-[150px] rounded-full border-[28px] border-white/[0.05] top-5 right-5" />
          <View pointerEvents="none" className="absolute w-[110px] h-[110px] rounded-full border-[22px] border-white/[0.06] -bottom-[30px] -left-[30px]" />

          <View className="px-7 pt-ct-lg pb-9">
            <View className="w-[52px] h-[52px] rounded-ct-lg bg-ct-orange items-center justify-center mb-ct-lg"
              style={{ shadowColor: '#f5801e', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6 }}>
              <Ionicons name="cube" size={26} color="#fff" />
            </View>
            <Text className="text-ct-2xl font-extrabold text-white tracking-tight">CargoTrack</Text>
            <Text className="text-ct-sm font-medium text-ct-text-brand mt-0.5">East Africa Logistics Intelligence</Text>
            <View className="w-8 h-[3px] rounded-sm bg-ct-orange mt-5 mb-ct-lg" />
            <Text className="text-ct-3xl font-extrabold text-white tracking-tight">Create account</Text>
            <Text className="text-ct-base text-ct-text-brand mt-1 leading-5">Join the Northern Corridor network</Text>
          </View>
        </SafeAreaView>

        {/* Form card */}
        <View className="flex-1 bg-ct-surface-card dark:bg-ct-dark-card rounded-t-ct-2xl -mt-[22px] px-6 pt-8 pb-12">
          {generalError && (
            <View className="flex-row items-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-ct-md p-ct-md mb-5">
              <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" style={{ marginRight: 8 }} />
              <Text className="flex-1 text-ct-sm text-red-700 dark:text-red-200 leading-[18px]">{generalError}</Text>
            </View>
          )}

          {/* Name row */}
          <View className="flex-row gap-2.5 mb-[18px]">
            <View className="flex-1">
              <Input
                label="First name" icon="person-outline" placeholder="Jane"
                value={form.first_name} error={fieldErrors.first_name}
                onChangeText={(v) => set('first_name', v)} autoCapitalize="words" returnKeyType="next"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Last name" icon="person-outline" placeholder="Mwangi"
                value={form.last_name} error={fieldErrors.last_name}
                onChangeText={(v) => set('last_name', v)} autoCapitalize="words" returnKeyType="next"
              />
            </View>
          </View>

          <Input
            label="Email address" icon="mail-outline" placeholder="jane@company.com"
            value={form.email} error={fieldErrors.email}
            onChangeText={(v) => set('email', v)} keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false} className="mb-[18px]"
          />

          {/* Org + Phone row */}
          <View className="flex-row gap-2.5 mb-[18px]">
            <View className="flex-1">
              <Input
                label="Organization" icon="briefcase-outline" placeholder="Acme Freight"
                value={form.org_name ?? ''} error={fieldErrors.org_name}
                onChangeText={(v) => set('org_name', v)} autoCapitalize="words"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Phone" icon="call-outline" placeholder="+254 700 000 000"
                value={form.phone} error={fieldErrors.phone}
                onChangeText={(v) => set('phone', v)} keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Role selector */}
          <View className="mb-[18px]">
            <Text className="text-ct-sm font-heading font-bold text-ct-text-secondary dark:text-ct-dark-text-muted mb-2 uppercase tracking-wider">Account type</Text>
            <View className="flex-row flex-wrap gap-2">
              {ROLES.map((opt) => {
                const selected = form.role === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value} onPress={() => set('role', opt.value)} activeOpacity={0.75}
                    className={`w-[31%] items-center rounded-ct-md p-2.5 border-[1.5px] ${
                      selected
                        ? 'border-ct-navy bg-blue-50 dark:bg-blue-900/20'
                        : 'border-ct-border-light dark:border-ct-dark-border bg-ct-surface-muted dark:bg-ct-dark-surface'
                    }`}
                  >
                    <Ionicons name={opt.icon} size={18} color={selected ? '#0f2d5e' : '#9ca3af'} style={{ marginBottom: 4 }} />
                    <Text className={`text-ct-xs font-bold text-center ${selected ? 'text-ct-navy dark:text-blue-300' : 'text-ct-text-secondary dark:text-ct-dark-text-muted'}`}>
                      {opt.label}
                    </Text>
                    <Text className={`text-[10px] text-center mt-0.5 leading-[13px] ${selected ? 'text-blue-500 dark:text-blue-400' : 'text-ct-text-faint'}`}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {fieldErrors.role && <Text className="text-ct-xs text-ct-danger mt-1.5">{fieldErrors.role}</Text>}
          </View>

          <Input
            label="Password" icon="lock-closed-outline" placeholder="Min. 10 characters, 1 upper, 1 digit, 1 symbol"
            value={form.password} error={fieldErrors.password}
            onChangeText={(v) => set('password', v)} secureTextEntry className="mb-[18px]"
          />

          <Input
            label="Confirm password" icon="lock-closed-outline" placeholder="Repeat password"
            value={form.password2} error={fieldErrors.password2}
            onChangeText={(v) => set('password2', v)} secureTextEntry
            returnKeyType="done" onSubmitEditing={handleSubmit} className="mb-7"
          />

          <Button variant="primary" size="lg" loading={loading} onPress={handleSubmit} className="w-full">
            Create account
          </Button>

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} className="mt-5 items-center" activeOpacity={0.7}>
            <Text className="text-ct-base text-ct-text-muted dark:text-ct-dark-text-muted">
              Already have an account?{' '}
              <Text className="text-ct-navy dark:text-ct-orange font-bold">Sign in</Text>
            </Text>
          </TouchableOpacity>

          <Text className="mt-6 text-center text-ct-xs text-gray-300 dark:text-gray-600">
            {new Date().getFullYear()} CargoTrack Ltd
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
