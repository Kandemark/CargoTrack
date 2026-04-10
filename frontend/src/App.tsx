/**
 * @file App.tsx
 * @description Root React component — configures React Router with nested
 * role-based routes and authentication guards.
 *
 * URL structure:
 *   Public   /login  /register  /access-denied
 *   /admin/* — ADMIN only          (AdminDashboard, user mgmt)
 *   /ops/*   — ADMIN + LOG_MGR     (OpsDashboard, Shipments, Predictions)
 *   /driver/*— CARRIER only        (DriverPortal, Shipments, LogEvent)
 *   /portal/*— CLIENT only         (ClientPortal, Shipments)
 *   /shared/*— any authenticated   (Tracking, Alerts)
 *
 * Guard chain: ProtectedRoute (auth) → RoleRoute (role) → PageWrapper → page
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard, ROLES } from '@/lib/roleUtils'

import ProtectedRoute from '@/components/guards/ProtectedRoute'
import RoleRoute      from '@/components/guards/RoleRoute'
import AccessDenied   from '@/components/guards/AccessDenied'
import PageWrapper    from '@/components/layout/PageWrapper'

import Landing          from '@/pages/Landing'
import Login            from '@/pages/Login'
import Register         from '@/pages/Register'

import AdminDashboard   from '@/pages/admin/AdminDashboard'
import OpsDashboard     from '@/pages/ops/OpsDashboard'
import DriverPortal     from '@/pages/driver/DriverPortal'
import ClientPortal     from '@/pages/client/ClientPortal'

import Shipments        from '@/pages/Shipments'
import ShipmentDetail   from '@/pages/ShipmentDetail'
import ShipmentCreate   from '@/pages/ShipmentCreate'
import LogEvent         from '@/pages/LogEvent'
import Tracking         from '@/pages/Tracking'
import Predictions      from '@/pages/Predictions'
import Alerts           from '@/pages/Alerts'

// ── Landing route — redirects authenticated users to their role dashboard ─────

function LandingRoute() {
  const { isAuthenticated, user } = useAuthStore()
  return isAuthenticated
    ? <Navigate to={getRoleDashboard(user?.role)} replace />
    : <Landing />
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public ─────────────────────────────────────────────────────────── */}
        <Route path="/"              element={<LandingRoute />} />
        <Route path="/login"         element={<Login />} />
        <Route path="/register"      element={<Register />} />
        <Route path="/access-denied" element={<AccessDenied />} />

        {/* ── All authenticated ──────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>

          {/* /shared/* — any authenticated role */}
          <Route element={<PageWrapper />}>
            <Route path="/shared/tracking" element={<Tracking />} />
            <Route path="/shared/alerts"   element={<Alerts />} />
          </Route>

          {/* /admin/* — ADMIN only */}
          <Route element={<RoleRoute roles={ROLES.ADMIN_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>
          </Route>

          {/* /ops/* — ADMIN + LOGISTICS_MGR */}
          <Route element={<RoleRoute roles={ROLES.OPS} />}>
            <Route element={<PageWrapper />}>
              <Route path="/ops/dashboard"               element={<OpsDashboard />} />
              <Route path="/ops/shipments"               element={<Shipments />} />
              <Route path="/ops/shipments/new"           element={<ShipmentCreate />} />
              <Route path="/ops/shipments/:id"           element={<ShipmentDetail />} />
              <Route path="/ops/shipments/:id/log-event" element={<LogEvent />} />
              <Route path="/ops/predictions"             element={<Predictions />} />
            </Route>
          </Route>

          {/* /driver/* — CARRIER only */}
          <Route element={<RoleRoute roles={ROLES.CARRIER_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/driver/dashboard"                element={<DriverPortal />} />
              <Route path="/driver/shipments"                element={<Shipments />} />
              <Route path="/driver/shipments/:id"            element={<ShipmentDetail />} />
              <Route path="/driver/shipments/:id/log-event"  element={<LogEvent />} />
            </Route>
          </Route>

          {/* /portal/* — CLIENT only */}
          <Route element={<RoleRoute roles={ROLES.CLIENT_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/portal/dashboard"  element={<ClientPortal />} />
              <Route path="/portal/shipments"  element={<Shipments />} />
              <Route path="/portal/shipments/:id" element={<ShipmentDetail />} />
            </Route>
          </Route>

        </Route>

        {/* ── Fallback — unknown paths go to login ───────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}
