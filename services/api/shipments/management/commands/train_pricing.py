"""Train the dynamic pricing model on historical booking data."""
import json

from django.core.management.base import BaseCommand

from cargotrack.ml.dynamic_pricing import DynamicPricingEngine
from payments.models import Invoice
from shipments.models import Route, Shipment


class Command(BaseCommand):
    help = "Train the dynamic pricing model on historical invoice and shipment data."

    def add_arguments(self, parser):
        parser.add_argument("--bookings-file", type=str, help="Path to JSON file with historical booking prices")

    def handle(self, **options):
        shipments = Shipment.objects.select_related("route").all().order_by("pk")
        invoices = {i.shipment_id: i for i in Invoice.objects.filter(status="PAID")}

        bookings = []
        for s in shipments:
            corridor = f"{s.route.origin}-{s.route.destination}" if s.route else "unknown"
            invoice = invoices.get(s.pk)
            booking = {
                "corridor": corridor,
                "commodity": "general",
                "weight_tonnes": float(s.weight_kg or 10000) / 1000,
                "distance_km": float(s.route.distance_km) if s.route else 500,
                "truck_capacity_pct": 60.0,
                "fuel_price_index": 100.0,
                "days_to_pickup": 3.0,
                "available_trucks": 10,
                "pending_shipments": 20,
                "month": float(s.created_at.month) if s.created_at else 6,
                "final_price_usd": float(invoice.amount_kes) / 130 if invoice else 1200.0,
            }
            bookings.append(booking)

        if options.get("bookings_file"):
            with open(options["bookings_file"]) as f:
                bookings = json.load(f)

        if len(bookings) < 15:
            self.stdout.write(self.style.WARNING("Not enough bookings to train pricing model (need 15+)."))
            return

        engine = DynamicPricingEngine()
        engine.fit(bookings)
        engine.save()

        # Show sample recommendations
        for b in bookings[:3]:
            r = engine.recommend(b)
            self.stdout.write(f"  {b['corridor']}: ${r['recommended_price_usd']}")

        self.stdout.write(self.style.SUCCESS(f"Pricing model trained on {len(bookings)} bookings."))
