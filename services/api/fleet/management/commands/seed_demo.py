"""
Seed the CargoTrack database with realistic East Africa logistics demo data.

Creates 7 companies with 20-30 employees each, full user registration data,
carriers, drivers, trucks, shipments, marketplace listings/bids, scale tickets,
chat conversations, invoices, alerts, and complete audit trails.

Safe to run multiple times (clears all seed data first).

Usage:
    docker compose -f docker-compose.sandbox.yml run backend python manage.py seed_demo
"""

import random
from datetime import date, timedelta
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
PASSWORD = "demo123"

# ═══════════════════════════════════════════════════════════════════════════════
# Helper utilities
# ═══════════════════════════════════════════════════════════════════════════════

def rnd(a, b):
    return random.randint(a, b)


def rnd_f(a, b, dp=1):
    return round(random.uniform(a, b), dp)


def days_ago(n):
    return timezone.now() - timedelta(days=n)


def future_days(n):
    return timezone.now() + timedelta(days=n)


def pick(seq):
    return random.choice(seq)


def pick_n(seq, n):
    return random.sample(seq, min(n, len(seq)))


# ═══════════════════════════════════════════════════════════════════════════════
# Static data pools
# ═══════════════════════════════════════════════════════════════════════════════

KENYAN_FIRST_NAMES = [
    "Kande", "Amina", "Barack", "Catherine", "David", "Esther", "Fatuma",
    "Grace", "Hassan", "Irene", "James", "Kevin", "Linda", "Mercy",
    "Nancy", "Ochieng", "Peter", "Rose", "Samuel", "Tabitha",
    "Victor", "Wanjiku", "Yusuf", "Agnes", "Brian", "Caroline",
    "Daniel", "Emily", "Francis", "Gladys", "Henry", "Ida",
    "Jackson", "Kiprotich", "Lilian", "Michael", "Njeri", "Omondi",
    "Patrick", "Queenter", "Ruth", "Stephen", "Thomas", "Usha",
    "Vincent", "Wambui", "Zachary", "Akinyi", "Brenda", "Charles",
    "Dorcas", "Erick", "Fiona", "Geoffrey", "Hellen", "Isaac",
    "Janet", "Kamau", "Lucy", "Moses", "Naomi", "Otieno",
    "Philip", "Rebecca", "Simon", "Terry", "Ahmed", "Beatrice",
    "Chris", "Diana", "Elijah", "Faith", "George", "Hannah",
    "Josphat", "Kelvin", "Leah", "Mark", "Nyambura", "Oliver",
]

KENYAN_LAST_NAMES = [
    "Abdalla", "Barasa", "Chebet", "Dlamini", "Echesa", "Gachanja",
    "Hamisi", "Iminza", "Juma", "Kariuki", "Lubega", "Maina",
    "Njoroge", "Ochieng", "Peters", "Rotich", "Salim", "Tumbo",
    "Wafula", "Wambua", "Wangari", "Adhiambo", "Bett", "Cheruiyot",
    "Gitau", "Hussein", "Jelimo", "Kibet", "Langat", "Muthoni",
    "Ndung'u", "Odhiambo", "Omari", "Kipruto", "Wanjala", "Mutua",
    "Githinji", "Mwangi", "Otieno", "Kamau", "Nyaga", "Ouma",
    "Wanjiru", "Akinyi", "Bosire", "Cherono", "Kilonzo", "Mbogo",
    "Mogaka", "Nyongesa", "Oloo", "Rono", "Sang", "Towett",
    "Wamalwa", "Yator", "Abdi", "Birir", "Chumba", "Kipchoge",
    "Kiplagat", "Makori", "Murungi", "Namachanja", "Obura", "Ogutu",
    "Sirma", "Tanui", "Wekesa", "Yego",
]

DOMAINS = {
    1: "cargotrack.co.ke",
    2: "siginon.co.ke",
    3: "bollore.co.ke",
    4: "riofresh.co.ke",
    5: "mct.co.ke",
    6: "eahauliers.co.ke",
    7: "safarichem.co.ke",
}

COMPANY_ADDRESSES = {
    1: "12th Floor, Delta Towers, Westlands, Nairobi",
    2: "Siginon Complex, Mombasa Road, Nairobi",
    3: "Bollore House, 5th Floor, Mombasa Road, Nairobi",
    4: "Rio House, Karatina Road, Nairobi",
    5: "Port Gate 12, Kilindini Harbour, Mombasa",
    6: "E.A. Hauliers Yard, Changamwe, Mombasa",
    7: "SafariChem Building, Industrial Area, Nairobi",
}

COMPANY_WEBSITES = {
    1: "https://cargotrack.co.ke",
    2: "https://siginon.com",
    3: "https://bollore-logistics.co.ke",
    4: "https://riofreshproduce.co.ke",
    5: "https://mct.co.ke",
    6: "https://eahauliers.co.ke",
    7: "https://safarichemlogistics.co.ke",
}

COMPANY_ORG_TYPES = {
    1: "FREIGHT_FORWARDER",
    2: "CARRIER_COMPANY",
    3: "FREIGHT_FORWARDER",
    4: "SHIPPER",
    5: "FREIGHT_FORWARDER",
    6: "CARRIER_COMPANY",
    7: "FREIGHT_FORWARDER",
}

