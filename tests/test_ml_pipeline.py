import datetime
from io import StringIO
from pathlib import Path

import pandas as pd
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from cargotrack.ml.delay_predictor import DelayPredictor


def test_delay_predictor_trains_on_small_balanced_dataset():
    predictor = DelayPredictor()
    X = pd.DataFrame(
        [
            {
                'distance_km': 480.0,
                'estimated_hours': 8.0,
                'weight_kg': 500.0,
                'hour_of_departure': 8,
                'day_of_week': 1,
                'month': 4,
                'route_origin_encoded': 1,
                'route_destination_encoded': 1,
                'num_tracking_events': 2,
                'has_customs_stop': 0,
            },
            {
                'distance_km': 820.0,
                'estimated_hours': 14.0,
                'weight_kg': 1800.0,
                'hour_of_departure': 22,
                'day_of_week': 4,
                'month': 4,
                'route_origin_encoded': 2,
                'route_destination_encoded': 2,
                'num_tracking_events': 5,
                'has_customs_stop': 1,
            },
        ]
    )

    predictor.train(X, [0, 1])

    report = predictor.get_accuracy_report()
    assert report['n_samples'] == 2
    assert report['cv_skipped'] is True
    assert report['cv_f1_mean'] is None


def test_train_model_command_trains_and_saves_model(db, monkeypatch, sample_route):
    from shipments.models import Shipment

    model_path = Path('C:/projects/CargoTrack/tests_artifacts/delay_model.pkl')
    model_path.parent.mkdir(exist_ok=True)
    if model_path.exists():
        model_path.unlink()
    monkeypatch.setattr(DelayPredictor, 'MODEL_PATH', model_path)

    now = datetime.datetime.now(tz=datetime.timezone.utc)
    Shipment.objects.create(
        tracking_number='CT-ML-0001',
        route=sample_route,
        status='DELIVERED',
        carrier_name='On Time Cargo',
        weight_kg=900.0,
        scheduled_departure=now - datetime.timedelta(hours=10),
        scheduled_arrival=now - datetime.timedelta(hours=2),
        actual_arrival=now - datetime.timedelta(hours=3),
    )
    Shipment.objects.create(
        tracking_number='CT-ML-0002',
        route=sample_route,
        status='DELAYED',
        carrier_name='Late Cargo',
        weight_kg=1200.0,
        scheduled_departure=now - datetime.timedelta(hours=10),
        scheduled_arrival=now - datetime.timedelta(hours=2),
    )

    stdout = StringIO()
    call_command('train_model', stdout=stdout)

    assert 'trained on 2 shipments' in stdout.getvalue()
    assert DelayPredictor.load().get_accuracy_report()['n_samples'] == 2


def test_train_model_command_requires_two_classes(db, monkeypatch, sample_route):
    from shipments.models import Shipment

    model_path = Path('C:/projects/CargoTrack/tests_artifacts/delay_model_single_class.pkl')
    model_path.parent.mkdir(exist_ok=True)
    if model_path.exists():
        model_path.unlink()
    monkeypatch.setattr(DelayPredictor, 'MODEL_PATH', model_path)

    now = datetime.datetime.now(tz=datetime.timezone.utc)
    Shipment.objects.create(
        tracking_number='CT-ML-0003',
        route=sample_route,
        status='DELIVERED',
        carrier_name='Only On Time Cargo',
        weight_kg=700.0,
        scheduled_departure=now - datetime.timedelta(hours=8),
        scheduled_arrival=now - datetime.timedelta(hours=1),
        actual_arrival=now - datetime.timedelta(hours=2),
    )
    Shipment.objects.create(
        tracking_number='CT-ML-0004',
        route=sample_route,
        status='DELIVERED',
        carrier_name='Only On Time Cargo 2',
        weight_kg=750.0,
        scheduled_departure=now - datetime.timedelta(hours=7),
        scheduled_arrival=now - datetime.timedelta(hours=1),
        actual_arrival=now - datetime.timedelta(hours=1, minutes=30),
    )

    with pytest.raises(CommandError, match='both delayed and on-time shipments'):
        call_command('train_model')
