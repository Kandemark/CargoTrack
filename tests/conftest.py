"""
tests/conftest.py

Shared pytest fixtures for the CargoTrack test suite.

These fixtures are available to every test in the tests/ package without
any explicit import — pytest discovers conftest.py automatically.
"""
import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


# ── User fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def client_user(db):
    """A regular CLIENT-role User."""
    return User.objects.create_user(
        username="test_client",
        email="client@test.cargotrack.dev",
        password="testpass123",
        role='CLIENT',
    )


@pytest.fixture
def manager_user(db):
    """A LOGISTICS_MGR-role User."""
    return User.objects.create_user(
        username="test_manager",
        email="manager@test.cargotrack.dev",
        password="testpass123",
        role='LOGISTICS_MGR',
    )


# ── Shipment fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def sample_route(db):
    """A Route from Mombasa to Nairobi (480 km, 8 h)."""
    from shipments.models import Route
    return Route.objects.create(
        origin="Mombasa",
        destination="Nairobi",
        distance_km=480.0,
        estimated_hours=8.0,
    )


@pytest.fixture
def sample_shipment(db, sample_route):
    """
    A standard in-transit Shipment with moderate delay risk.

    status           = IN_TRANSIT
    delay_risk_score = 0.5
    """
    from shipments.models import Shipment
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    return Shipment.objects.create(
        tracking_number="CT-TEST-0001",
        route=sample_route,
        status="IN_TRANSIT",
        carrier_name="Test Carrier Ltd",
        weight_kg=500.0,
        scheduled_departure=now - datetime.timedelta(hours=4),
        scheduled_arrival=now + datetime.timedelta(hours=4),
        delay_risk_score=0.5,
    )


@pytest.fixture
def high_risk_shipment(db, sample_route):
    """
    A delayed Shipment with high delay risk — triggers alert thresholds.

    status           = DELAYED
    delay_risk_score = 0.85
    """
    from shipments.models import Shipment
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    return Shipment.objects.create(
        tracking_number="CT-TEST-0002",
        route=sample_route,
        status="DELAYED",
        carrier_name="High Risk Freight",
        weight_kg=2000.0,
        scheduled_departure=now - datetime.timedelta(hours=20),
        scheduled_arrival=now - datetime.timedelta(hours=4),
        actual_departure=now - datetime.timedelta(hours=19),
        delay_risk_score=0.85,
    )


# ── API fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    """
    An unauthenticated DRF APIClient.

    Authenticate within the test via api_client.force_authenticate(user=...)
    or api_client.login(...) as needed.
    """
    return APIClient()
