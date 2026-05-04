/**
 * More tab — secondary navigation hub.
 * Houses Payments, Documents, and account management.
 */
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/lib/store'

// ── Section item ──────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  subtitle,
  accent = '#0f2d5e',
  onPress,
  badge,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  subtitle: string
  accent?: string
  onPress: () => void
  badge?: string
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Icon chip */}
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          backgroundColor: `${accent}18`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <Ionicons name={icon} size={22} color={accent} />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{label}</Text>
        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{subtitle}</Text>
      </View>

      {badge ? (
        <View
          style={{
            backgroundColor: '#f5801e',
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 2,
            marginRight: 8,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{badge}</Text>
        </View>
      ) : null}

      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
    </TouchableOpacity>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: '#9ca3af',
        letterSpacing: 0.8,
        marginHorizontal: 20,
        marginBottom: 8,
        marginTop: 20,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Text>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const { user, logout } = useAuthStore()

  async function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

        {/* Header */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>More</Text>

          {/* User chip */}
          {user && (
            <View
              style={{
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#f5801e',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  {(user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {user.first_name
                    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
                    : user.username}
                </Text>
                <Text style={{ color: '#93b4d8', fontSize: 12, marginTop: 1 }}>{user.email}</Text>
              </View>
              <View
                style={{
                  backgroundColor: 'rgba(245,128,30,0.2)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: '#f5801e', fontSize: 11, fontWeight: '700' }}>
                  {user.role ?? 'User'}
                </Text>
              </View>
            </View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          <SectionLabel label="Finance" />
          <MenuItem
            icon="receipt-outline"
            label="Payments"
            subtitle="Invoices, M-Pesa, Airtel Money"
            accent="#0f2d5e"
            onPress={() => router.push('/(tabs)/payments')}
          />
          <MenuItem
            icon="document-text-outline"
            label="Documents"
            subtitle="Bills of lading, customs, packing lists"
            accent="#0f2d5e"
            onPress={() => router.push('/(tabs)/documents')}
          />

          <SectionLabel label="Account" />
          <MenuItem
            icon="person-circle-outline"
            label="Profile"
            subtitle="Edit name, password, notifications"
            accent="#4f46e5"
            onPress={() => {
              // TODO: profile screen
              Alert.alert('Coming soon', 'Profile settings are coming in the next release.')
            }}
          />

          <SectionLabel label="Session" />
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              marginHorizontal: 16,
              borderRadius: 16,
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                backgroundColor: '#fee2e218',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ef4444' }}>Sign out</Text>
              <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>End your current session</Text>
            </View>
          </TouchableOpacity>

          <Text style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 24 }}>
            CargoTrack v1.0 · East Africa Logistics Intelligence
          </Text>

        </ScrollView>
      </View>
    </SafeAreaView>
  )
}
