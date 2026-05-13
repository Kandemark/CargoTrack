"""conftest.py — pytest fixtures for CargoTrack."""
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        username="admin", email="admin@cargotrack.local", password="testpass123",
        role=User.Role.ADMIN,
    )


@pytest.fixture
def manager_user(db):
    return User.objects.create_user(
        username="manager", email="manager@cargotrack.local", password="testpass123",
        role=User.Role.LOGISTICS_MGR,
    )


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        username="client1", email="client@cargotrack.local", password="testpass123",
        role=User.Role.CLIENT,
    )
