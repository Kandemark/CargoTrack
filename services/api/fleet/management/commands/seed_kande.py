"""
Seed Kande Farms company with full operational data across all domains.
Creates one user per role, then populates routes, carriers, drivers, trucks,
shipments, tracking events, invoices, payments, alerts, and documents.

Safe to run multiple times (clears Kande seed data first).
"""
import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import Organization
from alerts.models import Alert
from carriers.models import Carrier
from fleet.models import Driver, Truck
from payments.models import Invoice, Payment
from shipments.models import Route, Shipment
from tracking.models import TrackingEvent

User = get_user_model()

KANDE_ORG = "Kande Farms"
KANDE_SLUG = "kande-farms"
PASSWORD = "demo123"

# (username, email, first_name, last_name, phone, role)
USER_DEFS = [
    ("admin",            "admin@kandefarms.co.ke",         "David",    "Mwangi",     "+254722100100", "ADMIN"),
    ("jane.muthoni",     "jane.muthoni@kandefarms.co.ke",  "Jane",     "Muthoni",    "+254711200200", "LOGISTICS_MGR"),
    ("grace.wanjiku",    "grace.wanjiku@kandefarms.co.ke", "Grace",    "Wanjiku",    "+254744400400", "CLIENT"),
    ("john.otieno",      "john.otieno@kandefarms.co.ke",   "John",     "Otieno",     "+254777700700", "CARRIER"),
    ("peter.ochieng",    "peter.ochieng@kandefarms.co.ke", "Peter",    "Ochieng",    "+254733300300", "DISPATCHER"),
    ("sarah.chebet",     "sarah.chebet@kandefarms.co.ke",  "Sarah",    "Chebet",     "+254700111222", "CUSTOMS_BROKER"),
    ("james.njoroge",    "james.njoroge@kandefarms.co.ke", "James",    "Njoroge",    "+254700222333", "WAREHOUSE_MGR"),
    ("linda.wambui",     "linda.wambui@kandefarms.co.ke",  "Linda",    "Wambui",     "+254700333444", "PORT_AGENT"),
    ("kevin.kiprotich",  "kevin.kiprotich@kandefarms.co.ke","Kevin",   "Kiprotich",  "+254700444555", "FINANCE_OFFICER"),
]

# ── Real East African route corridors ────────────────────────────────────────

ROUTE_DEFS = [
    ("Nairobi", "Mombasa", 485, 10),
    ("Mombasa", "Nairobi", 485, 10),
    ("Nairobi", "Kisumu", 350, 7),
    ("Kisumu", "Nairobi", 350, 7),
    ("Nairobi", "Eldoret", 310, 6),
    ("Eldoret", "Nairobi", 310, 6),
    ("Nairobi", "Nakuru", 160, 3.5),
    ("Nakuru", "Nairobi", 160, 3.5),
    ("Mombasa", "Kampala", 1140, 22),
    ("Kampala", "Mombasa", 1140, 22),
    ("Nairobi", "Arusha", 270, 5.5),
    ("Arusha", "Nairobi", 270, 5.5),
    ("Mombasa", "Dar es Salaam", 510, 11),
    ("Dar es Salaam", "Mombasa", 510, 11),
    ("Nairobi", "Kigali", 1220, 24),
    ("Kigali", "Nairobi", 1220, 24),
    ("Mombasa", "Juba", 1720, 34),
    ("Nairobi", "Malaba", 440, 9),
    ("Kisumu", "Kampala", 350, 8),
    ("Nakuru", "Eldoret", 155, 3),
]

# ── Carrier pool ──────────────────────────────────────────────────────────────

