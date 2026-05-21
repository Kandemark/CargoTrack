import { Phone, Video } from 'lucide-react'

interface Props {
  calleeId: number
  calleeName?: string
  onStartCall: () => void
  disabled?: boolean
  variant?: 'icon' | 'button'
}

export default function VideoCallButton({ calleeName, onStartCall, disabled, variant = 'button' }: Props) {
  if (variant === 'icon') {
    return (
      <button
        onClick={onStartCall}
        disabled={disabled}
        title={`Video call ${calleeName ?? ''}`}
        className="p-2 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Video className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={onStartCall}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white font-semibold text-sm
        hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
    >
      <Phone className="w-4 h-4" />
      Call{calleeName ? ` ${calleeName}` : ''}
    </button>
  )
}
