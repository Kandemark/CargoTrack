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

# Shortcut permission constants are defined once in domains._authz and imported here.
# Code importing from cargotrack.authz continues to work unchanged.
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
    # Pre-built DRF permission instances
    CanViewShipments,
    CanCreateShipments,
    CanUpdateShipments,
    CanDispatchShipments,
    CanDeleteShipments,
    CanTrackShipments,
    CanViewRates,
    CanManageRates,
    CanManageRoutes,
    CanViewContracts,
    CanManageContracts,
    CanViewFinance,
    CanManageFinance,
    CanApproveFinance,
    CanViewCustoms,
    CanSubmitCustoms,
    CanClearCustoms,
    CanViewFleet,
    CanManageFleet,
    CanAssignFleet,
    CanViewPorts,
    CanManagePorts,
    CanViewColdChain,
    CanManageColdChain,
    CanViewDocuments,
    CanUploadDocuments,
    CanVerifyDocuments,
    CanViewAnalytics,
    CanExportAnalytics,
    CanSendChat,
    CanManageChat,
    CanViewMarketplace,
    CanBidMarketplace,
    CanManageMarketplace,
    CanViewPredictions,
    CanAdminUsers,
    CanAdminSystem,
    CanViewAudit,
)
