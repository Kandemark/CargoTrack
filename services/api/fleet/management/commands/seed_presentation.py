"""
Seed 6 companies with full operational data across all CargoTrack domains.

Creates organizations, users (all 9 roles), carriers, trucks, drivers,
routes, shipments, tracking events, invoices, payments, marketplace listings
with bids, social posts with comments, community groups, cross-org
conversations, driver job history, and expenses.

Idempotent — uses get_or_create with natural keys (slug, username, code,
tracking_number).  --force deletes seed-tagged data and regenerates.

All data goes into the database so it's editable/deletable via the app.
"""
import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import Organization
from carriers.models import Carrier
from chats.models import Conversation, Message, SocialComment, SocialPost
from fleet.models import Driver, DriverExpense, DriverJobHistory, Truck
from marketplace.models import Bid, FreightListing
from payments.models import Invoice, Payment
from shipments.models import Route, Shipment
from tracking.models import TrackingEvent

User = get_user_model()
PASSWORD = "demo123"
NOW = timezone.now()

# ══════════════════════════════════════════════════════════════════════════════
# Organisation definitions
# ══════════════════════════════════════════════════════════════════════════════

ORG_DEFS = [
    dict(slug="mombasa-port-logistics", name="[Seed] Mombasa Port Logistics",
         org_type="FREIGHT_FORWARDER", country="Kenya",
         address="Moi International Airport Rd, Mombasa",
         website="https://mombasaportlogistics.co.ke"),
    dict(slug="lake-victoria-freight", name="[Seed] Lake Victoria Freight Co",
         org_type="CARRIER_COMPANY", country="Uganda",
         address="Plot 42, Njeru Road, Jinja",
         website="https://lakevicfreight.ug"),
    dict(slug="kilimanjaro-express", name="[Seed] Kilimanjaro Express",
         org_type="CARRIER_COMPANY", country="Tanzania",
         address="Sokoine Drive, Arusha",
         website="https://kiliexpress.co.tz"),
    dict(slug="rwanda-customs-brokers", name="[Seed] Rwanda Customs Brokers Ltd",
         org_type="BROKERAGE", country="Rwanda",
         address="KG 7 Ave, Kacyiru, Kigali",
         website="https://rwandacustoms.rw"),
    dict(slug="eastern-drc-traders", name="[Seed] Eastern DRC Traders",
         org_type="SHIPPER", country="DRC",
         address="Avenue du Commerce 88, Goma",
         website="https://easterndrctraders.cd"),
    dict(slug="kande-farms-ltd", name="[Seed] Kande Farms Ltd",
         org_type="SHIPPER", country="Kenya",
         address="Moi Avenue, Mombasa",
         website="https://kandefarms.co.ke"),
]

# ══════════════════════════════════════════════════════════════════════════════
# User definitions per organisation
# ══════════════════════════════════════════════════════════════════════════════

# Format: (username, email, first_name, last_name, phone, role)
# SHIPPER orgs get: ADMIN, LOGISTICS_MGR, CLIENT, FINANCE_OFFICER + extras
# CARRIER_COMPANY orgs get: ADMIN, LOGISTICS_MGR, CARRIER, DISPATCHER, DRIVER
# FREIGHT_FORWARDER orgs get: ADMIN, LOGISTICS_MGR, DISPATCHER, CUSTOMS_BROKER, PORT_AGENT, FINANCE_OFFICER
# BROKERAGE orgs get: ADMIN, CUSTOMS_BROKER, FINANCE_OFFICER, CLIENT

