"""
Seed the database with realistic East Africa logistics demo data.
Creates organizations, users, carriers, drivers, trucks, shipments,
marketplace listings/bids, scale tickets, and chat conversations.
Safe to run multiple times (clears all seed data first).
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
from chats.models import Conversation, Message
from fleet.models import Driver, DriverJobHistory, Truck, TruckMaintenanceLog, ScaleTicket
from marketplace.models import FreightListing, Bid
from payments.models import Invoice
from shipments.models import Route, Shipment
from tracking.models import TrackingEvent

User = get_user_model()

# ── helpers ──────────────────────────────────────────────────────────────────

def rnd(a, b):
    return random.randint(a, b)

def rnd_f(a, b, dp=1):
    return round(random.uniform(a, b), dp)

def days_ago(n):
    return timezone.now() - timedelta(days=n)

def future_days(n):
    return timezone.now() + timedelta(days=n)

# ── data pools ────────────────────────────────────────────────────────────────

TRUCK_MAKES = [
    ("Isuzu", "FRR", 2021, "DIESEL"), ("Isuzu", "NQR", 2020, "DIESEL"),
    ("Mitsubishi", "Canter", 2022, "DIESEL"), ("Mitsubishi", "Rosa", 2019, "DIESEL"),
    ("Mercedes", "Actros", 2023, "DIESEL"), ("Mercedes", "Sprinter", 2021, "DIESEL"),
    ("MAN", "TGX", 2022, "DIESEL"), ("MAN", "TGL", 2020, "DIESEL"),
    ("Volvo", "FH16", 2023, "DIESEL"), ("Volvo", "FM", 2021, "DIESEL"),
    ("Scania", "R450", 2022, "DIESEL"), ("Scania", "G410", 2021, "DIESEL"),
    ("Toyota", "Dyna", 2020, "DIESEL"), ("Toyota", "Hilux", 2022, "DIESEL"),
    ("Tata", "LPT 1613", 2019, "DIESEL"), ("Hino", "500 Series", 2021, "DIESEL"),
    ("FAW", "J6P", 2020, "DIESEL"), ("Sinotruk", "HOWO", 2019, "DIESEL"),
    ("DAF", "XF105", 2022, "DIESEL"), ("Ford", "Transit", 2021, "DIESEL"),
    ("Iveco", "Stralis", 2022, "DIESEL"), ("Renault", "Trucks T", 2021, "DIESEL"),
    ("King Long", "XMQ6900", 2020, "DIESEL"), ("Yutong", "ZK6938H", 2021, "DIESEL"),
    ("Ashok Leyland", "U-3718", 2019, "DIESEL"),
]

COLORS = ["White", "Silver", "Red", "Blue", "Yellow", "Orange", "Green", "Black", "Grey"]

DRIVER_NAMES = [
    ("James", "Kamau"), ("Mary", "Wanjiku"), ("Peter", "Odhiambo"), ("Grace", "Achieng"),
    ("Samuel", "Mutua"), ("Faith", "Njeri"), ("Daniel", "Otieno"), ("Alice", "Muthoni"),
    ("Joseph", "Mwangi"), ("Esther", "Wairimu"), ("Moses", "Kipchoge"), ("Ruth", "Chebet"),
    ("David", "Omondi"), ("Hannah", "Cherotich"), ("John", "Gitau"), ("Sarah", "Wambui"),
    ("Paul", "Njenga"), ("Lydia", "Anyango"), ("Stephen", "Karanja"), ("Priscilla", "Auma"),
    ("Michael", "Korir"), ("Agnes", "Wangari"), ("George", "Okello"), ("Dorcas", "Jemutai"),
    ("Patrick", "Muriuki"), ("Tabitha", "Odero"), ("Charles", "Kiptoo"), ("Miriam", "Adhiambo"),
]

ROUTES = [
    "Nairobi → Mombasa", "Nairobi → Kisumu", "Mombasa → Nairobi",
    "Nairobi → Nakuru", "Kisumu → Nairobi", "Nairobi → Eldoret",
    "Mombasa → Malindi", "Nairobi → Thika", "Nakuru → Kisumu",
    "Eldoret → Nairobi", "Nairobi → Nyeri", "Mombasa → Voi",
    "Nairobi → Machakos", "Kisumu → Kericho", "Nakuru → Nairobi",
    "Nairobi → Garissa", "Mombasa → Kwale", "Nairobi → Nanyuki",
    "Kisumu → Kakamega", "Mombasa → Taveta", "Nairobi → Kajiado",
    "Eldoret → Kisumu", "Nairobi → Embu", "Mombasa → Lamu",
]

CARRIER_NAMES = [
    ("TRANSAMI", "Transami Kenya"),
    ("MITCHELL", "Mitchell Cotts"),
    ("SIGINON", "Siginon Group"),
    ("EAFREIGHT", "EA Freight"),
    ("SKYNET", "SkyNet Kenya"),
    ("BOLLORE", "Bollore Logistics"),
    ("DAMCO", "Damco Kenya"),
    ("KN", "Kuehne+Nagel"),
    ("DHL", "DHL Supply Chain"),
]

CERT_POOL = [
    "ADR Dangerous Goods", "Refrigerated Cargo", "Heavy Haulage",
    "HACCP Food Safety", "Oversized Load", "Port Operations",
    "Defensive Driving", "First Aid", "GPS & Telematics",
]

ALERT_MESSAGES = {
    "CRITICAL": [
        "Engine temperature critical — pull over immediately",
        "Brake failure warning — stop vehicle safely",
        "Cargo temperature out of range — perishables at risk",
        "GPS blackout — vehicle location unknown for 2 hours",
        "Customs clearance blocked — consignment held at Mombasa port",
    ],
    "HIGH": [
        "Tyre pressure low on rear-left — check before next stop",
        "Driver hours exceeded legal limit — rest break required",
        "Border crossing delayed — ETA adjusted by 6 hours",
        "Fuel level critically low — nearest station 80 km",
        "Unexpected road closure on Mombasa Highway — rerouting",
    ],
    "MEDIUM": [
        "Scheduled service overdue by 500 km",
        "Route deviation detected — 12 km off planned path",
        "Delivery window at risk — estimated 2 hours late",
        "Document missing: certificate of origin not uploaded",
        "Heavy rainfall reported on route — drive with caution",
    ],
    "LOW": [
        "Shipment picked up and in transit",
        "ETA updated based on current traffic conditions",
        "Driver logged break at Nakuru rest stop",
        "Checkpoint passed — Nairobi weigh bridge cleared",
        "Delivery confirmed — POD signed by consignee",
    ],
}

MAINTENANCE_TYPES = [
    ("ROUTINE", "Engine oil & filter replacement"),
    ("TYRE", "Tyre rotation and pressure check"),
    ("REPAIR", "Brake pad and disc inspection"),
    ("ROUTINE", "50,000 km full service"),
    ("REPAIR", "Electrical system diagnostic"),
    ("REPAIR", "Gearbox and clutch check"),
    ("ROUTINE", "Radiator flush and coolant top-up"),
    ("REPAIR", "Shock absorbers and leaf springs"),
]

TRACKING_EVENTS = [
    ("PICKUP", "Shipment picked up from origin"),
    ("IN_TRANSIT", "Departed Nairobi depot, heading to Mombasa"),
    ("CHECKPOINT", "Cleared Nairobi weigh bridge"),
    ("CHECKPOINT", "Arrived Mtito Andei checkpoint"),
    ("CHECKPOINT", "Cleared Mombasa port gate"),
    ("DELAY", "Traffic delay on Mombasa Road — 90 min"),
    ("OUT_FOR_DELIVERY", "Out for final delivery"),
    ("DELIVERED", "Delivered — POD signed"),
]

STATUSES = ["IN_TRANSIT", "IN_TRANSIT", "IN_TRANSIT", "DELIVERED", "DELIVERED",
            "PENDING", "AT_CUSTOMS", "DELAYED"]

INV_STATUSES = ["PAID", "PAID", "PAID", "PENDING", "OVERDUE"]

TRUCK_STATUSES = ["ACTIVE", "ACTIVE", "ACTIVE", "IDLE", "IDLE",
                  "MAINTENANCE", "OFF_DUTY", "DECOMMISSIONED"]

DRIVER_STATUSES = ["AVAILABLE", "ON_ROUTE", "ON_ROUTE", "OFF_DUTY", "ON_LEAVE"]

FREIGHT_CARGO_TYPES = ["GENERAL", "CONTAINER", "BULK", "PERISHABLE", "FRAGILE",
                       "HAZARDOUS", "VEHICLES", "OTHER"]

ORIGIN_CITIES = ["Nairobi", "Mombasa", "Kisumu", "Eldoret", "Nakuru"]
DEST_CITIES   = ["Mombasa", "Nairobi", "Kisumu", "Kampala", "Dar es Salaam",
                 "Kigali", "Juba", "Malindi", "Garissa", "Nakuru"]


class Command(BaseCommand):
    help = "Seed demo data for CargoTrack"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Clear existing seed data first")

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data…")

        # ── clear ─────────────────────────────────────────────────────────────
        Bid.objects.all().delete()
        FreightListing.objects.all().delete()
        Message.objects.all().delete()
        Conversation.objects.all().delete()
        ScaleTicket.objects.all().delete()
        TrackingEvent.objects.all().delete()
        Alert.objects.all().delete()
        Invoice.objects.all().delete()
        DriverJobHistory.objects.all().delete()
        TruckMaintenanceLog.objects.all().delete()
        Shipment.objects.all().delete()
        Route.objects.all().delete()
        Driver.objects.all().delete()
        Truck.objects.all().delete()
        Carrier.objects.all().delete()
        Organization.objects.filter(name__startswith='Seed:').delete()
        User.objects.filter(is_superuser=False).delete()
        self.stdout.write("  Cleared existing data")

        # ── organizations ─────────────────────────────────────────────────────
        orgs = []
        org_data = [
            ("Meridian Freight Ltd", "FREIGHT_FORWARDER", "Kenya", "P051234567A"),
            ("Siginon Group", "CARRIER_COMPANY", "Kenya", "P059876543B"),
            ("East African Shippers Ltd", "SHIPPER", "Kenya", "P051112223C"),
        ]
        for name, otype, country, tax_id in org_data:
            org = Organization.objects.create(
                name=f"Seed: {name}",
                slug=slugify(f"seed-{name}"),
                org_type=otype,
                country=country,
                tax_id=tax_id,
                is_verified=True,
            )
            orgs.append(org)
        self.stdout.write(f"  Created {len(orgs)} organizations")

        # ── users ─────────────────────────────────────────────────────────────
        # All 9 roles with realistic East African profiles.
        # Every user gets: first_name, last_name, email, phone, onboarding_completed=True.
        # Username = email prefix so registered users and seed users follow the same convention.
        USER_DEFS = [
            # (username, email, first, last, phone, role, org_idx)
            ("admin",        "admin@cargotrack.co.ke",     "David",    "Mwangi",     "+254722100100", "ADMIN",          1),
            ("jane.muthoni", "jane.muthoni@cargotrack.co.ke", "Jane",  "Muthoni",   "+254711200200", "LOGISTICS_MGR",  0),
            ("peter.ochieng","peter.ochieng@cargotrack.co.ke","Peter", "Ochieng",  "+254733300300", "DISPATCHER",     0),
            ("grace.wanjiku","grace.wanjiku@cargotrack.co.ke","Grace", "Wanjiku",  "+254744400400", "CLIENT",         2),
            ("samuel.kamau", "samuel.kamau@cargotrack.co.ke","Samuel", "Kamau",    "+254755500500", "CLIENT",         2),
            ("faith.nyambura","faith.nyambura@cargotrack.co.ke","Faith","Nyambura","+254766600600", "CLIENT",         2),
            ("john.otieno",  "john.otieno@cargotrack.co.ke", "John",   "Otieno",   "+254777700700", "CARRIER",        1),
            ("mary.akinyi",  "mary.akinyi@cargotrack.co.ke", "Mary",   "Akinyi",   "+254788800800", "CARRIER",        1),
            ("daniel.wambua","daniel.wambua@cargotrack.co.ke","Daniel","Wambua",   "+254799900900", "CARRIER",        0),
            ("sarah.chebet", "sarah.chebet@cargotrack.co.ke","Sarah",  "Chebet",   "+254700111222", "CUSTOMS_BROKER", 1),
            ("james.njoroge","james.njoroge@cargotrack.co.ke","James", "Njoroge",  "+254700222333", "WAREHOUSE_MGR",  0),
            ("linda.wambui", "linda.wambui@cargotrack.co.ke","Linda",  "Wambui",   "+254700333444", "PORT_AGENT",     2),
            ("kevin.kiprotich","kevin.kiprotich@cargotrack.co.ke","Kevin","Kiprotich","+254700444555","FINANCE_OFFICER",0),
        ]
        ALL_USERS = {}
        PASSWORD = "demo123"
        for username, email, first, last, phone, role, org_idx in USER_DEFS:
            u, _ = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first,
                    "last_name": last,
                    "phone": phone,
                    "role": role,
                    "organization": orgs[org_idx],
                    "onboarding_completed": True,
                    "is_superuser": (role == "ADMIN"),
                    "is_staff": (role == "ADMIN"),
                },
            )
            u.set_password(PASSWORD)
            # Ensure all fields are set even on existing users
            u.email = email
            u.first_name = first
            u.last_name = last
            u.phone = phone
            u.role = role
            u.organization = orgs[org_idx]
            u.onboarding_completed = True
            u.save()
            ALL_USERS[username] = u
        org_users = list(ALL_USERS.values())
        ops_user = ALL_USERS['jane.muthoni']
        admin_user = ALL_USERS['admin']
        self.stdout.write(f"  Created/updated {len(ALL_USERS)} users (all 9 roles, password: {PASSWORD})")

        # ── carriers ──────────────────────────────────────────────────────────
        carriers = []
        for i, (code, name) in enumerate(CARRIER_NAMES):
            c = Carrier.objects.create(
                code=code,
                name=name,
                status="ACTIVE",
                organization=orgs[1] if i < 5 else orgs[0],
                contact_name=f"Contact {name}",
                phone=f"+2547{rnd(10000000, 99999999)}",
                email=f"info@{name.lower().replace(' ', '').replace('+', '')}.co.ke",
                country="Kenya",
                on_time_rate=round(random.uniform(0.75, 0.98), 3),
                rating=round(random.uniform(3.5, 5.0), 1),
                active_shipments=rnd(0, 15),
                total_shipments=rnd(50, 500),
                specialties=random.sample(CERT_POOL, rnd(1, 3)),
            )
            carriers.append(c)
        self.stdout.write(f"  Created {len(carriers)} carriers")

        # ── drivers ───────────────────────────────────────────────────────────
        drivers = []
        for i, (fn, ln) in enumerate(DRIVER_NAMES[:28]):
            total_jobs = rnd(40, 420)
            on_time = round(random.uniform(0.72, 0.99), 3)
            rating = round(random.uniform(3.2, 5.0), 1)
            certs = random.sample(CERT_POOL, rnd(1, 4))
            exp = rnd(2, 18)
            status = random.choice(DRIVER_STATUSES)
            d = Driver.objects.create(
                driver_id=f"DRV-{1000 + i:04d}",
                first_name=fn, last_name=ln,
                phone=f"+2547{rnd(10000000, 99999999)}",
                email=f"{fn.lower()}.{ln.lower()}@cargotrack.co.ke",
                license_number=f"DL{rnd(1000000, 9999999)}",
                license_class=random.choice(["CE", "C", "B", "ADR"]),
                license_expiry=date.today() + timedelta(days=rnd(180, 900)),
                status=status,
                years_experience=exp,
                rating=Decimal(str(rating)),
                on_time_rate=Decimal(str(on_time)),
                total_jobs=total_jobs,
                total_km=rnd(50000, 500000),
                earnings_mtd=Decimal(str(rnd(80000, 320000))),
                certifications=certs,
                current_location=random.choice(ROUTES).split(" → ")[0],
                organization=random.choice(orgs),
                created_at=days_ago(rnd(100, 600)),
            )
            drivers.append(d)
        self.stdout.write(f"  Created {len(drivers)} drivers")

        # ── trucks ────────────────────────────────────────────────────────────
        trucks = []
        for i, (make, model, year, fuel) in enumerate(TRUCK_MAKES[:25]):
            status = random.choice(TRUCK_STATUSES)
            assigned = drivers[i] if i < len(drivers) and status in ("ACTIVE",) else None
            odometer = rnd(15000, 450000)
            t = Truck.objects.create(
                fleet_id=f"CT-{100 + i:03d}",
                make=make, model=model, year=year,
                plate=f"K{'ABCDEFGHJKLMNPQRSTUVWXYZ'[i % 24]}{rnd(100, 999)}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}",
                vin=f"VIN{rnd(10000000, 99999999)}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}",
                color=random.choice(COLORS),
                payload_tonnes=rnd_f(3.5, 30.0),
                engine_cc=rnd(2800, 12900),
                fuel_type=fuel,
                fuel_capacity_l=rnd(150, 450),
                status=status,
                odometer_km=odometer,
                load_pct=rnd(0, 100) if status == "ACTIVE" else 0,
                current_location=random.choice(ROUTES).split(" → ")[0],
                latitude=rnd_f(-4.5, 4.5, 6),
                longitude=rnd_f(33.9, 42.0, 6),
                last_service_date=date.today() - timedelta(days=rnd(10, 180)),
                next_service_date=date.today() + timedelta(days=rnd(5, 90)),
                next_service_km=odometer + rnd(5000, 15000),
                assigned_driver=assigned,
                organization=random.choice(orgs),
                created_at=days_ago(rnd(200, 800)),
            )
            trucks.append(t)

            for j in range(rnd(2, 5)):
                log_type, desc = random.choice(MAINTENANCE_TYPES)
                log_km = max(1000, odometer - rnd(j * 10000, (j + 1) * 25000))
                TruckMaintenanceLog.objects.create(
                    truck=t,
                    log_type=log_type,
                    description=desc,
                    cost_kes=Decimal(str(rnd(5000, 95000))),
                    odometer_km=log_km,
                    performed_by=f"ServicePro Garage — {random.choice(['Nairobi', 'Mombasa', 'Nakuru', 'Kisumu'])}",
                    performed_at=timezone.now() - timedelta(days=rnd(j * 40, (j + 1) * 80)),
                )
        self.stdout.write(f"  Created {len(trucks)} trucks with maintenance logs")

        # ── routes ────────────────────────────────────────────────────────────
        ROUTE_DISTANCES = {
            "Nairobi → Mombasa": (480, 8), "Nairobi → Kisumu": (340, 6),
            "Mombasa → Nairobi": (480, 8), "Nairobi → Nakuru": (160, 3),
            "Kisumu → Nairobi": (340, 6), "Nairobi → Eldoret": (310, 5),
            "Mombasa → Malindi": (120, 2), "Nairobi → Thika": (45, 1),
            "Nakuru → Kisumu": (180, 3), "Eldoret → Nairobi": (310, 5),
            "Nairobi → Nyeri": (150, 3), "Mombasa → Voi": (165, 3),
            "Nairobi → Machakos": (65, 1), "Kisumu → Kericho": (90, 2),
            "Nakuru → Nairobi": (160, 3), "Nairobi → Garissa": (370, 6),
            "Mombasa → Kwale": (50, 1), "Nairobi → Nanyuki": (200, 4),
            "Kisumu → Kakamega": (55, 1), "Mombasa → Taveta": (260, 5),
            "Nairobi → Kajiado": (85, 2), "Eldoret → Kisumu": (150, 3),
            "Nairobi → Embu": (130, 3), "Mombasa → Lamu": (340, 6),
        }
        route_objs = {}
        for label, (dist_km, est_h) in ROUTE_DISTANCES.items():
            origin, destination = label.split(" → ")
            r = Route.objects.create(
                origin=origin,
                destination=destination,
                distance_km=dist_km,
                estimated_hours=est_h,
            )
            route_objs[label] = r
        self.stdout.write(f"  Created {len(route_objs)} routes")

        # ── shipments ─────────────────────────────────────────────────────────
        route_labels = list(route_objs.keys())
        shipments = []
        for i in range(60):
            client = random.choice(org_users)
            route_label = random.choice(route_labels)
            route_obj = route_objs[route_label]
            status = random.choice(STATUSES)
            dep = days_ago(rnd(1, 30))
            sched_arr = dep + timedelta(days=rnd(1, 7))
            actual_arr = None
            if status == "DELIVERED":
                actual_arr = sched_arr + timedelta(hours=rnd(-12, 24))

            # Assign carrier FK, truck, driver for in-transit/delivered shipments
            ship_carrier = random.choice(carriers) if status in ("IN_TRANSIT", "DELIVERED", "AT_CUSTOMS") else None
            ship_truck = random.choice(trucks) if ship_carrier and status in ("IN_TRANSIT", "DELIVERED") else None
            ship_driver = ship_truck.assigned_driver if ship_truck else None
            dispatch = "DISPATCHED" if ship_truck else ("DELIVERED" if status == "DELIVERED" else "UNASSIGNED")

            s = Shipment.objects.create(
                tracking_number=f"CT{timezone.now().year}{i + 1001:04d}",
                route=route_obj,
                status=status,
                carrier_name=ship_carrier.name if ship_carrier else random.choice([n for _, n in CARRIER_NAMES]),
                carrier=ship_carrier,
                assigned_truck=ship_truck,
                assigned_driver=ship_driver,
                dispatch_status=dispatch,
                weight_kg=Decimal(str(rnd(500, 28000))),
                scheduled_departure=dep,
                scheduled_arrival=sched_arr,
                actual_departure=dep if status != "PENDING" else None,
                actual_arrival=actual_arr,
                client=client,
                delay_risk_score=Decimal(str(rnd_f(0.0, 0.95, 3))),
                created_at=dep,
            )
            shipments.append(s)

            # tracking events
            n_events = rnd(2, len(TRACKING_EVENTS))
            for ev_type, ev_msg in TRACKING_EVENTS[:n_events]:
                loc_parts = route_label.split(" → ")
                loc = loc_parts[0] if ev_type == "PICKUP" else random.choice(loc_parts)
                TrackingEvent.objects.create(
                    shipment=s,
                    event_type=ev_type,
                    location=loc,
                    notes=ev_msg,
                    recorded_by=ops_user,
                    timestamp=dep + timedelta(hours=rnd(0, 48)),
                )
        self.stdout.write(f"  Created {len(shipments)} shipments with tracking events")

        # ── driver job history ────────────────────────────────────────────────
        for s in shipments:
            if s.status in ("IN_TRANSIT", "DELIVERED"):
                drv = s.assigned_driver or random.choice(drivers)
                route_label = f"{s.route.origin} → {s.route.destination}"
                dist = rnd(80, 550)
                on_time = random.random() > 0.18
                DriverJobHistory.objects.create(
                    driver=drv,
                    shipment=s,
                    route_label=route_label,
                    distance_km=dist,
                    on_time=on_time,
                    earnings_kes=Decimal(str(rnd(4500, 22000))),
                    completed_at=s.actual_arrival or s.scheduled_arrival,
                )

        # ── invoices ──────────────────────────────────────────────────────────
        for i, s in enumerate(shipments):
            inv_status = random.choice(INV_STATUSES)
            amount = Decimal(str(rnd(25000, 380000)))
            created_at = s.created_at + timedelta(days=rnd(0, 3))
            paid_at = created_at + timedelta(days=rnd(1, 20)) if inv_status == "PAID" else None
            Invoice.objects.create(
                invoice_number=f"INV-{timezone.now().year}-{i + 1001:04d}",
                shipment=s,
                amount_kes=amount,
                status=inv_status,
                description=f"Freight charges: {s.route.origin} → {s.route.destination}",
                created_by=ops_user,
                created_at=created_at,
                paid_at=paid_at,
            )
            if random.random() < 0.4:
                Invoice.objects.create(
                    invoice_number=f"INV-{timezone.now().year}-{i + 2001:04d}",
                    shipment=s,
                    amount_kes=Decimal(str(rnd(5000, 45000))),
                    status=random.choice(INV_STATUSES),
                    description=f"Handling & customs: {s.route.origin} → {s.route.destination}",
                    created_by=ops_user,
                    created_at=created_at + timedelta(days=1),
                    paid_at=paid_at,
                )
        self.stdout.write(f"  Created invoices for {len(shipments)} shipments")

        # ── alerts ────────────────────────────────────────────────────────────
        severity_weights = ["CRITICAL"] * 3 + ["HIGH"] * 8 + ["MEDIUM"] * 14 + ["LOW"] * 20
        for s in shipments:
            n_alerts = rnd(0, 4)
            for _ in range(n_alerts):
                sev = random.choice(severity_weights)
                msg = random.choice(ALERT_MESSAGES[sev])
                acked = random.random() > 0.45
                Alert.objects.create(
                    shipment=s,
                    message=msg,
                    risk_score=Decimal(str(rnd_f(0.1, 0.99, 2))),
                    severity=sev,
                    sent_at=s.created_at + timedelta(hours=rnd(1, 72)),
                    acknowledged=acked,
                    acknowledged_by=ops_user if acked else None,
                )
        self.stdout.write("  Created alerts")

        # ── scale tickets ─────────────────────────────────────────────────────
        for _ in range(30):
            t = random.choice(trucks)
            d = t.assigned_driver or random.choice(drivers)
            ScaleTicket.objects.create(
                truck=t,
                driver=d,
                weight_kg=rnd_f(500, 28000),
                location=f"{random.choice(['Nairobi', 'Mombasa', 'Nakuru'])} Weighbridge",
                latitude=rnd_f(-4.5, 4.5, 6),
                longitude=rnd_f(33.9, 42.0, 6),
                notes=random.choice(["Within limits", "Slight overload — approved", "Re-weighed — OK", ""]),
                captured_at=days_ago(rnd(1, 60)),
            )
        self.stdout.write(f"  Created {ScaleTicket.objects.count()} scale tickets")

        # ── marketplace listings ──────────────────────────────────────────────
        listings = []
        for i in range(20):
            origin = random.choice(ORIGIN_CITIES)
            dest = random.choice([d for d in DEST_CITIES if d != origin])
            cargo_type = random.choice(FREIGHT_CARGO_TYPES)
            weight = rnd(500, 25000)
            budget_min = rnd(15000, 80000)
            budget_max = budget_min + rnd(10000, 50000)
            pickup = future_days(rnd(1, 14))
            delivery = pickup + timedelta(days=rnd(1, 10))
            is_hazmat = cargo_type == "HAZARDOUS"
            is_reefer = cargo_type == "PERISHABLE"
            status = random.choice(["OPEN", "OPEN", "OPEN", "AWARDED", "EXPIRED"])
            owner = random.choice(org_users)
            l = FreightListing.objects.create(
                cargo_type=cargo_type,
                weight_kg=Decimal(str(weight)),
                volume_m3=rnd_f(1, 60),
                origin=origin,
                destination=dest,
                pickup_date=pickup.date(),
                delivery_date=delivery.date(),
                budget_min=Decimal(str(budget_min)),
                budget_max=Decimal(str(budget_max)),
                description=f"{cargo_type.title()} cargo: {origin} → {dest}",
                requires_hazmat=is_hazmat,
                requires_reefer=is_reefer,
                status=status,
                posted_by=owner,
            )
            listings.append(l)
        self.stdout.write(f"  Created {len(listings)} freight listings")

        # ── bids ──────────────────────────────────────────────────────────────
        bid_count = 0
        for listing in listings:
            n_bids = rnd(0, 4)
            bidders_used = set()
            for _ in range(n_bids):
                available = [c for c in carriers if c.pk not in bidders_used]
                if not available:
                    break
                bidder = random.choice(available)
                bidders_used.add(bidder.pk)
                t = random.choice(trucks)
                min_bid = int(listing.budget_min or 10000)
                max_bid = int(listing.budget_max or min_bid + 20000)
                Bid.objects.create(
                    listing=listing,
                    carrier=bidder,
                    truck=t,
                    driver=t.assigned_driver or random.choice(drivers),
                    amount=Decimal(str(rnd(min_bid, max_bid))),
                    estimated_days=rnd(1, 8),
                    notes=f"Can handle this {listing.cargo_type.lower()} shipment.",
                )
                bid_count += 1
        self.stdout.write(f"  Created {bid_count} bids")

        # ── chat conversations ────────────────────────────────────────────────
        all_users = list(ALL_USERS.values())
        for i in range(5):
            participants = random.sample(all_users, min(3, len(all_users)))
            conv = Conversation.objects.create(
                is_group=len(participants) > 2,
                subject=f"Chat {i+1}",
                created_by=participants[0],
                shipment=random.choice(shipments) if random.random() < 0.4 else None,
            )
            conv.participants.set(participants)
            for j in range(rnd(2, 6)):
                sender = random.choice(participants)
                Message.objects.create(
                    conversation=conv,
                    sender=sender,
                    content=random.choice([
                        "Shipment status update?",
                        "On schedule, arriving tomorrow.",
                        "Customs clearance done.",
                        "Any delays at the border?",
                        "ETA updated to 14:00.",
                        "Documents uploaded.",
                        "Confirmed, thanks!",
                    ]),
                    created_at=days_ago(rnd(0, 14)),
                )
        self.stdout.write(f"  Created {Conversation.objects.count()} conversations with messages")

        # ── summary ───────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            f"\nDone! "
            f"{Organization.objects.count()} orgs, "
            f"{User.objects.count()} users, "
            f"{Carrier.objects.count()} carriers, "
            f"{Driver.objects.count()} drivers, "
            f"{Truck.objects.count()} trucks, "
            f"{Shipment.objects.count()} shipments, "
            f"{Invoice.objects.count()} invoices, "
            f"{Alert.objects.count()} alerts, "
            f"{ScaleTicket.objects.count()} scale tickets, "
            f"{FreightListing.objects.count()} listings, "
            f"{Bid.objects.count()} bids, "
            f"{Conversation.objects.count()} conversations."
        ))
