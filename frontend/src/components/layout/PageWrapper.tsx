/**
 * @file PageWrapper.tsx
 * @description Root authenticated layout component.  Wraps every protected
 * page with a fixed `Sidebar` on the left and a top `Navbar`, leaving the
 * centre column scrollable for page content.
 *
 * @param children - The page component to render in the main content area.
 * @returns The full-page layout: Sidebar | Navbar + main content.
 */
import { type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

/**
 * Authenticated page shell — sidebar + navbar + scrollable content area.
 *
 * Usage A (nested routes via <Outlet />):
 *   <Route element={<PageWrapper />}>
 *     <Route path="/ops/dashboard" element={<OpsDashboard />} />
 *   </Route>
 *
 * Usage B (explicit children, legacy pattern):
 *   <PageWrapper><Dashboard /></PageWrapper>
 */
export default function PageWrapper({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-6 py-6">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}
