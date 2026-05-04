import { Text, View } from 'react-native'

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-ct-surface-bg dark:bg-ct-dark-bg">
      <Text className="text-ct-lg font-heading font-bold text-ct-text-primary dark:text-ct-dark-text">
        Modal
      </Text>
    </View>
  )
}
