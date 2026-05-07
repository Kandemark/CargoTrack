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
      <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-card dark:bg-ct-dark-card">
        <View className="flex-row items-center justify-between px-5 py-ct-lg border-b border-ct-border-light dark:border-ct-dark-border">
          <View className="flex-row items-center">
            <Ionicons name="server-outline" size={20} color="#0f2d5e" style={{ marginRight: 8 }} />
            <Text className="text-ct-lg font-heading font-bold text-ct-text-primary dark:text-ct-dark-text">
              Server Settings
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text className="text-ct-base text-ct-text-muted dark:text-ct-dark-text-muted mb-ct-lg leading-5">
            The app auto-discovers the server on startup. Use this screen only if automatic discovery fails.
          </Text>

          <View className="flex-row bg-blue-50 dark:bg-blue-900/20 rounded-ct-md p-ct-md mb-5">
            <Ionicons name="bulb-outline" size={16} color="#0f2d5e" style={{ marginRight: 8, marginTop: 2 }} />
            <Text className="flex-1 text-ct-sm text-blue-900 dark:text-blue-200 leading-[19px]">
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-ct-md mb-ct-lg">
            {getSuggestedApiBaseUrls().slice(0, 10).map((url) => (
              <TouchableOpacity
                key={url}
                onPress={() => setBaseUrl(url)}
                activeOpacity={0.75}
                className={`mr-2 px-ct-md py-ct-sm rounded-full border ${
                  baseUrl === url
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-ct-navy dark:border-blue-400'
                    : 'bg-ct-surface-muted dark:bg-ct-dark-surface border-ct-border-light dark:border-ct-dark-border'
                }`}
              >
                <Text
                  className={`text-ct-sm font-bold ${
                    baseUrl === url
                      ? 'text-ct-navy dark:text-blue-300'
                      : 'text-ct-text-muted dark:text-ct-dark-text-muted'
                  }`}
                >
                  {url.replace('http://', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {status && (
            <View
              className={`flex-row items-center rounded-ct-md p-ct-md mb-ct-lg ${
                status.ok ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
              }`}
            >
              <Ionicons
                name={status.ok ? 'checkmark-circle' : 'information-circle'}
                size={16}
                color={status.ok ? '#166534' : '#0f2d5e'}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`flex-1 text-ct-sm leading-[18px] ${
                  status.ok ? 'text-green-800 dark:text-green-200' : 'text-blue-900 dark:text-blue-200'
                }`}
              >
                {status.text}
              </Text>
            </View>
          )}

          <View className="flex-row gap-2">
            <Button variant="outline" size="md" onPress={() => handleTest()} disabled={busy} className="flex-1">
              Test
            </Button>
            <Button variant="outline" size="md" onPress={() => handleReset()} disabled={busy} className="flex-1">
              Reset
            </Button>
            <Button variant="primary" size="md" onPress={() => handleSave()} loading={busy} className="flex-1">
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
    <View className="flex-1 bg-ct-navy">
      <Toast message={toastMessage} visible={toastVisible} type={toastType} onDismiss={() => setToastVisible(false)} />
      <ServerSettingsModal visible={serverModalVisible} onClose={() => setServerModalVisible(false)} />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero header */}
          <SafeAreaView edges={['top']} className="bg-ct-navy overflow-hidden">
            {/* Connection badge */}
            <TouchableOpacity
              onPress={() => setServerModalVisible(true)}
              activeOpacity={0.7}
              className="absolute top-6 right-5 flex-row items-center px-2.5 py-1.5 rounded-full bg-white/12 z-10"
            >
              <View
                className={`w-2 h-2 rounded-full ${
                  serverOnline === true ? 'bg-green-500' : serverOnline === false ? 'bg-amber-500' : 'bg-gray-400'
                }`}
              />
              <Ionicons name="settings-outline" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* Decorative rings */}
            <View pointerEvents="none" className="absolute w-[260px] h-[260px] rounded-full border-[32px] border-white/[0.06] -top-[100px] -right-20" />
            <View pointerEvents="none" className="absolute w-[160px] h-[160px] rounded-full border-[32px] border-white/[0.04] top-10 right-[50px]" />
            <View pointerEvents="none" className="absolute w-[120px] h-[120px] rounded-full border-[32px] border-white/[0.05] -bottom-[30px] -left-[30px]" />

            <View className="px-7 pt-5 pb-11">
              <View className="w-14 h-14 rounded-ct-xl bg-ct-orange items-center justify-center mb-[18px]"
                style={{
                  shadowColor: '#f5801e', shadowOpacity: 0.4,
                  shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 8,
                }}
              >
                <Ionicons name="cube" size={28} color="#fff" />
              </View>

              <Text className="text-2xl font-extrabold text-white tracking-tight mb-0.5">CargoTrack</Text>
              <Text className="text-ct-xs font-medium text-ct-text-brand">East Africa Logistics Intelligence</Text>

              <View className="w-9 h-[3px] rounded-sm bg-ct-orange mt-[22px] mb-ct-lg" />

              <Text className="text-ct-3xl font-extrabold text-white tracking-tight">Welcome back</Text>
              <Text className="text-ct-md text-ct-text-brand mt-1 leading-[22px]">Sign in to your account</Text>
            </View>
          </SafeAreaView>

          {/* Form card */}
          <Animated.View
            className="flex-1 bg-ct-surface-card dark:bg-ct-dark-card rounded-t-ct-2xl -mt-[22px] px-6 pt-8 pb-10"
            style={{ opacity: fadeAnim }}
          >
            {/* Server down banner */}
            {serverOnline === false && (
              <TouchableOpacity
                className="flex-row items-center bg-amber-50 dark:bg-amber-900/20 rounded-ct-md p-ct-md mb-5 border border-amber-200 dark:border-amber-800"
                onPress={() => setServerModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-offline-outline" size={16} color="#b45309" style={{ marginRight: 8 }} />
                <Text className="flex-1 text-ct-sm font-medium text-amber-800 dark:text-amber-200">Server not reachable. Tap to configure.</Text>
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
                  className="flex-row items-center justify-center py-[15px] rounded-ct-md border-[1.5px] border-ct-navy bg-blue-50 dark:bg-blue-900/20 mb-ct-lg"
                >
                  <Ionicons
                    name={bioBusy ? 'hourglass-outline' : 'finger-print-outline'}
                    size={22}
                    color="#0f2d5e"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-ct-md font-bold text-ct-navy dark:text-blue-300">
                    {bioBusy ? 'Verifying...' : `Sign in with ${bioLabel}`}
                  </Text>
                </TouchableOpacity>

                <View className="flex-row items-center mb-5">
                  <View className="flex-1 h-px bg-ct-border-light dark:bg-ct-dark-border" />
                  <Text className="mx-ct-md text-ct-sm font-medium text-ct-text-faint">or use password</Text>
                  <View className="flex-1 h-px bg-ct-border-light dark:bg-ct-dark-border" />
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
              className="mb-[18px]"
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
              className="mb-7"
            />

            <Button variant="primary" size="lg" loading={loading} onPress={handleLogin} className="w-full">
              Sign in
            </Button>

            <TouchableOpacity
              onPress={() => router.navigate('/(auth)/register')}
              className="mt-5 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-ct-base text-ct-text-muted dark:text-ct-dark-text-muted">
                Don't have an account?{' '}
                <Text className="text-ct-navy dark:text-ct-orange font-bold">Create one</Text>
              </Text>
            </TouchableOpacity>

            <Text className="mt-[22px] text-center text-ct-xs text-gray-300 dark:text-gray-600 leading-[17px]">
              {bioAvailable && !bioEnabled ? 'Sign in to enable biometric access.\n' : ''}
              {new Date().getFullYear()} CargoTrack Ltd
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
