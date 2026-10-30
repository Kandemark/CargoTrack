"""Alert list: open alerts by default, history for managers with ?all."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import CustomUser, Organization
from alerts.models import Alert
from shipments.models import Route, Shipment


class AlertListTests(TestCase):
    def setUp(self):
        org = Organization.objects.create(name='Test Freight', org_type='FREIGHT_FORWARDER')
        self.manager = CustomUser.objects.create_user(
            username='mgr', password='x', role='LOGISTICS_MGR', organization=org,
        )
        route = Route.objects.create(origin='Mombasa', destination='Nairobi', distance_km=485, estimated_hours=10)
        now = timezone.now()
        shipment = Shipment.objects.create(
            tracking_number='CT-T-1', route=route, weight_kg=1000, client=self.manager,
            scheduled_departure=now, scheduled_arrival=now + timedelta(hours=10),
        )
        Alert.objects.create(shipment=shipment, message='open', risk_score=0.7, severity='HIGH')
        Alert.objects.create(shipment=shipment, message='done', risk_score=0.3, severity='LOW', acknowledged=True)
        self.api = APIClient()
        self.api.force_authenticate(self.manager)

    def messages(self, query=''):
        res = self.api.get(f'/api/v1/alerts/{query}')
        self.assertEqual(res.status_code, 200)
        return sorted(a['message'] for a in res.data['results'])

    def test_open_alerts_by_default(self):
        self.assertEqual(self.messages(), ['open'])

    def test_all_accepts_1_and_true(self):
        # axios sends booleans as "true", so both spellings must work.
        self.assertEqual(self.messages('?all=1'), ['done', 'open'])
        self.assertEqual(self.messages('?all=true'), ['done', 'open'])
