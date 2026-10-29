"""
Django management command: fill a development database with demo data.

    python manage.py seed_demo

Creates two companies, four users (password: DEMO_PASSWORD below) and a
few shipments in different states, so every screen of the app has
something to show. Safe to run more than once. Refuses to run unless
DEBUG is on: it must never touch a real database.
"""
import random
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import CustomUser, Organization
from shipments.models import Route, Shipment
from tracking.models import TrackingEvent

DEMO_PASSWORD = 'cargotrack-demo'

USERS = [
    # username, first, last, role, organisation
    ('amina', 'Amina', 'Wanjiru', 'LOGISTICS_MGR', 'Mombasa Freight Ltd'),
    ('brian', 'Brian', 'Otieno', 'DRIVER', 'Mombasa Freight Ltd'),
    ('carol', 'Carol', 'Nakato', 'CARRIER', 'Kampala Haulage'),
    ('owner', 'Platform', 'Owner', 'PLATFORM_OWNER', 'CargoTrack'),
]

ORG_TYPES = {
    'Mombasa Freight Ltd': 'FREIGHT_FORWARDER',
    'Kampala Haulage': 'CARRIER_COMPANY',
    'CargoTrack': 'FREIGHT_FORWARDER',
}

ROUTES = [
    ('Mombasa', 'Nairobi', 485, 10),
    ('Mombasa', 'Kampala', 1150, 30),
    ('Nairobi', 'Kigali', 1300, 36),
    ('Dar es Salaam', 'Nairobi', 870, 22),
]

SHIPMENTS = [
    # route index, status, carrier, weight, departure offset (days), events
    (0, 'IN_TRANSIT', 'Kampala Haulage', 18000, -1, [('DEPARTURE', 'Mombasa Port'), ('CHECKPOINT', 'Mariakani weighbridge')]),
    (1, 'CUSTOMS', 'Kampala Haulage', 24000, -3, [('DEPARTURE', 'Mombasa Port'), ('CHECKPOINT', 'Nairobi'), ('CUSTOMS_ENTRY', 'Malaba border')]),
    (2, 'PENDING', 'Kampala Haulage', 12500, 2, []),
    (3, 'DELIVERED', 'Mombasa Freight Ltd', 9000, -6, [('DEPARTURE', 'Dar es Salaam'), ('CHECKPOINT', 'Namanga border'), ('ARRIVAL', 'Nairobi ICD')]),
    (0, 'DELAYED', 'Mombasa Freight Ltd', 21000, -2, [('DEPARTURE', 'Mombasa Port'), ('DELAY', 'Voi: traffic jam on A109')]),
]


class Command(BaseCommand):
    help = 'Fill a development database with demo companies, users and shipments.'

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('seed_demo only runs with DEBUG=True; it must never touch a real database.')

        orgs = {}
        for name, org_type in ORG_TYPES.items():
            orgs[name], _ = Organization.objects.get_or_create(name=name, defaults={'org_type': org_type})

        users = {}
        for username, first, last, role, org in USERS:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': first, 'last_name': last, 'email': f'{username}@demo.cargotrack.example',
                    'role': role, 'organization': orgs[org], 'onboarding_completed': True,
                },
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
            users[username] = user

        routes = []
        for origin, destination, km, hours in ROUTES:
            route, _ = Route.objects.get_or_create(
                origin=origin, destination=destination,
                defaults={'distance_km': km, 'estimated_hours': hours},
            )
            routes.append(route)

        if not Shipment.objects.filter(client=users['amina']).exists():
            now = timezone.now()
            rng = random.Random(7)
            for i, (route_i, status, carrier, weight, offset, events) in enumerate(SHIPMENTS, start=1):
                route = routes[route_i]
                departure = now + timedelta(days=offset)
                shipment = Shipment.objects.create(
                    tracking_number=f'CT-DEMO-{i:04d}', route=route, status=status, carrier_name=carrier,
                    weight_kg=weight, client=users['amina'],
                    scheduled_departure=departure,
                    scheduled_arrival=departure + timedelta(hours=route.estimated_hours + 6),
                    actual_departure=departure if offset < 0 else None,
                    actual_arrival=departure + timedelta(hours=route.estimated_hours) if status == 'DELIVERED' else None,
                    delay_risk_score=round(rng.uniform(0.05, 0.9), 2),
                )
                for j, (event_type, location) in enumerate(events):
                    TrackingEvent.objects.create(
                        shipment=shipment, event_type=event_type, location=location,
                        timestamp=departure + timedelta(hours=j * 6), recorded_by=users['amina'],
                    )

        self.stdout.write(self.style.SUCCESS(
            f'Demo data ready. Sign in as {", ".join(u for u, *_ in USERS)} with password "{DEMO_PASSWORD}".'
        ))