COMPANY_COUNTRIES = {
    1: "Kenya", 2: "Kenya", 3: "Kenya", 4: "Kenya",
    5: "Kenya", 6: "Kenya", 7: "Kenya",
}

COMPANY_TAX_IDS = {
    1: "P052024001A", 2: "P051996543B", 3: "P052001234C",
    4: "P052011122D", 5: "P052020987E", 6: "P052018765F",
    7: "P052015432G",
}

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

CERT_POOL = [
    "ADR Dangerous Goods", "Refrigerated Cargo", "Heavy Haulage",
    "HACCP Food Safety", "Oversized Load", "Port Operations",
    "Defensive Driving", "First Aid", "GPS & Telematics",
]

ROUTES = [
    ("Nairobi", "Mombasa", 480, 8), ("Nairobi", "Kisumu", 340, 6),
    ("Mombasa", "Nairobi", 480, 8), ("Nairobi", "Nakuru", 160, 3),
    ("Kisumu", "Nairobi", 340, 6), ("Nairobi", "Eldoret", 310, 5),
    ("Mombasa", "Malindi", 120, 2), ("Nairobi", "Thika", 45, 1),
    ("Nakuru", "Kisumu", 180, 3), ("Eldoret", "Nairobi", 310, 5),
    ("Nairobi", "Nyeri", 150, 3), ("Mombasa", "Voi", 165, 3),
    ("Nairobi", "Machakos", 65, 1), ("Kisumu", "Kericho", 90, 2),
    ("Nakuru", "Nairobi", 160, 3), ("Nairobi", "Garissa", 370, 6),
    ("Mombasa", "Kwale", 50, 1), ("Nairobi", "Nanyuki", 200, 4),
    ("Kisumu", "Kakamega", 55, 1), ("Mombasa", "Taveta", 260, 5),
    ("Nairobi", "Kajiado", 85, 2), ("Eldoret", "Kisumu", 150, 3),
    ("Nairobi", "Embu", 130, 3), ("Mombasa", "Lamu", 340, 6),
]

CARRIER_DATA = [
    ("TRANSAMI", "Transami Kenya", 2),
    ("MITCHELL", "Mitchell Cotts", 2),
    ("SIGINON", "Siginon Group", 2),
    ("EAFREIGHT", "EA Freight Logistics", 6),
    ("SKYNET", "SkyNet Kenya", 3),
    ("BOLLORE", "Bollore Logistics", 3),
    ("DAMCO", "Damco Kenya", 7),
    ("KN", "Kuehne+Nagel Kenya", 7),
    ("DHL", "DHL Supply Chain EA", 1),
    ("RIO_CARRIER", "Rio Fresh Transport", 4),
    ("MCT_CARRIER", "MCT Port Services", 5),
    ("SAF_CARRIER", "SafariChem Haulage", 7),
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
    ("IN_TRANSIT", "Departed origin depot"),
    ("CHECKPOINT", "Cleared weigh bridge"),
    ("CHECKPOINT", "Arrived intermediate checkpoint"),
    ("CHECKPOINT", "Cleared port gate"),
    ("DELAY", "Traffic delay — 90 min"),
    ("OUT_FOR_DELIVERY", "Out for final delivery"),
    ("DELIVERED", "Delivered — POD signed"),
]

STATUSES = ["IN_TRANSIT", "IN_TRANSIT", "IN_TRANSIT", "DELIVERED", "DELIVERED",
            "PENDING", "CUSTOMS", "DELAYED"]

INV_STATUSES = ["PAID", "PAID", "PAID", "PENDING", "OVERDUE"]

TRUCK_STATUSES = ["ACTIVE", "ACTIVE", "ACTIVE", "IDLE", "IDLE",
                  "MAINTENANCE", "OFF_DUTY", "DECOMMISSIONED"]

DRIVER_STATUSES = ["AVAILABLE", "ON_ROUTE", "ON_ROUTE", "OFF_DUTY", "ON_LEAVE"]

FREIGHT_CARGO_TYPES = ["GENERAL", "CONTAINER", "BULK", "PERISHABLE", "FRAGILE",
                       "HAZARDOUS", "VEHICLES", "OTHER"]

ORIGIN_CITIES = ["Nairobi", "Mombasa", "Kisumu", "Eldoret", "Nakuru"]
DEST_CITIES = ["Mombasa", "Nairobi", "Kisumu", "Kampala", "Dar es Salaam",
               "Kigali", "Juba", "Malindi", "Garissa", "Nakuru"]

KENYAN_PHONE_PREFIXES = [
    "+254700", "+254701", "+254702", "+254703", "+254704",
    "+254710", "+254711", "+254712", "+254713", "+254714",
    "+254720", "+254721", "+254722", "+254723", "+254724",
    "+254730", "+254731", "+254732", "+254740", "+254741",
    "+254750", "+254751", "+254757", "+254758", "+254759",
    "+254760", "+254761", "+254768", "+254769", "+254770",
    "+254771", "+254772", "+254780", "+254781", "+254790",
    "+254791", "+254792", "+254798", "+254799",
]