CARRIER_DEFS = [
    ("CR-001", "Kande Logistics",       "ACTIVE", "James Kiprono",   "+254722500100", "kenya",   "Nairobi"),
    ("CR-002", "Mombasa Road Express",   "ACTIVE", "Amina Hassan",    "+254723600200", "kenya",   "Mombasa"),
    ("CR-003", "Great Lakes Freight",    "ACTIVE", "Patrick Ndayizeye","+256775300300","uganda",  "Kampala"),
    ("CR-004", "Serengeti Carriers",     "ACTIVE", "Joseph Mwakyusa", "+255784400400", "tanzania","Dar es Salaam"),
    ("CR-005", "Highland Hauliers",      "ACTIVE", "Ruth Wanjiku",    "+254725500500", "kenya",   "Eldoret"),
    ("CR-006", "Lake Region Transport",  "ACTIVE", "David Okello",   "+256776600600", "uganda",  "Jinja"),
    ("CR-007", "Kilimanjaro Express",    "SUSPENDED", "Grace Tarimo", "+255787700700", "tanzania","Arusha"),
    ("CR-008", "Coastline Movers",       "ACTIVE", "Hassan Omar",     "+254728800800", "kenya",   "Malindi"),
]

# ── Truck pool ────────────────────────────────────────────────────────────────

TRUCK_DEFS = [
    # (fleet_id, make, model, year, plate, vin, fuel, payload, odo, location)
    ("TX-101", "Isuzu",    "FRR",        2022, "KCB 001A", "VIN-KF-101", "DIESEL", 8.0,  128000, "Nairobi"),
    ("TX-102", "Isuzu",    "NQR",        2021, "KCB 002A", "VIN-KF-102", "DIESEL", 6.5,  195000, "Mombasa"),
    ("TX-103", "Mitsubishi","Canter",    2023, "KCB 003A", "VIN-KF-103", "DIESEL", 5.0,  87000,  "Nakuru"),
    ("TX-104", "Mercedes", "Actros",     2023, "KCB 004A", "VIN-KF-104", "DIESEL", 25.0, 142000, "Nairobi"),
    ("TX-105", "MAN",      "TGX",        2022, "KCB 005A", "VIN-KF-105", "DIESEL", 22.0, 168000, "Eldoret"),
    ("TX-106", "Volvo",    "FH16",       2023, "KCB 006A", "VIN-KF-106", "DIESEL", 28.0, 95000,  "Kisumu"),
    ("TX-107", "Scania",   "R450",       2022, "KCB 007A", "VIN-KF-107", "DIESEL", 20.0, 201000, "Nairobi"),
    ("TX-108", "Toyota",   "Dyna",       2021, "KCB 008A", "VIN-KF-108", "DIESEL", 3.5,  76000,  "Nairobi"),
]

# ── Driver pool ───────────────────────────────────────────────────────────────

DRIVER_DEFS = [
    ("DRV-001", "Samuel",   "Mutua",     "+254711801001", "CE", 8,  4.8, "Nairobi → Mombasa"),
    ("DRV-002", "Faith",    "Njeri",     "+254712802002", "CE", 6,  4.9, "Mombasa → Nairobi"),
    ("DRV-003", "Daniel",   "Otieno",    "+254713803003", "CE", 10, 4.7, "Nairobi → Kisumu"),
    ("DRV-004", "Alice",    "Muthoni",   "+254714804004", "C",  5,  4.6, "Kisumu → Nairobi"),
    ("DRV-005", "Joseph",   "Mwangi",    "+254715805005", "CE", 12, 4.9, "Nairobi → Kampala"),
    ("DRV-006", "Esther",   "Wairimu",   "+254716806006", "B",  4,  4.5, "Nakuru → Eldoret"),
    ("DRV-007", "Moses",    "Kipchoge",  "+254717807007", "CE", 15, 4.8, "Mombasa → Kampala"),
    ("DRV-008", "Hannah",   "Cherotich", "+254718808008", "CE", 7,  4.7, "Nairobi → Arusha"),
    ("DRV-009", "David",    "Omondi",    "+254719809009", "C",  9,  4.6, "Eldoret → Nairobi"),
    ("DRV-010", "Paul",     "Njenga",    "+254720810010", "CE", 11, 4.8, "Nairobi → Kigali"),
    ("DRV-011", "Lydia",    "Anyango",   "+254721811011", "CE", 6,  4.5, "Kisumu → Kampala"),
    ("DRV-012", "Michael",  "Korir",     "+254722812012", "CE", 8,  4.7, "Mombasa → Dar es Salaam"),
]

