import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TextInput, Alert, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import { useThemeStore, type ThemeMode } from '@/lib/themeStore'
import ScreenHeader from '@/components/ScreenHeader'
import AnimatedPressable from '@/components/animated/AnimatedPressable'
import ScreenWrapper from '@/components/animated/ScreenWrapper'
import ConnectionCenter from '@/components/ConnectionCenter'

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { mode: 'light',  label: 'Light',  icon: 'sunny-outline' },
  { mode: 'dark',   label: 'Dark',   icon: 'moon-outline' },
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
]

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const { colors, font, brand, spacing, isDark } = useAppTheme()
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name)
      setLastName(user.last_name)
      setPhone(user.phone)
    }
  }, [user])

  async function handleSaveProfile() {
    if (!user) return
    setSaving(true)
    try {
      const res = await apiClient.patch<typeof user>('/api/v1/accounts/me/', { first_name: firstName, last_name: lastName, phone })
      setUser({ ...user, ...res.data })
      Alert.alert('Saved', 'Profile updated successfully.')
    } catch { Alert.alert('Error', 'Failed to update profile.') }
    finally { setSaving(false) }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) return Alert.alert('Error', 'Please fill in both password fields.')
    setSaving(true)
    try {
      await apiClient.post('/api/v1/accounts/change-password/', { current_password: currentPassword, new_password: newPassword })
      Alert.alert('Done', 'Password changed successfully.')
      setCurrentPassword(''); setNewPassword('')
    } catch { Alert.alert('Error', 'Failed to change password.') }
    finally { setSaving(false) }
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout() } },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Settings" backButton />
      <ScreenWrapper entrance="fade">
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {/* Profile Section */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Profile</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.field}>
            <Text style={[s.label, { color: colors.textFaint }]}>First Name</Text>
            <TextInput style={[s.input, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]} value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.textFaint} />
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: colors.textFaint }]}>Last Name</Text>
            <TextInput style={[s.input, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]} value={lastName} onChangeText={setLastName} placeholderTextColor={colors.textFaint} />
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: colors.textFaint }]}>Phone</Text>
            <TextInput style={[s.input, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]} value={phone} onChangeText={setPhone} placeholderTextColor={colors.textFaint} />
          </View>
          <AnimatedPressable onPress={handleSaveProfile} disabled={saving} scaleTo={0.97} style={[s.btn, { backgroundColor: brand.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{saving ? 'Saving...' : 'Save Profile'}</Text>
          </AnimatedPressable>
        </View>

        {/* Password */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Change Password</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.field}>
            <Text style={[s.label, { color: colors.textFaint }]}>Current Password</Text>
            <TextInput style={[s.input, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholderTextColor={colors.textFaint} />
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: colors.textFaint }]}>New Password</Text>
            <TextInput style={[s.input, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholderTextColor={colors.textFaint} />
          </View>
          <AnimatedPressable onPress={handleChangePassword} disabled={saving} scaleTo={0.97} style={[s.btn, { backgroundColor: '#eab308' }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Change Password</Text>
          </AnimatedPressable>
        </View>

        {/* Account Info */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Account</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            ['Email', user?.email ?? '—'],
            ['Role', user?.role_display ?? user?.role ?? '—'],
            ['Organization', user?.org_name ?? '—'],
            ['Member since', user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : '—'],
          ].map(([label, val]) => (
            <View key={label}>
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{val}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>

        {/* Theme */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Appearance</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode
              return (
                <AnimatedPressable
                  key={opt.mode}
                  onPress={() => setThemeMode(opt.mode)}
                  scaleTo={0.96}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    borderRadius: 12,
                    paddingVertical: 12,
                    borderWidth: 1.5,
                    borderColor: active ? brand.accent : colors.border,
                    backgroundColor: active
                      ? (isDark ? 'rgba(245,128,30,0.15)' : 'rgba(245,128,30,0.08)')
                      : 'transparent',
                  }}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={active ? brand.accent : colors.textMuted}
                    style={{ marginBottom: 4 }}
                  />
                  <Text style={{
                    fontSize: 11,
                    fontWeight: active ? '700' : '600',
                    color: active ? brand.accent : colors.textMuted,
                  }}>
                    {opt.label}
                  </Text>
                </AnimatedPressable>
              )
            })}
          </View>
        </View>

        {/* Server connection */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Server Connection</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ConnectionCenter />
        </View>

        {/* App info */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>About</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            ['Version', Constants.expoConfig?.version ?? '0.0.1'],
            ['Build', Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString() ?? '1'],
            ['SDK', Constants.expoConfig?.sdkVersion ?? '—'],
          ].map(([label, val]) => (
            <View key={label}>
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{val}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>

        {/* Sign Out */}
        <AnimatedPressable onPress={handleLogout} scaleTo={0.96} style={[s.btn, { backgroundColor: '#ef4444', marginTop: 20 }]}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 8 }}>Sign Out</Text>
        </AnimatedPressable>
        </ScrollView>
      </ScreenWrapper>
    </View>
  )
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10, marginTop: 8 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 8 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  divider: { height: 1 },
})
