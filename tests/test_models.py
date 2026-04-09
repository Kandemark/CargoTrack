"""
tests/test_models.py
Unit tests for CargoTrack domain models.

pytest test functions (not unittest classes) covering Route, Shipment,
TrackingEvent, Alert, UserProfile, and AlertManager.

Run: pytest tests/test_models.py -v
"""
import datetime

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


# ── Route ─────────────────────────────────────────────────────────────────────

def test_route_str_representation(sample_route):
    """Route.__str__ contains origin and destination."""
    s = str(sample_route)
    assert "Mombasa" in s
    assert "Nairobi" in s


def test_route_requires_origin_and_destination(db):
    """Route can be created with only origin, destination, distance, and hours."""
    from shipments.models import Route
    route = Route.objects.create(
        origin="Kisumu",
        destination="Eldoret",
        distance_km=100.0,
        estimated_hours=2.0,
    )
    assert route.pk is not None
    assert route.origin == "Kisumu"
    assert route.destination == "Eldoret"


# ── Shipment ──────────────────────────────────────────────────────────────────

def test_shipment_str_is_tracking_number(sample_shipment):
    """Shipment.__str__ returns or contains the tracking number."""
    assert "CT-TEST-0001" in str(sample_shipment)


def test_shipment_default_status_is_pending(db, sample_route):
    """A freshly created Shipment without an explicit status defaults to PENDING."""
    from shipments.models import Shipment
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    shipment = Shipment.objects.create(
        tracking_number="CT-TEST-9001",
        route=sample_route,
        carrier_name="Default Carrier",
        weight_kg=100.0,
        scheduled_departure=now,
        scheduled_arrival=now + datetime.timedelta(hours=4),
    )
    assert shipment.status == "PENDING"


def test_shipment_delay_risk_score_default_zero(db, sample_route):
    """delay_risk_score defaults to 0.0 when not provided."""
    from shipments.models import Shipment
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    shipment = Shipment.objects.create(
        tracking_number="CT-TEST-9002",
        route=sample_route,
        carrier_name="Default Carrier",
        weight_kg=50.0,
        scheduled_departure=now,
        scheduled_arrival=now + datetime.timedelta(hours=2),
    )
    assert shipment.delay_risk_score == 0.0


def test_shipment_unique_tracking_number(db, sample_route):
    """Creating two Shipments with the same tracking_number raises IntegrityError."""
    from django.db import IntegrityError
    from shipments.models import Shipment
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    Shipment.objects.create(
        tracking_number="CT-DUPE-0001",
        route=sample_route,
        carrier_name="Carrier A",
        weight_kg=100.0,
        scheduled_departure=now,
        scheduled_arrival=now + datetime.timedelta(hours=2),
    )
    with pytest.raises(IntegrityError):
        Shipment.objects.create(
            tracking_number="CT-DUPE-0001",
            route=sample_route,
            carrier_name="Carrier B",
            weight_kg=200.0,
            scheduled_departure=now,
            scheduled_arrival=now + datetime.timedelta(hours=2),
        )


# ── TrackingEvent ─────────────────────────────────────────────────────────────

def test_tracking_event_to_dict_returns_all_fields(db, sample_shipment):
    """TrackingEvent.to_dict() returns a dict with all seven expected keys."""
    from tracking.models import TrackingEvent
    event = TrackingEvent.objects.create(
        shipment=sample_shipment,
        event_type="CHECKPOINT",
        location="Voi",
        notes="On schedule",
    )
    d = event.to_dict()
    for key in ("id", "shipment_id", "event_type", "location", "notes", "timestamp", "recorded_by"):
        assert key in d, f"Missing key: {key}"


def test_tracking_event_get_event_type_returns_string(db, sample_shipment):
    """TrackingEvent.get_event_type() returns a non-empty string."""
    from tracking.models import TrackingEvent
    event = TrackingEvent.objects.create(
        shipment=sample_shipment,
        event_type="DEPARTURE",
        location="Mombasa Port",
    )
    result = event.get_event_type()
    assert isinstance(result, str)
    assert result == "DEPARTURE"