# ── Shipment pool (genres: produce, construction, fuel, consumer goods, etc.) ─

SHIPMENT_DEFS = [
    # (tracking_number, route_idx, status, weight_kg, carrier_idx, delay_risk)
    # IN_TRANSIT — active shipments
    ("CT-20260501-001", 0,  "IN_TRANSIT", 8500,  0, 0.12),   # Nairobi → Mombasa
    ("CT-20260501-002", 2,  "IN_TRANSIT", 4200,  2, 0.08),   # Nairobi → Kisumu
    ("CT-20260501-003", 8,  "IN_TRANSIT", 12000, 3, 0.22),   # Mombasa → Kampala
    ("CT-20260502-004", 4,  "IN_TRANSIT", 6300,  4, 0.15),   # Nairobi → Eldoret
    ("CT-20260502-005", 12, "IN_TRANSIT", 15000, 5, 0.35),   # Mombasa → Dar
    ("CT-20260502-006", 17, "IN_TRANSIT", 3700,  1, 0.05),   # Nairobi → Malaba
    ("CT-20260503-007", 18, "IN_TRANSIT", 5800,  5, 0.18),   # Kisumu → Kampala
    ("CT-20260503-008", 6,  "IN_TRANSIT", 9100,  0, 0.28),   # Nairobi → Nakuru
    ("CT-20260504-009", 14, "IN_TRANSIT", 22000, 2, 0.42),   # Nairobi → Kigali
    ("CT-20260504-010", 10, "IN_TRANSIT", 4800,  3, 0.10),   # Nairobi → Arusha
    # AT_CUSTOMS
    ("CT-20260428-011", 1,  "AT_CUSTOMS", 5600,  1, 0.32),   # Mombasa → Nairobi
    ("CT-20260429-012", 3,  "AT_CUSTOMS", 3400,  5, 0.25),   # Kisumu → Nairobi
    ("CT-20260429-013", 13, "AT_CUSTOMS", 18000, 3, 0.45),   # Dar → Mombasa
    ("CT-20260430-014", 0,  "AT_CUSTOMS", 7800,  0, 0.20),   # Nairobi → Mombasa
    # DELIVERED
    ("CT-20260420-015", 1,  "DELIVERED",  5200,  1, 0.0),
    ("CT-20260421-016", 7,  "DELIVERED",  3800,  4, 0.0),
    ("CT-20260422-017", 2,  "DELIVERED",  9200,  2, 0.0),
    ("CT-20260422-018", 4,  "DELIVERED",  11000, 0, 0.0),
    ("CT-20260423-019", 6,  "DELIVERED",  4500,  5, 0.0),
    ("CT-20260424-020", 16, "DELIVERED",  16000, 3, 0.0),
    ("CT-20260425-021", 5,  "DELIVERED",  6700,  1, 0.0),
    ("CT-20260426-022", 19, "DELIVERED",  3500,  4, 0.0),
    # DELAYED
    ("CT-20260424-023", 8,  "DELAYED",    10500, 2, 0.78),   # Mombasa → Kampala
    ("CT-20260425-024", 10, "DELAYED",    7200,  3, 0.85),   # Nairobi → Arusha
    ("CT-20260426-025", 0,  "DELAYED",    8900,  0, 0.65),   # Nairobi → Mombasa
    # PENDING
    ("CT-20260505-026", 1,  "PENDING",    6100,  None, 0.0),
    ("CT-20260505-027", 3,  "PENDING",    4300,  None, 0.0),
    ("CT-20260505-028", 9,  "PENDING",    14500, None, 0.0),
    ("CT-20260506-029", 11, "PENDING",    3800,  None, 0.0),
    ("CT-20260506-030", 14, "PENDING",    25000, None, 0.0),
    ("CT-20260507-031", 15, "PENDING",    5200,  None, 0.0),
    ("CT-20260507-032", 5,  "PENDING",    7800,  None, 0.0),
    ("CT-20260508-033", 18, "PENDING",    4600,  None, 0.0),
    ("CT-20260508-034", 2,  "PENDING",    11200, None, 0.0),
    ("CT-20260509-035", 7,  "PENDING",    3600,  None, 0.0),
]

