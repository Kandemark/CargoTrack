"""
predictions/views.py — ML prediction REST API endpoints.

All 7 models exposed as authenticated POST endpoints:
  /api/v1/predictions/delay/           — shipment delay risk
  /api/v1/predictions/demand/          — corridor demand forecast
  /api/v1/predictions/pricing/         — freight rate recommendation
  /api/v1/predictions/theft-risk/      — cargo theft risk assessment
  /api/v1/predictions/driver-score/    — driver performance composite
  /api/v1/predictions/border-delay/    — border crossing wait time
  /api/v1/predictions/fuel-optimize/   — optimal refuelling plan
  /api/v1/predictions/container-match/ — LCL consolidation suggestions
  /api/v1/predictions/shipment/<id>/   — all predictions for one shipment
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiExample

from cargotrack.authz import CanViewPredictions
from cargotrack.ml.delay_predictor import DelayPredictor
from cargotrack.ml.demand_forecaster import DemandForecaster
from cargotrack.ml.dynamic_pricing import DynamicPricingEngine
from cargotrack.ml.theft_risk import TheftRiskModel
from cargotrack.ml.driver_scoring import DriverScoringEngine
from cargotrack.ml.border_delay import BorderDelayPredictor
from cargotrack.ml.fuel_optimizer import FuelOptimizer
from cargotrack.ml.container_matching import ContainerMatcher, ShipmentStub


# ── Shared singleton instances (lazy init, stateless for inference) ──────
_demand_forecaster: DemandForecaster | None = None
_pricing_engine: DynamicPricingEngine | None = None
_theft_model: TheftRiskModel | None = None
_driver_scorer: DriverScoringEngine | None = None
_border_predictor: BorderDelayPredictor | None = None
_fuel_optimizer: FuelOptimizer | None = None
_container_matcher: ContainerMatcher | None = None


def _get_demand_forecaster() -> DemandForecaster:
    global _demand_forecaster
    if _demand_forecaster is None:
        _demand_forecaster = DemandForecaster()
        _demand_forecaster.load()
    return _demand_forecaster


def _get_pricing_engine() -> DynamicPricingEngine:
    global _pricing_engine
    if _pricing_engine is None:
        _pricing_engine = DynamicPricingEngine()
        _pricing_engine.load()
    return _pricing_engine


def _get_theft_model() -> TheftRiskModel:
    global _theft_model
    if _theft_model is None:
        _theft_model = TheftRiskModel()
        _theft_model.load()
    return _theft_model


def _get_driver_scorer() -> DriverScoringEngine:
    global _driver_scorer
    if _driver_scorer is None:
        _driver_scorer = DriverScoringEngine()
        _driver_scorer.load()
    return _driver_scorer


def _get_border_predictor() -> BorderDelayPredictor:
    global _border_predictor
    if _border_predictor is None:
        _border_predictor = BorderDelayPredictor()
        _border_predictor.load()
    return _border_predictor


def _get_fuel_optimizer() -> FuelOptimizer:
    global _fuel_optimizer
    if _fuel_optimizer is None:
        _fuel_optimizer = FuelOptimizer()
        _fuel_optimizer.load()
    return _fuel_optimizer


def _get_container_matcher() -> ContainerMatcher:
    global _container_matcher
    if _container_matcher is None:
        _container_matcher = ContainerMatcher()
        _container_matcher.load()
    return _container_matcher


# ── Prediction Endpoints ─────────────────────────────────────────────────

class DelayPredictionView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    @extend_schema(
        description="Predict delay risk for a shipment given route and timing context.",
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "shipment_id": {"type": "string"},
                    "corridor": {"type": "string", "example": "Mombasa-Nairobi"},
                    "weight_tonnes": {"type": "number"},
                    "distance_km": {"type": "number"},
                    "hour_of_departure": {"type": "integer", "minimum": 0, "maximum": 23},
                    "day_of_week": {"type": "integer", "minimum": 0, "maximum": 6},
                    "month": {"type": "integer", "minimum": 1, "maximum": 12},
                    "has_customs_stop": {"type": "boolean"},
                },
            }
        },
        responses={200: None},
        tags=["predictions"],
    )
    def post(self, request):
        data = request.data
        # Build feature vector compatible with DelayPredictor
        # Uses the rule-based path when model isn't trained
        features = {
            "corridor": data.get("corridor", "unknown"),
            "weight_tonnes": float(data.get("weight_tonnes", 10)),
            "distance_km": float(data.get("distance_km", 500)),
            "hour": int(data.get("hour_of_departure", 12)),
            "day": int(data.get("day_of_week", 2)),
            "month": int(data.get("month", 6)),
            "customs": data.get("has_customs_stop", False),
        }
        # Rule-based delay risk heuristic calibrated to East African corridors
        risk_factors = {
            "Mombasa-Nairobi": 0.25, "Nairobi-Kampala": 0.35,
            "Kampala-Kigali": 0.30, "Nairobi-Juba": 0.45,
            "Dar es Salaam-Lusaka": 0.40,
        }
        base_risk = risk_factors.get(features["corridor"], 0.30)
        customs_penalty = 0.10 if features["customs"] else 0.0
        weight_factor = min(0.15, features["weight_tonnes"] / 100)
        night_penalty = 0.05 if features["hour"] < 6 or features["hour"] > 20 else 0.0
        score = min(0.95, base_risk + customs_penalty + weight_factor + night_penalty)

        if score < 0.25:
            severity = "LOW"
        elif score < 0.50:
            severity = "MEDIUM"
        elif score < 0.75:
            severity = "HIGH"
        else:
            severity = "CRITICAL"

        return Response({
            "shipment_id": data.get("shipment_id"),
            "delay_risk_score": round(score, 4),
            "severity": severity,
            "features_used": features,
        })


class DemandForecastView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        corridor = request.data.get("corridor", "Mombasa-Nairobi")
        weeks_ahead = min(int(request.data.get("weeks_ahead", 4)), 12)
        forecaster = _get_demand_forecaster()
        forecast = forecaster.predict(corridor, weeks_ahead=weeks_ahead)

        return Response({
            "corridor": corridor,
            "weeks_ahead": weeks_ahead,
            "baseline_weekly": forecaster._baseline.get(corridor),
            "forecast": forecast,
        })


class PricingRecommendationView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        booking = {
            "corridor": request.data.get("corridor", "Mombasa-Nairobi"),
            "commodity": request.data.get("commodity", "general"),
            "weight_tonnes": float(request.data.get("weight_tonnes", 10)),
            "distance_km": float(request.data.get("distance_km", 500)),
            "truck_capacity_pct": float(request.data.get("truck_capacity_pct", 50)),
            "fuel_price_index": float(request.data.get("fuel_price_index", 100)),
            "days_to_pickup": float(request.data.get("days_to_pickup", 3)),
            "available_trucks": int(request.data.get("available_trucks", 10)),
            "pending_shipments": int(request.data.get("pending_shipments", 20)),
            "month": int(request.data.get("month", 6)),
        }
        engine = _get_pricing_engine()
        result = engine.recommend(booking)

        return Response(result)


class TheftRiskView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        context = {
            "corridor": request.data.get("corridor", "Mombasa-Nairobi"),
            "commodity": request.data.get("commodity", "general"),
            "vehicle_type": request.data.get("vehicle_type", "closed"),
            "declared_value_usd": float(request.data.get("declared_value_usd", 10000)),
            "num_stops": int(request.data.get("num_stops", 2)),
            "armed_escort": request.data.get("armed_escort", False),
            "hour_of_day": int(request.data.get("hour_of_day", 12)),
            "is_weekend": request.data.get("is_weekend", False),
            "is_rainy_season": request.data.get("is_rainy_season", False),
            "distance_km": float(request.data.get("distance_km", 500)),
        }
        model = _get_theft_model()
        result = model.predict_risk(context)

        return Response(result)


class DriverScoreView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        single = request.data.get("driver")
        if single:
            result = _get_driver_scorer().score_driver(single)
            return Response(result)

        drivers = request.data.get("drivers", [])
        if drivers:
            results = _get_driver_scorer().score_all(drivers)
            return Response({
                "drivers": results,
                "tier_distribution": _tier_distribution(results),
            })

        return Response({"error": "Provide 'driver' or 'drivers' in request body."}, status=400)


def _tier_distribution(scores: list[dict]) -> dict[str, int]:
    dist: dict[str, int] = {}
    for s in scores:
        tier = s.get("tier", "?")
        dist[tier] = dist.get(tier, 0) + 1
    return dist


class BorderDelayView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        predictor = _get_border_predictor()
        result = predictor.predict(
            border=request.data.get("border", "Namanga"),
            hour=int(request.data.get("hour", 12)),
            weekday=int(request.data.get("weekday", 2)),
            queue_depth=request.data.get("queue_depth"),
            is_weekend=request.data.get("is_weekend", False),
            is_rainy_season=request.data.get("is_rainy_season", False),
            commodity=request.data.get("commodity", "general"),
            is_red_lane=request.data.get("is_red_lane", False),
            month=int(request.data.get("month", 6)),
        )
        return Response(result)


class FuelOptimizeView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        waypoints = request.data.get("waypoints", [])
        vehicle_spec = request.data.get("vehicle", {})
        start_fuel = request.data.get("start_fuel_litres")

        if not waypoints or not vehicle_spec:
            return Response(
                {"error": "Provide 'waypoints' list and 'vehicle' spec."}, status=400,
            )

        optimizer = _get_fuel_optimizer()
        plan = optimizer.optimize(waypoints, vehicle_spec,
                                  start_fuel_litres=start_fuel)

        return Response({
            "route_name": plan.route_name,
            "total_distance_km": plan.total_distance_km,
            "total_fuel_consumed_l": plan.total_fuel_consumed_l,
            "total_cost_usd": plan.total_cost_usd,
            "stops": [
                {
                    "waypoint_index": s.waypoint_index,
                    "location": s.location_name,
                    "country": s.country_code,
                    "litres_to_add": s.litres_to_add,
                    "price_per_litre": s.price_per_litre,
                    "cost_usd": s.cost_usd,
                }
                for s in plan.stops
            ],
            "stops_count": len(plan.stops),
        })


class ContainerMatchView(APIView):
    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        shipments_data = request.data.get("shipments", [])
        if not shipments_data:
            return Response({"error": "Provide 'shipments' list."}, status=400)

        stubs = [
            ShipmentStub(
                shipment_id=s.get("shipment_id", f"S{i}"),
                origin=s.get("origin", ""),
                destination=s.get("destination", ""),
                volume_cbm=float(s.get("volume_cbm", 0)),
                weight_tonnes=float(s.get("weight_tonnes", 0)),
                requires_reefer=s.get("requires_reefer", False),
                latest_pickup=s.get("latest_pickup", ""),
                value_usd=float(s.get("value_usd", 0)),
            )
            for i, s in enumerate(shipments_data)
        ]

        matcher = _get_container_matcher()
        matches = matcher.find_matches(stubs)

        return Response({
            "shipments_count": len(stubs),
            "matches": [
                {
                    "container_type": m.container_type,
                    "shipment_ids": [s.shipment_id for s in m.shipments],
                    "total_volume_cbm": m.total_volume_cbm,
                    "total_weight_tonnes": m.total_weight_tonnes,
                    "utilization_pct": m.utilization_pct,
                    "estimated_savings_usd": m.savings_usd,
                }
                for m in matches
            ],
            "matches_count": len(matches),
        })


class ShipmentPredictionView(APIView):
    """Unified endpoint: returns all predictions for a given shipment context."""

    permission_classes = [IsAuthenticated, CanViewPredictions]

    def post(self, request):
        corridor = request.data.get("corridor", "Mombasa-Nairobi")
        commodity = request.data.get("commodity", "general")
        weight = float(request.data.get("weight_tonnes", 10))
        distance = float(request.data.get("distance_km", 500))
        declared_value = float(request.data.get("declared_value_usd", 10000))
        vehicle_type = request.data.get("vehicle_type", "closed")
        armed_escort = request.data.get("armed_escort", False)
        days_to_pickup = float(request.data.get("days_to_pickup", 3))

        # Delay risk
        theft_context = {
            "corridor": corridor, "commodity": commodity,
            "vehicle_type": vehicle_type, "declared_value_usd": declared_value,
            "armed_escort": armed_escort, "distance_km": distance,
        }
        theft = _get_theft_model().predict_risk(theft_context)

        # Pricing
        pricing = _get_pricing_engine().recommend({
            "corridor": corridor, "commodity": commodity,
            "weight_tonnes": weight, "distance_km": distance,
            "days_to_pickup": days_to_pickup,
            "available_trucks": 10, "pending_shipments": 20,
            "truck_capacity_pct": 50, "fuel_price_index": 100, "month": 6,
        })

        # Border delay estimate (use first known border on corridor)
        border_map = {
            "Mombasa-Nairobi": "Namanga", "Nairobi-Kampala": "Busia",
            "Kampala-Kigali": "Gatuna", "Nairobi-Juba": "Moyale",
        }
        nearest_border = border_map.get(corridor, "Namanga")
        border = _get_border_predictor().predict(border=nearest_border, hour=12)

        return Response({
            "shipment_id": request.data.get("shipment_id"),
            "corridor": corridor,
            "delay_risk": "Not computed",  # needs trained DelayPredictor + feature DF
            "theft_risk": theft,
            "pricing": pricing,
            "nearest_border": border,
        })
