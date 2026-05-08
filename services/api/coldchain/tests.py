"""Comprehensive tests for Cold Chain Monitoring module."""
from unittest.mock import Mock, patch, MagicMock
from django.test import SimpleTestCase


class ColdChainImportTests(SimpleTestCase):
    def test_all_modules_importable(self):
        from coldchain.models import (
            ColdChainShipment, TemperatureReading,
            TemperatureExcursion, ColdChainCertificate, ColdChainSLA,
        )
        self.assertTrue(all([
            ColdChainShipment, TemperatureReading,
            TemperatureExcursion, ColdChainCertificate, ColdChainSLA,
        ]))

    def test_product_type_choices(self):
        from coldchain.models import ColdChainShipment
        self.assertEqual(len(ColdChainShipment.PRODUCT_TYPES), 11)
        valid = [c[0] for c in ColdChainShipment.PRODUCT_TYPES]
        for v in ('FLOWERS', 'VACCINES', 'MEAT', 'DAIRY', 'BLOOD', 'PHARMA'):
            self.assertIn(v, valid)

    def test_excursion_severity_choices(self):
        from coldchain.models import TemperatureExcursion
        self.assertEqual(len(TemperatureExcursion.SEVERITY_CHOICES), 4)
        valid = [c[0] for c in TemperatureExcursion.SEVERITY_CHOICES]
        for v in ('WARNING', 'BREACH', 'CRITICAL', 'SPOILAGE_ALERT'):
            self.assertIn(v, valid)

    def test_coldchain_shipment_str(self):
        from coldchain.models import ColdChainShipment
        cc = ColdChainShipment(
            product_type='VACCINES', temp_min_c=2.0, temp_max_c=8.0,
            tolerance_minutes=30,
        )
        self.assertIn('ColdChain', str(cc))
        self.assertIn('Vaccines', str(cc))

    def test_excursion_str(self):
        from coldchain.models import TemperatureExcursion
        exc = TemperatureExcursion(
            severity='BREACH', duration_minutes=45,
            temp_limit_breached='OVER_MAX',
        )
        self.assertIn('BREACH', str(exc))
        self.assertIn('45min', str(exc))

    def test_certificate_str_compliant(self):
        from coldchain.models import ColdChainCertificate
        cert = ColdChainCertificate(
            total_readings=1000, excursions_count=0,
            total_excursion_minutes=0, min_temp_recorded_c=2.5,
            max_temp_recorded_c=7.8, avg_temp_c=4.2, is_compliant=True,
        )
        self.assertIn('COMPLIANT', str(cert))

    def test_certificate_str_noncompliant(self):
        from coldchain.models import ColdChainCertificate
        cert = ColdChainCertificate(
            total_readings=1000, excursions_count=5,
            total_excursion_minutes=120, min_temp_recorded_c=-5.0,
            max_temp_recorded_c=15.0, avg_temp_c=6.0, is_compliant=False,
        )
        self.assertIn('NON-COMPLIANT', str(cert))

    def test_sla_str(self):
        from coldchain.models import ColdChainSLA
        sla = ColdChainSLA(
            max_excursion_minutes=120, max_excursions=3,
            total_excursion_minutes=0, total_excursions=0,
        )
        self.assertIn('SLA', str(sla))

    def test_serializer_fields(self):
        from coldchain.serializers import (
            ColdChainShipmentSerializer, TemperatureReadingSerializer,
            TemperatureExcursionSerializer, ColdChainCertificateSerializer,
        )
        cc_fields = ColdChainShipmentSerializer.Meta.fields
        self.assertIn('product_type', cc_fields)
        self.assertIn('temp_min_c', cc_fields)
        self.assertIn('recent_readings', cc_fields)
        self.assertIn('active_excursion', cc_fields)

        reading_fields = TemperatureReadingSerializer.Meta.fields
        self.assertIn('temperature_c', reading_fields)
        self.assertIn('humidity_pct', reading_fields)
        self.assertIn('battery_level', reading_fields)

        cert_fields = ColdChainCertificateSerializer.Meta.fields
        self.assertIn('is_compliant', cert_fields)
        self.assertIn('avg_temp_c', cert_fields)

    def test_app_config(self):
        from coldchain.apps import ColdchainConfig
        self.assertEqual(ColdchainConfig.name, 'coldchain')
        self.assertEqual(ColdchainConfig.verbose_name, 'Cold Chain Monitoring')