# ── Invoice pool (linked to shipments by index in SHIPMENT_DEFS) ─────────────

INVOICE_DEFS = [
    # (shipment_idx, amount_kes, status, description)
    (14, 145000, "PAID",    "Maize delivery Nairobi → Mombasa — 20ft container"),
    (15, 89000,  "PAID",    "Tea export Nakuru → Nairobi — loose cargo"),
    (16, 215000, "PAID",    "Coffee beans Nairobi → Kisumu — 2× 10ft containers"),
    (17, 255000, "PAID",    "Steel pipes Nairobi → Eldoret — flatbed"),
    (18, 125000, "PAID",    "Cooking oil Nairobi → Nakuru — tanker"),
    (19, 380000, "PAID",    "Electronics Mombasa → Kigali — 40ft container"),
    (20, 160000, "PAID",    "Fertilizer Eldoret → Nairobi — bulk"),
    (21, 95000,  "PAID",    "Textiles Nakuru → Eldoret — 10ft container"),
    # Active — not yet paid
    (0,  195000, "PENDING", "Fresh produce Nairobi → Mombasa — reefer container"),
    (1,  98000,  "PENDING", "Tea leaves Nairobi → Kisumu — loose cargo"),
    (2,  285000, "PENDING", "Construction materials Mombasa → Kampala — 40ft"),
    (3,  150000, "PENDING", "Dairy products Nairobi → Eldoret — reefer"),
    (4,  340000, "PENDING", "Fuel tanker Mombasa → Dar es Salaam"),
    (5,  86000,  "PENDING", "Packaged foods Nairobi → Malaba — 20ft"),
    (6,  135000, "PENDING", "Fish export Kisumu → Kampala — reefer"),
    (7,  210000, "PENDING", "Cement Nairobi → Nakuru — bulk"),
    (8,  520000, "PENDING", "Heavy machinery Nairobi → Kigali — flatbed"),
    (9,  112000, "PENDING", "Flowers Nairobi → Arusha — reefer"),
    # Overdue (from delivered/delayed shipments)
    (22, 245000, "PENDING", "Medical supplies Mombasa → Kampala — reefer — OVERDUE"),
    (23, 170000, "PENDING", "Vehicle parts Nairobi → Arusha — OVERDUE"),
    (24, 205000, "PENDING", "Timber Nairobi → Mombasa — flatbed — OVERDUE"),
    # Customs & pending
    (10, 130000, "PENDING", "Imported electronics Mombasa → Nairobi — 20ft container"),
    (11, 85000,  "PENDING", "Sugar Kisumu → Nairobi — bulk"),
    (12, 420000, "PENDING", "Heavy equipment Dar → Mombasa — oversize flatbed"),
    (13, 180000, "PENDING", "Avocado export Nairobi → Mombasa — reefer"),
]

# ── Tracking event templates per status ───────────────────────────────────────

