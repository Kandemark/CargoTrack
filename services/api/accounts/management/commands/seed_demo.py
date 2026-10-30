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
from alerts.models import Alert
from shipments.models import Route, Shipment
from shipments.road import fill_route_geometry
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

ALERTS = [
    # tracking number, severity, risk, hours ago, acknowledged, message
    ('CT-DEMO-0005', 'HIGH', 0.78, 20, False,
     'Stuck in traffic on the A109 near Voi. Arrival in Nairobi is likely one to two days late.'),
    ('CT-DEMO-0002', 'HIGH', 0.66, 30, False,
     'Held at Malaba for customs inspection for more than 24 hours.'),
    ('CT-DEMO-0003', 'MEDIUM', 0.6, 5, False,
     'Delay risk is rising for the Nairobi to Kigali run: the queue at Gatuna border is long.'),
    ('CT-DEMO-0001', 'LOW', 0.33, 26, True,
     'Stopped at Mariakani weighbridge longer than planned.'),
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
            # The road path for maps; skipped quietly when the routing server is unreachable.
            fill_route_geometry(route)

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

        now = timezone.now()
        for tracking, severity, risk, hours_ago, acknowledged, message in ALERTS:
            shipment = Shipment.objects.filter(tracking_number=tracking).first()
            if shipment is None or Alert.objects.filter(shipment=shipment, message=message).exists():
                continue
            alert = Alert.objects.create(
                shipment=shipment, message=message, risk_score=risk, severity=severity,
                acknowledged=acknowledged, acknowledged_by=users['amina'] if acknowledged else None,
            )
            # sent_at is set on create; move it back so the list shows a spread of times.
            Alert.objects.filter(pk=alert.pk).update(sent_at=now - timedelta(hours=hours_ago))

        seed_operations(users, orgs, now)

        self.stdout.write(self.style.SUCCESS(
            f'Demo data ready. Sign in as {", ".join(u for u, *_ in USERS)} with password "{DEMO_PASSWORD}".'
        ))


def seed_operations(users, orgs, now):
    """
    Carriers, fleet, money, documents, deliveries, the job board, chat,
    cold chain and notifications, so every screen in the app has data.
    Each record is keyed on a unique field, so running twice changes nothing.
    """
    from decimal import Decimal

    from accounts.models import Notification
    from carriers.models import Carrier, RateCard
    from chats.models import Conversation, Message
    from coldchain.models import ColdChainShipment, TemperatureReading
    from fleet.models import Driver, Truck
    from marketplace.models import Bid, FreightListing
    from payments.models import Invoice
    from pod.models import ProofOfDelivery
    from shipments.models import ComplianceDoc

    org = orgs['Mombasa Freight Ltd']
    today = now.date()
    ships = {s.tracking_number: s for s in Shipment.objects.filter(tracking_number__startswith='CT-DEMO-')}

    kampala, _ = Carrier.objects.get_or_create(code='KH-01', defaults={
        'name': 'Kampala Haulage', 'organization': org, 'contact_name': 'Carol Nakato',
        'phone': '+256 700 000 111', 'email': 'ops@kampalahaulage.example',
        'headquarters': 'Kampala', 'country': 'Uganda', 'on_time_rate': 91.0, 'rating': 4.6,
        'active_shipments': 3, 'total_shipments': 48, 'specialties': ['Containers', 'Transit to Uganda'],
    })
    Carrier.objects.get_or_create(code='RV-02', defaults={
        'name': 'Rift Valley Movers', 'organization': org, 'contact_name': 'Peter Kiprono',
        'phone': '+254 711 000 222', 'headquarters': 'Nakuru', 'on_time_rate': 84.0, 'rating': 4.2,
        'total_shipments': 21, 'specialties': ['Bulk grain', 'Fertiliser'],
    })
    for name, origin, dest, per_kg, per_km, minimum in [
        ('Mombasa to Kampala, containers', 'Mombasa', 'Kampala', '4.20', '95', '180000'),
        ('Mombasa to Nairobi, general', 'Mombasa', 'Nairobi', '2.10', '80', '45000'),
        ('Nairobi to Kigali, general', 'Nairobi', 'Kigali', '4.80', '110', '210000'),
    ]:
        RateCard.objects.get_or_create(carrier=kampala, name=name, defaults={
            'origin': origin, 'destination': dest, 'per_kg': Decimal(per_kg), 'per_km': Decimal(per_km),
            'min_charge': Decimal(minimum), 'valid_from': today - timedelta(days=90),
            'valid_until': today + timedelta(days=275),
        })

    drivers = {}
    for code, first, last, status, route, user in [
        ('DRV-001', 'Brian', 'Otieno', 'ON_ROUTE', 'Mombasa to Nairobi', users['brian']),
        ('DRV-002', 'Joseph', 'Mwangi', 'ON_ROUTE', 'Mombasa to Kampala', None),
        ('DRV-003', 'Grace', 'Achieng', 'AVAILABLE', '', None),
    ]:
        drivers[code], _ = Driver.objects.get_or_create(driver_id=code, defaults={
            'first_name': first, 'last_name': last, 'organization': org, 'user': user, 'status': status,
            'active_route': route, 'license_class': 'CE', 'license_expiry': today + timedelta(days=400),
            'years_experience': 6, 'rating': 4.7, 'on_time_rate': 93.0, 'total_jobs': 140, 'total_km': 98000,
        })
    trucks = {}
    for fleet_id, plate, make, model, status, location, driver in [
        ('TX-101', 'KDA 101A', 'Scania', 'R450', 'ACTIVE', 'Voi', 'DRV-001'),
        ('TX-102', 'KDB 202B', 'Volvo', 'FH16', 'ACTIVE', 'Malaba', 'DRV-002'),
        ('TX-103', 'KDC 303C', 'Mercedes-Benz', 'Actros', 'MAINTENANCE', 'Mombasa depot', None),
    ]:
        trucks[fleet_id], _ = Truck.objects.get_or_create(fleet_id=fleet_id, defaults={
            'plate': plate, 'vin': f'VIN{fleet_id}', 'make': make, 'model': model, 'year': 2021, 'organization': org,
            'status': status, 'payload_tonnes': 28, 'current_location': location, 'odometer_km': 212000,
            'load_pct': 80 if status == 'ACTIVE' else 0, 'assigned_driver': drivers.get(driver),
            'next_service_date': today + timedelta(days=12),
        })
    for tracking, truck, driver in [('CT-DEMO-0005', 'TX-101', 'DRV-001'), ('CT-DEMO-0002', 'TX-102', 'DRV-002')]:
        ship = ships.get(tracking)
        if ship and not ship.assigned_truck_id:
            ship.assigned_truck, ship.assigned_driver = trucks[truck], drivers[driver]
            ship.carrier = kampala if ship.carrier_name == 'Kampala Haulage' else None
            ship.save()

    if not Invoice.objects.filter(shipment__tracking_number__startswith='CT-DEMO-').exists():
        for tracking, amount, status, description in [
            ('CT-DEMO-0004', '86000', 'PAID', 'Dar es Salaam to Nairobi, 9 t'),
            ('CT-DEMO-0001', '64000', 'PENDING', 'Mombasa to Nairobi, 18 t'),
            ('CT-DEMO-0002', '212000', 'PENDING', 'Mombasa to Kampala, 24 t'),
            ('CT-DEMO-0005', '71000', 'FAILED', 'Mombasa to Nairobi, 21 t'),
        ]:
            inv = Invoice(shipment=ships[tracking], amount_kes=Decimal(amount), status=status,
                          description=description, created_by=users['amina'])
            if status == 'PAID':
                inv.paid_at = now - timedelta(days=4)
            inv.save()

    for tracking, doc_type, reference, days, status in [
        ('CT-DEMO-0002', 'DECLARATION', 'KRA-SE-24-11873', 60, 'VALID'),
        ('CT-DEMO-0002', 'CERTIFICATE', 'COMESA-CO-55102', 10, 'EXPIRING'),
        ('CT-DEMO-0003', 'PERMIT', 'RRA-IMP-2291', 120, 'VALID'),
        ('CT-DEMO-0003', 'INSURANCE', '', None, 'MISSING'),
    ]:
        ComplianceDoc.objects.get_or_create(shipment=ships[tracking], doc_type=doc_type, defaults={
            'reference': reference, 'issued_by': 'Kenya Revenue Authority' if doc_type == 'DECLARATION' else '',
            'issued_date': today - timedelta(days=20) if reference else None,
            'expiry_date': today + timedelta(days=days) if days else None, 'status': status,
        })

    delivered = ships.get('CT-DEMO-0004')
    if delivered and not ProofOfDelivery.objects.filter(shipment=delivered).exists():
        ProofOfDelivery.objects.create(
            shipment=delivered, delivered_at=delivered.actual_arrival or now, received_by_name='Daniel Kamau',
            condition='GOOD', notes='Received at Nairobi ICD gate 3.', captured_by=users['amina'],
            location_lat=-1.3195, location_lng=36.9178,
        )

    for origin, dest, cargo, weight, days, budget in [
        ('Mombasa', 'Kampala', 'CONTAINER', 26000, 3, ('190000', '230000')),
        ('Nairobi', 'Juba', 'GENERAL', 14000, 6, ('260000', '320000')),
    ]:
        listing, created = FreightListing.objects.get_or_create(
            posted_by=users['amina'], origin=origin, destination=dest, defaults={
                'cargo_type': cargo, 'weight_kg': weight, 'pickup_date': today + timedelta(days=days),
                'delivery_date': today + timedelta(days=days + 4), 'budget_min': Decimal(budget[0]),
                'budget_max': Decimal(budget[1]), 'description': f'{weight // 1000} t {cargo.lower()} cargo.',
            })
        if created:
            Bid.objects.create(listing=listing, carrier=kampala, amount=Decimal(budget[0]) + 5000,
                               estimated_days=4, notes='Truck available from Mombasa on the pickup date.')

    if not Conversation.objects.filter(subject='CT-DEMO-0002 at Malaba').exists():
        conv = Conversation.objects.create(subject='CT-DEMO-0002 at Malaba', shipment=ships.get('CT-DEMO-0002'),
                                           created_by=users['amina'])
        conv.participants.set([users['amina'], users['carol']])
        for sender, text in [
            ('carol', 'Customs at Malaba have asked for the certificate of origin again.'),
            ('amina', 'Sending it now. Can the driver wait at the yard?'),
            ('carol', 'Yes, Joseph is parked at the yard until clearance.'),
        ]:
            Message.objects.create(conversation=conv, sender=users[sender], content=text)

    pharma = ships.get('CT-DEMO-0003')
    if pharma and not ColdChainShipment.objects.filter(shipment=pharma).exists():
        cold = ColdChainShipment.objects.create(shipment=pharma, product_type='DAIRY', temp_min_c=2, temp_max_c=8,
                                                monitoring_device_id='TLOG-4471')
        for i in range(12):
            TemperatureReading.objects.create(
                coldchain_shipment=cold, device_id='TLOG-4471', timestamp=now - timedelta(hours=11 - i),
                temperature_c=round(4.5 + (i % 5) * 0.6 + (2.4 if i == 8 else 0), 1), humidity_pct=62,
            )

    # Recording the delivery above already notifies Amina; these add the other kinds.
    for ntype, title, message, severity, read in [
        ('PAYMENT', 'Invoice paid', 'The invoice for CT-DEMO-0004 was paid by M-Pesa.', 'INFO', True),
        ('SYSTEM', 'New bid on your listing', 'Kampala Haulage bid on Mombasa to Kampala.', 'MEDIUM', False),
    ]:
        Notification.objects.get_or_create(user=users['amina'], title=title, defaults={
            'type': ntype, 'message': message, 'severity': severity, 'is_read': read,
        })
