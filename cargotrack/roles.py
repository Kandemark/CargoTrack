"""
cargotrack/roles.py
Centralised role constants for the CargoTrack RBAC system.

Import UserRole anywhere role values are needed instead of scattering
magic strings across the codebase.
"""


class UserRole:
    """
    Plain Python class holding role constants and their display labels.

    Used as the source of truth for role values in UserProfile.role,
    permission checks, and any view-level access guards.
    """

    ADMIN   = 'admin'
    MANAGER = 'manager'
    CARRIER = 'carrier'
    CLIENT  = 'client'

    CHOICES = [
        (ADMIN,   'Admin'),
        (MANAGER, 'Manager'),
        (CARRIER, 'Carrier'),
        (CLIENT,  'Client'),
    ]