def gen_tracking_events(shipment, route, status):
    """Generate realistic tracking event timeline for a shipment."""
    events = []
    now = timezone.now()
    base = shipment.scheduled_departure or (now - timedelta(days=3))

    events.append({
        "event_type": "DEPARTURE",
        "location": f"{route.origin} Warehouse",
        "notes": f"Departed {route.origin}",
        "timestamp": base,
    })

    if status in ("IN_TRANSIT", "AT_CUSTOMS", "DELAYED", "DELIVERED"):
        midpoint = route.destination
        events.append({
            "event_type": "CHECKPOINT",
            "location": "Nakuru Weighbridge" if "Nakuru" in f"{route.origin}{route.destination}" else "Athi River Checkpoint",
            "notes": "Weight verified, documents in order",
            "timestamp": base + timedelta(hours=random.randint(2, 5)),
        })

    if status in ("AT_CUSTOMS",):
        events.append({
            "event_type": "CUSTOMS_ENTRY",
            "location": f"{route.destination} Customs Terminal",
            "notes": "Awaiting customs clearance",
            "timestamp": base + timedelta(hours=random.randint(6, 12)),
        })

    if status == "DELAYED":
        events.append({
            "event_type": "DELAY",
            "location": "Border Crossing" if "Kampala" in route.destination or "Kigali" in route.destination else "Route",
            "notes": f"Delay — {random.choice(['traffic congestion', 'mechanical issue', 'documentation hold', 'weather conditions'])}",
            "timestamp": base + timedelta(hours=random.randint(4, 10)),
        })

    if status == "DELIVERED":
        events.append({
            "event_type": "ARRIVAL",
            "location": f"{route.destination} Distribution Center",
            "notes": f"Delivered to {route.destination}",
            "timestamp": base + timedelta(hours=route.estimated_hours + random.randint(0, 2)),
        })

    return events


# ── Alert templates ───────────────────────────────────────────────────────────

ALERT_DEFS = [
    # (severity, message, risk_score, shipment_index)
    ("HIGH",     "Delayed 48+ hours at Malaba border — documents pending", 0.78, 22),
    ("HIGH",     "Risk score 85% — likely delivery failure", 0.85, 23),
    ("MEDIUM",   "Cold chain deviation — reefer temp at 8°C (threshold 4°C)", 0.55, 0),
    ("MEDIUM",   "Fuel price increase 12% on northern corridor", 0.45, 2),
    ("MEDIUM",   "Driver approaching hours limit — 8.5h driving", 0.50, 3),
    ("LOW",      "Truck due for service in 500 km — schedule maintenance", 0.20, 4),
    ("LOW",      "Customs clearance queue at Mombasa port — 2-day backlog", 0.30, 10),
    ("HIGH",     "Carrier requested extension — delivery at risk", 0.72, 24),
    ("MEDIUM",   "Warehouse zone B (Cold Storage) at 75% capacity", 0.48, 6),
    ("LOW",      "New tariff rate for Kenya-Uganda corridor effective next month", 0.15, 7),
]


