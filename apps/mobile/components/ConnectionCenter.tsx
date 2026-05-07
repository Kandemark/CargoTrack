import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { checkApiHealth, getCurrentApiBaseUrl, resetApiBaseUrl, updateApiBaseUrl } from '@/lib/api'
import { getSuggestedApiBaseUrls } from '@/lib/runtime-config'
import { Card, Button } from '@/components/ui'

export default function ConnectionCenter() {
  const [value, setValue] = useState(getCurrentApiBaseUrl())
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function testCurrent() {
    setSaving(true)
    try {
      await checkApiHealth(value)
      setStatus(`Connected to ${value}.`)
    } catch {
      setStatus(`Could not reach ${value}. If this is a phone, use your computer's LAN IP and make sure Django is running.`)
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const next = await updateApiBaseUrl(value)
      setValue(next)
      await checkApiHealth(next)
      setStatus(`Saved and verified ${next}.`)
    } catch {
      setStatus('Saved the address, but the API did not answer. Check your network and Django server.')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    setSaving(true)
    try {
      const next = await resetApiBaseUrl()
      setValue(next)
      setStatus(`Reset to ${next}.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-ct-dark-text">Connection center</Text>
      <Text className="text-ct-xs text-ct-text-secondary dark:text-ct-dark-text-muted mt-1 leading-[18px]">
        Use the API address your phone can actually reach. Physical devices usually need your computer's LAN IP, not `localhost`.
      </Text>

      <View className="flex-row items-center border-[1.5px] border-blue-100 dark:border-blue-900 rounded-ct-md px-3 py-2.5 bg-slate-50 dark:bg-ct-dark-surface mt-3">
        <Ionicons name="server-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 text-ct-sm text-ct-text-primary dark:text-ct-dark-text"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2.5">
        {getSuggestedApiBaseUrls().map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => setValue(item)}
            className="mr-2 px-2.5 py-[7px] rounded-full bg-slate-200 dark:bg-slate-700"
            activeOpacity={0.75}
          >
            <Text className="text-ct-xs font-bold text-slate-700 dark:text-slate-300">{item.replace('http://', '')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {status ? (
        <View className="mt-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-ct-md p-2.5">
          <Text className="text-ct-xs text-blue-900 dark:text-blue-200 leading-[17px]">{status}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          onPress={() => void testCurrent()}
          className="flex-1 bg-white dark:bg-ct-dark-card border border-slate-300 dark:border-slate-600 rounded-ct-md items-center py-3"
          activeOpacity={0.8}
        >
          <Text className="text-ct-xs font-bold text-slate-700 dark:text-slate-300">Test</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void reset()}
          className="flex-1 bg-white dark:bg-ct-dark-card border border-slate-300 dark:border-slate-600 rounded-ct-md items-center py-3"
          activeOpacity={0.8}
        >
          <Text className="text-ct-xs font-bold text-slate-700 dark:text-slate-300">Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void save()}
          className="flex-1 bg-ct-navy dark:bg-ct-orange rounded-ct-md items-center py-3"
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-ct-xs font-extrabold text-white">Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  )
}