CHAT_MESSAGES = [
    "Shipment status update?",
    "On schedule, arriving tomorrow.",
    "Customs clearance done.",
    "Any delays at the border?",
    "ETA updated to 14:00.",
    "Documents uploaded.",
    "Confirmed, thanks!",
    "Please send the CMR note.",
    "Truck dispatched, ETA 6 hours.",
    "Border crossing smooth today.",
    "Container arrived at ICD Nairobi.",
    "Invoice sent for approval.",
    "KRA customs entry submitted.",
    "Delivery confirmed — POD attached.",
    "Can we schedule pickup for Friday?",
    "Warehouse space confirmed for your cargo.",
    "Driver reached Malaba border, queue is short.",
    "Port health inspection cleared.",
    "Need to reschedule delivery to Monday.",
    "Payment received, thanks for prompt settlement.",
]


# ═══════════════════════════════════════════════════════════════════════════════
# Company employee definitions
# ═══════════════════════════════════════════════════════════════════════════════

def _phone():
    return f"{pick(KENYAN_PHONE_PREFIXES)}{rnd(100000, 999999)}"


def _email(first, last, company_id):
    domain = DOMAINS[company_id]
    return f"{first.lower()}.{last.lower()}@{domain}"


# Each employee: (first_name, last_name, role, is_admin_flag)
# is_admin=True means they're the company admin (ADMIN role, is_staff=True)
# The PLATFORM_OWNER goes to company 1 (CargoTrack)

