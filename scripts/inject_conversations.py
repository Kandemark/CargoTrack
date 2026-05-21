from chats.models import Conversation, Message
from accounts.models import CustomUser, Organization
from django.utils import timezone

# Get all users
users = list(CustomUser.objects.filter(is_active=True))
if not users:
    print("No users found!")
    exit(1)

org = Organization.objects.first()
if not org:
    print("No org found!")
    exit(1)

org_users = list(CustomUser.objects.filter(is_active=True, organization=org))

# ── 1. Default Company Group (all org members) ──────────────────────────
company_group, created = Conversation.objects.get_or_create(
    is_group=True,
    subject=f"{org.name} — Team Chat",
    defaults={
        'is_community': True,
        'is_encrypted': False,
        'description': f'Default company-wide group for {org.name}',
        'announcement': f'Welcome to the {org.name} team! Use this space for company-wide announcements and discussions.',
        'created_by': org_users[0] if org_users else users[0],
    }
)
if created:
    company_group.participants.set(org_users)
    company_group.save()
    Message.objects.create(
        conversation=company_group,
        sender=org_users[0] if org_users else users[0],
        content=f'Welcome to {org.name} official group! This is the default company chat for all team members.',
        is_system=True,
    )
    print(f"[CREATED] Company group: {company_group.subject} ({company_group.participants.count()} members)")
else:
    print(f"[EXISTS] Company group: {company_group.subject}")

# ── 2. Permanent conversation (demo users) ──────────────────────────────
emma = CustomUser.objects.filter(username='emmaunuel.tunu').first()
diamond = CustomUser.objects.filter(username='diamond.kethi').first()

if emma and diamond:
    perm_conv, created = Conversation.objects.get_or_create(
        is_group=False,
        subject='',
        defaults={
            'created_by': diamond,
        }
    )
    if created:
        perm_conv.participants.set([emma, diamond])
        # Create a rich message history
        messages_data = [
            (diamond, 'Hey Emmaunuel! Welcome to the CargoTrack team. I\'m Diamond, the admin here. 👋'),
            (emma, 'Thanks Diamond! Happy to be here. I\'ve been looking at the logistics dashboard — very impressive setup.'),
            (diamond, 'Glad you like it! We manage over 500 shipments per month across East Africa. The live tracking is our crown jewel.'),
            (emma, 'I noticed the fleet analytics are really detailed. Are we tracking fuel optimization too?'),
            (diamond, 'Yes! We have a fuel optimizer microservice in Rust. It saves us about 14% on average. Check /fleet/analytics.'),
            (emma, 'That\'s incredible. I\'ll dive into the route optimizer next. I have some ideas for the Kenya-Uganda corridor.'),
            (diamond, 'Perfect timing — we\'re expanding that corridor next quarter. Let\'s set up a meeting with the logistics team.'),
            (emma, 'Sounds great. I\'ll also check the customs integration — I have experience with the Uganda Revenue Authority systems.'),
            (diamond, 'That would be a huge help! Our customs broker team could use someone with URA experience. I\'ll loop you in.'),
            (emma, 'Looking forward to it. This platform has real potential to transform East African logistics.'),
        ]
        for sender, text in messages_data:
            Message.objects.create(
                conversation=perm_conv,
                sender=sender,
                content=text,
                created_at=timezone.now(),
            )
        print(f"[CREATED] Permanent conversation: Emmaunuel ↔ Diamond ({perm_conv.messages.count()} messages)")
    else:
        print(f"[EXISTS] Permanent conversation: Emmaunuel ↔ Diamond")
else:
    print("Emmaunuel or Diamond not found! Run create_users.py first.")

# ── 3. Cross-company conversation ──────────────────────────────────────
# Get users from different orgs if they exist, or create a cross-org conversation
other_orgs = Organization.objects.exclude(id=org.id)
if other_orgs.exists():
    other_org = other_orgs.first()
    other_users = list(CustomUser.objects.filter(is_active=True, organization=other_org)[:2])
    if other_users and len(org_users) >= 1:
        cross_conv, created = Conversation.objects.get_or_create(
            is_group=False,
            subject='',
            defaults={'created_by': org_users[0]}
        )
        if created:
            cross_participants = [org_users[0]] + other_users[:1]
            cross_conv.participants.set(cross_participants)
            Message.objects.create(
                conversation=cross_conv,
                sender=org_users[0],
                content=f'Hello! Cross-company collaboration enabled on CargoTrack.',
                is_system=True,
            )
            print(f"[CREATED] Cross-company conversation: {org.name} ↔ {other_org.name}")
        else:
            print(f"[EXISTS] Cross-company conversation")

print("\nDone! Social center database injection complete.")
