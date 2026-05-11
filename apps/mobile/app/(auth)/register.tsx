import { useRef, useState } from 'react'
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import axios from 'axios'
import { authApi } from '@/lib/api'
import { Button, Input } from '@/components/ui'
import { useAppTheme } from '@/lib/useAppTheme'
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
  const { colors, font, spacing, radius, isDark } = useAppTheme()

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0f2d5e' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#0f2d5e', overflow: 'hidden' }}>
          {/* Decorative rings */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 240,
              height: 240,
              borderRadius: 9999,
              borderWidth: 44,
              borderColor: 'rgba(255,255,255,0.07)',
              top: -90,
              right: -70,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 150,
              height: 150,
              borderRadius: 9999,
              borderWidth: 28,
              borderColor: 'rgba(255,255,255,0.05)',
              top: 20,
              right: 20,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 110,
              height: 110,
              borderRadius: 9999,
              borderWidth: 22,
              borderColor: 'rgba(255,255,255,0.06)',
              bottom: -30,
              left: -30,
            }}
          />

          <View style={{ paddingHorizontal: 28, paddingTop: spacing.lg, paddingBottom: 36 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: '#f5801e',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
                shadowColor: '#f5801e',
                shadowOpacity: 0.4,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Ionicons name="cube" size={26} color="#fff" />
            </View>
            <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: '#ffffff', letterSpacing: -0.25 }}>
              CargoTrack
            </Text>
            <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textBrand, marginTop: 2 }}>
              East Africa Logistics Intelligence
            </Text>
            <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: '#f5801e', marginTop: 20, marginBottom: spacing.lg }} />
            <Text style={{ fontSize: font.size['3xl'], fontWeight: font.weight.extrabold, color: '#ffffff', letterSpacing: -0.25 }}>
              Create account
            </Text>
            <Text style={{ fontSize: font.size.base, color: colors.textBrand, marginTop: 4, lineHeight: 20 }}>
              Join the Northern Corridor network
            </Text>
          </View>
        </SafeAreaView>

        {/* Form card */}
        <View style={{
          flex: 1,
          backgroundColor: colors.card,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          marginTop: -22,
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 48,
        }}>
          {generalError && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(127,29,29,0.2)' : '#fef2f2',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDark ? '#991b1b' : '#fecaca',
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: 20,
            }}>
              <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: font.size.sm, color: isDark ? '#fecaca' : '#b91c1c', lineHeight: 18 }}>
                {generalError}
              </Text>
            </View>
          )}

          {/* Name row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="First name" icon="person-outline" placeholder="Jane"
                value={form.first_name} error={fieldErrors.first_name}
                onChangeText={(v) => set('first_name', v)} autoCapitalize="words" returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
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
            autoCapitalize="none" autoCorrect={false}
            containerStyle={{ marginBottom: 18 }}
          />

          {/* Org + Phone row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Organization" icon="briefcase-outline" placeholder="Acme Freight"
                value={form.org_name ?? ''} error={fieldErrors.org_name}
                onChangeText={(v) => set('org_name', v)} autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Phone" icon="call-outline" placeholder="+254 700 000 000"
                value={form.phone} error={fieldErrors.phone}
                onChangeText={(v) => set('phone', v)} keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Role selector */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{
              fontSize: font.size.sm,
              fontFamily: font.family.heading,
              fontWeight: font.weight.bold,
              color: colors.textSecondary,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}>
              Account type
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ROLES.map((opt) => {
                const selected = form.role === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value} onPress={() => set('role', opt.value)} activeOpacity={0.75}
                    style={{
                      width: '31%',
                      alignItems: 'center',
                      borderRadius: radius.md,
                      padding: 10,
                      borderWidth: 1.5,
                      borderColor: selected
                        ? '#0f2d5e'
                        : colors.border,
                      backgroundColor: selected
                        ? (isDark ? 'rgba(30,58,138,0.2)' : '#eff6ff')
                        : colors.muted,
                    }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={18}
                      color={selected ? '#0f2d5e' : '#9ca3af'}
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={{
                      fontSize: font.size.xs,
                      fontWeight: font.weight.bold,
                      textAlign: 'center',
                      color: selected
                        ? (isDark ? '#93c5fd' : '#0f2d5e')
                        : colors.textSecondary,
                    }}>
                      {opt.label}
                    </Text>
                    <Text style={{
                      fontSize: 10,
                      textAlign: 'center',
                      marginTop: 2,
                      lineHeight: 13,
                      color: selected
                        ? (isDark ? '#60a5fa' : '#3b82f6')
                        : colors.textFaint,
                    }}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {fieldErrors.role && (
              <Text style={{ fontSize: font.size.xs, color: '#EF4444', marginTop: 6 }}>
                {fieldErrors.role}
              </Text>
            )}
          </View>

          <Input
            label="Password" icon="lock-closed-outline" placeholder="Min. 10 characters, 1 upper, 1 digit, 1 symbol"
            value={form.password} error={fieldErrors.password}
            onChangeText={(v) => set('password', v)} secureTextEntry
            containerStyle={{ marginBottom: 18 }}
          />

          <Input
            label="Confirm password" icon="lock-closed-outline" placeholder="Repeat password"
            value={form.password2} error={fieldErrors.password2}
            onChangeText={(v) => set('password2', v)} secureTextEntry
            returnKeyType="done" onSubmitEditing={handleSubmit}
            containerStyle={{ marginBottom: 28 }}
          />

          <Button variant="primary" size="lg" loading={loading} onPress={handleSubmit} style={{ width: '100%' }}>
            Create account
          </Button>

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: 20, alignItems: 'center' }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: font.size.base, color: colors.textMuted }}>
              Already have an account?{' '}
              <Text style={{ color: isDark ? '#f5801e' : '#0f2d5e', fontWeight: font.weight.bold }}>Sign in</Text>
            </Text>
          </TouchableOpacity>

          <Text style={{ marginTop: 24, textAlign: 'center', fontSize: font.size.xs, color: isDark ? '#4b5563' : '#d1d5db' }}>
            {new Date().getFullYear()} CargoTrack Ltd
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
