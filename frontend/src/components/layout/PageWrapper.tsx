import { type ReactNode } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function PageWrapper({
  children,
  unreadAlerts = 0,
}: {
  children: ReactNode
  unreadAlerts?: number
}) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar unreadAlerts={unreadAlerts} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