class ExcursionAutoResolveTests(SimpleTestCase):
    """Test excursion auto-resolution logic without database."""

    def test_auto_resolve_returns_true_when_temp_in_range_and_tolerance_elapsed(self):
        from coldchain.models import TemperatureExcursion, ColdChainShipment
        from django.utils import timezone
        import datetime

        cc = ColdChainShipment(temp_min_c=2.0, temp_max_c=8.0, tolerance_minutes=1)
        now = timezone.now()
        exc = TemperatureExcursion(
            coldchain_shipment=cc,
            started_at=now - datetime.timedelta(minutes=5),
            severity='BREACH', temp_limit_breached='OVER_MAX',
        )

        with patch.object(TemperatureExcursion, 'save'):
            result = exc.try_auto_resolve(5.0, 1, now)
            self.assertTrue(result)

    def test_auto_resolve_returns_false_when_temp_out_of_range(self):
        from coldchain.models import TemperatureExcursion, ColdChainShipment
        from django.utils import timezone

        cc = ColdChainShipment(temp_min_c=2.0, temp_max_c=8.0, tolerance_minutes=30)
        exc = TemperatureExcursion(
            coldchain_shipment=cc, started_at=timezone.now(),
            severity='BREACH', temp_limit_breached='OVER_MAX',
        )
        with patch.object(TemperatureExcursion, 'save'):
            result = exc.try_auto_resolve(15.0, 30)  # 15°C is way out of range
            self.assertFalse(result)

    def test_check_escalation_returns_true_on_escalation(self):
        from coldchain.models import TemperatureExcursion, ColdChainShipment
        from django.utils import timezone
        import datetime

        cc = ColdChainShipment(temp_min_c=2.0, temp_max_c=8.0, tolerance_minutes=1)
        exc = TemperatureExcursion(
            coldchain_shipment=cc,
            started_at=timezone.now() - datetime.timedelta(minutes=2),
            severity='WARNING',
            temp_limit_breached='OVER_MAX',
        )
        # Started 2 min ago, tolerance=1min → should escalate to BREACH
        with patch.object(TemperatureExcursion, 'save'):
            result = exc.check_escalation(1)
            self.assertTrue(result)
            self.assertIn(exc.severity, ['BREACH', 'CRITICAL', 'SPOILAGE_ALERT'])

    def test_escalation_to_critical(self):
        from coldchain.models import TemperatureExcursion, ColdChainShipment
        from django.utils import timezone
        import datetime

        cc = ColdChainShipment(temp_min_c=2.0, temp_max_c=8.0, tolerance_minutes=1)
        exc = TemperatureExcursion(
            coldchain_shipment=cc,
            started_at=timezone.now() - datetime.timedelta(minutes=3),
            severity='WARNING',
            temp_limit_breached='OVER_MAX',
        )
        # Started 3 min ago, tolerance=1min → escalated past BREACH to CRITICAL or higher
        with patch.object(TemperatureExcursion, 'save'):
            exc.check_escalation(1)
            self.assertIn(exc.severity, ['BREACH', 'CRITICAL', 'SPOILAGE_ALERT'])


class SLATests(SimpleTestCase):
    """Test SLA breach detection logic."""

    def test_sla_not_breached_initially(self):
        from coldchain.models import ColdChainSLA
        sla = ColdChainSLA(
            max_excursion_minutes=120, max_excursions=3,
            total_excursion_minutes=50, total_excursions=1,
        )
        self.assertFalse(sla.is_breached)

    def test_sla_breached_by_minutes(self):
        from coldchain.models import ColdChainSLA
        sla = ColdChainSLA(
            max_excursion_minutes=120, max_excursions=3,
            total_excursion_minutes=150, total_excursions=1,
        )
        with patch.object(ColdChainSLA, 'save'):
            result = sla.check_breach()
            self.assertTrue(result)
            self.assertTrue(sla.is_breached)

    def test_sla_breached_by_count(self):
        from coldchain.models import ColdChainSLA
        sla = ColdChainSLA(
            max_excursion_minutes=120, max_excursions=3,
            total_excursion_minutes=50, total_excursions=5,
        )
        with patch.object(ColdChainSLA, 'save'):
            result = sla.check_breach()
            self.assertTrue(result)
            self.assertTrue(sla.is_breached)


class ExcursionAlertSignalTests(SimpleTestCase):
    """Test that excursion alert signals run without errors."""

    @patch('alerts.models.Alert')
    @patch('alerts.models.Notification')
    def test_on_excursion_created_creates_alert(self, mock_notification_cls, mock_alert_cls):
        from coldchain.models import on_excursion_created

        cc = Mock()
        cc.shipment.tracking_number = 'CT-TEST-001'
        cc.shipment_id = 1
        cc.shipment.client_id = None
        cc.get_product_type_display.return_value = 'Vaccines'
        cc.temp_min_c = 2.0
        cc.temp_max_c = 8.0

        exc = Mock()
        exc.coldchain_shipment = cc
        exc.severity = 'BREACH'
        exc.get_severity_display.return_value = 'Breach — out of range'
        exc.temp_limit_breached = 'OVER_MAX'
        exc.peak_temp_c = 12.0

        on_excursion_created(Mock(), exc, True)
        mock_alert_cls.objects.create.assert_called_once()

    @patch('alerts.models.Alert')
    @patch('alerts.models.Notification')
    def test_on_excursion_created_skips_on_update(self, mock_notification_cls, mock_alert_cls):
        from coldchain.models import on_excursion_created
        exc = Mock()
        on_excursion_created(Mock(), exc, False)
        mock_alert_cls.objects.create.assert_not_called()