class Command(BaseCommand):
    help = "Seed Kande Farms company with full operational data across all domains"

    def handle(self, *args, **options):
        admin_user = None
        org = None

        # ── Clear existing Kande data ──────────────────────────────────────
        User.objects.filter(email__endswith="@kandefarms.co.ke").delete()
        # Clear org-scoped data before deleting the org
        Carrier.objects.filter(organization__slug=KANDE_SLUG).delete()
        Truck.objects.filter(organization__slug=KANDE_SLUG).delete()
        Driver.objects.filter(organization__slug=KANDE_SLUG).delete()
        Organization.objects.filter(slug=KANDE_SLUG).delete()
        self.stdout.write("Cleared existing Kande Farms seed data.")

        # ── Create Kande Farms organization ────────────────────────────────
        org = Organization.objects.create(
            name=KANDE_ORG,
            slug=KANDE_SLUG,
            org_type="SHIPPER",
            country="Kenya",
            tax_id="P052024567K",
            is_verified=True,
            address="Kande Farms Road, Naivasha, Nakuru County, Kenya",
        )
        self.stdout.write(f"Created organization: {org.name}")

        # ── Create users ───────────────────────────────────────────────────
        users = {}
        for username, email, first, last, phone, role in USER_DEFS:
            is_admin = (role == "ADMIN")
            u = User.objects.create_user(
                username=username,
                email=email,
                password=PASSWORD,
                first_name=first,
                last_name=last,
                phone=phone,
                role=role,
                organization=org,
                onboarding_completed=True,
                is_superuser=is_admin,
                is_staff=is_admin,
            )
            users[username] = u
            if is_admin:
                admin_user = u
            self.stdout.write(f"  [{role:16s}] {username:20s} -> {email}")

        # ── Create routes ──────────────────────────────────────────────────
        routes = []
        for origin, dest, dist, hours in ROUTE_DEFS:
            r = Route.objects.create(
                origin=origin,
                destination=dest,
                distance_km=dist,
                estimated_hours=hours,
            )
            routes.append(r)
        self.stdout.write(f"Created {len(routes)} routes")

        # ── Create carriers ────────────────────────────────────────────────
        carriers = []
        for code, name, status, contact, phone, country, hq in CARRIER_DEFS:
            c = Carrier.objects.create(
                code=code, name=name, status=status,
                contact_name=contact, phone=phone,
                country=country, headquarters=hq,
                on_time_rate=random.uniform(82, 98),
                rating=random.uniform(3.8, 4.9),
                active_shipments=0, total_shipments=random.randint(50, 400),
                high_risk_count=random.randint(0, 5),
                organization=org,
            )
            carriers.append(c)
        self.stdout.write(f"Created {len(carriers)} carriers")

        # ── Create trucks ──────────────────────────────────────────────────
        trucks = []
        for fid, make, model, year, plate, vin, fuel, payload, odo, loc in TRUCK_DEFS:
            t = Truck.objects.create(
                fleet_id=fid, make=make, model=model, year=year, plate=plate,
                vin=vin, fuel_type=fuel, payload_tonnes=payload,
                odometer_km=odo + random.randint(0, 5000),
                current_location=loc,
                status=random.choice(["ACTIVE", "ACTIVE", "ACTIVE", "IDLE"]),
                load_pct=random.randint(0, 95),
                last_service_date=date.today() - timedelta(days=random.randint(30, 180)),
                next_service_date=date.today() + timedelta(days=random.randint(30, 120)),
                organization=org,
            )
            trucks.append(t)
        self.stdout.write(f"Created {len(trucks)} trucks")

        # ── Create drivers ─────────────────────────────────────────────────
        drivers = []
        for did, first, last, phone, lic, exp, rating, route_desc in DRIVER_DEFS:
            d = Driver.objects.create(
                driver_id=did, first_name=first, last_name=last,
                phone=phone, license_class=lic,
                years_experience=exp, rating=rating,
                on_time_rate=random.uniform(85, 100),
                total_jobs=random.randint(80, 600),
                total_km=random.randint(15000, 200000),
                active_route=route_desc,
                status=random.choice(["AVAILABLE", "AVAILABLE", "ON_ROUTE", "OFF_DUTY"]),
                organization=org,
            )
            drivers.append(d)

        # Assign trucks to some drivers (1:1, unassign old first)
        for i in range(min(len(drivers), len(trucks))):
            if drivers[i].status in ("AVAILABLE", "ON_ROUTE"):
                # Unassign from any other driver
                Truck.objects.filter(assigned_driver=drivers[i]).update(assigned_driver=None)
                trucks[i].assigned_driver = drivers[i]
                trucks[i].save(update_fields=['assigned_driver'])
        self.stdout.write(f"Created {len(drivers)} drivers")

        # ── Create shipments ───────────────────────────────────────────────
        shipments = []
        now = timezone.now()
        for tn, route_idx, status, weight, c_idx, risk in SHIPMENT_DEFS:
            route = routes[route_idx]
            carrier = carriers[c_idx] if c_idx is not None else None
            sched_dep = now - timedelta(days=random.randint(1, 15))
            sched_arr = sched_dep + timedelta(hours=route.estimated_hours + random.randint(0, 4))

            s = Shipment.objects.create(
                tracking_number=tn,
                route=route,
                status=status,
                weight_kg=weight,
                carrier=carrier,
                carrier_name=carrier.name if carrier else "",
                scheduled_departure=sched_dep,
                scheduled_arrival=sched_arr,
                actual_departure=sched_dep if status != "PENDING" else None,
                actual_arrival=sched_arr if status == "DELIVERED" else None,
                delay_risk_score=risk,
                client=users.get("grace.wanjiku"),  # CLIENT owns shipments
            )
            shipments.append(s)

        # Assign truck/driver to some in-transit shipments
        for i, s in enumerate(shipments):
            if s.status in ("IN_TRANSIT", "DELAYED", "DELIVERED"):
                s.assigned_truck = trucks[i % len(trucks)]
                s.assigned_driver = drivers[i % len(drivers)]
                s.save(update_fields=['assigned_truck', 'assigned_driver'])
        self.stdout.write(f"Created {len(shipments)} shipments")

        # ── Create tracking events ─────────────────────────────────────────
        event_count = 0
        for i, s in enumerate(shipments):
            events = gen_tracking_events(s, s.route, s.status)
            for evt in events:
                TrackingEvent.objects.create(
                    shipment=s,
                    event_type=evt["event_type"],
                    location=evt["location"],
                    notes=evt["notes"],
                    timestamp=evt["timestamp"],
                    recorded_by=admin_user,
                )
                event_count += 1
        self.stdout.write(f"Created {event_count} tracking events")

        # ── Create invoices + payments ─────────────────────────────────────
        finance_user = users.get("kevin.kiprotich")
        invoice_objs = []
        for ship_idx, amount, status, desc in INVOICE_DEFS:
            s = shipments[ship_idx]
            inv = Invoice.objects.create(
                invoice_number=f"INV-2026-{5001 + len(invoice_objs)}",
                shipment=s,
                amount_kes=amount,
                currency="KES",
                status=status,
                description=desc,
                created_by=finance_user,
                created_at=s.created_at + timedelta(hours=1),
            )
            invoice_objs.append(inv)

            # Create payment for PAID invoices
            if status == "PAID":
                Payment.objects.create(
                    invoice=inv,
                    provider=random.choice(["MPESA", "FLUTTERWAVE", "STRIPE", "PESAPAL"]),
                    provider_reference=f"TXN-{random.randint(1000000, 9999999)}",
                    amount=Decimal(amount),
                    currency="KES",
                    status="SUCCESS",
                    created_at=inv.created_at + timedelta(hours=random.randint(1, 24)),
                )
        self.stdout.write(f"Created {len(invoice_objs)} invoices with payments for PAID ones")

        # ── Create alerts ──────────────────────────────────────────────────
        for severity, message, risk_score, ship_idx in ALERT_DEFS:
            Alert.objects.create(
                shipment=shipments[ship_idx],
                severity=severity,
                message=message,
                risk_score=risk_score,
                acknowledged=random.choice([False, False, True]),
                acknowledged_by=admin_user if random.random() > 0.6 else None,
            )
        self.stdout.write(f"Created {len(ALERT_DEFS)} alerts")

        # ── Summary ────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            f"\n{'='*60}\n"
            f"Kande Farms seed complete!\n"
            f"  Organization: {org.name}\n"
            f"  Users:        {len(users)} (one per role)\n"
            f"  Routes:       {len(routes)}\n"
            f"  Carriers:     {len(carriers)}\n"
            f"  Trucks:       {len(trucks)}\n"
            f"  Drivers:      {len(drivers)}\n"
            f"  Shipments:    {len(shipments)} (10 in-transit, 4 at customs, 8 delivered, 3 delayed, 10 pending)\n"
            f"  Tracking:     {event_count} events\n"
            f"  Invoices:     {len(invoice_objs)} (8 paid, 17 pending)\n"
            f"  Alerts:       {len(ALERT_DEFS)}\n"
            f"\n"
            f"  Admin login:  admin / {PASSWORD}\n"
            f"  All passwords: {PASSWORD}\n"
            f"{'='*60}"
        ))
