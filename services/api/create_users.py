import os
import secrets
import sys

from accounts.models import CustomUser, Organization


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        print(f"ERROR: {name} environment variable is required but not set.", file=sys.stderr)
        sys.exit(1)
    return value


ADMIN_EMAIL = _require_env("CT_ADMIN_EMAIL")
ADMIN_PASSWORD = _require_env("CT_ADMIN_PASSWORD")
LOGISTICS_EMAIL = _require_env("CT_LOGISTICS_EMAIL")
LOGISTICS_PASSWORD = _require_env("CT_LOGISTICS_PASSWORD")

org = Organization.objects.first()
if not org:
    print("No org found, creating default")
    org = Organization.objects.create(
        name="CargoTrack East Africa",
        slug="cargotrack-ea",
        org_type="LOGISTICS",
        invite_code=secrets.token_hex(8).upper(),
    )
    print(f"Created org: {org.name} (id={org.id})")

if not CustomUser.objects.filter(username=LOGISTICS_EMAIL).exists():
    user1 = CustomUser.objects.create_user(
        username=LOGISTICS_EMAIL,
        email=LOGISTICS_EMAIL,
        password=LOGISTICS_PASSWORD,
        first_name="Emmaunuel",
        last_name="Tunu",
        role="LOGISTICS_MGR",
        organization=org,
        onboarding_completed=True,
    )
    print(f"Created: {user1.first_name} {user1.last_name} (id={user1.id}, role={user1.role})")
else:
    print("Logistics manager already exists")

if not CustomUser.objects.filter(username=ADMIN_EMAIL).exists():
    user2 = CustomUser.objects.create_user(
        username=ADMIN_EMAIL,
        email=ADMIN_EMAIL,
        password=ADMIN_PASSWORD,
        first_name="Diamond",
        last_name="Kethi",
        role="ADMIN",
        organization=org,
        onboarding_completed=True,
    )
    print(f"Created: {user2.first_name} {user2.last_name} (id={user2.id}, role={user2.role})")
else:
    print("Admin user already exists")

print(f"\nOrg: {org.name} (id={org.id})")
print(f"Members: {org.members.count()}")
