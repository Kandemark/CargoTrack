import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    function goOffline() { setOffline(true); setShowReconnected(false) }
    function goOnline() {
      setOffline(false)
      setShowReconnected(true)
      setTimeout(() => setShowReconnected(false), 3000)
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 inset-x-0 z-[9999] bg-red-600 text-white text-sm font-semibold py-2 px-4 flex items-center justify-center gap-2 shadow-lg"
        >
          <WifiOff className="w-4 h-4" />
          Connection lost — waiting for network...
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 inset-x-0 z-[9999] bg-emerald-600 text-white text-sm font-semibold py-2 px-4 flex items-center justify-center gap-2 shadow-lg"
        >
          <Wifi className="w-4 h-4" />
          Connection restored
        </motion.div>
      )}
    </AnimatePresence>
  )
}
