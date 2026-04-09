import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const { setTokens, setUser } = useAuthStore()

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Validation', 'Username and password are required.')
      return
    }
    setLoading(true)
    try {
      const tokenRes = await authApi.login({ username: username.trim(), password })
      await setTokens(tokenRes.data.access, tokenRes.data.refresh)

      const meRes = await authApi.me()
      setUser(meRes.data)

      router.replace('/(tabs)/')
    } catch {
      Alert.alert('Sign In Failed', 'Invalid credentials. Please check your username and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header band */}
        <View className="bg-ct-navy px-6 pt-16 pb-10">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-10 h-10 rounded-xl bg-ct-orange items-center justify-center">
              <Text className="text-white font-bold text-base">CT</Text>
            </View>
            <View>
              <Text className="text-white font-bold text-xl">CargoTrack</Text>
              <Text className="text-blue-300 text-xs">Logistics Intelligence</Text>
            </View>
          </View>
          <Text className="text-white text-2xl font-bold mt-2">Sign in</Text>
          <Text className="text-blue-200 text-sm mt-1">Northern Corridor — East Africa</Text>
        </View>

        {/* Form */}
        <View className="flex-1 bg-white rounded-t-3xl -mt-4 px-6 pt-8 pb-10">
          <View className="mb-5">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Username</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
              placeholder="your.username"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View className="mb-7">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Password</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="bg-ct-navy rounded-xl py-4 items-center active:opacity-80"
            style={{ opacity: loading ? 0.65 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Sign in</Text>
            )}
          </TouchableOpacity>

          <Text className="text-center text-xs text-gray-400 mt-8">
            © {new Date().getFullYear()} CargoTrack Ltd · Enterprise Logistics Intelligence
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
