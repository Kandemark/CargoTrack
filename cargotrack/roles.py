"""
cargotrack/roles.py — RBAC role constants
==========================================

Provides a plain-Python ``UserRole`` class for use anywhere a role string is
needed outside of the ORM layer.

Note on authoritative role values
----------------------------------
``accounts.models.CustomUser.Role`` (a ``TextChoices`` enum) is the canonical
source of role values stored in the database::

    ADMIN        = 'ADMIN'
    LOGISTICS_MGR = 'LOGISTICS_MGR'
    CLIENT       = 'CLIENT'
    CARRIER      = 'CARRIER'

``cargotrack.roles.UserRole`` uses different lowercase strings (``'admin'``,
``'manager'``) and was defined before the TextChoices refactor.  The two are
**not interchangeable** — never use ``UserRole`` constants to compare against
``request.user.role``; use ``CustomUser.Role`` for that.  ``UserRole`` is
preserved for legacy compatibility and potential future admin tooling.
"""


class UserRole:
    """
    Plain Python class holding legacy role constants and display labels.

    .. warning::
        These constants do **not** match the database values stored in
        ``CustomUser.role``.  For permission checks, use
        ``accounts.models.CustomUser.Role`` instead.

    Attributes:
        ADMIN   (str): Legacy admin role string ``'admin'``.
        MANAGER (str): Legacy manager role string ``'manager'``.
        CARRIER (str): Legacy carrier role string ``'carrier'``.
        CLIENT  (str): Legacy client role string ``'client'``.
        CHOICES (list[tuple]): ``(value, label)`` pairs for form widgets.
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
