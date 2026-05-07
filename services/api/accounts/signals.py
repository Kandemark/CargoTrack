"""
accounts/signals.py
Django signal handlers for the accounts app.

Automatically creates a UserProfile whenever a new User is saved for the
first time, so every user always has an associated profile record without
requiring manual setup.
"""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a UserProfile for every newly created User."""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, **kwargs):
    """
    Persist the related UserProfile whenever the User is saved.

    Handles the case where a profile already exists (e.g. after an update)
    and ensures it is written to the database in sync with its owner.
    """
    if hasattr(instance, 'profile'):
        instance.profile.save()