USER_DEFS_BY_ORG = {
    "mombasa-port-logistics": [
        ("fatima.hassan", "fatima.hassan@mombasaport.co.ke", "Fatima", "Hassan", "+254722500001", "ADMIN"),
        ("omar.salim", "omar.salim@mombasaport.co.ke", "Omar", "Salim", "+254722500002", "LOGISTICS_MGR"),
        ("aisha.mohammed", "aisha.mohammed@mombasaport.co.ke", "Aisha", "Mohammed", "+254722500003", "DISPATCHER"),
        ("hassan.juma", "hassan.juma@mombasaport.co.ke", "Hassan", "Juma", "+254722500004", "CUSTOMS_BROKER"),
        ("zainab.ali", "zainab.ali@mombasaport.co.ke", "Zainab", "Ali", "+254722500005", "PORT_AGENT"),
        ("ibrahim.ngugi", "ibrahim.ngugi@mombasaport.co.ke", "Ibrahim", "Ngugi", "+254722500006", "FINANCE_OFFICER"),
    ],
    "lake-victoria-freight": [
        ("patrick.tumusiime", "patrick.tumusiime@lakevic.ug", "Patrick", "Tumusiime", "+256772100001", "ADMIN"),
        ("brenda.namakula", "brenda.namakula@lakevic.ug", "Brenda", "Namakula", "+256772100002", "LOGISTICS_MGR"),
        ("robert.kato", "robert.kato@lakevic.ug", "Robert", "Kato", "+256772100003", "CARRIER"),
        ("moses.ssemwogerere", "moses.s@lakevic.ug", "Moses", "Ssemwogerere", "+256772100004", "DISPATCHER"),
        ("yusuf.lwanga", "yusuf.lwanga@lakevic.ug", "Yusuf", "Lwanga", "+256772100005", "DRIVER"),
        ("faith.nabirye", "faith.nabirye@lakevic.ug", "Faith", "Nabirye", "+256772100006", "FINANCE_OFFICER"),
    ],
    "kilimanjaro-express": [
        ("joseph.mushi", "joseph.mushi@kiliexpress.co.tz", "Joseph", "Mushi", "+255762100001", "ADMIN"),
        ("grace.macha", "grace.macha@kiliexpress.co.tz", "Grace", "Macha", "+255762100002", "LOGISTICS_MGR"),
        ("emmanuel.mrema", "emmanuel.mrema@kiliexpress.co.tz", "Emmanuel", "Mrema", "+255762100003", "CARRIER"),
        ("fatma.juma", "fatma.juma@kiliexpress.co.tz", "Fatma", "Juma", "+255762100004", "DISPATCHER"),
        ("juma.ramadhan", "juma.ramadhan@kiliexpress.co.tz", "Juma", "Ramadhan", "+255762100005", "DRIVER"),
    ],
    "rwanda-customs-brokers": [
        ("jean.habimana", "jean.habimana@rwandacustoms.rw", "Jean", "Habimana", "+250788100001", "ADMIN"),
        ("grace.umutoni", "grace.umutoni@rwandacustoms.rw", "Grace", "Umutoni", "+250788100002", "CUSTOMS_BROKER"),
        ("patrick.niyonshuti", "patrick.n@rwandacustoms.rw", "Patrick", "Niyonshuti", "+250788100003", "FINANCE_OFFICER"),
        ("aline.mukamana", "aline.mukamana@rwandacustoms.rw", "Aline", "Mukamana", "+250788100004", "CLIENT"),
    ],
    "eastern-drc-traders": [
        ("guy.mbula", "guy.mbula@easterndrc.cd", "Guy", "Mbula", "+243998100001", "ADMIN"),
        ("nadia.kasongo", "nadia.kasongo@easterndrc.cd", "Nadia", "Kasongo", "+243998100002", "LOGISTICS_MGR"),
        ("pierre.mutombo", "pierre.mutombo@easterndrc.cd", "Pierre", "Mutombo", "+243998100003", "CLIENT"),
        ("claudine.kambale", "claudine.kambale@easterndrc.cd", "Claudine", "Kambale", "+243998100004", "FINANCE_OFFICER"),
        ("deogratias.ndayisaba", "deogratias.n@easterndrc.cd", "Deogratias", "Ndayisaba", "+243998100005", "WAREHOUSE_MGR"),
    ],
    "kande-farms-ltd": [
        ("diamond.akinyi", "diamond.akinyi@kandefarms.co.ke", "Diamond", "Akinyi", "+254700111001", "ADMIN"),
        ("tumaini.wafula", "tumaini.wafula@kandefarms.co.ke", "Tumaini", "Wafula", "+254700111002", "LOGISTICS_MGR"),
        ("rose.chelangat", "rose.chelangat@kandefarms.co.ke", "Rose", "Chelangat", "+254700111003", "CLIENT"),
        ("simon.kiplagat", "simon.kiplagat@kandefarms.co.ke", "Simon", "Kiplagat", "+254700111004", "FINANCE_OFFICER"),
        ("mary.nyambura", "mary.nyambura@kandefarms.co.ke", "Mary", "Nyambura", "+254700111005", "WAREHOUSE_MGR"),
    ],
}

# ══════════════════════════════════════════════════════════════════════════════
# Route definitions — East African corridors
# ══════════════════════════════════════════════════════════════════════════════

ROUTE_DEFS = [
    ("Nairobi", "Mombasa", 485, 10),
    ("Mombasa", "Nairobi", 485, 10),
    ("Nairobi", "Kampala", 690, 14),
    ("Kampala", "Nairobi", 690, 14),
    ("Mombasa", "Kampala", 1140, 22),
    ("Kampala", "Mombasa", 1140, 22),
    ("Nairobi", "Arusha", 270, 5.5),
    ("Arusha", "Nairobi", 270, 5.5),
    ("Dar es Salaam", "Arusha", 640, 12),
    ("Arusha", "Dar es Salaam", 640, 12),
    ("Mombasa", "Dar es Salaam", 510, 11),
    ("Dar es Salaam", "Mombasa", 510, 11),
    ("Nairobi", "Kisumu", 350, 7),
    ("Kisumu", "Nairobi", 350, 7),
    ("Kigali", "Kampala", 500, 10),
    ("Kampala", "Kigali", 500, 10),
    ("Kampala", "Juba", 580, 12),
    ("Goma", "Kigali", 160, 4),
    ("Kigali", "Goma", 160, 4),
    ("Nairobi", "Jinja", 610, 12),
    ("Jinja", "Nairobi", 610, 12),
    ("Mombasa", "Kigali", 1420, 28),
    ("Kigali", "Mombasa", 1420, 28),
    ("Arusha", "Nakuru", 380, 8),
    ("Nakuru", "Arusha", 380, 8),
]

# ══════════════════════════════════════════════════════════════════════════════
# Truck makes / models — East African fleet
# ══════════════════════════════════════════════════════════════════════════════

TRUCK_MAKES = [
    ("Mitsubishi", "Fuso Fighter", "K"),
    ("Isuzu", "FVR 900", "K"),
    ("Hino", "500 Series", "K"),
    ("Scania", "P410", "T"),
    ("Mercedes-Benz", "Actros 2645", "T"),
    ("MAN", "TGS 26.440", "T"),
    ("Volvo", "FH 540", "T"),
    ("Toyota", "Dyna", "K"),
    ("UD Trucks", "Quester", "K"),
    ("Tata", "LPT 2518", "E"),
]

KENYAN_PLATES = ["KCB", "KCC", "KCD", "KCE", "KCF", "KCG", "KBZ", "KCA", "KBX", "KBY"]
UGANDAN_PLATES = ["UAP", "UAQ", "UAR", "UAS", "UAT", "UAU"]
TANZANIAN_PLATES = ["T123", "T456", "T789", "T234", "T567", "T890"]
RWANDAN_PLATES = ["RAB", "RAC", "RAD"]
DRC_PLATES = ["CGO", "CG1", "CG2"]

PLATE_POOL = {
    "Kenya": KENYAN_PLATES,
    "Uganda": UGANDAN_PLATES,
    "Tanzania": TANZANIAN_PLATES,
    "Rwanda": RWANDAN_PLATES,
    "DRC": DRC_PLATES,
}


