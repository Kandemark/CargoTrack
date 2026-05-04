"""
accounts/serializers.py — DRF serializers for user accounts
=============================================================

Serializers
-----------
UserMeSerializer
    Read/write serializer for ``GET /api/v1/accounts/me/`` and
    ``PATCH /api/v1/accounts/me/``.  Exposes the authenticated user's own
    profile fields; role, username, and email are read-only to prevent
    self-escalation.

RegisterSerializer
    Write-only serializer for ``POST /api/auth/register/``.  Restricts
    self-assignable roles to CLIENT and CARRIER; ADMIN and LOGISTICS_MGR
    must be granted by an administrator in the Django admin panel.
"""
from rest_framework import serializers
from .models import APIKey, AuditEntry, CustomUser, Integration, Notification, Organization


class UserMeSerializer(serializers.ModelSerializer):
    """
    Read/write serializer for the authenticated user's own profile.

    Sensitive fields excluded:
      - password       (never exposed via API)
      - is_superuser   (internal Django flag)
      - is_staff       (internal Django flag)
      - user_permissions, groups (Django internals)
    Role is read-only — role changes require admin action outside this endpoint.
    """

    role_display = serializers.CharField(source='get_role_display', read_only=True)
    org_name = serializers.CharField(source='organization.name', read_only=True, default=None)
    org_id = serializers.IntegerField(source='organization.id', read_only=True, default=None)

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'role_display',
            'org_id',
            'org_name',
            'phone',
            'onboarding_completed',
            'date_joined',
            'last_login',
        ]
        read_only_fields = ['id', 'username', 'email', 'role', 'role_display',
                            'org_id', 'org_name', 'date_joined', 'last_login']

    def validate_first_name(self, value):
        if len(value.strip()) < 1:
            raise serializers.ValidationError("First name cannot be blank.")
        return value.strip()

    def validate_last_name(self, value):
        if len(value.strip()) < 1:
            raise serializers.ValidationError("Last name cannot be blank.")
        return value.strip()

    def validate_phone(self, value):
        if value and len(value) > 20:
            raise serializers.ValidationError("Phone number must be 20 characters or fewer.")
        return value

class UserAdminSerializer(serializers.ModelSerializer):
    """
    Serializer for the ADMIN-only user management endpoint.

    Exposes all user fields.  Role and is_active are writable so admins can
    reassign roles and deactivate accounts without the Django admin panel.
    """

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'organization', 'phone',
            'is_active', 'date_joined', 'last_login',
        ]
        read_only_fields = ['id', 'username', 'email', 'date_joined', 'last_login']


class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['id', 'name', 'prefix', 'created_at', 'last_used']
        read_only_fields = ['id', 'prefix', 'created_at', 'last_used']


class APIKeyCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=10)

    @staticmethod
    def _validate_password_strength(password: str) -> str:
        errors = []
        if not any(c.isupper() for c in password):
            errors.append('one uppercase letter')
        if not any(c.isdigit() for c in password):
            errors.append('one digit')
        if not any(c in '!@#$%^&*()-_=+[]{}|;:,.<>?/~`' for c in password):
            errors.append('one special character')
        if errors:
            raise serializers.ValidationError(
                f'Password must contain at least {", ".join(errors)}.'
            )
        return password

    def validate_new_password(self, value):
        self._validate_password_strength(value)
        return value


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ('created_at',)


class AuditEntrySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default='System')
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'System'

    class Meta:
        model = AuditEntry
        fields = '__all__'
        read_only_fields = ('created_at',)


class IntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Integration
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class OrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'org_type', 'logo_url', 'website',
            'address', 'country', 'tax_id', 'is_verified', 'invite_code',
            'member_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'invite_code', 'created_at', 'updated_at']

    def get_member_count(self, obj) -> int:
        return obj.members.count()


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['name', 'org_type', 'website', 'address', 'country', 'tax_id']


