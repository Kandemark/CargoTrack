"""Tests for fleet module — driver expenses, trip sheet, offline sync."""
from unittest.mock import Mock, patch, MagicMock
from django.test import SimpleTestCase


class DriverExpenseModelTests(SimpleTestCase):
    def test_expense_importable(self):
        from fleet.models import DriverExpense
        self.assertTrue(DriverExpense)

    def test_expense_type_choices(self):
        from fleet.models import DriverExpense
        self.assertEqual(len(DriverExpense.EXPENSE_TYPES), 10)
        valid = [c[0] for c in DriverExpense.EXPENSE_TYPES]
        for v in ('FUEL', 'TOLL', 'BORDER', 'PARKING', 'REPAIR', 'TYRE', 'MEAL', 'LODGING', 'BRIBE', 'OTHER'):
            self.assertIn(v, valid)

    def test_currency_choices(self):
        from fleet.models import DriverExpense
        self.assertEqual(len(DriverExpense.CURRENCY_CHOICES), 5)
        valid = [c[0] for c in DriverExpense.CURRENCY_CHOICES]
        for v in ('KES', 'USD', 'TZS', 'UGX', 'RWF'):
            self.assertIn(v, valid)

    def test_expense_str(self):
        from fleet.models import DriverExpense
        exp = DriverExpense(expense_type='FUEL', amount=5000, currency='KES', driver_id=1)
        self.assertIn('Fuel', str(exp))
        self.assertIn('5000', str(exp))

    def test_reimbursed_defaults_false(self):
        from fleet.models import DriverExpense
        exp = DriverExpense(expense_type='TOLL', amount=500, currency='KES')
        self.assertFalse(exp.reimbursed)


class DriverExpenseSerializerTests(SimpleTestCase):
    def test_serializer_fields(self):
        from fleet.serializers import DriverExpenseSerializer
        fields = DriverExpenseSerializer.Meta.fields
        self.assertIn('expense_type', fields)
        self.assertIn('amount', fields)
        self.assertIn('currency', fields)
        self.assertIn('reimbursed', fields)
        self.assertIn('receipt_image', fields)
        self.assertIn('location', fields)


class TripSheetPermissionTests(SimpleTestCase):
    def test_non_driver_gets_403(self):
        from fleet.api_views import DriverTripSheetView
        view = DriverTripSheetView()
        request = Mock()
        request.user = Mock()
        request.user.is_driver = False
        response = view.get(request)
        self.assertEqual(response.status_code, 403)


class OfflineSyncPermissionTests(SimpleTestCase):
    def test_non_driver_gets_403(self):
        from fleet.api_views import OfflineSyncView
        view = OfflineSyncView()
        request = Mock()
        request.user = Mock()
        request.user.is_driver = False
        response = view.post(request)
        self.assertEqual(response.status_code, 403)

    def test_driver_without_profile_gets_404(self):
        from fleet.api_views import OfflineSyncView
        from fleet.models import Driver
        view = OfflineSyncView()
        request = Mock()
        request.user = Mock()
        request.user.is_driver = True
        request.data = {}
        with patch.object(Driver.objects, 'get', side_effect=Driver.DoesNotExist):
            response = view.post(request)
            self.assertEqual(response.status_code, 404)


class AssignTruckTests(SimpleTestCase):
    def test_truck_not_found(self):
        from fleet.api_views import AssignTruckView
        from fleet.models import Truck
        view = AssignTruckView()
        request = Mock()
        request.data = {'driver_id': 'DRV-001'}
        with patch.object(Truck.objects, 'get', side_effect=Truck.DoesNotExist):
            response = view.post(request, pk=999)
            self.assertEqual(response.status_code, 404)

    def test_driver_not_found(self):
        from fleet.api_views import AssignTruckView
        from fleet.models import Truck, Driver
        view = AssignTruckView()
        request = Mock()
        request.data = {'driver_id': 'DRV-NONEXISTENT'}
        with patch.object(Truck.objects, 'get') as mock_get:
            mock_truck = Mock()
            mock_get.return_value = mock_truck
            with patch.object(Driver.objects, 'get', side_effect=Driver.DoesNotExist):
                response = view.post(request, pk=1)
                self.assertEqual(response.status_code, 404)

    def test_unassign_driver(self):
        from fleet.api_views import AssignTruckView
        from fleet.models import Truck
        view = AssignTruckView()
        request = Mock()
        request.data = {'driver_id': None}
        mock_truck = Mock()
        mock_truck.assigned_driver = Mock()
        with patch.object(Truck.objects, 'get', return_value=mock_truck):
            response = view.post(request, pk=1)
            self.assertEqual(response.data['status'], 'unassigned')
