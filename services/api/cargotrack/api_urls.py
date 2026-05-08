"""
cargotrack/api_urls.py — Versioned API Router.

Mounted at /api/<version>/ by cargotrack/urls.py.

All cross-cutting imports come through the domain layer (``domains.*``)
rather than reaching directly into app internals.  Each domain module
documents its scope, dependencies, and public API.
"""
from django.urls import include, path

from domains.analytics import (
    AnalyticsExportView, AnalyticsView, BidAnalyticsView, CarbonView,
    CarrierBenchmarkView, CorridorAnalyticsView, CustomerAnalyticsView,
    DriverLeaderboardView, PerformanceAnalyticsView, ProfitAnalyticsView,
    RouteAnalyticsView, SLAListView, TemporalAnalyticsView,
)
from domains.contracts import RateComparisonView, RateLookupView
from domains.finance import (
    CurrencyConvertView, InvoiceCalculateView, TaxSummaryView,
)
from domains.identity import (
    AuditEntryCreateView, AuditEntryListView, IntegrationDetailView,
    IntegrationListView, NotificationDismissView, NotificationListView,
    NotificationMarkAllReadView, NotificationMarkReadView,
)
from domains.ports import DemurrageCalculateView, DemurragePortStatusView
from domains.shipments import (
    BorderCrossingInfoView, ComplianceDocDetailView,
    ComplianceDocListCreateView, CustomsDeclarationView, CustomsStatusView,
    DocumentExtractionDetailView, DocumentExtractionView, RouteListAPIView,
    TariffLookupView,
)
from domains.shipments import BatchETAView, RealTimeETAView

urlpatterns = [
    # ── Django-app sub-routers ────────────────────────────────────────────
    path('accounts/',     include('accounts.api_urls')),
    path('routes/',       RouteListAPIView.as_view(),          name='v1-routes'),
    path('shipments/',    include('shipments.api_urls')),
    path('tracking/',     include('tracking.api_urls')),
    path('alerts/',       include('alerts.api_urls')),
    path('dashboard/',    include('dashboard.api_urls')),
    path('',              include('payments.api_urls')),
    path('fleet/',        include('fleet.api_urls')),
    path('',              include('carriers.api_urls')),
    path('chat/',         include('chats.api_urls')),
    path('marketplace/',  include('marketplace.api_urls')),
    path('pod/',          include('pod.urls')),
    path('coldchain/',    include('coldchain.urls')),
    path('predictions/', include('predictions.urls')),

    # ── Analytics / SLA / Carbon ─────────────────────────────────────────
    path('analytics/',                     AnalyticsView.as_view(),            name='v1-analytics'),
    path('analytics/profit/',              ProfitAnalyticsView.as_view(),     name='v1-analytics-profit'),
    path('analytics/routes/',              RouteAnalyticsView.as_view(),      name='v1-analytics-routes'),
    path('analytics/carrier-benchmark/',   CarrierBenchmarkView.as_view(),    name='v1-analytics-carrier-benchmark'),
    path('analytics/corridors/',           CorridorAnalyticsView.as_view(),   name='v1-analytics-corridors'),
    path('analytics/customers/',           CustomerAnalyticsView.as_view(),   name='v1-analytics-customers'),
    path('analytics/temporal/',            TemporalAnalyticsView.as_view(),   name='v1-analytics-temporal'),
    path('analytics/export/',              AnalyticsExportView.as_view(),     name='v1-analytics-export'),
    path('analytics/performance/',         PerformanceAnalyticsView.as_view(), name='v1-analytics-performance'),
    path('analytics/driver-leaderboard/',  DriverLeaderboardView.as_view(),   name='v1-analytics-driver-leaderboard'),
    path('analytics/bid-analytics/',       BidAnalyticsView.as_view(),        name='v1-analytics-bid-analytics'),
    path('sla/',                           SLAListView.as_view(),             name='v1-sla'),
    path('carbon/',                        CarbonView.as_view(),              name='v1-carbon'),

    # ── Customs (EAC customs systems integration) ────────────────────────
    path('customs/declare/',       CustomsDeclarationView.as_view(),      name='v1-customs-declare'),
    path('customs/status/',        CustomsStatusView.as_view(),           name='v1-customs-status'),
    path('customs/tariff/',        TariffLookupView.as_view(),            name='v1-customs-tariff'),
    path('customs/borders/',       BorderCrossingInfoView.as_view(),      name='v1-customs-borders'),

    # ── Real-time ETA ────────────────────────────────────────────────────
    path('eta/',               RealTimeETAView.as_view(),             name='v1-eta'),
    path('eta/batch/',         BatchETAView.as_view(),                name='v1-eta-batch'),

    # ── Multi-currency finance ───────────────────────────────────────────
    path('finance/convert/',   CurrencyConvertView.as_view(),         name='v1-finance-convert'),
    path('finance/taxes/',     TaxSummaryView.as_view(),              name='v1-finance-taxes'),
    path('finance/calculate/', InvoiceCalculateView.as_view(),        name='v1-finance-calculate'),

    # ── Rates & contracts ────────────────────────────────────────────────
    path('rates/',             RateLookupView.as_view(),              name='v1-rates-lookup'),
    path('rates/compare/',     RateComparisonView.as_view(),          name='v1-rates-compare'),

    # ── Demurrage & detention ────────────────────────────────────────────
    path('demurrage/',            DemurrageCalculateView.as_view(),    name='v1-demurrage'),
    path('demurrage/port/',       DemurragePortStatusView.as_view(),   name='v1-demurrage-port'),

    # ── Compliance documents ─────────────────────────────────────────────
    path('compliance/',            ComplianceDocListCreateView.as_view(),  name='v1-compliance-list'),
    path('compliance/<int:pk>/',   ComplianceDocDetailView.as_view(),      name='v1-compliance-detail'),

    # ── Document OCR extraction ──────────────────────────────────────────
    path('documents/extract/',              DocumentExtractionView.as_view(),       name='v1-document-extract'),
    path('documents/<int:pk>/extraction/',  DocumentExtractionDetailView.as_view(), name='v1-document-extraction'),

    # ── Notifications ────────────────────────────────────────────────────
    path('notifications/',                     NotificationListView.as_view(),        name='v1-notif-list'),
    path('notifications/mark-all-read/',       NotificationMarkAllReadView.as_view(), name='v1-notif-mark-all'),
    path('notifications/<int:pk>/read/',       NotificationMarkReadView.as_view(),    name='v1-notif-read'),
    path('notifications/<int:pk>/',            NotificationDismissView.as_view(),     name='v1-notif-dismiss'),

    # ── Audit log ────────────────────────────────────────────────────────
    path('audit/',        AuditEntryListView.as_view(),        name='v1-audit-list'),
    path('audit/create/', AuditEntryCreateView.as_view(),      name='v1-audit-create'),

    # ── Integrations ─────────────────────────────────────────────────────
    path('integrations/',            IntegrationListView.as_view(),   name='v1-integrations-list'),
    path('integrations/<int:pk>/',   IntegrationDetailView.as_view(), name='v1-integrations-detail'),
]
