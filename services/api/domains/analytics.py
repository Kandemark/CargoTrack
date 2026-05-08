"""
Domain: Analytics & Intelligence
─────────────────────────────────
Business intelligence and machine learning — KPI dashboards, profit analysis,
route and corridor analytics, carrier benchmarking, customer analytics,
temporal trends, driver leaderboards, bid analytics, SLA compliance, carbon
emissions, and ML predictions (delay, demand, pricing, theft risk, driver
scoring, border delays).

This is a **read-only projection domain**.  It does not own aggregates or
mutate state.  All data is projected from other domains (Shipments, Fleet,
Finance, Partners) into analytics views.

Owns
~~~~
- ``dashboard``           Django app — aggregated KPI views (no models)
- ``predictions``         Django app — ML prediction endpoints (no models)
- ``cargotrack.ml.*``     ML models — DelayPredictor, DemandForecaster, etc.

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment data (analytics source)
- ``domains.fleet``       Driver data (leaderboard)
- ``domains.identity``    User data (customer analytics)
"""

from shipments.api_views import (
    AnalyticsExportView,
    AnalyticsView,
    BidAnalyticsView,
    CarbonView,
    CarrierBenchmarkView,
    CorridorAnalyticsView,
    CustomerAnalyticsView,
    DriverLeaderboardView,
    PerformanceAnalyticsView,
    ProfitAnalyticsView,
    RouteAnalyticsView,
    SLAListView,
    TemporalAnalyticsView,
)

__all__ = [
    "AnalyticsExportView",
    "AnalyticsView",
    "BidAnalyticsView",
    "CarbonView",
    "CarrierBenchmarkView",
    "CorridorAnalyticsView",
    "CustomerAnalyticsView",
    "DriverLeaderboardView",
    "PerformanceAnalyticsView",
    "ProfitAnalyticsView",
    "RouteAnalyticsView",
    "SLAListView",
    "TemporalAnalyticsView",
]
