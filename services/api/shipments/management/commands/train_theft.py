"""Train the cargo theft risk model on historical incident data."""
from django.core.management.base import BaseCommand

from cargotrack.ml.theft_risk import TheftRiskModel
from shipments.models import Route, Shipment


class Command(BaseCommand):
    help = "Train the cargo theft risk model on historical shipment and incident data."

    def add_arguments(self, parser):
        parser.add_argument("--incidents-file", type=str, help="Path to JSON file with labeled theft incidents")

    def handle(self, **options):
        shipments = Shipment.objects.select_related("route").all().order_by("pk")
        routes = {r.pk: r for r in Route.objects.all()}

        # Build training set from shipments with known outcomes
        incidents = []
        for s in shipments:
            corridor = f"{s.route.origin}-{s.route.destination}" if s.route else "unknown"
            incidents.append({
                "corridor": corridor,
                "commodity": "general",
                "vehicle_type": "closed",
                "declared_value_usd": 10000,
                "num_stops": 2,
                "armed_escort": False,
                "hour_of_day": 12,
                "is_weekend": False,
                "is_rainy_season": False,
                "distance_km": float(s.route.distance_km) if s.route else 500,
                "occurred": s.status == "DELAYED",  # proxy label
            })

        if options.get("incidents_file"):
            import json
            with open(options["incidents_file"]) as f:
                incidents = json.load(f)

        if len(incidents) < 10:
            self.stdout.write(self.style.WARNING("Not enough incidents to train theft risk model (need 10+)."))
            return

        model = TheftRiskModel()
        model.fit(incidents)
        model.save()

        self.stdout.write(self.style.SUCCESS(f"Theft risk model trained on {len(incidents)} incidents."))
