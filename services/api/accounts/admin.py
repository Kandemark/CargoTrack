"""
accounts/admin.py — Django admin registration for accounts models
==================================================================

Registers ``CustomUser`` and ``UserProfile`` with the Django admin site.
``CustomUserAdmin`` extends the built-in ``UserAdmin`` to expose the
CargoTrack-specific fields (role, phone, company) in the change form.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserProfile


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """Admin view for CustomUser.

    Extends Django's built-in UserAdmin to add the CargoTrack profile
    fields to the change form fieldset.  The list view surfaces role and
    active status so administrators can quickly audit access levels.
    """

    # Columns shown in the changelist table
    list_display = ("username", "email", "get_full_name", "role", "is_active")
    # Sidebar filter widget options
    list_filter  = ("role", "is_active", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name")
    # Append CargoTrack fields after the standard Django UserAdmin fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ("CargoTrack Profile", {"fields": ("role", "phone", "company")}),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin view for UserProfile (read-mostly; auto-created by signals)."""

    list_display  = ("user", "created_at")
    search_fields = ("user__username", "user__email")
