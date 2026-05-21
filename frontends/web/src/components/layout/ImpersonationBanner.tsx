/**
 * ImpersonationBanner.tsx — Amber banner shown when an admin is impersonating another user.
 */
import { useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function ImpersonationBanner() {
  const { isImpersonating, user, originalUser, stopImpersonating } = useAuthStore()
  const [stopping, setStopping] = useState(false)

  if (!isImpersonating) return null

  async function handleStop() {
    setStopping(true)
    try {
      await stopImpersonating()
      window.location.href = '/platform/dashboard'
    } catch {
      setStopping(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500 text-white text-sm font-medium">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldOff className="w-4 h-4 shrink-0" />
        <span className="truncate">
          Viewing as <strong>{user?.first_name} {user?.last_name}</strong>
          {originalUser && <> · Original: {originalUser.first_name} {originalUser.last_name}</>}
        </span>
      </div>
      <button
        onClick={handleStop}
        disabled={stopping}
        className="shrink-0 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold transition-colors disabled:opacity-50"
      >
        {stopping ? 'Reverting...' : 'Stop Impersonating'}
      </button>
    </div>
  )
}
