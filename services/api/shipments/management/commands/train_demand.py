"""Train the demand forecasting model on historical shipment data."""
from django.core.management.base import BaseCommand

from cargotrack.ml.demand_forecaster import DemandForecaster
from shipments.models import Shipment


class Command(BaseCommand):
    help = "Train the demand forecasting model on historical shipments."

    def handle(self, **options):
        shipments = list(Shipment.objects.select_related("route").all().order_by("created_at"))
        if len(shipments) < 10:
            self.stdout.write(self.style.WARNING("Not enough shipments to train demand model (need 10+)."))
            return

        forecaster = DemandForecaster()
        forecaster.fit(shipments)
        forecaster.save()

        # Show a sample forecast
        for corr in forecaster._corridors[:5]:
            f = forecaster.predict(corr, weeks_ahead=2)
            self.stdout.write(f"  {corr}: {f[0]['predicted_volume']} shipments/week")

        self.stdout.write(self.style.SUCCESS(f"Demand model trained on {len(shipments)} shipments across {len(forecaster._corridors)} corridors."))
