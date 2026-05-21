import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { checkApiHealth, getCurrentApiBaseUrl, resetApiBaseUrl, updateApiBaseUrl } from '@/lib/api'
import { getSuggestedApiBaseUrls } from '@/lib/runtime-config'
import { Card, Button } from '@/components/ui'
import { useAppTheme } from '@/lib/useAppTheme'

export default function ConnectionCenter() {
  const [value, setValue] = useState(getCurrentApiBaseUrl())
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { colors, font, isDark } = useAppTheme()

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
      <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>
        Connection center
      </Text>
      <Text style={{ fontSize: font.size.xs, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
        Use the API address your phone can actually reach. Physical devices usually need your computer's LAN IP, not `localhost`.
      </Text>

      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: isDark ? '#1e3a5f' : '#dbeafe',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.muted,
        marginTop: 12,
      }}>
        <Ionicons name="server-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, fontSize: font.size.sm, color: colors.text }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        {getSuggestedApiBaseUrls().map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => setValue(item)}
            style={{
              marginRight: 8,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 9999,
              backgroundColor: isDark ? '#334155' : '#E5E7EB',
            }}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#cbd5e1' : '#374151' }}>
              {item.replace('http://', '')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {status ? (
        <View style={{
          marginTop: 10,
          backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF',
          borderRadius: 12,
          padding: 10,
        }}>
          <Text style={{ fontSize: font.size.xs, color: isDark ? '#bfdbfe' : '#1e3a8a', lineHeight: 17 }}>
            {status}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => void testCurrent()}
          style={{
            flex: 1,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: isDark ? '#475569' : '#d1d5db',
            borderRadius: 12,
            alignItems: 'center',
            paddingVertical: 12,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#cbd5e1' : '#374151' }}>Test</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void reset()}
          style={{
            flex: 1,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: isDark ? '#475569' : '#d1d5db',
            borderRadius: 12,
            alignItems: 'center',
            paddingVertical: 12,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#cbd5e1' : '#374151' }}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void save()}
          style={{
            flex: 1,
            backgroundColor: isDark ? '#f5801e' : '#0f2d5e',
            borderRadius: 12,
            alignItems: 'center',
            paddingVertical: 12,
          }}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, color: '#fff' }}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  )
}
