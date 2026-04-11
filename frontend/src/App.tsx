/**
 * @file App.tsx
 * @description Root React component — configures React Router with nested
 * role-based routes and authentication guards.
 *
 * URL structure:
 *   Public   /login  /register  /access-denied  /track/:tracking_number
 *   /admin/* — ADMIN only
 *   /ops/*   — ADMIN + LOGISTICS_MGR
 *   /driver/*— CARRIER only
 *   /portal/*— CLIENT only
 *   Flat authenticated: /dashboard /live-map /payments /payments/:id
 *                        /documents /team /settings /alerts /tracking
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
import TrackingPortal   from '@/pages/TrackingPortal'

import AdminDashboard   from '@/pages/admin/AdminDashboard'
import OpsDashboard     from '@/pages/ops/OpsDashboard'
import DriverPortal     from '@/pages/driver/DriverPortal'
import ClientPortal     from '@/pages/client/ClientPortal'

import Dashboard        from '@/pages/Dashboard'
import Shipments        from '@/pages/Shipments'
import ShipmentDetail   from '@/pages/ShipmentDetail'
import ShipmentCreate   from '@/pages/ShipmentCreate'
import LogEvent         from '@/pages/LogEvent'
import Tracking         from '@/pages/Tracking'
import Predictions      from '@/pages/Predictions'
import Alerts           from '@/pages/Alerts'
import LiveMap          from '@/pages/LiveMap'
import Payments         from '@/pages/Payments'
import InvoiceDetail    from '@/pages/InvoiceDetail'
import Documents        from '@/pages/Documents'
import Team             from '@/pages/Team'
import Settings         from '@/pages/Settings'

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
        <Route path="/track/:tracking_number" element={<TrackingPortal />} />
        <Route path="/track"         element={<TrackingPortal />} />

        {/* ── All authenticated ──────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>

          {/* Flat routes accessible to any authenticated user */}
          <Route element={<PageWrapper />}>
            <Route path="/dashboard"         element={<Dashboard />} />
            <Route path="/shipments"         element={<Shipments />} />
            <Route path="/shipments/new"     element={<ShipmentCreate />} />
            <Route path="/shipments/:id"     element={<ShipmentDetail />} />
            <Route path="/shipments/:id/log-event" element={<LogEvent />} />
            <Route path="/live-map"          element={<LiveMap />} />
            <Route path="/tracking"          element={<Tracking />} />
            <Route path="/predictions"       element={<Predictions />} />
            <Route path="/alerts"            element={<Alerts />} />
            <Route path="/payments"          element={<Payments />} />
            <Route path="/payments/:id"      element={<InvoiceDetail />} />
            <Route path="/documents"         element={<Documents />} />
            <Route path="/settings"          element={<Settings />} />

            {/* Shared legacy routes */}
            <Route path="/shared/tracking"   element={<Tracking />} />
            <Route path="/shared/alerts"     element={<Alerts />} />
          </Route>

          {/* Team — Admin only */}
          <Route element={<RoleRoute roles={ROLES.ADMIN_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/team" element={<Team />} />
            </Route>
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
              <Route path="/portal/dashboard"     element={<ClientPortal />} />
              <Route path="/portal/shipments"     element={<Shipments />} />
              <Route path="/portal/shipments/:id" element={<ShipmentDetail />} />
            </Route>
          </Route>

        </Route>

        {/* ── Fallback ────────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}
