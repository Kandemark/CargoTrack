"""
dashboard/admin.py — Django admin for the dashboard app
========================================================

The dashboard app has no domain models, so this file intentionally contains
no @admin.register calls.  It exists to satisfy Django's admin autodiscovery.
"""
from django.contrib import admin  # noqa: F401 — required by admin autodiscovery
