import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

interface Action {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  color: string
  route: string
}

const actions: Action[] = [
  {
    icon: 'navigate',
    label: 'Track Map',
    color: '#2563EB',
    route: '/(tabs)/track',
  },
  {
    icon: 'add-circle-outline',
    label: 'Log Event',
    color: '#16A34A',
    route: '/shipment/log-event',
  },
  {
    icon: 'cloud-upload-outline',
    label: 'Upload Document',
    color: '#7C3AED',
    route: '/(tabs)/documents',
  },
  {
    icon: 'scan-outline',
    label: 'Quick Scan',
    color: '#F59E0B',
    route: '/(tabs)/payments',
  },
]

interface FabActionsSheetProps {
  visible: boolean
  onClose: () => void
}

export default function FabActionsSheet({ visible, onClose }: FabActionsSheetProps) {
  const router = useRouter()

  function handleAction(route: string) {
    onClose()
    setTimeout(() => router.push(route as any), 200)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <View className="bg-ct-surface-card dark:bg-ct-dark-card rounded-t-ct-2xl px-ct-lg pt-ct-xl pb-ct-3xl">
          {/* Handle */}
          <View className="items-center mb-ct-lg">
            <View className="w-10 h-1 rounded-full bg-ct-border-mid dark:bg-ct-dark-border" />
          </View>

          <Text className="text-ct-lg font-heading font-bold text-ct-text-primary dark:text-ct-dark-text mb-ct-lg text-center">
            Quick Actions
          </Text>

          <View className="flex-row flex-wrap justify-center gap-ct-lg">
            {actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => handleAction(action.route)}
                activeOpacity={0.7}
                className="items-center w-20"
              >
                <View
                  className="w-14 h-14 rounded-ct-xl items-center justify-center mb-ct-sm"
                  style={{ backgroundColor: `${action.color}15` }}
                >
                  <Ionicons name={action.icon} size={26} color={action.color} />
                </View>
                <Text className="text-ct-xs text-ct-text-secondary dark:text-ct-dark-text-muted text-center font-bold">
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="mt-ct-xl bg-ct-surface-muted dark:bg-ct-dark-surface rounded-ct-lg py-ct-md items-center"
          >
            <Text className="text-ct-md font-heading font-bold text-ct-text-muted dark:text-ct-dark-text-muted">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  )
}
