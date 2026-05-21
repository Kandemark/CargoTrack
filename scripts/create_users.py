from accounts.models import CustomUser, Organization
from django.utils.text import slugify
import secrets

org = Organization.objects.first()
if not org:
    print("No org found, creating default")
    org = Organization.objects.create(
        name="CargoTrack East Africa",
        slug="cargotrack-ea",
        org_type="LOGISTICS",
        invite_code=secrets.token_hex(8).upper()
    )
    print(f"Created org: {org.name} (id={org.id})")

if not CustomUser.objects.filter(username="emmaunuel.tunu").exists():
    user1 = CustomUser.objects.create_user(
        username="emmaunuel.tunu",
        email="emmaunuel.tunu@cargotrack.co.ke",
        password="CargoTrack2024!",
        first_name="Emmaunuel",
        last_name="Tunu",
        role="LOGISTICS_MGR",
        organization=org,
        onboarding_completed=True,
    )
    print(f"Created: {user1.first_name} {user1.last_name} (id={user1.id}, role={user1.role})")
else:
    print("Emmaunuel Tunu already exists")

if not CustomUser.objects.filter(username="diamond.kethi").exists():
    user2 = CustomUser.objects.create_user(
        username="diamond.kethi",
        email="diamond.kethi@cargotrack.co.ke",
        password="CargoTrack2024!",
        first_name="Diamond",
        last_name="Kethi",
        role="ADMIN",
        organization=org,
        onboarding_completed=True,
    )
    print(f"Created: {user2.first_name} {user2.last_name} (id={user2.id}, role={user2.role})")
else:
    print("Diamond Kethi already exists")

print(f"\nOrg: {org.name} (id={org.id})")
print(f"Members: {org.members.count()}")
