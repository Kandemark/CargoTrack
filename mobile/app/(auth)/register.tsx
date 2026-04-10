import { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import axios from 'axios'
import { authApi } from '@/lib/api'
import type { RegisterPayload } from '@shared/api/auth'

// ── Field error map ───────────────────────────────────────────────────────────

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
  if (axios.isAxiosError(err) && !err.response) {
    return { fields: {}, general: 'Cannot reach the server. Check your network connection.' }
  }
  return { fields: {}, general: 'Registration failed. Please try again.' }
}

// ── Role selector ─────────────────────────────────────────────────────────────

const ROLES: { value: RegisterPayload['role']; label: string; sub: string }[] = [
  { value: 'CLIENT',  label: 'Client',  sub: 'Track shipments & view data' },
  { value: 'CARRIER', label: 'Carrier', sub: 'Log tracking events for cargo' },
]

// ── Input helper ──────────────────────────────────────────────────────────────

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-gray-700 mb-1.5">{label}</Text>
      {children}
      {error ? <Text className="text-red-500 text-xs mt-1">{error}</Text> : null}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const [form, setForm] = useState<RegisterPayload>({
    first_name: '',
    last_name:  '',
    email:      '',
    company:    '',
    phone:      '',
    role:       'CLIENT',
    password:   '',
    password2:  '',
  })
  const [fieldErrors, setFE]  = useState<FieldErrors>({})
  const [generalError, setGE] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Refs for keyboard "next" chaining
  const lastNameRef  = useRef<TextInput>(null)
  const emailRef     = useRef<TextInput>(null)
  const companyRef   = useRef<TextInput>(null)
  const phoneRef     = useRef<TextInput>(null)
  const passwordRef  = useRef<TextInput>(null)
  const password2Ref = useRef<TextInput>(null)

  function set<K extends keyof RegisterPayload>(key: K, value: RegisterPayload[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    setFE((p) => ({ ...p, [key]: undefined }))
  }

  async function handleSubmit() {
    setFE({})
    setGE(null)

    // Client-side password match check before hitting the network
    if (form.password !== form.password2) {
      setFE({ password2: 'Passwords do not match.' })
      return
    }

    setLoading(true)
    try {
      await authApi.register(form)
      // Navigate to login — user confirms credentials before entering the app
      router.replace('/(auth)/login')
    } catch (err) {
      const { fields, general } = parseApiErrors(err)
      setFE(fields)
      setGE(
        general ??
        (Object.keys(fields).length > 0
          ? 'Please correct the errors above.'
          : 'Registration failed. Please try again.'),
      )
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (key: keyof RegisterPayload) => ({
    borderWidth: 1,
    borderColor: fieldErrors[key] ? '#fca5a5' : '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: fieldErrors[key] ? '#fef2f2' : '#f9fafb',
  } as const)

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f2d5e' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Navy header */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#0f2d5e' }}>
          <View className="bg-ct-navy px-6 pt-6 pb-10">
            <View className="flex-row items-center gap-3 mb-6">
              <View className="w-10 h-10 rounded-xl bg-ct-orange items-center justify-center">
                <Text className="text-white font-bold text-base">CT</Text>
              </View>
              <View>
                <Text className="text-white font-bold text-xl">CargoTrack</Text>
                <Text className="text-blue-300 text-xs">Logistics Intelligence</Text>
              </View>
            </View>
            <Text className="text-white text-2xl font-bold">Create account</Text>
            <Text className="text-blue-300 text-sm mt-1">
              Northern Corridor · East Africa
            </Text>
          </View>
        </SafeAreaView>

        {/* Form card */}
        <View className="flex-1 bg-white rounded-t-3xl -mt-5 px-6 pt-7 pb-12">

          {/* General error banner */}
          {generalError && (
            <View className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <Text className="text-red-700 text-sm leading-5">{generalError}</Text>
            </View>
          )}

          {/* Name row */}
          <View className="flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="First name" error={fieldErrors.first_name}>
                <TextInput
                  style={inputStyle('first_name')}
                  placeholder="Jane"
                  placeholderTextColor="#9ca3af"
                  value={form.first_name}
                  onChangeText={(v) => set('first_name', v)}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Last name" error={fieldErrors.last_name}>
                <TextInput
                  ref={lastNameRef}
                  style={inputStyle('last_name')}
                  placeholder="Mwangi"
                  placeholderTextColor="#9ca3af"
                  value={form.last_name}
                  onChangeText={(v) => set('last_name', v)}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </Field>
            </View>
          </View>

          {/* Email */}
          <Field label="Email address" error={fieldErrors.email}>
            <TextInput
              ref={emailRef}
              style={inputStyle('email')}
              placeholder="jane@company.com"
              placeholderTextColor="#9ca3af"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => companyRef.current?.focus()}
            />
          </Field>

          {/* Company + Phone row */}
          <View className="flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Company" error={fieldErrors.company}>
                <TextInput
                  ref={companyRef}
                  style={inputStyle('company')}
                  placeholder="Acme Freight"
                  placeholderTextColor="#9ca3af"
                  value={form.company}
                  onChangeText={(v) => set('company', v)}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Phone" error={fieldErrors.phone}>
                <TextInput
                  ref={phoneRef}
                  style={inputStyle('phone')}
                  placeholder="+254 700 000 000"
                  placeholderTextColor="#9ca3af"
                  value={form.phone}
                  onChangeText={(v) => set('phone', v)}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </Field>
            </View>
          </View>

          {/* Role selector */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Account type</Text>
            <View className="flex-row" style={{ gap: 10 }}>
              {ROLES.map((opt) => {
                const selected = form.role === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => set('role', opt.value)}
                    style={{
                      flex: 1,
                      borderWidth: 2,
                      borderColor: selected ? '#0f2d5e' : '#e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: selected ? '#eff6ff' : '#f9fafb',
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: '700',
                      color: selected ? '#0f2d5e' : '#374151',
                      marginBottom: 2,
                    }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: selected ? '#3b82f6' : '#6b7280' }}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {fieldErrors.role ? (
              <Text className="text-red-500 text-xs mt-1">{fieldErrors.role}</Text>
            ) : null}
          </View>

          {/* Password row */}
          <View className="flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Password" error={fieldErrors.password}>
                <TextInput
                  ref={passwordRef}
                  style={inputStyle('password')}
                  placeholder="Min. 8 chars"
                  placeholderTextColor="#9ca3af"
                  value={form.password}
                  onChangeText={(v) => set('password', v)}
                  secureTextEntry
                  returnKeyType="next"
                  onSubmitEditing={() => password2Ref.current?.focus()}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Confirm" error={fieldErrors.password2}>
                <TextInput
                  ref={password2Ref}
                  style={inputStyle('password2')}
                  placeholder="Repeat"
                  placeholderTextColor="#9ca3af"
                  value={form.password2}
                  onChangeText={(v) => set('password2', v)}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </Field>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="bg-ct-navy rounded-xl py-4 items-center mt-2"
            style={{ opacity: loading ? 0.65 : 1 }}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Create account</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            className="mt-6 items-center"
          >
            <Text className="text-sm text-gray-500">
              Already have an account?{' '}
              <Text className="text-ct-navy font-semibold">Sign in</Text>
            </Text>
          </TouchableOpacity>

          <Text className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} CargoTrack Ltd · Enterprise Logistics Intelligence
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
