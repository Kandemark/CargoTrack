/**
 * @file mobile/app/(auth)/login.tsx
 * @description Mobile login screen — unauthenticated entry point.
 *
 * Submits credentials to `POST /api/auth/token/`, stores the returned
 * `access_token` and `refresh_token` in SecureStore via `useAuthStore.setTokens()`,
 * then fetches the user profile via `GET /api/v1/accounts/me/` and navigates
 * to `/(tabs)/` on success.
 *
 * Platform notes:
 *   - `KeyboardAvoidingView` uses `padding` behavior on iOS and `height` on Android
 *     to keep the form above the software keyboard.
 *   - `autoCapitalize="none"` on the email input prevents auto-capitalisation
 *     of the first character, which differs by platform.
 *
 * @route /(auth)/login
 * @auth Public (AllowAny)
 */
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
import { useAuthStore } from '@/lib/store'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const passwordRef = useRef<TextInput>(null)
  const { setTokens, setUser } = useAuthStore()

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const tokenRes = await authApi.login({ username: username.trim(), password })
      await setTokens(tokenRes.data.access, tokenRes.data.refresh)
      const meRes = await authApi.me()
      setUser(meRes.data)
      router.replace('/')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Incorrect email or password. Please try again.')
      } else if (axios.isAxiosError(err) && !err.response) {
        setError('Cannot reach the server. Check your network connection.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

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
        {/* Navy header band with logo — SafeAreaView handles status bar inset */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#0f2d5e' }}>
        <View className="bg-ct-navy px-6 pt-6 pb-12">
          <View className="flex-row items-center gap-3 mb-6">
            <View className="w-10 h-10 rounded-xl bg-ct-orange items-center justify-center">
              <Text className="text-white font-bold text-base">CT</Text>
            </View>
            <View>
              <Text className="text-white font-bold text-xl">CargoTrack</Text>
              <Text className="text-blue-300 text-xs">Logistics Intelligence</Text>
            </View>
          </View>
          <Text className="text-white text-2xl font-bold">Sign in</Text>
          <Text className="text-blue-300 text-sm mt-1">
            Northern Corridor · East Africa
          </Text>
        </View>
        </SafeAreaView>

        {/* Form card */}
        <View className="flex-1 bg-white rounded-t-3xl -mt-5 px-6 pt-8 pb-12">

          {/* Inline error */}
          {error && (
            <View className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <Text className="text-red-700 text-sm leading-5">{error}</Text>
            </View>
          )}

          {/* Email */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Email address</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
              placeholder="your@email.com"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={(v) => { setUsername(v); setError(null) }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          {/* Password */}
          <View className="mb-7">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Password</Text>
            <TextInput
              ref={passwordRef}
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null) }}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="bg-ct-navy rounded-xl py-4 items-center"
            style={{ opacity: loading ? 0.65 : 1 }}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Sign in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            className="mt-6 items-center"
          >
            <Text className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Text className="text-ct-navy font-semibold">Create one</Text>
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
