import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Alert,
  Modal,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import axios from 'axios'
import {
  authApi,
  apiClient,
  checkApiConnection,
  getCurrentApiBaseUrl,
  resetApiBaseUrl,
  updateApiBaseUrl,
} from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { registerPushToken } from '@/lib/notifications'
import { getSuggestedApiBaseUrls } from '@/lib/runtime-config'
import {
  checkBiometricCapabilities,
  authenticateWithBiometrics,
  isBiometricEnabled,
  getBiometricCredentials,
  enrollBiometricCredentials,
} from '@/lib/biometrics'
import { Button, Input, Toast } from '@/components/ui'
import { useAppTheme } from '@/lib/useAppTheme'

// ── Server settings modal ────────────────────────────────────────────────────────
function ServerSettingsModal({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const [baseUrl, setBaseUrl] = useState(getCurrentApiBaseUrl())
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const { colors, font, spacing, radius, isDark } = useAppTheme()

  useEffect(() => {
    if (visible) {
      setBaseUrl(getCurrentApiBaseUrl())
      setStatus(null)
    }
  }, [visible])

  async function handleTest(target?: string) {
    const candidate = target ?? baseUrl
    if (!candidate.trim()) {
      setStatus({ text: 'Enter a server address.', ok: false })
      return
    }
    setBusy(true)
    try {
      const result = await checkApiConnection(candidate)
      if (result.authOk) {
        setStatus({ text: 'Connected to CargoTrack API — server is reachable.', ok: true })
      } else if (result.healthOk) {
        setStatus({ text: 'Server reached but sign-in is not available.', ok: false })
      } else {
        setStatus({ text: 'CargoTrack API not found on this server.', ok: false })
      }
    } catch {
      setStatus({ text: 'Cannot reach this address. Check that the server is running.', ok: false })
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    setBusy(true)
    try {
      const saved = await updateApiBaseUrl(baseUrl)
      const result = await checkApiConnection(saved)
      setStatus(result.authOk
        ? { text: 'Saved and connected.', ok: true }
        : { text: 'Saved but could not verify the API.', ok: false })
    } catch {
      setStatus({ text: 'Saved but health check failed.', ok: false })
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setBusy(true)
    try {
      const fallback = await resetApiBaseUrl()
      setBaseUrl(fallback)
      setStatus({ text: 'Reset — server will be auto-discovered on next launch.', ok: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.card }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="server-outline" size={20} color="#0f2d5e" style={{ marginRight: 8 }} />
            <Text style={{
              fontSize: font.size.lg,
              fontFamily: font.family.heading,
              fontWeight: font.weight.bold,
              color: colors.text,
            }}>
              Server Settings
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={{
            fontSize: font.size.base,
            color: colors.textMuted,
            marginBottom: spacing.lg,
            lineHeight: 20,
          }}>
            The app auto-discovers the server on startup. Use this screen only if automatic discovery fails.
          </Text>

          <View style={{
            flexDirection: 'row',
            backgroundColor: isDark ? 'rgba(30,58,138,0.2)' : '#eff6ff',
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: 20,
          }}>
            <Ionicons name="bulb-outline" size={16} color="#0f2d5e" style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={{
              flex: 1,
              fontSize: font.size.sm,
              color: isDark ? '#bfdbfe' : '#1e3a8a',
              lineHeight: 19,
            }}>
              Make sure Docker is running (.\scripts\dev.ps1 up) and your device is on the same WiFi network.
            </Text>
          </View>

          <Input
            label="Server address"
            icon="globe-outline"
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.25:8000"
          />

          {/* URL suggestions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
          >
            {getSuggestedApiBaseUrls().slice(0, 10).map((url) => (
              <TouchableOpacity
                key={url}
                onPress={() => setBaseUrl(url)}
                activeOpacity={0.75}
                style={{
                  marginRight: 8,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 9999,
                  borderWidth: StyleSheet.hairlineWidth,
                  backgroundColor: baseUrl === url
                    ? (isDark ? 'rgba(30,58,138,0.3)' : '#eff6ff')
                    : colors.muted,
                  borderColor: baseUrl === url
                    ? (isDark ? '#60a5fa' : '#0f2d5e')
                    : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: font.size.sm,
                    fontWeight: font.weight.bold,
                    color: baseUrl === url
                      ? (isDark ? '#93c5fd' : '#0f2d5e')
                      : colors.textMuted,
                  }}
                >
                  {url.replace('http://', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {status && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.lg,
                backgroundColor: status.ok
                  ? (isDark ? 'rgba(20,83,45,0.2)' : '#f0fdf4')
                  : (isDark ? 'rgba(30,58,138,0.2)' : '#eff6ff'),
              }}
            >
              <Ionicons
                name={status.ok ? 'checkmark-circle' : 'information-circle'}
                size={16}
                color={status.ok ? '#166534' : '#0f2d5e'}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: font.size.sm,
                  lineHeight: 18,
                  color: status.ok
                    ? (isDark ? '#bbf7d0' : '#166534')
                    : (isDark ? '#bfdbfe' : '#1e3a8a'),
                }}
              >
                {status.text}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="outline" size="md" onPress={() => handleTest()} disabled={busy} style={{ flex: 1 }}>
              Test
            </Button>
            <Button variant="outline" size="md" onPress={() => handleReset()} disabled={busy} style={{ flex: 1 }}>
              Reset
            </Button>
            <Button variant="primary" size="md" onPress={() => handleSave()} loading={busy} style={{ flex: 1 }}>
              Save
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── Login Screen ─────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'error' | 'success' | 'info' | 'warning'>('error')
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [serverAddress, setServerAddress] = useState('')
  const [serverModalVisible, setServerModalVisible] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [bioLabel, setBioLabel] = useState('Biometrics')
  const [bioBusy, setBioBusy] = useState(false)

  const fadeAnim = useRef(new Animated.Value(0)).current
  const { setTokens, setUser, setBiometricEnabled } = useAuthStore()
  const { colors, font, spacing, radius, isDark } = useAppTheme()

  const showError = useCallback((msg: string) => {
    setToastMessage(msg)
    setToastType('error')
    setToastVisible(true)
  }, [])

  const showInfo = useCallback((msg: string) => {
    setToastMessage(msg)
    setToastType('info')
    setToastVisible(true)
  }, [])

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start()

    void (async () => {
      const url = getCurrentApiBaseUrl()
      setServerAddress(url)
      try {
        const res = await fetch(`${url}/api/health/`, { method: 'GET' })
        setServerOnline(res.ok)
      } catch {
        setServerOnline(false)
      }

      const cap = await checkBiometricCapabilities()
      if (cap.isAvailable && cap.isEnrolled) {
        setBioAvailable(true)
        setBioLabel(cap.label)
        const enabled = await isBiometricEnabled()
        setBioEnabled(enabled)
      }
    })()
  }, [fadeAnim])

  const performLogin = useCallback(async (user: string, pass: string) => {
    const tokenRes = await authApi.login({ username: user.trim(), password: pass })
    await setTokens(tokenRes.data.access, tokenRes.data.refresh)
    const meRes = await authApi.me()
    setUser(meRes.data)
    void registerPushToken(apiClient)
    router.replace('/')
  }, [setTokens, setUser])

  function handleLoginError(err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      showError('Incorrect username or password.')
    } else if (axios.isAxiosError(err) && !err.response) {
      showError('Cannot reach the server. Tap the gear icon to check server settings.')
      setServerOnline(false)
    } else if (axios.isAxiosError(err) && err.response?.status === 404) {
      showError('Server reached but sign-in is unavailable. Is Django running?')
    } else if (axios.isAxiosError(err) && err.response?.status && err.response?.status >= 500) {
      showError('Server error. Please try again later.')
    } else {
      showError('Something went wrong. Please try again.')
    }
  }

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      showError('Please enter your username and password.')
      return
    }
    setLoading(true)
    try {
      await performLogin(username.trim(), password)
      promptBiometricEnrollment(username.trim(), password)
    } catch (err) {
      handleLoginError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleBiometricLogin() {
    setBioBusy(true)
    const authResult = await authenticateWithBiometrics('CargoTrack')
    if (!authResult.success) {
      setBioBusy(false)
      if (authResult.error !== 'cancelled') showError(authResult.error ?? 'Biometric authentication failed.')
      return
    }
    const creds = await getBiometricCredentials()
    if (!creds) {
      setBioBusy(false)
      showError('Biometric sign-in not set up. Sign in with your password first.')
      const { disableBiometrics } = await import('@/lib/biometrics')
      await disableBiometrics()
      setBioEnabled(false)
      setBiometricEnabled(false)
      return
    }
    setUsername(creds.username)
    try {
      await performLogin(creds.username, creds.password)
    } catch (err) {
      setBioBusy(false)
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        showError('Saved credentials are no longer valid. Please sign in with your password.')
        const { disableBiometrics } = await import('@/lib/biometrics')
        await disableBiometrics()
        setBioEnabled(false)
        setBiometricEnabled(false)
        return
      }
      handleLoginError(err)
    }
  }

  async function promptBiometricEnrollment(user: string, pass: string) {
    if (!bioAvailable || bioEnabled) return
    setTimeout(() => {
      Alert.alert(
        `Sign in with ${bioLabel}`,
        `Enable ${bioLabel} for faster sign-in? Your credentials stay encrypted on this device.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              await enrollBiometricCredentials(user, pass)
              setBioEnabled(true)
              setBiometricEnabled(true)
            },
          },
        ],
        { cancelable: true },
      )
    }, 800)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <Toast message={toastMessage} visible={toastVisible} type={toastType} onDismiss={() => setToastVisible(false)} />
      <ServerSettingsModal visible={serverModalVisible} onClose={() => setServerModalVisible(false)} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero header */}
          <SafeAreaView edges={['top']} style={{ backgroundColor: '#0f2d5e', overflow: 'hidden' }}>
            {/* Connection badge */}
            <TouchableOpacity
              onPress={() => setServerModalVisible(true)}
              activeOpacity={0.7}
              style={{
                position: 'absolute',
                top: 24,
                right: 20,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 9999,
                backgroundColor: 'rgba(255,255,255,0.12)',
                zIndex: 10,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  backgroundColor: serverOnline === true
                    ? '#22c55e'
                    : serverOnline === false
                      ? '#f59e0b'
                      : '#9ca3af',
                }}
              />
              <Ionicons name="settings-outline" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* Decorative rings */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 260,
                height: 260,
                borderRadius: 9999,
                borderWidth: 32,
                borderColor: 'rgba(255,255,255,0.06)',
                top: -100,
                right: -80,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 160,
                height: 160,
                borderRadius: 9999,
                borderWidth: 32,
                borderColor: 'rgba(255,255,255,0.04)',
                top: 40,
                right: 50,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 120,
                height: 120,
                borderRadius: 9999,
                borderWidth: 32,
                borderColor: 'rgba(255,255,255,0.05)',
                bottom: -30,
                left: -30,
              }}
            />

            <View style={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 44 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.xl,
                  backgroundColor: '#f5801e',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 18,
                  shadowColor: '#f5801e',
                  shadowOpacity: 0.4,
                  shadowOffset: { width: 0, height: 6 },
                  shadowRadius: 14,
                  elevation: 8,
                }}
              >
                <Ionicons name="cube" size={28} color="#fff" />
              </View>

              <Text style={{ fontSize: 24, fontWeight: font.weight.extrabold, color: '#ffffff', letterSpacing: -0.25, marginBottom: 2 }}>
                CargoTrack
              </Text>
              <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.medium, color: colors.textBrand }}>
                East Africa Logistics Intelligence
              </Text>

              <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: '#f5801e', marginTop: 22, marginBottom: spacing.lg }} />

              <Text style={{ fontSize: font.size['3xl'], fontWeight: font.weight.extrabold, color: '#ffffff', letterSpacing: -0.25 }}>
                Welcome back
              </Text>
              <Text style={{ fontSize: font.size.md, color: colors.textBrand, marginTop: 4, lineHeight: 22 }}>
                Sign in to your account
              </Text>
            </View>
          </SafeAreaView>

          {/* Form card */}
          <Animated.View
            style={[
              {
                flex: 1,
                backgroundColor: colors.card,
                borderTopLeftRadius: radius['2xl'],
                borderTopRightRadius: radius['2xl'],
                marginTop: -22,
                paddingHorizontal: 24,
                paddingTop: 32,
                paddingBottom: 40,
              },
              { opacity: fadeAnim },
            ]}
          >
            {/* Server down banner */}
            {serverOnline === false && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(120,53,15,0.2)' : '#fffbeb',
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: 20,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isDark ? '#92400e' : '#fde68a',
                }}
                onPress={() => setServerModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-offline-outline" size={16} color="#b45309" style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: font.size.sm, fontWeight: font.weight.medium, color: isDark ? '#fde68a' : '#92400e' }}>
                  Server not reachable. Tap to configure.
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#b45309" />
              </TouchableOpacity>
            )}

            {/* Biometric button */}
            {bioAvailable && bioEnabled && (
              <>
                <TouchableOpacity
                  onPress={handleBiometricLogin}
                  disabled={bioBusy}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 15,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: '#0f2d5e',
                    backgroundColor: isDark ? 'rgba(30,58,138,0.2)' : '#eff6ff',
                    marginBottom: spacing.lg,
                  }}
                >
                  <Ionicons
                    name={bioBusy ? 'hourglass-outline' : 'finger-print-outline'}
                    size={22}
                    color="#0f2d5e"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ fontSize: font.size.md, fontWeight: font.weight.bold, color: isDark ? '#93c5fd' : '#0f2d5e' }}>
                    {bioBusy ? 'Verifying...' : `Sign in with ${bioLabel}`}
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
                  <Text style={{ marginHorizontal: spacing.md, fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textFaint }}>
                    or use password
                  </Text>
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
                </View>
              </>
            )}

            <Input
              label="Username"
              icon="person-outline"
              placeholder="Enter your username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              containerStyle={{ marginBottom: 18 }}
            />

            <Input
              label="Password"
              icon="lock-closed-outline"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              containerStyle={{ marginBottom: 28 }}
            />

            <Button variant="primary" size="lg" loading={loading} onPress={handleLogin} style={{ width: '100%' }}>
              Sign in
            </Button>

            <TouchableOpacity
              onPress={() => router.navigate('/(auth)/register')}
              style={{ marginTop: 20, alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: font.size.base, color: colors.textMuted }}>
                Don't have an account?{' '}
                <Text style={{ color: isDark ? '#f5801e' : '#0f2d5e', fontWeight: font.weight.bold }}>Create one</Text>
              </Text>
            </TouchableOpacity>

            <Text style={{ marginTop: 22, textAlign: 'center', fontSize: font.size.xs, color: isDark ? '#4b5563' : '#d1d5db', lineHeight: 17 }}>
              {bioAvailable && !bioEnabled ? 'Sign in to enable biometric access.\n' : ''}
              {new Date().getFullYear()} CargoTrack Ltd
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
