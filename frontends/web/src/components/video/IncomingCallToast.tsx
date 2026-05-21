import { motion } from 'framer-motion'
import { Phone, PhoneOff } from 'lucide-react'

interface Props {
  callerName: string
  onAccept: () => void
  onDecline: () => void
}

export default function IncomingCallToast({ callerName, onAccept, onDecline }: Props) {
  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
        border border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center gap-5"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 ring-2 ring-white dark:ring-gray-800 animate-pulse" />
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Incoming Video Call</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{callerName} is calling...</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          className="p-2.5 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
          title="Accept"
        >
          <Phone className="w-4 h-4" />
        </button>
        <button
          onClick={onDecline}
          className="p-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
          title="Decline"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}
