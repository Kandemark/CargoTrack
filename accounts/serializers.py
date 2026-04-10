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
from .models import CustomUser


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
            'company',
            'phone',
            'date_joined',
            'last_login',
        ]
        read_only_fields = ['id', 'username', 'email', 'role', 'role_display', 'date_joined', 'last_login']

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

    def validate_company(self, value):
        if value and len(value) > 120:
            raise serializers.ValidationError("Company name must be 120 characters or fewer.")
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
            'role', 'company', 'phone',
            'is_active', 'date_joined', 'last_login',
        ]
        read_only_fields = ['id', 'username', 'email', 'date_joined', 'last_login']


class RegisterSerializer(serializers.Serializer):
    """
    Write-only serializer for new account registration.

    Only CLIENT and CARRIER roles are self-assignable. ADMIN and LOGISTICS_MGR
    roles are assigned by administrators via the Django admin panel.

    On success, creates a CustomUser with username set to the supplied email
    address and returns the instance for token generation in the view.
    """

    first_name = serializers.CharField(max_length=150)
    last_name  = serializers.CharField(max_length=150)
    email      = serializers.EmailField()
    company    = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')
    phone      = serializers.CharField(max_length=20,  required=False, allow_blank=True, default='')
    role       = serializers.ChoiceField(choices=['CLIENT', 'CARRIER'])
    password   = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'},
    )
    password2  = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        label="Confirm password",
    )

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
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        email    = validated_data['email']

        user = CustomUser(username=email, **validated_data)
        user.set_password(password)
        user.save()
        return user
