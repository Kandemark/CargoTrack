/**
 * PageWrapper.tsx — Authenticated shell: collapsible sidebar + navbar + content.
 */
import { useState, useEffect, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import CommandPalette from '@/components/CommandPalette'
import RealTimeProvider from '@/components/RealTimeProvider'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import OfflineIndicator from '@/components/ui/OfflineIndicator'
import { useSidebarStore } from '@/store/sidebarStore'

function useMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

export default function PageWrapper({ children }: { children?: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false)
  const { collapsed, setCollapsed } = useSidebarStore()
  const isMobile = useMobile()

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile, setCollapsed])

  // Global ⌘K / Ctrl+K handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showSidebar = !isMobile && !collapsed
  const showMobileOverlay = isMobile && !collapsed

  return (
    <div className="flex h-screen overflow-hidden bg-ct-mist dark:bg-[#0d1117]">
      <Sidebar />

      {/* Mobile backdrop */}
      {showMobileOverlay && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <OfflineIndicator />
        <Navbar onCmdK={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <ErrorBoundary section="This page">
              <RealTimeProvider>
                {children ?? <Outlet />}
              </RealTimeProvider>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