def test_tracking_event_get_timestamp_returns_datetime(db, sample_shipment):
    """TrackingEvent.get_timestamp() returns a timezone-aware datetime."""
    from tracking.models import TrackingEvent
    event = TrackingEvent.objects.create(
        shipment=sample_shipment,
        event_type="CHECKPOINT",
        location="Mtito Andei",
    )
    ts = event.get_timestamp()
    assert isinstance(ts, datetime.datetime)
    assert ts.tzinfo is not None


# ── Alert ─────────────────────────────────────────────────────────────────────

def test_alert_default_not_acknowledged(db, sample_shipment):
    """Alert.acknowledged defaults to False on creation."""
    from alerts.models import Alert
    alert = Alert.objects.create(
        shipment=sample_shipment,
        message="High delay risk detected",
        risk_score=0.8,
        severity="HIGH",
    )
    assert alert.acknowledged is False


def test_alert_severity_choices(db, sample_shipment):
    """Alert accepts all four severity levels without validation errors."""
    from alerts.models import Alert
    for severity in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        alert = Alert.objects.create(
            shipment=sample_shipment,
            message=f"Test alert ({severity})",
            risk_score=0.5,
            severity=severity,
        )
        assert alert.severity == severity


# ── UserProfile ───────────────────────────────────────────────────────────────

def test_user_profile_auto_created_on_user_save(db):
    """Creating a User auto-creates a linked UserProfile via post_save signal."""
    from accounts.models import UserProfile
    user = User.objects.create_user(
        username="signal_test_user",
        email="signal@test.cargotrack.dev",
        password="testpass123",
    )
    assert UserProfile.objects.filter(user=user).exists()


def test_user_default_role_is_client(db):
    """A freshly created CustomUser has role = CLIENT by default."""
    user = User.objects.create_user(
        username="role_default_user",
        email="roledefault@test.cargotrack.dev",
        password="testpass123",
    )
    assert user.role == 'CLIENT'


# ── AlertManager ──────────────────────────────────────────────────────────────

def test_alert_manager_does_not_fire_below_threshold(db, sample_shipment):
    """AlertManager.fire() does not call handlers when risk_score < threshold."""
    from alerts.alert_manager import AlertManager

    fired_calls = []

    class TrackingHandler:
        def get_handler_name(self):
            return "Tracker"
        def send(self, shipment_id, message, risk_score):
            fired_calls.append(risk_score)
            return True

    manager = AlertManager(threshold=0.70)
    manager.register_handler(TrackingHandler())
    result = manager.fire(sample_shipment.id, risk_score=0.50)

    assert result["fired"] is False
    assert len(fired_calls) == 0


def test_alert_manager_fires_all_handlers_above_threshold(db, high_risk_shipment):
    """AlertManager.fire() calls every registered handler when risk_score >= threshold."""
    from alerts.alert_manager import AlertManager, InAppAlertHandler

    manager = AlertManager(threshold=0.70)
    manager.register_handler(InAppAlertHandler())

    result = manager.fire(high_risk_shipment.id, risk_score=0.85)

    assert result["fired"] is True
    assert len(result["handlers_called"]) >= 1


def test_alert_manager_returns_correct_handler_names(db, sample_shipment):
    """AlertManager.fire() result includes handler names when fired."""
    from alerts.alert_manager import AlertManager, InAppAlertHandler, EmailAlertHandler

    manager = AlertManager(threshold=0.70)
    manager.register_handler(InAppAlertHandler())
    manager.register_handler(EmailAlertHandler())

    result = manager.fire(sample_shipment.id, risk_score=0.90)

    assert result["fired"] is True
    names = result["handlers_called"]
    assert "InApp" in names
    assert "Email" in names
