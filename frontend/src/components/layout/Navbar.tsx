import { Bell, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function Navbar({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const user = useAuthStore((s) => s.user)

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '??'

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 z-10">
      {/* Left — date */}
      <p className="text-sm text-gray-400 font-medium tabular-nums">
        {formatDate(new Date())}
      </p>

      {/* Right — alerts + user */}
      <div className="flex items-center gap-2">
        {/* Bell */}
        <Link
          to="/alerts"
          className="relative p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadAlerts > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </Link>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* User */}
        <button className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors group">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'var(--ct-navy)' }}
          >
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
            {user ? `${user.first_name} ${user.last_name}` : 'Account'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
        </button>
      </div>
    </header>
  )
}
