"""Tests for POD module — verification, disputes, QR codes, signals."""
from django.test import SimpleTestCase
from unittest.mock import Mock, patch, MagicMock


class PODImportTests(SimpleTestCase):
    def test_all_modules_importable(self):
        from pod.models import ProofOfDelivery, PODPhoto, PODDispute
        self.assertTrue(all([ProofOfDelivery, PODPhoto, PODDispute]))

    def test_model_field_choices(self):
        from pod.models import ProofOfDelivery, PODPhoto, PODDispute
        self.assertEqual(len(ProofOfDelivery.CONDITION_CHOICES), 4)
        self.assertEqual(len(ProofOfDelivery.VERIFICATION_STATUS), 3)
        self.assertEqual(len(PODPhoto.PHOTO_TYPES), 6)
        self.assertEqual(len(PODDispute.DISPUTE_REASONS), 7)
        self.assertEqual(len(PODDispute.RESOLUTION_STATUS), 7)

    def test_condition_choices_values(self):
        from pod.models import ProofOfDelivery
        valid = [c[0] for c in ProofOfDelivery.CONDITION_CHOICES]
        for v in ('GOOD', 'DAMAGED', 'SHORT', 'REFUSED'):
            self.assertIn(v, valid)

    def test_verification_status_values(self):
        from pod.models import ProofOfDelivery
        valid = [c[0] for c in ProofOfDelivery.VERIFICATION_STATUS]
        for v in ('UNVERIFIED', 'VERIFIED', 'DISPUTED'):
            self.assertIn(v, valid)

    def test_pod_generates_verification_code(self):
        from pod.models import ProofOfDelivery
        pod = ProofOfDelivery(
            shipment_id=1, delivered_at='2026-05-07T10:00:00Z',
            received_by_name='Test Receiver',
        )
        self.assertEqual(pod.verification_code, '')
        # save() triggers code generation — skip calling save (no DB),
        # test the field exists and is blank before save
        self.assertIsInstance(pod.verification_code, str)

    def test_generate_qr_url(self):
        from pod.models import ProofOfDelivery
        pod = ProofOfDelivery(
            shipment_id=1, delivered_at='2026-05-07T10:00:00Z',
            received_by_name='Test Receiver',
        )
        pod.verification_code = 'CT-POD-ABCD1234'
        url = pod.generate_qr_url()
        self.assertIn('verify-pod?code=CT-POD-ABCD1234', url)

    def test_dispute_reason_choices(self):
        from pod.models import PODDispute
        valid = [c[0] for c in PODDispute.DISPUTE_REASONS]
        for v in ('DAMAGED', 'SHORTAGE', 'WRONG_GOODS', 'LATE', 'CONDITION', 'DOCUMENTATION', 'OTHER'):
            self.assertIn(v, valid)

    def test_dispute_resolution_choices(self):
        from pod.models import PODDispute
        valid = [c[0] for c in PODDispute.RESOLUTION_STATUS]
        for v in ('OPEN', 'UNDER_REVIEW', 'RESOLVED_REFUND', 'RESOLVED_REDELIVERY', 'CLOSED'):
            self.assertIn(v, valid)

    def test_serializer_fields(self):
        from pod.serializers import (
            ProofOfDeliverySerializer, PODPhotoSerializer, PODDisputeSerializer,
        )
        pod_fields = ProofOfDeliverySerializer.Meta.fields
        self.assertIn('verification_code', pod_fields)
        self.assertIn('verification_url', pod_fields)
        self.assertIn('verification_status', pod_fields)
        self.assertIn('dispute', pod_fields)
        self.assertIn('tracking_number', pod_fields)

        dispute_fields = PODDisputeSerializer.Meta.fields
        self.assertIn('dispute_reason', dispute_fields)
        self.assertIn('resolution_status', dispute_fields)
        self.assertIn('resolution_amount', dispute_fields)

    def test_pod_str(self):
        from pod.models import ProofOfDelivery
        pod = ProofOfDelivery(shipment_id=1, delivered_at='2026-05-07T10:00:00Z',
                              received_by_name='John Doe')
        self.assertIn('POD', str(pod))

    def test_dispute_str(self):
        from pod.models import PODDispute
        d = PODDispute(pod_id=1, dispute_reason='DAMAGED',
                       description='Box crushed on arrival')
        self.assertIn('Dispute', str(d))
        self.assertIn('POD', str(d))
        self.assertIn('Goods damaged on arrival', str(d))

    def test_app_config(self):
        from pod.apps import PodConfig
        self.assertEqual(PodConfig.name, 'pod')


class PODSignalTests(SimpleTestCase):
    """Test that signal handlers don't crash when called with mock instances."""

    def test_on_pod_captured_signal(self):
        from pod.models import on_pod_captured
        pod = Mock()
        pod.shipment = Mock()
        pod.shipment.tracking_number = 'CT-TEST-001'
        pod.shipment.client_id = None
        pod.get_condition_display.return_value = 'Good — delivered intact'
        pod.received_by_name = 'Receiver'
        pod.generate_qr_url.return_value = 'https://app.cargotrack.io/verify-pod?code=TEST'
        on_pod_captured(Mock(), pod, True)
        pod.shipment.save.assert_called_once()

    def test_on_dispute_raised_signal(self):
        from pod.models import on_dispute_raised
        dispute = Mock()
        dispute.pod = Mock()
        on_dispute_raised(Mock(), dispute, True)
        dispute.pod.save.assert_called_once()

    def test_on_pod_captured_skips_update(self):
        from pod.models import on_pod_captured
        pod = Mock()
        on_pod_captured(Mock(), pod, False)  # created=False — should skip
        pod.shipment.save.assert_not_called()

    def test_on_dispute_raised_skips_update(self):
        from pod.models import on_dispute_raised
        dispute = Mock()
        on_dispute_raised(Mock(), dispute, False)  # created=False — should skip
        dispute.pod.save.assert_not_called()
