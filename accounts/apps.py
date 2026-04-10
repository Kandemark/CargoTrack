"""
accounts/apps.py — AppConfig for the accounts application
===========================================================

Registers signal handlers on startup so that a UserProfile is automatically
created for every new CustomUser without requiring explicit view-level code.
"""
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """AppConfig for the accounts domain app.

    Attributes:
        default_auto_field: Uses BigAutoField (64-bit) to avoid the 2 billion
                            row limit of AutoField on high-volume user tables.
        name: Python dotted path used by Django's app registry.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        """Import signal handlers so they are registered when Django starts.

        Django calls ``ready()`` once after the app registry is fully
        populated.  Importing ``accounts.signals`` here triggers the
        ``@receiver`` decorators, connecting ``create_user_profile`` and
        ``save_user_profile`` to the ``post_save`` signal of AUTH_USER_MODEL.
        """
        import accounts.signals  # noqa: F401 — side-effect import
