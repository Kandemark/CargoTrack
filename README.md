# CargoTrack

**CIT 2228: Computer Programming II — Group 10 Project**
Multimedia University of Kenya · Faculty of Engineering and Technology

> Cargo Shipment Tracking, Delay Prediction & Logistics Management System

---

## Overview

CargoTrack is a full-stack Django web application that lets logistics managers and clients track cargo shipments across East Africa in real time. The system provides:

- **Shipment lifecycle management** — create, update, and track shipments from PENDING through DELIVERED with status timestamps.
- **Live tracking events** — log GPS checkpoints, customs clearances, and delay notifications via a JSON API.
- **ML-based delay prediction** — a scikit-learn Random Forest classifier (`DelayPredictor`) trained on historical shipment data predicts per-shipment delay probability.
- **Automated alert pipeline** — `AlertManager` broadcasts high-risk alerts (risk score > 0.70) through pluggable handlers (in-app database record + email notification).
- **KPI dashboard** — aggregated fleet statistics, per-carrier performance, and recent event feed available via REST API and a Chart.js template view.
- **Role-based access control** — two-tier roles (`UserProfile.role`: admin / manager / carrier / client) enforce read/write permissions across all endpoints.

**Tech stack:** Python 3.10+, Django 4.2, Django REST Framework 3.15, scikit-learn, pandas, pytest-django, SQLite (dev).

---

## Setup & Installation

### Prerequisites

- Python 3.10 or higher
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Kandemark/CargoTrack.git
cd CargoTrack

# 2. Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Apply database migrations
python manage.py migrate

# 5. Seed realistic test data (5 routes, 20 shipments, 65 tracking events, 8 alerts)
python manage.py seed_data

# 6. (Optional) Train the delay prediction model
python manage.py train_model

# 7. Create a superuser for Django Admin
python manage.py createsuperuser

# 8. Start the development server
python manage.py runserver
```

The application is available at `http://127.0.0.1:8000/`.
Django Admin is at `http://127.0.0.1:8000/admin/`.

---

## Running Tests

```bash
# Activate the virtual environment first (see above), then:

# Run the full test suite with coverage report
pytest tests/ --cov=. --cov-report=term-missing -q

# Run only model unit tests with verbose output
pytest tests/test_models.py -v

# Run with HTML coverage report
pytest tests/ --cov=. --cov-report=html -q
# Open htmlcov/index.html in a browser
```

**Current test results:** 16 tests, 16 passed — core model coverage at 94–100% across `shipments`, `tracking`, `alerts`, and `accounts`.

---

## Architecture & Key Classes

CargoTrack is built around nine OOP classes that demonstrate the four pillars of object-oriented design required by CIT 2228.

| Class | Module | Description |
|---|---|---|
| `ShipmentEvent` | `cargotrack/base_classes.py` | Abstract base class (ABC) defining the interface all tracking event types must implement: `get_event_type()`, `get_timestamp()`, `to_dict()`. |
| `BasePredictor` | `cargotrack/base_classes.py` | ABC for ML predictor classes, enforcing `train()`, `predict()`, and `get_accuracy_report()` on every subclass. |
| `BaseAlertHandler` | `cargotrack/base_classes.py` | ABC for alert delivery strategies, requiring concrete implementations to define `send()` and `get_handler_name()`. |
| `FeatureEngineer` | `cargotrack/ml/feature_engineer.py` | Transforms raw `Shipment` QuerySets into a pandas DataFrame of 10 numeric features; uses deterministic label encoding so inference is reproducible without retraining. |
| `DelayPredictor` | `cargotrack/ml/delay_predictor.py` | Inherits `BasePredictor`; wraps a scikit-learn `RandomForestClassifier` with 5-fold cross-validated training, pickle serialisation, and a `predict()` method that returns `(label, probability)` pairs. |
| `InAppAlertHandler` | `alerts/alert_manager.py` | Concrete `BaseAlertHandler` that persists an `Alert` database record; maps risk score bands to LOW / MEDIUM / HIGH / CRITICAL severity. |
| `EmailAlertHandler` | `alerts/alert_manager.py` | Concrete `BaseAlertHandler` that logs alert messages via the Python logging framework (email transport in production). |
| `AlertManager` | `alerts/alert_manager.py` | Observer/Strategy coordinator: maintains a registry of handlers and calls each one when `fire()` is invoked with a risk score above the configurable threshold (default 0.70). |
| `LogisticsDashboard` | `dashboard/dashboard.py` | Encapsulates all KPI QuerySet logic (`get_summary_stats`, `get_recent_events`, `get_carrier_performance`) so view classes stay thin and the same data layer can be used in both template and API views. |

