"""
shipments/management/commands/seed_data.py

Management command that populates the database with realistic East African
logistics test data: routes, users, shipments, tracking events, and alerts.

Usage:
    python manage.py seed_data
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

import datetime

User = get_user_model()


# ── Constants ─────────────────────────────────────────────────────────────────

ROUTES = [
    ("Mombasa",  "Nairobi",       480,  8),
    ("Nairobi",  "Kampala",       670, 12),
    ("Nairobi",  "Dar es Salaam", 850, 14),
    ("Mombasa",  "Kisumu",        560, 10),
    ("Kampala",  "Kigali",        510,  9),
]

CARRIERS = [
    "Kenya Transport Ltd",
    "East Africa Freight",
    "Kampala Express",
    "Swahili Cargo Co",
    "Rift Valley Haulage",
    "Lake Victoria Logistics",
    "Nairobi Fast Freight",
]

STATUSES = ["PENDING", "IN_TRANSIT", "CUSTOMS", "DELIVERED", "DELAYED"]

# Event types that make sense per shipment status
STATUS_EVENT_MAP = {
    "PENDING":    ["NOTE",         "DEPARTURE"],
    "IN_TRANSIT": ["DEPARTURE",    "CHECKPOINT", "CHECKPOINT"],
    "CUSTOMS":    ["DEPARTURE",    "CHECKPOINT", "CUSTOMS_ENTRY"],
    "DELIVERED":  ["DEPARTURE",    "CHECKPOINT", "CUSTOMS_CLEAR", "ARRIVAL"],
    "DELAYED":    ["DEPARTURE",    "CHECKPOINT", "DELAY",         "NOTE"],
}

LOCATIONS = [
    "Mombasa Port", "Nairobi Warehouse", "Kampala Depot", "Kigali Hub",
    "Dar es Salaam Terminal", "Kisumu Gate", "Eldoret Checkpoint",
    "Nakuru Weighbridge", "Busia Border Post", "Malaba Crossing",
]


class Command(BaseCommand):
    help = "Seed the database with realistic East African logistics test data"

    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO("=" * 55))
        self.stdout.write(self.style.HTTP_INFO("  CargoTrack — Seeding Test Data"))
        self.stdout.write(self.style.HTTP_INFO("=" * 55))

        routes    = self._create_routes()
        users     = self._create_users()
        shipments = self._create_shipments(routes)
        self._create_tracking_events(shipments)
        self._create_alerts(shipments)

        self.stdout.write(self.style.HTTP_INFO("=" * 55))
        self.stdout.write(self.style.SUCCESS("Seeding complete."))

    # ── Step 1: Routes ────────────────────────────────────────────────────────

    def _create_routes(self):
        from shipments.models import Route

        self.stdout.write("\n[1/4] Routes")
        routes = []
        for origin, destination, distance_km, estimated_hours in ROUTES:
            route, created = Route.objects.get_or_create(
                origin=origin,
                destination=destination,
                defaults={
                    "distance_km":     distance_km,
                    "estimated_hours": estimated_hours,
                },
            )
            status = "created" if created else "exists "
            self.stdout.write(
                f"  {status}  {origin:<10} -> {destination:<16} "
                f"{distance_km:>4} km  {estimated_hours:>2} h"
            )
            routes.append(route)

        self.stdout.write(self.style.SUCCESS(f"  {len(routes)} routes ready."))
        return routes

    # ── Step 2: Users ─────────────────────────────────────────────────────────

    def _create_users(self):
        self.stdout.write("\n[2/4] Users")
        users = {}

        # (username, email, full_name, CustomUser.Role value)
        specs = [
            ("manager1", "manager1@cargotrack.dev", "Manager One", "LOGISTICS_MGR"),
            ("client1",  "client1@cargotrack.dev",  "Client One",  "CLIENT"),
        ]

        for username, email, full_name, role in specs:
            first, last = full_name.split(" ", 1)
            if User.objects.filter(username=username).exists():
                user = User.objects.get(username=username)
                self.stdout.write(f"  exists   {username} ({role})")
            else:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password="cargotrack2026",
                    first_name=first,
                    last_name=last,
                    role=role,
                )
                self.stdout.write(
                    self.style.SUCCESS(f"  created  {username} ({role})")
                )
            users[role] = user

        return users

    # ── Step 3: Shipments ─────────────────────────────────────────────────────

    def _create_shipments(self, routes):
        from shipments.models import Shipment

        self.stdout.write("\n[3/4] Shipments")

        # Base departure: 2026-03-01 06:00 UTC  (spread across Mar–May 2026)
        base_dt = datetime.datetime(2026, 3, 1, 6, 0, tzinfo=datetime.timezone.utc)

        shipments = []
        for i in range(20):
            route        = routes[i % len(routes)]
            carrier      = CARRIERS[i % len(CARRIERS)]
            status       = STATUSES[i % len(STATUSES)]
            weight_kg    = 200 + (i * 173) % 4800   # 200–5000 kg, deterministic
            # Spread departures: one every ~3.6 days across Mar–May
            departure    = base_dt + datetime.timedelta(days=i * 3, hours=i % 12)
            arrival_sched = departure + datetime.timedelta(hours=route.estimated_hours)

            # Actual times for completed/delayed shipments
            actual_dep  = departure + datetime.timedelta(hours=i % 3)
            actual_arr  = None
            if status in ("DELIVERED", "DELAYED"):
                delay_h     = (i % 5) * 2          # 0, 2, 4, 6, or 8 h delay
                actual_arr  = arrival_sched + datetime.timedelta(hours=delay_h)

            # Risk score: weight-based + deterministic offset
            risk_offset   = ((i * 37) % 100) / 200   # 0.00–0.495
            risk_score    = round(min((weight_kg / 5000) + risk_offset, 1.0), 3)

            tracking_num  = f"CT-{(1000 + i):04d}"

            shipment, created = Shipment.objects.get_or_create(
                tracking_number=tracking_num,
                defaults={
                    "route":               route,
                    "status":              status,
                    "carrier_name":        carrier,
                    "weight_kg":           weight_kg,
                    "scheduled_departure": departure,
                    "scheduled_arrival":   arrival_sched,
                    "actual_departure":    actual_dep,
                    "actual_arrival":      actual_arr,
                    "delay_risk_score":    risk_score,
                },
            )
            flag = "created" if created else "exists "
            self.stdout.write(
                f"  {flag}  {tracking_num}  {status:<10}  "
                f"{carrier:<26}  {weight_kg:>4} kg  risk={risk_score:.3f}"
            )
            shipments.append(shipment)

        self.stdout.write(self.style.SUCCESS(f"  {len(shipments)} shipments ready."))
        return shipments

    # ── Step 4: Tracking Events ───────────────────────────────────────────────

    def _create_tracking_events(self, shipments):
        from tracking.models import TrackingEvent

        self.stdout.write("\n[4/4] Tracking Events")
        total = 0

        for i, shipment in enumerate(shipments):
            event_types = STATUS_EVENT_MAP.get(shipment.status, ["NOTE", "CHECKPOINT"])

            # Skip if events already exist for this shipment
            if TrackingEvent.objects.filter(shipment=shipment).exists():
                continue

            for j, etype in enumerate(event_types):
                ts = shipment.scheduled_departure + datetime.timedelta(
                    hours=j * (shipment.route.estimated_hours / max(len(event_types), 1))
                )
                location = LOCATIONS[(i + j) % len(LOCATIONS)]
                TrackingEvent.objects.create(
                    shipment=shipment,
                    event_type=etype,
                    location=location,
                    timestamp=ts,
                    notes=f"Auto-seeded event {j + 1} of {len(event_types)}",
                )
                total += 1

        self.stdout.write(self.style.SUCCESS(f"  {total} tracking events created."))

    # ── Step 5: Alerts ────────────────────────────────────────────────────────

    def _create_alerts(self, shipments):
        from alerts.models import Alert

        self.stdout.write("\n[5/5] Alerts  (risk_score > 0.7)")
        total = 0

        for shipment in shipments:
            if shipment.delay_risk_score <= 0.7:
                continue
            if Alert.objects.filter(shipment=shipment).exists():
                continue

            severity = "CRITICAL" if shipment.delay_risk_score >= 0.85 else "HIGH"
            Alert.objects.create(
                shipment=shipment,
                message=(
                    f"Shipment {shipment.tracking_number} has elevated delay risk "
                    f"({shipment.delay_risk_score:.1%}). "
                    f"Route: {shipment.route}. Carrier: {shipment.carrier_name}."
                ),
                risk_score=shipment.delay_risk_score,
                severity=severity,
            )
            self.stdout.write(
                f"  alert    {shipment.tracking_number}  "
                f"{severity:<8}  risk={shipment.delay_risk_score:.3f}"
            )
            total += 1

        if total == 0:
            self.stdout.write("  (no shipments exceeded the 0.7 threshold)")
        self.stdout.write(self.style.SUCCESS(f"  {total} alerts created."))
