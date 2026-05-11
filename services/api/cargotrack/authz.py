"""
cargotrack/authz.py — Authorization shortcut classes for DRF views.

These are pre-built DRF permission classes that views can use directly
without importing through the domain registry (which causes circular
imports when domain modules re-export views from ``shipments.api_views``).

All logic delegates to ``domains._authz``.  This module is just the
DRF-friendly shortcut layer kept outside the domain package to avoid
circular imports.
"""
from __future__ import annotations

from domains._authz import (                # noqa: F401  (re-exported)
    Permission,
    has_permission,
    assert_permission,
    require_permission,
    audit_user_permissions,
    HasPermission,
    HasObjectPermission,
    OrgScopedQueryset,
    CarrierScopedQueryset,
    DriverScopedQueryset,
)

# ── Pre-built DRF permission instances ───────────────────────────────────────

CanViewShipments     = HasPermission(Permission.SHIPMENTS_VIEW)
CanCreateShipments   = HasPermission(Permission.SHIPMENTS_CREATE)
CanUpdateShipments   = HasPermission(Permission.SHIPMENTS_UPDATE)
CanDispatchShipments = HasPermission(Permission.SHIPMENTS_DISPATCH)
CanDeleteShipments   = HasPermission(Permission.SHIPMENTS_DELETE)
CanTrackShipments    = HasPermission(Permission.SHIPMENTS_TRACK)

CanViewRates       = HasPermission(Permission.RATES_VIEW)
CanManageRates     = HasPermission(Permission.RATES_MANAGE)
CanManageRoutes    = HasPermission(Permission.ROUTES_MANAGE)
CanViewContracts   = HasPermission(Permission.CONTRACTS_VIEW)
CanManageContracts = HasPermission(Permission.CONTRACTS_MANAGE)

CanViewFinance   = HasPermission(Permission.FINANCE_VIEW)
CanManageFinance = HasPermission(Permission.FINANCE_MANAGE)
CanApproveFinance = HasPermission(Permission.FINANCE_APPROVE)

CanViewCustoms    = HasPermission(Permission.CUSTOMS_VIEW)
CanSubmitCustoms  = HasPermission(Permission.CUSTOMS_SUBMIT)
CanClearCustoms   = HasPermission(Permission.CUSTOMS_CLEAR)

CanViewFleet   = HasPermission(Permission.FLEET_VIEW)
CanManageFleet = HasPermission(Permission.FLEET_MANAGE)
CanAssignFleet = HasPermission(Permission.FLEET_ASSIGN)

CanViewPorts   = HasPermission(Permission.PORTS_VIEW)
CanManagePorts = HasPermission(Permission.PORTS_MANAGE)

CanViewColdChain   = HasPermission(Permission.COLDCHAIN_VIEW)
CanManageColdChain = HasPermission(Permission.COLDCHAIN_MANAGE)

CanViewDocuments   = HasPermission(Permission.DOCUMENTS_VIEW)
CanUploadDocuments = HasPermission(Permission.DOCUMENTS_UPLOAD)
CanVerifyDocuments = HasPermission(Permission.DOCUMENTS_VERIFY)

CanViewAnalytics   = HasPermission(Permission.ANALYTICS_VIEW)
CanExportAnalytics = HasPermission(Permission.ANALYTICS_EXPORT)

CanSendChat   = HasPermission(Permission.CHAT_SEND)
CanManageChat = HasPermission(Permission.CHAT_MANAGE)

CanViewMarketplace   = HasPermission(Permission.MARKETPLACE_VIEW)
CanBidMarketplace    = HasPermission(Permission.MARKETPLACE_BID)
CanManageMarketplace = HasPermission(Permission.MARKETPLACE_MANAGE)

CanViewPredictions = HasPermission(Permission.PREDICTIONS_VIEW)

CanAdminUsers  = HasPermission(Permission.ADMIN_USERS)
CanAdminSystem = HasPermission(Permission.ADMIN_SYSTEM)
CanViewAudit   = HasPermission(Permission.ADMIN_AUDIT)
