"""accounts/serializers.py"""
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