class Command(BaseCommand):
    help = "Seed 6 companies with full fake data across all domains for presentations."

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                            help='Delete all [Seed]-tagged data first, then regenerate.')

    def handle(self, *args, **options):
        if options['force']:
            self._purge_seed_data()

        self.orgs = {}
        self.users_by_org = {}
        self.all_users = {}
        self.carriers = {}
        self.routes = {}
        self.trucks = {}
        self.drivers = {}

        self._create_orgs()
        self._create_users()
        self._create_carriers()
        self._create_routes()
        self._create_trucks()
        self._create_drivers()
        self._create_shipments()
        self._create_invoices_and_payments()
        self._create_marketplace()
        self._create_social_posts()
        self._create_conversations()
        self._create_driver_history()

        total_users = sum(len(v) for v in self.users_by_org.values())
        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {len(self.orgs)} orgs, {total_users} users, '
            f'{len(self.carriers)} carriers, {len(self.trucks)} trucks, '
            f'{len(self.drivers)} drivers created.'
        ))

    # ── helpers ──────────────────────────────────────────────────────────────

    def _purge_seed_data(self):
        """Delete all data tagged with [Seed] prefix."""
        orgs = Organization.objects.filter(name__startswith='[Seed]')
        for org in orgs:
            User.objects.filter(organization=org).delete()
            Carrier.objects.filter(organization=org).delete()
            Truck.objects.filter(organization=org).delete()
            Driver.objects.filter(organization=org).delete()
        orgs.delete()
        # Also purge seed shipments / conversations
        Shipment.objects.filter(tracking_number__startswith='SEED').delete()
        Conversation.objects.filter(subject__startswith='[Seed]').delete()
        SocialPost.objects.filter(content__startswith='[Seed]').delete()
        Invoice.objects.filter(invoice_number__startswith='CT-SEED').delete()
        FreightListing.objects.filter(description__startswith='[Seed]').delete()
        self.stdout.write(self.style.WARNING('Purged all [Seed]-tagged data.'))

    def _create_orgs(self):
        for org_def in ORG_DEFS:
            org, created = Organization.objects.get_or_create(
                slug=org_def['slug'],
                defaults=dict(
                    name=org_def['name'],
                    org_type=org_def['org_type'],
                    country=org_def['country'],
                    address=org_def['address'],
                    website=org_def['website'],
                    is_verified=True,
                ),
            )
            self.orgs[org_def['slug']] = org
            tag = 'Created' if created else 'Skipped (exists)'
            self.stdout.write(f'  {tag} org: {org.name}')

    def _create_users(self):
        for org_slug, users_def in USER_DEFS_BY_ORG.items():
            org = self.orgs[org_slug]
            created_users = []
            for username, email, first, last, phone, role in users_def:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults=dict(
                        email=email,
                        first_name=first,
                        last_name=last,
                        phone=phone,
                        role=role,
                        organization=org,
                        is_active=True,
                        onboarding_completed=True,
                    ),
                )
                if created:
                    user.set_password(PASSWORD)
                    user.save()
                created_users.append(user)
                self.all_users[username] = user
                tag = 'Created' if created else 'Skipped'
                if created:
                    self.stdout.write(f'    {tag} user: {user.get_full_name()} ({role}) — {org_slug}')
            self.users_by_org[org_slug] = created_users

    def _create_carriers(self):
        carrier_defs = [
            # Mombasa Port Logistics (FREIGHT_FORWARDER — 2 carriers)
            ("MPL-EXPRESS", "MPL Express", "mombasa-port-logistics", "Kenya", "Mombasa"),
            ("MPL-COASTAL", "MPL Coastal Freight", "mombasa-port-logistics", "Kenya", "Mombasa"),
            # Lake Victoria Freight (CARRIER_COMPANY — 4 carriers)
            ("LVF-FERRY", "Lake Vic Ferry Services", "lake-victoria-freight", "Uganda", "Jinja"),
            ("LVF-LONGHAUL", "Lake Vic Long Haul", "lake-victoria-freight", "Uganda", "Kampala"),
            ("LVF-REGIONAL", "Lake Vic Regional", "lake-victoria-freight", "Uganda", "Entebbe"),
            ("LVF-BUSOGA", "Busoga Carriers", "lake-victoria-freight", "Uganda", "Jinja"),
            # Kilimanjaro Express (CARRIER_COMPANY — 4 carriers)
            ("KILI-CARGO", "Kili Cargo Ltd", "kilimanjaro-express", "Tanzania", "Arusha"),
            ("KILI-ROAD", "Kili Road Freight", "kilimanjaro-express", "Tanzania", "Moshi"),
            ("KILI-TRANS", "Kili Trans Express", "kilimanjaro-express", "Tanzania", "Arusha"),
            ("KILI-DAR", "Dar-Kili Connect", "kilimanjaro-express", "Tanzania", "Dar es Salaam"),
            # Rwanda Customs Brokers (BROKERAGE — 2 carriers)
            ("RCB-TRANSIT", "RCB Transit", "rwanda-customs-brokers", "Rwanda", "Kigali"),
            ("RCB-CLEAR", "RCB Clearance Express", "rwanda-customs-brokers", "Rwanda", "Kigali"),
            # Eastern DRC Traders (SHIPPER — 2 carriers)
            ("EDRC-GOMA", "Goma Transport", "eastern-drc-traders", "DRC", "Goma"),
            ("EDRC-VIRUNGA", "Virunga Logistics", "eastern-drc-traders", "DRC", "Goma"),
            # Kande Farms Ltd (SHIPPER — 2 carriers)
            ("KFL-MOMBASA", "KFL Mombasa Transport", "kande-farms-ltd", "Kenya", "Mombasa"),
            ("KFL-NAIROBI", "KFL Nairobi Freight", "kande-farms-ltd", "Kenya", "Nairobi"),
        ]
        for code, name, org_slug, country, hq in carrier_defs:
            org = self.orgs[org_slug]
            carrier, created = Carrier.objects.get_or_create(
                code=code,
                defaults=dict(
                    name=name, organization=org, country=country,
                    headquarters=hq, status='ACTIVE',
                    total_shipments=random.randint(20, 200),
                    on_time_rate=round(random.uniform(78, 98), 1),
                    rating=round(random.uniform(3.8, 5.0), 1),
                    specialties=['General Cargo', 'Container', 'Break Bulk'],
                ),
            )
            self.carriers[code] = carrier
            if created:
                self.stdout.write(f'    Created carrier: {name} ({code})')

    def _create_routes(self):
        for origin, dest, km, hrs in ROUTE_DEFS:
            key = f'{origin}->{dest}'
            route = Route.objects.filter(origin=origin, destination=dest).first()
            if not route:
                route = Route.objects.create(
                    origin=origin, destination=dest,
                    distance_km=km, estimated_hours=hrs,
                )
            self.routes[key] = route

    def _create_trucks(self):
        truck_idx = 1
        for org_slug, org in self.orgs.items():
            country = org.country
            plates = PLATE_POOL.get(country, KENYAN_PLATES)
            num_trucks = 6 if org.org_type == 'CARRIER_COMPANY' else 3
            for i in range(num_trucks):
                make, model, size = random.choice(TRUCK_MAKES)
                fleet_id = f'TX-{truck_idx:03d}'
                plate_prefix = random.choice(plates)
                plate = f'{plate_prefix} {100 + i}{chr(65 + i)}'
                truck, created = Truck.objects.get_or_create(
                    fleet_id=fleet_id,
                    defaults=dict(
                        make=make, model=model, year=random.randint(2018, 2025),
                        plate=plate, vin=f'VIN{random.randint(100000, 999999)}',
                        color=random.choice(['White', 'Blue', 'Green', 'Red', 'Yellow']),
                        payload_tonnes=round(random.uniform(8, 30), 1),
                        engine_cc=random.choice([6400, 7680, 8800, 10500]),
                        fuel_type='DIESEL', fuel_capacity_l=random.choice([200, 300, 400]),
                        status=random.choice(['ACTIVE', 'ACTIVE', 'IDLE']),
                        odometer_km=random.randint(20000, 250000),
                        organization=org,
                        current_location=f'{random.choice(["Nairobi", "Mombasa", "Kampala", "Arusha", "Kigali"])}',
                        latitude=-1.2921 + random.uniform(-3, 3),
                        longitude=36.8219 + random.uniform(-3, 3),
                    ),
                )
                self.trucks[fleet_id] = truck
                truck_idx += 1
                if created:
                    self.stdout.write(f'    Created truck: {plate} ({make} {model}) — {org_slug}')

    def _create_drivers(self):
        first_names_m = ['Peter', 'John', 'David', 'Samuel', 'Daniel', 'Joseph', 'Michael',
                          'James', 'Patrick', 'Emmanuel', 'Robert', 'Charles', 'Moses', 'Isaac',
                          'Fred', 'George', 'Paul', 'Stephen', 'Andrew', 'William', 'Thomas',
                          'Richard', 'Henry', 'Chris', 'Alex', 'Ben', 'Victor', 'Tony', 'Oscar', 'Felix']
        last_names_m = ['Otieno', 'Mwangi', 'Kamau', 'Ochieng', 'Njuguna', 'Kiprotich', 'Wanjala',
                         'Mutua', 'Omondi', 'Wafula', 'Kato', 'Okello', 'Lwanga', 'Mugisha',
                         'Ssemwogerere', 'Mushi', 'Mrema', 'Habimana', 'Niyonshuti', 'Mbula',
                         'Mutombo', 'Kasongo', 'Kambale', 'Ndayisaba', 'Juma', 'Salim']
        org_driver_slugs = [s for s in self.orgs if s not in ('rwanda-customs-brokers',)]

        for org_slug in org_driver_slugs:
            org = self.orgs[org_slug]
            country = org.country
            # Number of drivers: more for carrier companies
            num_drivers = 7 if org.org_type == 'CARRIER_COMPANY' else 4
            for i in range(num_drivers):
                driver_id = f'DRV-{len(self.drivers) + 101}'
                fname = random.choice(first_names_m)
                lname = random.choice(last_names_m)
                phone = f'+{random.choice(["2547","2557","2567","2507","2439"])}{random.randint(10000000,99999999)}'
                driver, created = Driver.objects.get_or_create(
                    driver_id=driver_id,
                    defaults=dict(
                        organization=org, first_name=fname, last_name=lname,
                        phone=phone, email=f'{fname.lower()}.{lname.lower()}@driver.co.ke',
                        license_number=f'DL{random.randint(100000, 999999)}',
                        license_class=random.choice(['CE', 'C', 'B', 'ADR']),
                        license_expiry=date.today() + timedelta(days=random.randint(180, 1200)),
                        status=random.choice(['AVAILABLE', 'ON_ROUTE', 'AVAILABLE', 'ON_ROUTE', 'OFF_DUTY']),
                        date_joined=date.today() - timedelta(days=random.randint(60, 2000)),
                        years_experience=random.randint(2, 18),
                        rating=round(random.uniform(3.5, 5.0), 1),
                        on_time_rate=round(random.uniform(75, 100), 1),
                        total_jobs=random.randint(10, 200),
                        total_km=random.randint(5000, 200000),
                        earnings_mtd=Decimal(random.randint(15000, 120000)),
                        current_location=random.choice(['Nairobi', 'Mombasa', 'Kampala', 'Arusha', 'Kigali']),
                        latitude=-1.2921 + random.uniform(-5, 5),
                        longitude=36.8219 + random.uniform(-5, 5),
                        certifications=['Dangerous Goods', 'Defensive Driving'] if random.random() > 0.5 else [],
                    ),
                )
                self.drivers[driver_id] = driver
                if created:
                    self.stdout.write(f'    Created driver: {fname} {lname} ({driver_id}) — {org_slug}')

    def _create_shipments(self):
        status_weights = ['PENDING'] * 5 + ['IN_TRANSIT'] * 15 + ['CUSTOMS'] * 5 + ['DELIVERED'] * 20 + ['DELAYED'] * 5
        event_types = ['DEPARTURE', 'CHECKPOINT', 'CHECKPOINT', 'CUSTOMS_ENTRY', 'CUSTOMS_CLEAR', 'ARRIVAL', 'DELAY', 'NOTE']
        checkpoints = {
            'Nairobi->Mombasa': ['Athi River', 'Emali', 'Voi', 'Mariakani'],
            'Mombasa->Nairobi': ['Mariakani', 'Voi', 'Emali', 'Athi River'],
            'Nairobi->Kampala': ['Naivasha', 'Eldoret', 'Malaba Border', 'Jinja'],
            'Kampala->Nairobi': ['Jinja', 'Malaba Border', 'Eldoret', 'Naivasha'],
            'Mombasa->Kampala': ['Voi', 'Nairobi', 'Eldoret', 'Malaba Border'],
            'Kampala->Mombasa': ['Malaba Border', 'Eldoret', 'Nairobi', 'Voi'],
            'Nairobi->Arusha': ['Kajiado', 'Namanga Border', 'Longido'],
            'Arusha->Nairobi': ['Longido', 'Namanga Border', 'Kajiado'],
            'Kigali->Kampala': ['Nyabugogo', 'Gatuna Border', 'Kabale', 'Masaka'],
            'Kampala->Kigali': ['Masaka', 'Kabale', 'Gatuna Border', 'Nyabugogo'],
        }

        # Assign trucks and drivers to shipments
        truck_list = list(self.trucks.values())
        driver_list = list(self.drivers.values())
        carrier_list = list(self.carriers.values())

        for i in range(50):
            route_key = random.choice(list(self.routes.keys()))
            route = self.routes[route_key]
            status = random.choice(status_weights)
            scheduled = NOW - timedelta(days=random.randint(5, 60))
            is_delivered = status == 'DELIVERED'
            actual_arrival = scheduled + timedelta(hours=route.estimated_hours + random.randint(-2, 8)) if is_delivered else None

            truck = random.choice(truck_list) if truck_list else None
            driver = random.choice(driver_list) if driver_list else None
            carrier = random.choice(carrier_list) if carrier_list else None

            # Pick a client from any org
            all_users_list = list(self.all_users.values())
            client = random.choice([u for u in all_users_list if u.role == 'CLIENT']) if all_users_list else None

            tn = f'SEED-{(i + 1):04d}'
            shipment, created = Shipment.objects.get_or_create(
                tracking_number=tn,
                defaults=dict(
                    route=route, status=status,
                    dispatch_status='DISPATCHED' if status != 'PENDING' else 'UNASSIGNED',
                    carrier=carrier, assigned_truck=truck, assigned_driver=driver,
                    client=client, weight_kg=random.randint(500, 25000),
                    scheduled_departure=scheduled,
                    scheduled_arrival=scheduled + timedelta(hours=route.estimated_hours),
                    actual_arrival=actual_arrival,
                    delay_risk_score=round(random.uniform(0, 1), 2),
                ),
            )
            if not created:
                continue

            # Create tracking events
            cps = checkpoints.get(route_key, [route.origin, route.destination])
            for j, cp in enumerate(cps[:random.randint(2, len(cps))]):
                TrackingEvent.objects.create(
                    shipment=shipment,
                    event_type=random.choice(event_types),
                    location=cp,
                    notes=f'Reached {cp}' if random.random() > 0.5 else '',
                    timestamp=scheduled + timedelta(hours=j * (route.estimated_hours / len(cps))),
                    recorded_by=random.choice(all_users_list) if random.random() > 0.3 else None,
                )

        total = Shipment.objects.filter(tracking_number__startswith='SEED').count()
        self.stdout.write(f'    {total} shipments with tracking events')

    def _create_invoices_and_payments(self):
        shipments = list(Shipment.objects.filter(tracking_number__startswith='SEED'))
        all_users_list = list(self.all_users.values())
        currencies = ['KES', 'KES', 'KES', 'KES', 'KES', 'KES', 'KES', 'USD', 'USD', 'UGX', 'TZS', 'RWF']
        payment_providers = ['MPESA', 'MPESA', 'MPESA', 'MPESA', 'MPESA', 'MPESA', 'FLUTTERWAVE', 'FLUTTERWAVE', 'STRIPE', 'PESAPAL', 'MTN', 'AIRTEL']

        invoice_count = 0
        for shipment in shipments:
            num_invoices = random.choice([1, 1, 1, 2])  # Most get 1, some get 2
            for j in range(num_invoices):
                currency = random.choice(currencies)
                amount = Decimal(random.randint(15000, 500000)) if currency == 'KES' else Decimal(random.randint(500, 8000))
                status = random.choice(['PAID', 'PAID', 'PAID', 'PENDING', 'PENDING', 'OVERDUE'])
                inv_num = f'CT-SEED-{invoice_count + 1:04d}'

                created_by = random.choice(all_users_list) if all_users_list else None
                invoice, created = Invoice.objects.get_or_create(
                    invoice_number=inv_num,
                    defaults=dict(
                        shipment=shipment, amount_kes=amount, currency=currency,
                        status=status, description=f'Freight charges — {shipment.route}',
                        created_by=created_by,
                        paid_at=NOW - timedelta(days=random.randint(1, 30)) if status == 'PAID' else None,
                    ),
                )
                if not created:
                    continue
                invoice_count += 1

                # Create 1-2 payments per invoice
                if status in ('PAID', 'PENDING') and random.random() > 0.2:
                    Payment.objects.create(
                        invoice=invoice,
                        provider=random.choice(payment_providers),
                        provider_reference=f'REF{random.randint(100000, 999999)}',
                        amount=amount if random.random() > 0.3 else amount * Decimal(random.uniform(0.4, 0.9)),
                        currency=currency,
                        status='SUCCESS' if status == 'PAID' else 'PENDING',
                        phone_number=f'+2547{random.randint(10000000, 99999999)}',
                    )

        total = Invoice.objects.filter(invoice_number__startswith='CT-SEED').count()
        self.stdout.write(f'    {total} invoices with payments')

    def _create_marketplace(self):
        # Idempotent: skip if seed listings already exist
        if FreightListing.objects.filter(description__startswith='[Seed]').exists():
            total = FreightListing.objects.filter(description__startswith='[Seed]').count()
            self.stdout.write(f'    Skipped marketplace (already {total} listings exist)')
            return

        all_users_list = list(self.all_users.values())
        shipper_users = [u for u in all_users_list if u.role in ('CLIENT', 'ADMIN', 'LOGISTICS_MGR')]
        carrier_ents = list(self.carriers.values())
        truck_list = list(self.trucks.values())
        driver_list = list(self.drivers.values())

        listing_count = 0
        for i in range(20):
            posted_by = random.choice(shipper_users) if shipper_users else random.choice(all_users_list)
            origins = ['Nairobi', 'Mombasa', 'Kampala', 'Arusha', 'Dar es Salaam', 'Kigali', 'Goma', 'Jinja', 'Kisumu']
            origin = random.choice(origins)
            dest = random.choice([d for d in origins if d != origin])
            pickup = date.today() + timedelta(days=random.randint(1, 14))
            listing = FreightListing.objects.create(
                posted_by=posted_by,
                cargo_type=random.choice(['GENERAL', 'PERISHABLE', 'BULK', 'CONTAINER', 'FRAGILE', 'HAZARDOUS']),
                weight_kg=random.randint(500, 30000),
                volume_m3=random.uniform(2, 60) if random.random() > 0.3 else None,
                origin=origin, destination=dest,
                pickup_date=pickup,
                delivery_date=pickup + timedelta(days=random.randint(2, 10)),
                budget_min=Decimal(random.randint(10000, 80000)),
                budget_max=Decimal(random.randint(80000, 250000)),
                description=f'[Seed] {random.choice(["Fresh produce", "Construction materials", "Electronics", "Textiles", "Coffee beans", "Tea", "Maize flour", "Steel pipes", "Medical supplies", "Spare parts"])} shipment from {origin} to {dest}.',
                requires_hazmat=random.random() < 0.1,
                requires_reefer=random.random() < 0.15,
                status=random.choice(['OPEN', 'OPEN', 'OPEN', 'IN_PROGRESS', 'AWARDED', 'COMPLETED']),
                expires_at=NOW + timedelta(days=random.randint(5, 25)),
            )
            listing_count += 1

            # 1-5 bids per listing
            num_bidders = random.randint(1, min(5, len(carrier_ents)))
            for carrier in random.sample(carrier_ents, num_bidders):
                try:
                    Bid.objects.create(
                        listing=listing, carrier=carrier,
                        truck=random.choice(truck_list) if random.random() > 0.3 else None,
                        driver=random.choice(driver_list) if random.random() > 0.4 else None,
                        amount=Decimal(random.randint(
                            int(listing.budget_min or 10000), int(listing.budget_max or 200000),
                        )),
                        notes=f'Can deliver in {random.randint(2, 7)} days',
                        status=random.choice(['PENDING', 'PENDING', 'ACCEPTED']),
                        estimated_days=random.randint(2, 8),
                    )
                except Exception:
                    pass  # Unique constraint may trigger

        self.stdout.write(f'    Created {listing_count} marketplace listings with bids')

    def _create_social_posts(self):
        # Idempotent check: any post by a seed user
        seed_user_ids = [u.id for u in self.all_users.values()]
        if SocialPost.objects.filter(author_id__in=seed_user_ids).exists():
            total = SocialPost.objects.filter(author_id__in=seed_user_ids).count()
            self.stdout.write(f'    Skipped social posts (already {total} posts exist)')
            return

        all_users_list = list(self.all_users.values())

        posts_data = [
            # Kande Farms Ltd posts
            ("kande-farms-ltd", "diamond.akinyi", False,
             "Management keeps saying bonuses are coming but it's been three months. "
             "We work hard at Kande Farms — we deserve better!"),
            ("kande-farms-ltd", "tumaini.wafula", False,
             "Wantam! Hii shipment ya green beans imechelewa kufika Mombasa. "
             "Customs clearance inakaa tricky this week — anyone else facing delays at the port?"),
            ("kande-farms-ltd", "rose.chelangat", False,
             "Just confirmed our avocado shipment to Europe cleared phytosanitary inspection. "
             "Big win for Kande quality standards!"),
            ("kande-farms-ltd", "mary.nyambura", True,
             "Warehouse update: New cold storage unit operational next week. "
             "We'll be able to hold 40 tonnes of fresh produce at 2°C."),
            # Mombasa Port Logistics posts
            ("mombasa-port-logistics", "fatima.hassan", False,
             "Port congestion update: Berth 3-5 cleared ahead of schedule. "
             "Container dwell time down to 3.2 days average this week."),
            ("mombasa-port-logistics", "aisha.mohammed", False,
             "Dispatched 12 trucks from Mombasa CFS to Nairobi ICD yesterday. "
             "All cleared customs within 4 hours — new record for our team!"),
            # Lake Victoria Freight posts
            ("lake-victoria-freight", "patrick.tumusiime", False,
             "Lake Victoria Freight just signed a contract to move 500 tonnes of maize "
             "from Jinja to Juba over the next quarter. Big things coming!"),
            ("lake-victoria-freight", "brenda.namakula", False,
             "Border crossing times at Malaba have improved massively since the "
             "new one-stop border post opened. Uganda-Kenya corridor is flowing."),
            # Kilimanjaro Express posts
            ("kilimanjaro-express", "joseph.mushi", False,
             "Kili Express expanding — we've added 3 new Mercedes Actros trucks "
             "to our fleet this month. Arusha to Dar in under 10 hours now."),
            ("kilimanjaro-express", "grace.macha", False,
             "Heads up to all transporters: the Arusha-Namanga road has construction "
             "delays between kilometer 40-60. Add 2 hours to your ETA."),
            # Rwanda Customs Brokers posts
            ("rwanda-customs-brokers", "jean.habimana", False,
             "Proud to announce RCB has been certified as an Authorized Economic Operator "
             "by Rwanda Revenue Authority. Faster clearance for all our clients!"),
            ("rwanda-customs-brokers", "grace.umutoni", True,
             "Customs alert: New HS code classification rules for electronics "
             "imports into Rwanda take effect next month. Get your paperwork updated."),
            # Eastern DRC Traders posts
            ("eastern-drc-traders", "guy.mbula", False,
             "Goma is open for business! Eastern DRC Traders moving minerals and "
             "agricultural products across the Great Lakes region."),
            ("eastern-drc-traders", "nadia.kasongo", False,
             "Cross-border trade between Goma and Gisenyi is booming. "
             "We're seeing 40% increase in small-scale freight this quarter."),
        ]

        post_objs = []
        for org_slug, username, is_pinned, content in posts_data:
            user = self.all_users.get(username)
            if not user:
                continue
            post = SocialPost.objects.create(
                author=user, content=content,
                is_pinned=is_pinned,
                is_announcement=is_pinned,
                like_count=random.randint(0, 12),
                reply_count=0,
            )
            post_objs.append(post)

        # Comments on posts
        comments_data = [
            # Responses to Diamond's complaint
            ("rose.chelangat", "Diamond akinyi, pole sana. I've raised this with HR — "
             "they say the bonus review is next month. Let's stay hopeful!"),
            ("simon.kiplagat", "Finance speaking: the bonus delay is because we're still "
             "reconciling Q1 export revenues. Should be resolved by month end."),
            ("tumaini.wafula", "Haha Diamond always complaining on here! Lakini you're "
             "right, tunangoja. Bonuses ni yetu!"),
            # Responses to Tumaini's customs post
            ("diamond.akinyi", "Tumaini, I had a container stuck at customs for 5 days last "
             "week. The new valuation process is chaos. Let's escalate to Mombasa Port Logistics."),
            ("fatima.hassan", "We've been helping Kande with their customs clearance at "
             "Mombasa port. Shoot me a DM and I'll connect you with Hassam."),
        ]

        for i, (username, content) in enumerate(comments_data):
            user = self.all_users.get(username)
            if not user:
                continue
            post = post_objs[i % len(post_objs)] if post_objs else None
            if not post:
                continue
            SocialComment.objects.create(post=post, author=user, content=content)
            post.reply_count += 1
            post.save(update_fields=['reply_count'])

        self.stdout.write(f'    Created {len(post_objs)} social posts with comments')

    def _create_conversations(self):
        # Idempotent: skip if seed conversations already exist
        if Conversation.objects.filter(subject__startswith='[Seed]').exists():
            total = Conversation.objects.filter(subject__startswith='[Seed]').count()
            self.stdout.write(f'    Skipped conversations (already {total} communities exist)')
            return

        all_users_list = list(self.all_users.values())

        # ── 3 community groups ───────────────────────────────────────────────

        communities = [
            ("[Seed] East Africa Freight Network",
             "Cross-org community for logistics professionals across East Africa. "
             "Share corridor updates, border news, and industry insights.",
             ['patrick.tumusiime', 'fatima.hassan', 'joseph.mushi', 'jean.habimana',
              'guy.mbula', 'diamond.akinyi', 'brenda.namakula', 'grace.macha']),
            ("[Seed] Kande Farms Internal",
             "Internal company communications for Kande Farms Ltd staff.",
             ['diamond.akinyi', 'tumaini.wafula', 'rose.chelangat', 'simon.kiplagat', 'mary.nyambura']),
            ("[Seed] Carriers Roundtable",
             "Private group for carrier company owners and dispatchers to coordinate.",
             ['patrick.tumusiime', 'moses.ssemwogerere', 'joseph.mushi', 'fatma.juma',
              'robert.kato', 'emmanuel.mrema']),
        ]

        for subject, description, usernames in communities:
            users = [self.all_users[u] for u in usernames if u in self.all_users]
            if len(users) < 2:
                continue
            creator = users[0]
            conv = Conversation.objects.create(
                subject=subject, description=description,
                is_group=True, is_community=True,
                created_by=creator,
            )
            conv.participants.set(users)

            # Seed messages
            seed_msgs = [
                (creator, f'Welcome to {subject}! This is our space to share updates and coordinate.'),
            ]
            if 'Freight Network' in subject:
                seed_msgs += [
                    (users[1], 'Great initiative! The Northern Corridor has been seeing some serious delays lately.'),
                    (users[2], 'Tanzania side is relatively smooth right now. Central Corridor from Dar to Rusumo is clear.'),
                    (users[3], 'Rwanda border posts are fully automated now — clearance takes max 2 hours.'),
                    (users[0], 'Anyone heard about the new axle load limits Kenya is introducing?'),
                    (users[1], 'Yes, 56 tonnes gross vehicle weight as of last month. Already being enforced at Mariakani weighbridge.'),
                    (users[4], 'DRC side, we need better coordination on the Goma-Gisenyi crossing. Queues are getting long.'),
                    (users[5], 'Kande Farms has 5 containers arriving Mombasa next week — who can help with last-mile to Nairobi?'),
                    (users[6], 'Lake Vic can handle that. We have capacity on the Mombasa-Kampala corridor. DM me.'),
                    (users[7], 'Kili Express also available for Mombasa-Arusha-Nairobi triangle. Competitive rates.'),
                    (users[0], 'Love the energy here! Let us keep sharing corridor updates as they come.'),
                ]
            elif 'Kande Farms' in subject:
                seed_msgs += [
                    (users[1], 'Team — warehouse inventory report due Friday. Please submit your counts.'),
                    (users[0], 'Noted. Also, does anyone know when the new forklift arrives?'),
                    (users[2], 'Client meeting tomorrow at 10am with the Dutch buyers. Need logistics data ready.'),
                    (users[3], 'Q2 invoices going out this week. Revenue looking strong — up 18% from last quarter.'),
                    (users[4], 'Cold storage unit commissioning got pushed to next Monday. Electricians finishing up.'),
                    (users[0], 'Thanks for the updates everyone. Let us crush this quarter!'),
                ]
            elif 'Carriers' in subject:
                seed_msgs += [
                    (users[1], 'Anyone have an empty truck from Kampala to Nairobi this Thursday?'),
                    (users[2], 'I have a 20-tonner heading that way. What is the cargo?'),
                    (users[3], 'Fuel prices in Tanzania dropped 3% this week. Good for margins.'),
                    (users[4], 'New rate card for the Kigali corridor is out. KES 120 per kg minimum.'),
                    (users[0], 'Let us standardize our rates for the Kampala-Nairobi corridor. Too much undercutting going on.'),
                ]

            for sender, content in seed_msgs:
                Message.objects.create(conversation=conv, sender=sender, content=content)
            self.stdout.write(f'    Created community: {subject}')

        # ── 5 cross-org 1-on-1 conversations ─────────────────────────────────

        cross_chats = [
            ('diamond.akinyi', 'fatima.hassan'),
            ('tumaini.wafula', 'aisha.mohammed'),
            ('patrick.tumusiime', 'joseph.mushi'),
            ('jean.habimana', 'guy.mbula'),
            ('rose.chelangat', 'nadia.kasongo'),
        ]

        chat_msgs = [
            "Hi! Just wanted to connect — we might have some cross-border business opportunities.",
            "Absolutely! We've been looking for partners in your region. What kind of volumes are you moving?",
            "Around 200-300 tonnes per month, mostly agricultural exports. Do you have capacity?",
            "We can definitely handle that. Let me check our fleet availability and get back to you with rates.",
            "Perfect. Also — what's the customs situation like on your side? Any recent changes?",
            "Things are stable right now. Clearance takes 1-3 days depending on the product category.",
            "Great. Let me loop in our operations team and we can set up a formal agreement.",
            "Sounds good! I'll send over our rate card and insurance details. Looking forward to working together.",
        ]

        for u1, u2 in cross_chats:
            user1 = self.all_users.get(u1)
            user2 = self.all_users.get(u2)
            if not user1 or not user2:
                continue
            conv = Conversation.objects.create(
                subject=f'{user1.first_name} & {user2.first_name}',
                created_by=user1,
            )
            conv.participants.set([user1, user2])
            for i, content in enumerate(chat_msgs[:random.randint(4, 8)]):
                sender = user1 if i % 2 == 0 else user2
                Message.objects.create(conversation=conv, sender=sender, content=content)
            self.stdout.write(f'    Created chat: {user1.first_name} ↔ {user2.first_name}')

    def _create_driver_history(self):
        # Idempotent: skip if any seed driver already has job history
        seed_driver_ids = [d.id for d in self.drivers.values()]
        if DriverJobHistory.objects.filter(driver_id__in=seed_driver_ids).exists():
            total = DriverJobHistory.objects.filter(driver_id__in=seed_driver_ids).count()
            exp_total = DriverExpense.objects.filter(driver_id__in=seed_driver_ids).count()
            self.stdout.write(f'    Skipped driver history (already {total} jobs, {exp_total} expenses exist)')
            return

        shipments = list(Shipment.objects.filter(tracking_number__startswith='SEED'))
        driver_list = list(self.drivers.values())
        routes_list = list(self.routes.keys())

        history_count = 0
        expense_count = 0
        expense_types = ['FUEL', 'TOLL', 'BORDER', 'PARKING', 'REPAIR', 'MEAL', 'LODGING', 'BRIBE', 'OTHER']

        for driver in driver_list:
            num_jobs = random.randint(3, 10)
            for _ in range(num_jobs):
                route_label = random.choice(routes_list) if routes_list else 'Nairobi->Mombasa'
                shipment = random.choice(shipments) if shipments and random.random() > 0.5 else None
                DriverJobHistory.objects.create(
                    driver=driver,
                    shipment=shipment,
                    route_label=route_label,
                    distance_km=random.randint(100, 1200),
                    status=random.choice(['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'IN_PROGRESS']),
                    on_time=random.random() > 0.15,
                    earnings_kes=Decimal(random.randint(3000, 35000)),
                    completed_at=NOW - timedelta(days=random.randint(1, 180)),
                )
                history_count += 1

            # Expenses
            for _ in range(random.randint(2, 6)):
                DriverExpense.objects.create(
                    driver=driver,
                    shipment=random.choice(shipments) if shipments and random.random() > 0.5 else None,
                    expense_type=random.choice(expense_types),
                    amount=Decimal(random.randint(200, 15000)),
                    currency=random.choice(['KES', 'KES', 'KES', 'KES', 'USD', 'UGX', 'TZS']),
                    description=f'{random.choice(["Fuel top-up at", "Toll gate", "Border processing", "Quick repair"])} {random.choice(["Nairobi", "Mombasa", "Kampala", "Arusha"])}',
                    location=random.choice(['Nairobi', 'Mombasa', 'Kampala', 'Arusha', 'Kigali']),
                    reimbursed=random.random() > 0.4,
                )
                expense_count += 1

        self.stdout.write(f'    Created {history_count} driver job history entries, {expense_count} expenses')
