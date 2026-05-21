import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAppTheme } from '@/lib/useAppTheme'

interface Action {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  color: string
  route: string
}

const actions: Action[] = [
  { icon: 'navigate', label: 'Track Map', color: '#2563EB', route: '/(tabs)/track' },
  { icon: 'add-circle-outline', label: 'Log Event', color: '#16A34A', route: '/shipment/log-event' },
  { icon: 'cloud-upload-outline', label: 'Upload Document', color: '#7C3AED', route: '/(tabs)/documents' },
  { icon: 'scan-outline', label: 'Quick Scan', color: '#F59E0B', route: '/(tabs)/payments' },
]

interface FabActionsSheetProps {
  visible: boolean
  onClose: () => void
}

export default function FabActionsSheet({ visible, onClose }: FabActionsSheetProps) {
  const router = useRouter()
  const { colors, font } = useAppTheme()

  function handleAction(route: string) {
    onClose()
    setTimeout(() => router.push(route as any), 200)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={onClose}>
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 32,
        }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: colors.borderMid }} />
          </View>

          <Text style={{
            fontSize: font.size.lg,
            fontFamily: 'SpaceGrotesk',
            fontWeight: font.weight.bold,
            color: colors.text,
            marginBottom: 16,
            textAlign: 'center',
          }}>
            Quick Actions
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => handleAction(action.route)}
                activeOpacity={0.7}
                style={{ alignItems: 'center', width: 80 }}
              >
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                  backgroundColor: `${action.color}15`,
                }}>
                  <Ionicons name={action.icon} size={26} color={action.color} />
                </View>
                <Text style={{
                  fontSize: font.size.xs,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  fontWeight: font.weight.bold,
                }}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 20,
              backgroundColor: colors.muted,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: font.size.md,
              fontFamily: 'SpaceGrotesk',
              fontWeight: font.weight.bold,
              color: colors.textMuted,
            }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  )
}
