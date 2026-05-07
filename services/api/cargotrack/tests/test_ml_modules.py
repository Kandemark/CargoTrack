"""Smoke tests for ML module imports and predictions — no database needed."""
from django.test import SimpleTestCase


class MLModuleImportTests(SimpleTestCase):
    def test_all_modules_importable(self):
        from cargotrack.ml.demand_forecaster import DemandForecaster
        from cargotrack.ml.dynamic_pricing import DynamicPricingEngine
        from cargotrack.ml.theft_risk import TheftRiskModel
        from cargotrack.ml.driver_scoring import DriverScoringEngine
        from cargotrack.ml.border_delay import BorderDelayPredictor
        from cargotrack.ml.fuel_optimizer import FuelOptimizer
        from cargotrack.ml.container_matching import ContainerMatcher
        self.assertTrue(all([
            DemandForecaster, DynamicPricingEngine, TheftRiskModel,
            DriverScoringEngine, BorderDelayPredictor, FuelOptimizer, ContainerMatcher,
        ]))


class DemandForecasterTests(SimpleTestCase):
    def test_predict_returns_forecast(self):
        from cargotrack.ml.demand_forecaster import DemandForecaster
        df = DemandForecaster()
        result = df.predict("Mombasa-Nairobi", weeks_ahead=1)
        self.assertEqual(len(result), 1)
        self.assertIn("predicted_volume", result[0])
        self.assertGreaterEqual(result[0]["predicted_volume"], 0)

    def test_predict_multiple_weeks(self):
        from cargotrack.ml.demand_forecaster import DemandForecaster
        df = DemandForecaster()
        result = df.predict("Nairobi-Kampala", weeks_ahead=4)
        self.assertEqual(len(result), 4)


class DynamicPricingTests(SimpleTestCase):
    def test_recommend_returns_price(self):
        from cargotrack.ml.dynamic_pricing import DynamicPricingEngine
        dp = DynamicPricingEngine()
        r = dp.recommend({
            "corridor": "Mombasa-Nairobi", "commodity": "general",
            "weight_tonnes": 20, "distance_km": 500,
        })
        self.assertIn("recommended_price_usd", r)
        self.assertGreater(r["recommended_price_usd"], 0)
        self.assertIn("min_price_usd", r)
        self.assertIn("max_price_usd", r)

    def test_urgent_shipment_surcharge(self):
        from cargotrack.ml.dynamic_pricing import DynamicPricingEngine
        dp = DynamicPricingEngine()
        normal = dp.recommend({
            "corridor": "Mombasa-Nairobi", "commodity": "general",
            "weight_tonnes": 20, "distance_km": 500, "days_to_pickup": 7,
        })
        urgent = dp.recommend({
            "corridor": "Mombasa-Nairobi", "commodity": "general",
            "weight_tonnes": 20, "distance_km": 500, "days_to_pickup": 1,
        })
        self.assertGreaterEqual(urgent["recommended_price_usd"], normal["recommended_price_usd"])


class TheftRiskTests(SimpleTestCase):
    def test_high_risk_route(self):
        from cargotrack.ml.theft_risk import TheftRiskModel
        tr = TheftRiskModel()
        risk = tr.predict_risk({
            "corridor": "Nairobi-Moyale", "commodity": "electronics",
            "vehicle_type": "open", "armed_escort": False,
            "declared_value_usd": 80000,
        })
        self.assertIn("risk_level", risk)
        self.assertIn(risk["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertGreaterEqual(risk["risk_score"], 0)

    def test_low_risk_shipment(self):
        from cargotrack.ml.theft_risk import TheftRiskModel
        tr = TheftRiskModel()
        risk = tr.predict_risk({
            "corridor": "Nairobi-Nakuru", "commodity": "construction",
            "vehicle_type": "closed", "armed_escort": True,
            "declared_value_usd": 5000,
        })
        self.assertIn(risk["risk_level"], ["LOW", "MEDIUM"])


class DriverScoringTests(SimpleTestCase):
    def test_elite_driver(self):
        from cargotrack.ml.driver_scoring import DriverScoringEngine
        ds = DriverScoringEngine()
        score = ds.score_driver({
            "driver_id": "DRV-ELITE", "on_time_rate": 98, "safety_score": 95,
            "fuel_efficiency": 110, "customer_rating": 4.9,
            "idle_time_pct": 5, "route_compliance": 97, "total_jobs": 300,
        })
        self.assertEqual(score["tier"], "ELITE")
        self.assertGreaterEqual(score["composite_score"], 90)

    def test_developing_driver(self):
        from cargotrack.ml.driver_scoring import DriverScoringEngine
        ds = DriverScoringEngine()
        score = ds.score_driver({
            "driver_id": "DRV-NEW", "on_time_rate": 60, "safety_score": 50,
            "fuel_efficiency": 70, "customer_rating": 2.5,
            "idle_time_pct": 25, "route_compliance": 55, "total_jobs": 10,
        })
        self.assertEqual(score["tier"], "D")


class BorderDelayTests(SimpleTestCase):
    def test_predict_returns_estimate(self):
        from cargotrack.ml.border_delay import BorderDelayPredictor
        bd = BorderDelayPredictor()
        est = bd.predict(border="Namanga", hour=14, is_weekend=False)
        self.assertIn("predicted_wait_hours", est)
        self.assertGreater(est["predicted_wait_hours"], 0)
        self.assertIn("border", est)

    def test_weekend_delay_longer(self):
        from cargotrack.ml.border_delay import BorderDelayPredictor
        bd = BorderDelayPredictor()
        weekday = bd.predict(border="Busia", hour=14, is_weekend=False)
        weekend = bd.predict(border="Busia", hour=14, is_weekend=True)
        self.assertGreaterEqual(weekend["predicted_wait_hours"], weekday["predicted_wait_hours"])


class FuelOptimizerTests(SimpleTestCase):
    def test_optimize_simple_route(self):
        from cargotrack.ml.fuel_optimizer import FuelOptimizer
        fo = FuelOptimizer()
        plan = fo.optimize(
            [
                {"name": "A", "country_code": "KE", "distance_from_prev_km": 0},
                {"name": "B", "country_code": "KE", "distance_from_prev_km": 500},
            ],
            {"fuel_capacity_litres": 400, "consumption_l_per_100km": 35.0},
        )
        self.assertGreater(plan.total_distance_km, 0)
        self.assertGreater(plan.total_fuel_consumed_l, 0)


class ContainerMatchingTests(SimpleTestCase):
    def test_two_shipment_consolidation(self):
        from cargotrack.ml.container_matching import ContainerMatcher, ShipmentStub
        cm = ContainerMatcher()
        stubs = [
            ShipmentStub("S1", "Mombasa", "Nairobi", 12, 8),
            ShipmentStub("S2", "Mombasa", "Nairobi", 15, 6),
        ]
        matches = cm.find_matches(stubs)
        self.assertIsInstance(matches, list)

    def test_single_shipment_no_match(self):
        from cargotrack.ml.container_matching import ContainerMatcher, ShipmentStub
        cm = ContainerMatcher()
        stubs = [ShipmentStub("S1", "Mombasa", "Kampala", 12, 8)]
        matches = cm.find_matches(stubs)
        self.assertEqual(len(matches), 0)