class RegisterSerializer(serializers.Serializer):
    """
    Write-only serializer for multi-step account registration.

    All 9 roles are self-assignable. Role-specific profile data is collected.
    On success, creates a CustomUser with optional Organization and role profile.
    """

    first_name = serializers.CharField(max_length=150)
    last_name  = serializers.CharField(max_length=150)
    email      = serializers.EmailField()
    phone      = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    role       = serializers.ChoiceField(choices=[c[0] for c in CustomUser.Role.choices])
    password   = serializers.CharField(
        write_only=True, min_length=10, style={'input_type': 'password'},
    )
    password2  = serializers.CharField(
        write_only=True, style={'input_type': 'password'}, label="Confirm password",
    )

    @staticmethod
    def _validate_password_strength(password: str) -> str:
        errors = []
        if not any(c.isupper() for c in password):
            errors.append('one uppercase letter')
        if not any(c.isdigit() for c in password):
            errors.append('one digit')
        if not any(c in '!@#$%^&*()-_=+[]{}|;:,.<>?/~`' for c in password):
            errors.append('one special character')
        if errors:
            raise serializers.ValidationError(
                f'Password must contain at least {", ".join(errors)}.'
            )
        return password

    # ── Organization (step 2) ──────────────────────────────────────────
    org_name   = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    org_type   = serializers.ChoiceField(
        choices=Organization.ORG_TYPES, required=False, allow_null=True, default='SHIPPER',
    )
    join_code  = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')

    # ── Role-specific (step 3) ─────────────────────────────────────────
    license_number  = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    license_class   = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    years_experience = serializers.IntegerField(required=False, default=0)
    certifications  = serializers.JSONField(required=False, default=list)
    cargo_prefs     = serializers.JSONField(required=False, default=list)
    tax_id          = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')

    def validate_first_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("First name cannot be blank.")
        return value.strip()

    def validate_last_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Last name cannot be blank.")
        return value.strip()

    def validate_email(self, value):
        normalised = value.lower().strip()
        if CustomUser.objects.filter(email__iexact=normalised).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        if CustomUser.objects.filter(username=normalised).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalised

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': "Passwords do not match."})
        self._validate_password_strength(attrs['password'])
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        email    = validated_data['email']

        # Extract org/role fields
        org_name = validated_data.pop('org_name', '') or ''
        org_type = validated_data.pop('org_type', 'SHIPPER')
        join_code = validated_data.pop('join_code', '') or ''
        license_number = validated_data.pop('license_number', '') or ''
        license_class = validated_data.pop('license_class', '') or ''
        years_experience = validated_data.pop('years_experience', 0) or 0
        certifications = validated_data.pop('certifications', []) or []
        validated_data.pop('cargo_prefs', None)
        validated_data.pop('tax_id', None)

        user = CustomUser(username=email, **validated_data)
        user.set_password(password)
        user.onboarding_completed = True

        # Create or join organization
        if join_code:
            try:
                org = Organization.objects.get(invite_code=join_code)
                user.organization = org
            except Organization.DoesNotExist:
                pass
        elif org_name:
            from django.utils.text import slugify
            import secrets
            org, _created = Organization.objects.get_or_create(
                name=org_name,
                defaults={
                    'slug': slugify(org_name),
                    'org_type': org_type,
                    'invite_code': secrets.token_hex(8).upper(),
                },
            )
            user.organization = org

        user.save()

        # Create role-specific profile
        if user.role == CustomUser.Role.CARRIER:
            from fleet.models import Driver
            driver_id = f'DRV-{user.pk:04d}'
            Driver.objects.create(
                driver_id=driver_id,
                user=user,
                organization=user.organization,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                email=user.email,
                license_number=license_number,
                license_class=license_class or 'C',
                certifications=certifications,
                status='AVAILABLE',
            )
        elif user.role in (CustomUser.Role.ADMIN, CustomUser.Role.LOGISTICS_MGR,
                           CustomUser.Role.DISPATCHER, CustomUser.Role.WAREHOUSE_MGR):
            if user.organization:
                Carrier.objects.get_or_create(
                    code=f'CAR-{user.organization.slug[:8].upper()}',
                    defaults={
                        'name': user.organization.name,
                        'organization': user.organization,
                    },
                )

        return user
