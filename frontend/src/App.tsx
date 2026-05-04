/**
 * App.tsx — Root React component for CargoTrack.
 *
 * Configures React Router with role-based nested routes and auth guards.
 *
 * URL structure:
 *   Public:        /  /login  /register  /access-denied  /track/:number
 *   /admin/*       ADMIN only
 *   /ops/*         ADMIN + LOGISTICS_MGR
 *   /driver/*      CARRIER only
 *   /portal/*      CLIENT only
 *   /dispatch/*    DISPATCHER only
 *   /customs/*     CUSTOMS_BROKER only
 *   /warehouse/*   WAREHOUSE_MGR only
 *   /port/*        PORT_AGENT only
 *   /finance/*     FINANCE_OFFICER only
 *   Flat shared:   /dashboard /live-map /payments /documents
 *                  /settings /alerts /tracking /shipments
 *                  /fleet/trucks  /fleet/drivers
 *                  /analytics /carriers /notifications /sla /carbon
 *                  /integrations /audit /rates /compliance
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getRoleDashboard, ROLES } from '@/lib/roleUtils'

import ProtectedRoute  from '@/components/guards/ProtectedRoute'
import RoleRoute       from '@/components/guards/RoleRoute'
import AccessDenied    from '@/components/guards/AccessDenied'
import PageWrapper     from '@/components/layout/PageWrapper'

// ── Public pages ───────────────────────────────────────────────────────────────
import Landing         from '@/pages/Landing'
import Login           from '@/pages/Login'
import Register        from '@/pages/Register'
import TrackingPortal  from '@/pages/TrackingPortal'

// ── Role portals ───────────────────────────────────────────────────────────────
import AdminDashboard    from '@/pages/admin/AdminDashboard'
import OpsDashboard      from '@/pages/ops/OpsDashboard'
import DriverPortal      from '@/pages/driver/DriverPortal'
import ClientPortal      from '@/pages/client/ClientPortal'
import DispatcherPortal  from '@/pages/dispatch/DispatcherPortal'
import CustomsPortal     from '@/pages/customs/CustomsPortal'
import WarehousePortal   from '@/pages/warehouse/WarehousePortal'
import PortPortal        from '@/pages/port/PortPortal'
import FinancePortal     from '@/pages/finance/FinancePortal'

// ── Fleet ─────────────────────────────────────────────────────────────────────
import FleetTrucks    from '@/pages/fleet/Trucks'
import FleetDrivers   from '@/pages/fleet/Drivers'
import TruckForm      from '@/pages/fleet/TruckForm'
import TruckDetail    from '@/pages/fleet/TruckDetail'
import FleetAnalytics from '@/pages/fleet/FleetAnalytics'

// ── Shared pages ───────────────────────────────────────────────────────────────
import Dashboard          from '@/pages/Dashboard'
import Shipments          from '@/pages/Shipments'
import ShipmentDetail     from '@/pages/ShipmentDetail'
import ShipmentCreate     from '@/pages/ShipmentCreate'
import LogEvent           from '@/pages/LogEvent'
import Tracking           from '@/pages/Tracking'
import Predictions        from '@/pages/Predictions'
import Alerts             from '@/pages/Alerts'
import LiveMap            from '@/pages/LiveMap'
import Payments           from '@/pages/Payments'
import InvoiceDetail      from '@/pages/InvoiceDetail'
import Documents          from '@/pages/Documents'
import Team               from '@/pages/Team'
import Settings           from '@/pages/Settings'

// ── New feature pages ──────────────────────────────────────────────────────────
import Messages           from '@/pages/Messages'
import Analytics          from '@/pages/Analytics'
import Carriers           from '@/pages/Carriers'
import NotificationCenter from '@/pages/NotificationCenter'
import SLAMonitor         from '@/pages/SLAMonitor'
import CarbonTracker      from '@/pages/CarbonTracker'
import IntegrationHub     from '@/pages/IntegrationHub'
import AuditLog           from '@/pages/AuditLog'
import RateCards          from '@/pages/RateCards'
import Compliance         from '@/pages/Compliance'
import JobBoard           from '@/pages/JobBoard'
import PerformanceMetrics from '@/pages/PerformanceMetrics'

// ── Landing gate — authenticated users go to their role dashboard ─────────────

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

        {/* ── Public ───────────────────────────────────────────────────────── */}
        <Route path="/"              element={<LandingRoute />} />
        <Route path="/login"         element={<Login />} />
        <Route path="/register"      element={<Register />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="/track/:tracking_number" element={<TrackingPortal />} />
        <Route path="/track"         element={<TrackingPortal />} />

        {/* ── Authenticated ─────────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>

          {/* Flat routes accessible to any authenticated user */}
          <Route element={<PageWrapper />}>
            <Route path="/dashboard"               element={<Dashboard />} />
            <Route path="/shipments"               element={<Shipments />} />
            <Route path="/shipments/new"           element={<ShipmentCreate />} />
            <Route path="/shipments/:id"           element={<ShipmentDetail />} />
            <Route path="/shipments/:id/log-event" element={<LogEvent />} />
            <Route path="/live-map"                element={<LiveMap />} />
            <Route path="/tracking"                element={<Tracking />} />
            <Route path="/predictions"             element={<Predictions />} />
            <Route path="/alerts"                  element={<Alerts />} />
            <Route path="/payments"                element={<Payments />} />
            <Route path="/payments/:id"            element={<InvoiceDetail />} />
            <Route path="/documents"               element={<Documents />} />
            <Route path="/settings"                element={<Settings />} />
            <Route path="/messages"               element={<Messages />} />
            <Route path="/fleet/trucks"            element={<FleetTrucks />} />
            <Route path="/fleet/trucks/new"       element={<TruckForm />} />
            <Route path="/fleet/trucks/:id/edit"  element={<TruckForm />} />
            <Route path="/fleet/trucks/:id"       element={<TruckDetail />} />
            <Route path="/fleet/drivers"           element={<FleetDrivers />} />
            <Route path="/fleet/analytics"         element={<FleetAnalytics />} />
            {/* New feature pages */}
            <Route path="/analytics"               element={<Analytics />} />
            <Route path="/carriers"                element={<Carriers />} />
            <Route path="/notifications"           element={<NotificationCenter />} />
            <Route path="/sla"                     element={<SLAMonitor />} />
            <Route path="/carbon"                  element={<CarbonTracker />} />
            <Route path="/integrations"            element={<IntegrationHub />} />
            <Route path="/audit"                   element={<AuditLog />} />
            <Route path="/rates"                   element={<RateCards />} />
            <Route path="/compliance"              element={<Compliance />} />
            <Route path="/job-board"               element={<JobBoard />} />
            <Route path="/performance"             element={<PerformanceMetrics />} />
            {/* Legacy shared routes */}
            <Route path="/shared/tracking"         element={<Tracking />} />
            <Route path="/shared/alerts"           element={<Alerts />} />
          </Route>

          {/* /team — Admin only */}
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
              <Route path="/ops/dashboard"                element={<OpsDashboard />} />
              <Route path="/ops/shipments"                element={<Shipments />} />
              <Route path="/ops/shipments/new"            element={<ShipmentCreate />} />
              <Route path="/ops/shipments/:id"            element={<ShipmentDetail />} />
              <Route path="/ops/shipments/:id/log-event"  element={<LogEvent />} />
              <Route path="/ops/predictions"              element={<Predictions />} />
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

          {/* /dispatch/* — DISPATCHER */}
          <Route element={<RoleRoute roles={ROLES.DISPATCHER_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/dispatch/dashboard" element={<DispatcherPortal />} />
              <Route path="/dispatch/queue"     element={<DispatcherPortal />} />
              <Route path="/dispatch/routes"    element={<LiveMap />} />
            </Route>
          </Route>

          {/* /customs/* — CUSTOMS_BROKER */}
          <Route element={<RoleRoute roles={ROLES.CUSTOMS_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/customs/dashboard"  element={<CustomsPortal />} />
              <Route path="/customs/queue"      element={<CustomsPortal />} />
              <Route path="/customs/documents"  element={<Documents />} />
              <Route path="/customs/compliance" element={<Alerts />} />
            </Route>
          </Route>

          {/* /warehouse/* — WAREHOUSE_MGR */}
          <Route element={<RoleRoute roles={ROLES.WAREHOUSE_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/warehouse/dashboard" element={<WarehousePortal />} />
              <Route path="/warehouse/inventory" element={<WarehousePortal />} />
              <Route path="/warehouse/inbound"   element={<WarehousePortal />} />
              <Route path="/warehouse/outbound"  element={<WarehousePortal />} />
            </Route>
          </Route>

          {/* /port/* — PORT_AGENT */}
          <Route element={<RoleRoute roles={ROLES.PORT_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/port/dashboard"  element={<PortPortal />} />
              <Route path="/port/vessels"    element={<PortPortal />} />
              <Route path="/port/containers" element={<PortPortal />} />
              <Route path="/port/manifest"   element={<PortPortal />} />
            </Route>
          </Route>

          {/* /finance/* — FINANCE_OFFICER */}
          <Route element={<RoleRoute roles={ROLES.FINANCE_ONLY} />}>
            <Route element={<PageWrapper />}>
              <Route path="/finance/dashboard" element={<FinancePortal />} />
              <Route path="/finance/revenue"   element={<FinancePortal />} />
              <Route path="/finance/reports"   element={<FinancePortal />} />
            </Route>
          </Route>

        </Route>

        {/* ── Fallback ──────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}