COMPANY_EMPLOYEES = {
    1: [  # CargoTrack Technologies — platform company
        ("Kande", "Mark", "PLATFORM_OWNER", True),
        ("Nancy", "Wanjiku", "LOGISTICS_MGR", False),
        ("James", "Kariuki", "LOGISTICS_MGR", False),
        ("Victor", "Omondi", "DISPATCHER", False),
        ("Linda", "Chebet", "DISPATCHER", False),
        ("Brian", "Wafula", "DISPATCHER", False),
        ("Gladys", "Muthoni", "FINANCE_OFFICER", False),
        ("Patrick", "Kamau", "FINANCE_OFFICER", False),
        ("Ruth", "Akinyi", "CLIENT", False),
        ("Henry", "Ndung'u", "CLIENT", False),
        ("Fiona", "Odhiambo", "CLIENT", False),
        ("Simon", "Rotich", "CARRIER", False),
        ("Janet", "Wanjala", "CARRIER", False),
        ("Philip", "Omari", "CUSTOMS_BROKER", False),
        ("Lucy", "Gitau", "WAREHOUSE_MGR", False),
        ("Ahmed", "Salim", "PORT_AGENT", False),
        ("Diana", "Kibet", "DRIVER", False),
        ("Chris", "Cheruiyot", "DRIVER", False),
        ("Hannah", "Wambua", "DRIVER", False),
        ("Kelvin", "Juma", "DRIVER", False),
        ("Leah", "Barasa", "DRIVER", False),
        ("Mark", "Towett", "DRIVER", False),
        ("Beatrice", "Langat", "DRIVER", False),
        ("Oliver", "Sang", "DRIVER", False),
        ("Terry", "Wekesa", "DRIVER", False),
    ],
    2: [  # Siginon Group — carrier company
        ("Rose", "Wanjiru", "ADMIN", True),
        ("Daniel", "Maina", "LOGISTICS_MGR", False),
        ("Emily", "Nyambura", "LOGISTICS_MGR", False),
        ("Francis", "Nyongesa", "DISPATCHER", False),
        ("Caroline", "Chumba", "DISPATCHER", False),
        ("Ida", "Mogaka", "DISPATCHER", False),
        ("Jackson", "Kiplagat", "FINANCE_OFFICER", False),
        ("Lilian", "Bosire", "FINANCE_OFFICER", False),
        ("Michael", "Mwangi", "CLIENT", False),
        ("Queenter", "Adhiambo", "CLIENT", False),
        ("Zachary", "Ouma", "CARRIER", False),
        ("Akinyi", "Bett", "CARRIER", False),
        ("Brenda", "Cherono", "CARRIER", False),
        ("Charles", "Kilonzo", "CUSTOMS_BROKER", False),
        ("Dorcas", "Mbogo", "WAREHOUSE_MGR", False),
        ("Erick", "Kipruto", "PORT_AGENT", False),
        ("Geoffrey", "Rono", "DRIVER", False),
        ("Hellen", "Yator", "DRIVER", False),
        ("Isaac", "Abdi", "DRIVER", False),
        ("Kamau", "Birir", "DRIVER", False),
        ("Moses", "Makori", "DRIVER", False),
        ("Naomi", "Murungi", "DRIVER", False),
        ("Otieno", "Namachanja", "DRIVER", False),
        ("Rebecca", "Obura", "DRIVER", False),
        ("Thomas", "Ogutu", "DRIVER", False),
        ("Usha", "Sirma", "DRIVER", False),
        ("Vincent", "Tanui", "DRIVER", False),
        ("Wambui", "Yego", "DRIVER", False),
    ],
    3: [  # Bollore Logistics Kenya — freight forwarder
        ("Thomas", "Kibet", "ADMIN", True),
        ("Faith", "Gachanja", "LOGISTICS_MGR", False),
        ("George", "Hamisi", "DISPATCHER", False),
        ("Irene", "Iminza", "DISPATCHER", False),
        ("Kevin", "Lubega", "DISPATCHER", False),
        ("Mercy", "Peters", "FINANCE_OFFICER", False),
        ("Ochieng", "Tumbo", "FINANCE_OFFICER", False),
        ("Peter", "Wangari", "CLIENT", False),
        ("Tabitha", "Chebet", "CLIENT", False),
        ("Yusuf", "Dlamini", "CLIENT", False),
        ("Agnes", "Echesa", "CARRIER", False),
        ("Catherine", "Njoroge", "CARRIER", False),
        ("Stephen", "Ochieng", "CUSTOMS_BROKER", False),
        ("Amina", "Barasa", "CUSTOMS_BROKER", False),
        ("David", "Hussein", "WAREHOUSE_MGR", False),
        ("Esther", "Jelimo", "PORT_AGENT", False),
        ("Fatuma", "Ndung'u", "PORT_AGENT", False),
        ("Hassan", "Odhiambo", "DRIVER", False),
        ("Samuel", "Githinji", "DRIVER", False),
        ("Wanjiku", "Nyaga", "DRIVER", False),
        ("Brenda", "Oloo", "DRIVER", False),
        ("Chris", "Wamalwa", "DRIVER", False),
        ("Diana", "Kipchoge", "DRIVER", False),
        ("Elijah", "Omari", "DRIVER", False),
        ("Josphat", "Otieno", "DRIVER", False),
        ("Nyambura", "Wanjala", "DRIVER", False),
    ],
    4: [  # Rio Fresh Produce Ltd — shipper
        ("Grace", "Wambui", "ADMIN", True),
        ("Daniel", "Mutua", "LOGISTICS_MGR", False),
        ("Fiona", "Wanjiru", "DISPATCHER", False),
        ("Henry", "Kiprotich", "DISPATCHER", False),
        ("Lucy", "Muthoni", "FINANCE_OFFICER", False),
        ("Philip", "Njoroge", "CLIENT", False),
        ("Ruth", "Akinyi", "CLIENT", False),
        ("Simon", "Odhiambo", "CLIENT", False),
        ("Janet", "Kamau", "CARRIER", False),
        ("Brian", "Cherono", "CARRIER", False),
        ("Linda", "Kibet", "WAREHOUSE_MGR", False),
        ("Victor", "Langat", "WAREHOUSE_MGR", False),
        ("Hannah", "Wambua", "CUSTOMS_BROKER", False),
        ("Ahmed", "Salim", "DRIVER", False),
        ("Diana", "Cheruiyot", "DRIVER", False),
        ("Chris", "Juma", "DRIVER", False),
        ("Beatrice", "Barasa", "DRIVER", False),
        ("Oliver", "Towett", "DRIVER", False),
        ("Terry", "Sang", "DRIVER", False),
        ("Mark", "Wekesa", "DRIVER", False),
        ("Kelvin", "Yego", "DRIVER", False),
        ("Leah", "Abdi", "DRIVER", False),
    ],
    5: [  # Mombasa Container Terminal Ltd — port operations
        ("Ahmed", "Salim", "ADMIN", True),
        ("Fatuma", "Abdi", "LOGISTICS_MGR", False),
        ("Hassan", "Mohammed", "DISPATCHER", False),
        ("Amina", "Juma", "DISPATCHER", False),
        ("Yusuf", "Hussein", "DISPATCHER", False),
        ("Zainab", "Ali", "FINANCE_OFFICER", False),
        ("Ibrahim", "Omar", "PORT_AGENT", False),
        ("Khadija", "Swaleh", "PORT_AGENT", False),
        ("Rashid", "Bakari", "PORT_AGENT", False),
        ("Saida", "Mwidani", "WAREHOUSE_MGR", False),
        ("Abdul", "Mwinyi", "CLIENT", False),
        ("Mariam", "Hamadi", "CLIENT", False),
        ("Juma", "Said", "CUSTOMS_BROKER", False),
        ("Halima", "Omar", "CUSTOMS_BROKER", False),
        ("Ali", "Mohammed", "DRIVER", False),
        ("Nuru", "Abdalla", "DRIVER", False),
        ("Omar", "Khamis", "DRIVER", False),
        ("Zahra", "Mwakio", "DRIVER", False),
        ("Bakari", "Shida", "DRIVER", False),
        ("Farida", "Kassim", "DRIVER", False),
        ("Hussein", "Mbwana", "DRIVER", False),
        ("Jamila", "Ponda", "DRIVER", False),
        ("Karim", "Shee", "DRIVER", False),
        ("Leyla", "Vuai", "DRIVER", False),
    ],
    6: [  # East Africa Hauliers Ltd — cross-border trucking
        ("Peter", "Odhiambo", "ADMIN", True),
        ("James", "Ouma", "LOGISTICS_MGR", False),
        ("Grace", "Achieng", "LOGISTICS_MGR", False),
        ("Samuel", "Oloo", "DISPATCHER", False),
        ("Faith", "Nyagah", "DISPATCHER", False),
        ("John", "Okello", "DISPATCHER", False),
        ("Mary", "Adhiambo", "FINANCE_OFFICER", False),
        ("Daniel", "Opondo", "FINANCE_OFFICER", False),
        ("Sarah", "Anyango", "CLIENT", False),
        ("Paul", "Onyango", "CLIENT", False),
        ("Lydia", "Awuor", "CARRIER", False),
        ("Stephen", "Ogola", "CARRIER", False),
        ("Priscilla", "Auma", "CARRIER", False),
        ("Michael", "Oduor", "CUSTOMS_BROKER", False),
        ("Agnes", "Atieno", "WAREHOUSE_MGR", False),
        ("George", "Owino", "PORT_AGENT", False),
        ("Dorcas", "Apiyo", "DRIVER", False),
        ("Patrick", "Omollo", "DRIVER", False),
        ("Tabitha", "Awino", "DRIVER", False),
        ("Charles", "Onyango", "DRIVER", False),
        ("Miriam", "Akoth", "DRIVER", False),
        ("David", "Ochieng", "DRIVER", False),
        ("Esther", "Adongo", "DRIVER", False),
        ("Moses", "Omondi", "DRIVER", False),
        ("Ruth", "Anyango", "DRIVER", False),
        ("Joseph", "Owiti", "DRIVER", False),
        ("Hannah", "Nyaboke", "DRIVER", False),
    ],
    7: [  # SafariChem Logistics — chemical/pharma
        ("Fatuma", "Abdi", "ADMIN", True),
        ("Kevin", "Kiprotich", "LOGISTICS_MGR", False),
        ("Nancy", "Chebet", "DISPATCHER", False),
        ("Victor", "Rotich", "DISPATCHER", False),
        ("Linda", "Cherono", "FINANCE_OFFICER", False),
        ("Brian", "Kiptoo", "CLIENT", False),
        ("Janet", "Jepkemoi", "CLIENT", False),
        ("Philip", "Kipruto", "CLIENT", False),
        ("Lucy", "Jepchirchir", "CARRIER", False),
        ("Patrick", "Kipkemboi", "CUSTOMS_BROKER", False),
        ("Ruth", "Chepkoech", "WAREHOUSE_MGR", False),
        ("Simon", "Kipkorir", "DRIVER", False),
        ("Hannah", "Jepleting", "DRIVER", False),
        ("Ahmed", "Kipngetich", "DRIVER", False),
        ("Diana", "Chepngetich", "DRIVER", False),
        ("Chris", "Kiplimo", "DRIVER", False),
        ("Beatrice", "Jepkosgei", "DRIVER", False),
        ("Oliver", "Kipchumba", "DRIVER", False),
        ("Terry", "Chepkurui", "DRIVER", False),
        ("Mark", "Kimutai", "DRIVER", False),
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# Command
# ═══════════════════════════════════════════════════════════════════════════════

class Command(BaseCommand):
    help = "Seed realistic East Africa logistics demo data"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Clear existing seed data first")

    def handle(self, *args, **options):
        self.stdout.write("=" * 70)
        self.stdout.write("  CargoTrack — Seeding East Africa Logistics Demo Data")
        self.stdout.write("=" * 70)

        # ── Clear existing data ────────────────────────────────────────────────
        self.stdout.write("\n[1/10] Clearing existing data…")
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
        Organization.objects.all().delete()
        User.objects.all().delete()
        self.stdout.write("  ✓ Cleared existing data")

        # ── Organizations ──────────────────────────────────────────────────────
        self.stdout.write("\n[2/10] Creating 7 companies…")
        orgs = {}
        COMPANY_NAMES = {
            1: "CargoTrack Technologies",
            2: "Siginon Group",
            3: "Bollore Logistics Kenya",
            4: "Rio Fresh Produce Ltd",
            5: "Mombasa Container Terminal Ltd",
            6: "East Africa Hauliers Ltd",
            7: "SafariChem Logistics Ltd",
        }
        for cid in range(1, 8):
            name = COMPANY_NAMES[cid]
            org = Organization.objects.create(
                name=name,
                slug=slugify(name),
                org_type=COMPANY_ORG_TYPES[cid],
                country=COMPANY_COUNTRIES[cid],
                tax_id=COMPANY_TAX_IDS[cid],
                address=COMPANY_ADDRESSES[cid],
                website=COMPANY_WEBSITES[cid],
                is_verified=True,
                created_at=days_ago(rnd(300, 800)),
            )
            orgs[cid] = org
            self.stdout.write(f"  ✓ {name} ({org.org_type}) — {org.country}")
        self.stdout.write(f"  → {len(orgs)} organizations created")

        # ── Users ──────────────────────────────────────────────────────────────
        self.stdout.write("\n[3/10] Creating users with full registration data…")
        all_users = {}
        total_users = 0
        admin_users = {}
        now = timezone.now()

        for cid in range(1, 8):
            org = orgs[cid]
            employees = COMPANY_EMPLOYEES[cid]
            company_name = COMPANY_NAMES[cid]

            for first_name, last_name, role, is_admin in employees:
                username = f"{first_name.lower()}.{last_name.lower()}"
                email = _email(first_name, last_name, cid)
                phone = _phone()

                # Realistic date_joined — admins joined earlier
                if is_admin and role == "PLATFORM_OWNER":
                    joined_days = rnd(500, 700)
                elif role in ("ADMIN", "LOGISTICS_MGR"):
                    joined_days = rnd(250, 500)
                else:
                    joined_days = rnd(30, 400)

                date_joined = now - timedelta(days=joined_days)

                # Last login — recent for active roles
                if role in ("DRIVER", "DISPATCHER"):
                    last_login = now - timedelta(hours=rnd(1, 48))
                elif role in ("CLIENT",):
                    last_login = now - timedelta(days=rnd(1, 7))
                else:
                    last_login = now - timedelta(hours=rnd(1, 72))

                defaults = {
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone": phone,
                    "role": role,
                    "organization": org,
                    "onboarding_completed": True,
                    "is_superuser": (role == "PLATFORM_OWNER"),
                    "is_staff": (role == "PLATFORM_OWNER"),
                    "date_joined": date_joined,
                }

                u, created = User.objects.get_or_create(
                    username=username,
                    defaults=defaults,
                )
                # Update all fields even on existing users
                for field, value in defaults.items():
                    setattr(u, field, value)
                u.set_password(PASSWORD)
                u.last_login = last_login
                u.save()

                all_users[username] = u
                total_users += 1
                if is_admin:
                    admin_users[cid] = u

            self.stdout.write(
                f"  ✓ {company_name}: {len(employees)} employees "
                f"(admin: {admin_users[cid].email})"
            )

        self.stdout.write(
            f"  → {total_users} users created across 7 companies "
            f"(password: {PASSWORD})"
        )

        # ── Carriers ───────────────────────────────────────────────────────────
        self.stdout.write("\n[4/10] Creating carriers…")
        carriers = []
        for code, name, org_idx in CARRIER_DATA:
            org = orgs[org_idx]
            c = Carrier.objects.create(
                code=code,
                name=name,
                status="ACTIVE",
                organization=org,
                contact_name=f"Contact {name}",
                phone=f"+2547{rnd(10000000, 99999999)}",
                email=f"info@{name.lower().replace(' ', '').replace('+', '')}.co.ke",
                country="Kenya",
                on_time_rate=round(random.uniform(0.72, 0.98), 3),
                rating=round(random.uniform(3.5, 5.0), 1),
                active_shipments=rnd(0, 20),
                total_shipments=rnd(100, 800),
                specialties=pick_n(CERT_POOL, rnd(1, 3)),
            )
            carriers.append(c)
        self.stdout.write(f"  → {len(carriers)} carriers created")

        # ── Drivers ────────────────────────────────────────────────────────────
        self.stdout.write("\n[5/10] Creating drivers and fleet…")
        drivers = []
        # Create Driver records for users with DRIVER role
        driver_users = [u for u in all_users.values() if u.role == "DRIVER"]
        for i, user in enumerate(driver_users):
            total_jobs = rnd(40, 520)
            on_time = round(random.uniform(0.70, 0.99), 3)
            rating = round(random.uniform(3.2, 5.0), 1)
            certs = pick_n(CERT_POOL, rnd(1, 4))
            exp = rnd(2, 22)
            status = pick(DRIVER_STATUSES)
            d = Driver.objects.create(
                driver_id=f"DRV-{1000 + i:04d}",
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                email=user.email,
                license_number=f"DL{rnd(1000000, 9999999)}",
                license_class=pick(["CE", "C", "B", "ADR"]),
                license_expiry=date.today() + timedelta(days=rnd(180, 900)),
                status=status,
                years_experience=exp,
                rating=Decimal(str(rating)),
                on_time_rate=Decimal(str(on_time)),
                total_jobs=total_jobs,
                total_km=rnd(50000, 600000),
                earnings_mtd=Decimal(str(rnd(80000, 380000))),
                certifications=certs,
                current_location=pick(ORIGIN_CITIES),
                organization=user.organization,
                created_at=user.date_joined,
            )
            drivers.append(d)
        self.stdout.write(f"  → {len(drivers)} drivers created")

        # ── Trucks ─────────────────────────────────────────────────────────────
        trucks = []
        truck_count = min(len(TRUCK_MAKES), 25)
        for i in range(truck_count):
            make, model, year, fuel = TRUCK_MAKES[i]
            org = pick(list(orgs.values()))
            status = pick(TRUCK_STATUSES)
            assigned = drivers[i] if i < len(drivers) and status == "ACTIVE" else None
            odometer = rnd(15000, 480000)
            t = Truck.objects.create(
                fleet_id=f"CT-{100 + i:03d}",
                make=make, model=model, year=year,
                plate=f"K{'ABCDEFGHJKLMNPQRSTUVWXYZ'[i % 24]}{rnd(100, 999)}{pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}",
                vin=f"VIN{rnd(10000000, 99999999)}{pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}",
                color=pick(COLORS),
                payload_tonnes=rnd_f(3.5, 30.0),
                engine_cc=rnd(2800, 12900),
                fuel_type=fuel,
                fuel_capacity_l=rnd(150, 450),
                status=status,
                odometer_km=odometer,
                load_pct=rnd(0, 100) if status == "ACTIVE" else 0,
                current_location=pick(ORIGIN_CITIES),
                latitude=rnd_f(-4.5, 4.5, 6),
                longitude=rnd_f(33.9, 42.0, 6),
                last_service_date=date.today() - timedelta(days=rnd(10, 180)),
                next_service_date=date.today() + timedelta(days=rnd(5, 90)),
                next_service_km=odometer + rnd(5000, 15000),
                assigned_driver=assigned,
                organization=org,
                created_at=days_ago(rnd(200, 900)),
            )
            trucks.append(t)

            # Maintenance logs
            for j in range(rnd(2, 5)):
                log_type, desc = pick(MAINTENANCE_TYPES)
                log_km = max(1000, odometer - rnd(j * 10000, (j + 1) * 25000))
                TruckMaintenanceLog.objects.create(
                    truck=t,
                    log_type=log_type,
                    description=desc,
                    cost_kes=Decimal(str(rnd(5000, 120000))),
                    odometer_km=log_km,
                    performed_by=f"ServicePro — {pick(['Nairobi', 'Mombasa', 'Nakuru', 'Kisumu', 'Eldoret'])}",
                    performed_at=timezone.now() - timedelta(days=rnd(j * 40, (j + 1) * 80)),
                )
        self.stdout.write(f"  → {len(trucks)} trucks with maintenance logs")

        # ── Routes ──────────────────────────────────────────────────────────────
        self.stdout.write("\n[6/10] Creating routes…")
        route_objs = {}
        for origin, dest, dist_km, est_h in ROUTES:
            label = f"{origin} → {dest}"
            r = Route.objects.create(
                origin=origin, destination=dest,
                distance_km=dist_km, estimated_hours=est_h,
            )
            route_objs[label] = r
        route_labels = list(route_objs.keys())
        self.stdout.write(f"  → {len(route_objs)} routes created")

        # ── Shipments ───────────────────────────────────────────────────────────
        self.stdout.write("\n[7/10] Creating shipments with tracking…")
        shipments = []
        all_org_users = list(all_users.values())
        ops_user = admin_users[1]  # Kande Mark as operations user

        for i in range(120):
            client = pick(all_org_users)
            route_label = pick(route_labels)
            route_obj = route_objs[route_label]
            status = pick(STATUSES)
            dep = days_ago(rnd(1, 60))
            sched_arr = dep + timedelta(days=rnd(1, 7))
            actual_arr = None
            if status == "DELIVERED":
                actual_arr = sched_arr + timedelta(hours=rnd(-12, 24))

            ship_carrier = (
                pick(carriers)
                if status in ("IN_TRANSIT", "DELIVERED", "CUSTOMS")
                else None
            )
            ship_truck = (
                pick(trucks)
                if ship_carrier and status in ("IN_TRANSIT", "DELIVERED")
                else None
            )
            ship_driver = ship_truck.assigned_driver if ship_truck else None
            dispatch = (
                "DISPATCHED" if ship_truck
                else ("DELIVERED" if status == "DELIVERED" else "UNASSIGNED")
            )

            s = Shipment.objects.create(
                tracking_number=f"CT{timezone.now().year}{i + 1001:04d}",
                route=route_obj,
                status=status,
                carrier_name=(
                    ship_carrier.name
                    if ship_carrier
                    else pick([n for _, n, _ in CARRIER_DATA])
                ),
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

            # Tracking events
            n_events = rnd(2, len(TRACKING_EVENTS))
            for ev_type, ev_msg in TRACKING_EVENTS[:n_events]:
                loc_parts = route_label.split(" → ")
                loc = loc_parts[0] if ev_type == "PICKUP" else pick(loc_parts)
                TrackingEvent.objects.create(
                    shipment=s,
                    event_type=ev_type,
                    location=loc,
                    notes=ev_msg,
                    recorded_by=ops_user,
                    timestamp=dep + timedelta(hours=rnd(0, 48)),
                )
        self.stdout.write(f"  → {len(shipments)} shipments with tracking events")

        # ── Driver job history ─────────────────────────────────────────────────
        for s in shipments:
            if s.status in ("IN_TRANSIT", "DELIVERED"):
                drv = s.assigned_driver or pick(drivers)
                route_label = f"{s.route.origin} → {s.route.destination}"
                dist = rnd(80, 550)
                on_time = random.random() > 0.18
                DriverJobHistory.objects.create(
                    driver=drv, shipment=s,
                    route_label=route_label,
                    distance_km=dist,
                    on_time=on_time,
                    earnings_kes=Decimal(str(rnd(4500, 25000))),
                    completed_at=s.actual_arrival or s.scheduled_arrival,
                )

        # ── Invoices ───────────────────────────────────────────────────────────
        self.stdout.write("\n[8/10] Creating invoices and financial data…")
        for i, s in enumerate(shipments):
            inv_status = pick(INV_STATUSES)
            amount = Decimal(str(rnd(25000, 450000)))
            created_at = s.created_at + timedelta(days=rnd(0, 3))
            paid_at = (
                created_at + timedelta(days=rnd(1, 30))
                if inv_status == "PAID"
                else None
            )
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
            # Additional charges (handling, customs, insurance) for ~40%
            if random.random() < 0.4:
                Invoice.objects.create(
                    invoice_number=f"INV-{timezone.now().year}-{i + 3001:04d}",
                    shipment=s,
                    amount_kes=Decimal(str(rnd(5000, 65000))),
                    status=pick(INV_STATUSES),
                    description=f"Ancillary charges: {pick(['Handling', 'Customs clearance', 'Insurance', 'Port fees', 'Warehouse storage'])}",
                    created_by=ops_user,
                    created_at=created_at + timedelta(days=1),
                    paid_at=paid_at,
                )
        total_invoices = Invoice.objects.count()
        self.stdout.write(f"  → {total_invoices} invoices created")

        # ── Alerts ─────────────────────────────────────────────────────────────
        severity_weights = ["CRITICAL"] * 3 + ["HIGH"] * 8 + ["MEDIUM"] * 14 + ["LOW"] * 20
        for s in shipments:
            n_alerts = rnd(0, 4)
            for _ in range(n_alerts):
                sev = pick(severity_weights)
                msg = pick(ALERT_MESSAGES[sev])
                acked = random.random() > 0.45
                Alert.objects.create(
                    shipment=s, message=msg,
                    risk_score=Decimal(str(rnd_f(0.1, 0.99, 2))),
                    severity=sev,
                    sent_at=s.created_at + timedelta(hours=rnd(1, 72)),
                    acknowledged=acked,
                    acknowledged_by=ops_user if acked else None,
                )

        # ── Scale tickets ──────────────────────────────────────────────────────
        for _ in range(50):
            t = pick(trucks)
            d = t.assigned_driver or pick(drivers)
            ScaleTicket.objects.create(
                truck=t, driver=d,
                weight_kg=rnd_f(500, 28000),
                location=f"{pick(['Nairobi', 'Mombasa', 'Nakuru', 'Eldoret', 'Malaba', 'Busia'])} Weighbridge",
                latitude=rnd_f(-4.5, 4.5, 6),
                longitude=rnd_f(33.9, 42.0, 6),
                notes=pick(["Within limits", "Slight overload — approved", "Re-weighed — OK", ""]),
                captured_at=days_ago(rnd(1, 90)),
            )

        # ── Marketplace ────────────────────────────────────────────────────────
        self.stdout.write("\n[9/10] Creating marketplace listings and bids…")
        listings = []
        for i in range(30):
            origin = pick(ORIGIN_CITIES)
            dest = pick([d for d in DEST_CITIES if d != origin])
            cargo_type = pick(FREIGHT_CARGO_TYPES)
            weight = rnd(500, 25000)
            budget_min = rnd(15000, 80000)
            budget_max = budget_min + rnd(10000, 50000)
            pickup = future_days(rnd(1, 14))
            delivery = pickup + timedelta(days=rnd(1, 10))
            is_hazmat = cargo_type == "HAZARDOUS"
            is_reefer = cargo_type == "PERISHABLE"
            status = pick(["OPEN", "OPEN", "OPEN", "AWARDED", "EXPIRED"])
            owner = pick(all_org_users)
            listing = FreightListing.objects.create(
                cargo_type=cargo_type,
                weight_kg=Decimal(str(weight)),
                volume_m3=rnd_f(1, 60),
                origin=origin, destination=dest,
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
            listings.append(listing)

        bid_count = 0
        for listing in listings:
            n_bids = rnd(0, 4)
            bidders_used = set()
            for _ in range(n_bids):
                available = [c for c in carriers if c.pk not in bidders_used]
                if not available:
                    break
                bidder = pick(available)
                bidders_used.add(bidder.pk)
                t = pick(trucks)
                min_bid = int(listing.budget_min or 10000)
                max_bid = int(listing.budget_max or min_bid + 20000)
                Bid.objects.create(
                    listing=listing, carrier=bidder,
                    truck=t,
                    driver=t.assigned_driver or pick(drivers),
                    amount=Decimal(str(rnd(min_bid, max_bid))),
                    estimated_days=rnd(1, 8),
                    notes=f"Can handle this {listing.cargo_type.lower()} shipment.",
                )
                bid_count += 1
        self.stdout.write(f"  → {len(listings)} listings, {bid_count} bids")

        # ── Conversations ──────────────────────────────────────────────────────
        self.stdout.write("\n[10/10] Creating chat conversations…")
        for i in range(8):
            participants = pick_n(all_org_users, min(3, len(all_org_users)))
            conv = Conversation.objects.create(
                is_group=len(participants) > 2,
                subject=pick([
                    "Shipment coordination", "Customs clearance updates",
                    "Driver dispatch", "Invoice query", "Rate negotiation",
                    "Warehouse scheduling", "Port operations", "Cold chain monitoring",
                ]),
                created_by=participants[0],
                shipment=pick(shipments) if random.random() < 0.5 else None,
            )
            conv.participants.set(participants)
            for j in range(rnd(3, 8)):
                sender = pick(participants)
                Message.objects.create(
                    conversation=conv, sender=sender,
                    content=pick(CHAT_MESSAGES),
                    created_at=days_ago(rnd(0, 30)),
                )

        # ── Summary ────────────────────────────────────────────────────────────
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.SUCCESS(
            f"\n  SEED COMPLETE — {total_users} users across 7 companies\n"
            f"  Platform Admin: kande.mark@cargotrack.co.ke / {PASSWORD}\n"
            f"  Company Admins:\n"
        ))
        for cid in range(1, 8):
            admin = admin_users[cid]
            self.stdout.write(
                f"    {COMPANY_NAMES[cid]}: {admin.email} / {PASSWORD}"
            )
        self.stdout.write(self.style.SUCCESS(
            f"\n  {Organization.objects.count()} orgs · "
            f"{User.objects.count()} users · "
            f"{Carrier.objects.count()} carriers · "
            f"{Driver.objects.count()} drivers · "
            f"{Truck.objects.count()} trucks · "
            f"{Shipment.objects.count()} shipments · "
            f"{total_invoices} invoices · "
            f"{Alert.objects.count()} alerts · "
            f"{ScaleTicket.objects.count()} scale tickets · "
            f"{FreightListing.objects.count()} listings · "
            f"{Bid.objects.count()} bids · "
            f"{Conversation.objects.count()} conversations\n"
        ))
        self.stdout.write("=" * 70)