**OOP principles demonstrated:**
- **Abstraction** — `ShipmentEvent`, `BasePredictor`, `BaseAlertHandler` define contracts without implementation.
- **Inheritance** — `DelayPredictor` extends `BasePredictor`; `TrackingEvent` implements `ShipmentEvent`.
- **Encapsulation** — `LogisticsDashboard` hides QuerySet complexity; `FeatureEngineer` owns its encoder state.
- **Polymorphism** — `AlertManager.fire()` calls `handler.send()` on any registered handler without knowing its concrete type.

---

## Team

**Group 10 — Transport and Logistics**

| # | Name | Registration | Role |
|---|---|---|---|
| 1 | Mark Mbugu | ENG-219-016/2024 | Project Lead |
| 2 | Quinsley Mchana | ENG-219-131/2024 | Backend Developer |
| 3 | Jara Emmanuel | ENG-219-040/2024 | ML Engineer |
| 4 | Diamond Kethi | ENG-219-083/2024 | Frontend / UI |
| 5 | Victor Mburu | ENG-219-130/2024 | Database & API |
| 6 | Japheth Keith | ENG-219-088/2024 | Testing & QA |
| 7 | Grey Boston | ENG-219-073/2024 | Docs & DevOps |
| 8 | Andrew Maina | ENG-219-007/2024 | Systems Integration |

---

## Demo Scenario

The following steps reproduce the core end-to-end workflow used in our Week 5 integration verification.

### 1. Seed and verify data

```bash
python manage.py seed_data
```

Expected output confirms 5 routes, 20 shipments, and 65 tracking events were created.

### 2. Train the ML model

```bash
python manage.py train_model
```

The command fetches all seeded shipments, engineers features, trains a `RandomForestClassifier` with 5-fold cross-validation, and prints the F1 score report before saving the model to `delay_predictor.pkl`.

### 3. Confirm OOP hierarchy in the Django shell

```bash
python manage.py shell
```

```python
from cargotrack.base_classes import BasePredictor, BaseAlertHandler, ShipmentEvent
from cargotrack.ml.delay_predictor import DelayPredictor
from alerts.alert_manager import InAppAlertHandler
from tracking.models import TrackingEvent

print(issubclass(DelayPredictor, BasePredictor))       # True
print(issubclass(InAppAlertHandler, BaseAlertHandler)) # True
print(hasattr(TrackingEvent, 'to_dict'))               # True
```

### 4. Fire an alert for a high-risk shipment

```python
from shipments.models import Shipment
from alerts.alert_manager import AlertManager, InAppAlertHandler, EmailAlertHandler

am = AlertManager(threshold=0.70)
am.register_handler(InAppAlertHandler())
am.register_handler(EmailAlertHandler())

high_risk = Shipment.objects.filter(delay_risk_score__gt=0.7).first()
result = am.fire(high_risk.pk, high_risk.delay_risk_score)
print(result)
# {'fired': True, 'handlers_called': ['InApp', 'Email'], 'results': [True, True]}
```

### 5. Query the dashboard API

With the dev server running:

```bash
curl http://127.0.0.1:8000/dashboard/api/
```

Returns a JSON object with `summary`, `recent_events`, and `carrier_performance` keys.

### 6. Run the test suite

```bash
pytest tests/test_models.py -v
```

```
tests/test_models.py::test_route_str_representation PASSED
tests/test_models.py::test_route_requires_origin_and_destination PASSED
tests/test_models.py::test_shipment_str_is_tracking_number PASSED
tests/test_models.py::test_shipment_default_status_is_pending PASSED
tests/test_models.py::test_shipment_delay_risk_score_default_zero PASSED
tests/test_models.py::test_shipment_unique_tracking_number PASSED
tests/test_models.py::test_tracking_event_to_dict_returns_all_fields PASSED
tests/test_models.py::test_tracking_event_get_event_type_returns_string PASSED
tests/test_models.py::test_tracking_event_get_timestamp_returns_datetime PASSED
tests/test_models.py::test_alert_default_not_acknowledged PASSED
tests/test_models.py::test_alert_severity_choices PASSED
tests/test_models.py::test_user_profile_auto_created_on_user_save PASSED
tests/test_models.py::test_user_profile_default_role_is_client PASSED
tests/test_models.py::test_alert_manager_does_not_fire_below_threshold PASSED
tests/test_models.py::test_alert_manager_fires_all_handlers_above_threshold PASSED
tests/test_models.py::test_alert_manager_returns_correct_handler_names PASSED

16 passed in 1.51s
```
