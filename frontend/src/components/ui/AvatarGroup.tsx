import { cn } from '@/lib/utils'

export interface AvatarItem {
  name: string
  imageUrl?: string
  /** Hex fallback background colour */
  color?: string
}

const PALETTE = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#00C896', '#EF4444', '#6366F1',
]

function initials(name: string) {
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

interface AvatarGroupProps {
  avatars: AvatarItem[]
  /** Max visible avatars before +N overflow  */
  max?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
}

const RING = {
  sm: 'ring-[1.5px]',
  md: 'ring-2',
  lg: 'ring-2',
}

export default function AvatarGroup({
  avatars,
  max = 4,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const visible = avatars.slice(0, max)
  const overflow = avatars.length - max

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((av, i) => {
        const bg = av.color ?? PALETTE[i % PALETTE.length]
        return (
          <div
            key={i}
            title={av.name}
            className={cn(
              'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
              'ring-background',
              SIZE[size],
              RING[size],
              i > 0 && '-ml-2',
            )}
            style={av.imageUrl
              ? { backgroundImage: `url(${av.imageUrl})`, backgroundSize: 'cover' }
              : { background: bg }
            }
          >
            {!av.imageUrl && initials(av.name)}
          </div>
        )
      })}

      {overflow > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold',
            'bg-muted text-muted-foreground ring-background -ml-2',
            SIZE[size],
            RING[size],
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
