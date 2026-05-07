import { Text } from 'react-native'
import { cn } from '@/lib/utils'

export default function SectionLabel({ label, className }: { label: string; className?: string }) {
  return (
    <Text
      className={cn(
        'text-ct-xs text-ct-text-faint font-heading font-bold uppercase tracking-[0.8px] mb-ct-md',
        className,
      )}
    >
      {label}
    </Text>
  )
}
