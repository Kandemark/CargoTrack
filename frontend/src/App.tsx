import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import PageWrapper from '@/components/layout/PageWrapper'

import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Shipments from '@/pages/Shipments'
import ShipmentDetail from '@/pages/ShipmentDetail'
import Tracking from '@/pages/Tracking'
import Predictions from '@/pages/Predictions'
import Alerts from '@/pages/Alerts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <PageWrapper>{children}</PageWrapper>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard"      element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/shipments"      element={<AppLayout><Shipments /></AppLayout>} />
        <Route path="/shipments/:id"  element={<AppLayout><ShipmentDetail /></AppLayout>} />
        <Route path="/tracking"       element={<AppLayout><Tracking /></AppLayout>} />
        <Route path="/predictions"    element={<AppLayout><Predictions /></AppLayout>} />
        <Route path="/alerts"         element={<AppLayout><Alerts /></AppLayout>} />

        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
