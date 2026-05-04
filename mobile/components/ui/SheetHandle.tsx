import { View } from 'react-native'
import { cn } from '@/lib/utils'

export default function SheetHandle({ className }: { className?: string }) {
  return (
    <View className={cn('items-center pt-ct-sm pb-ct-md', className)}>
      <View className="w-10 h-1 rounded-full bg-ct-border-mid dark:bg-ct-dark-border" />
    </View>
  )
}
