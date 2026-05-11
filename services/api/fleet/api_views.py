"""
fleet/api_views.py — Fleet REST API views.

Endpoints:
  GET/POST       /api/v1/fleet/trucks/
  GET/PATCH/PUT  /api/v1/fleet/trucks/<pk>/
  GET/POST       /api/v1/fleet/drivers/
  GET/PATCH/PUT  /api/v1/fleet/drivers/<pk>/
  GET            /api/v1/fleet/stats/
  GET            /api/v1/fleet/driver/trip-sheet/        — driver's current trip
  GET/POST       /api/v1/fleet/expenses/                  — driver expense capture
  POST           /api/v1/fleet/offline-sync/              — batch offline sync
  POST           /api/v1/fleet/trucks/<id>/assign/        — assign driver to truck
"""
import datetime

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from cargotrack.authz import (
    CanViewFleet, CanManageFleet, CanAssignFleet, CanManageFinance,
    OrgScopedQueryset, DriverScopedQueryset,
)

from .models import Driver, DriverJobHistory, DriverExpense, Truck, TruckMaintenanceLog
from .serializers import (
    DriverListSerializer,
    DriverSerializer,
    DriverExpenseSerializer,
    TruckListSerializer,
    TruckSerializer,
)
from tracking.models import TrackingEvent
from shipments.models import Shipment


class TruckViewSet(OrgScopedQueryset, viewsets.ModelViewSet):
    """
    CRUD endpoint for Truck fleet records.

    List action uses TruckListSerializer (lightweight, no nested relations).
    Detail action uses TruckSerializer (includes maintenance_logs + assigned_driver).

    Query parameters:
        status  — filter by Truck.status (case-insensitive)
        q       — search fleet_id, plate, make, or model (icontains)

    Extra actions:
        GET /fleet/trucks/stats/ — aggregate counts by status
    """

    permission_classes = [IsAuthenticated, CanViewFleet]
    queryset = Truck.objects.select_related('assigned_driver').prefetch_related('maintenance_logs')

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), CanManageFleet()]
        return super().get_permissions()

    def get_serializer_class(self):
        # Use lightweight list serializer to avoid N+1 on nested relations
        if self.action == 'list':
            return TruckListSerializer
        return TruckSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = self.scope_by_org(qs)
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s.upper())
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(
                Q(fleet_id__icontains=q) |
                Q(plate__icontains=q) |
                Q(make__icontains=q) |
                Q(model__icontains=q)
            )
        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request, **kwargs):
        """Return aggregate truck counts grouped by status."""
        total     = Truck.objects.count()
        by_status = dict(Truck.objects.values_list('status').annotate(n=Count('id')).values_list('status', 'n'))
        return Response({
            'total':       total,
            'active':      by_status.get('ACTIVE', 0),
            'idle':        by_status.get('IDLE', 0),
            'maintenance': by_status.get('MAINTENANCE', 0),
            'off_duty':    by_status.get('OFF_DUTY', 0),
        })


class DriverViewSet(OrgScopedQueryset, viewsets.ModelViewSet):
    """
    CRUD endpoint for Driver records.

    List action uses DriverListSerializer (no job_history nesting).
    Detail action uses DriverSerializer (includes job_history + truck_info).

    Query parameters:
        status  — filter by Driver.status (case-insensitive)
        q       — search driver_id, first_name, last_name, or phone

    Extra actions:
        GET /fleet/drivers/stats/ — aggregated performance metrics
    """

    permission_classes = [IsAuthenticated, CanViewFleet]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), CanManageFleet()]
        return super().get_permissions()
    queryset = Driver.objects.prefetch_related('job_history', 'assigned_truck')

    def get_serializer_class(self):
        # Lightweight serializer for list to avoid prefetching job_history unnecessarily
        if self.action == 'list':
            return DriverListSerializer
        return DriverSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = self.scope_by_org(qs)
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s.upper())
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(
                Q(driver_id__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(phone__icontains=q)
            )
        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request, **kwargs):
        total = Driver.objects.count()
        by_status = dict(
            Driver.objects.values_list('status').annotate(n=Count('id')).values_list('status', 'n')
        )
        avg_rating    = Driver.objects.aggregate(v=Avg('rating'))['v'] or 0
        avg_on_time   = Driver.objects.aggregate(v=Avg('on_time_rate'))['v'] or 0
        return Response({
            'total':      total,
            'available':  by_status.get('AVAILABLE', 0),
            'on_route':   by_status.get('ON_ROUTE', 0),
            'off_duty':   by_status.get('OFF_DUTY', 0),
            'on_leave':   by_status.get('ON_LEAVE', 0),
            'avg_rating':   round(avg_rating, 2),
            'avg_on_time':  round(avg_on_time, 1),
        })

    @action(detail=True, methods=['post'])
    def location(self, request, pk=None, **kwargs):
        """POST /api/v1/fleet/drivers/<id>/location/ — update driver GPS and status."""
        driver = self.get_object()
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        loc = request.data.get('location', '')
        status_val = request.data.get('status')

        if lat is not None:
            driver.latitude = float(lat)
        if lng is not None:
            driver.longitude = float(lng)
        if loc:
            driver.current_location = loc
        if status_val and status_val in dict(Driver.STATUS_CHOICES):
            driver.status = status_val

        driver.save(update_fields=['latitude', 'longitude', 'current_location', 'status'])

        # Also update assigned truck location if driver has one
        truck = getattr(driver, 'assigned_truck', None)
        if truck and lat is not None:
            truck.latitude = float(lat)
            truck.longitude = float(lng) if lng is not None else truck.longitude
            truck.current_location = loc or truck.current_location
            truck.save(update_fields=['latitude', 'longitude', 'current_location'])

        return Response({
            'driver_id': driver.driver_id,
            'latitude': driver.latitude,
            'longitude': driver.longitude,
            'location': driver.current_location,
        })


class FleetStatsView(APIView):
    permission_classes = [IsAuthenticated, CanViewFleet]

    def get(self, request, **kwargs):
        truck_total = Truck.objects.count()
        truck_active = Truck.objects.filter(status='ACTIVE').count()
        driver_total = Driver.objects.count()
        driver_on_route = Driver.objects.filter(status='ON_ROUTE').count()
        utilisation = round((truck_active / truck_total * 100), 1) if truck_total else 0
        return Response({
            'trucks':           truck_total,
            'trucks_active':    truck_active,
            'drivers':          driver_total,
            'drivers_on_route': driver_on_route,
            'fleet_utilisation': utilisation,
        })


class DriverAnalyticsView(APIView):
    """
    GET /api/v1/fleet/drivers/stats/
    Detailed per-driver performance analytics for the analytics dashboard.
    """
    permission_classes = [IsAuthenticated, CanViewFleet]

    def get(self, request, **kwargs):
        drivers = Driver.objects.prefetch_related('job_history').all()
        result = []
        for d in drivers:
            job_count = d.job_history.count()
            result.append({
                'driver_id': d.driver_id,
                'name': d.full_name,
                'phone': d.phone,
                'status': d.status,
                'rating': d.rating,
                'on_time_rate': d.on_time_rate,
                'total_jobs': d.total_jobs,
                'total_km': d.total_km,
                'earnings_mtd': float(d.earnings_mtd),
                'license_class': d.license_class,
                'license_expiry': d.license_expiry.isoformat() if d.license_expiry else None,
                'certifications': d.certifications,
                'years_experience': d.years_experience,
            })
        return Response(result)


class DriverTripSheetView(APIView):
    """
    GET /api/v1/fleet/driver/trip-sheet/

    Returns the authenticated driver's complete trip sheet: all assigned shipments
    with route details, fuel stops (from FuelOptimizer), border crossings, and
    a delivery checklist. Includes real-time GPS position of the truck.
    """
    permission_classes = [IsAuthenticated, CanViewFleet]

    def get(self, request):
        user = request.user
        if not user.is_driver:
            return Response({'error': 'Only drivers can access trip sheets'}, status=403)

        try:
            driver = Driver.objects.select_related('assigned_truck').get(user=user)
        except Driver.DoesNotExist:
            return Response({'error': 'No driver profile linked to this account'}, status=404)

        shipments = Shipment.objects.filter(
            assigned_driver=driver,
        ).select_related('route', 'carrier').exclude(
            status='DELIVERED',
        ).order_by('scheduled_departure')

        trip_sheet = {
            'driver': {
                'driver_id': driver.driver_id,
                'name': driver.full_name,
                'status': driver.status,
                'rating': driver.rating,
                'active_route': driver.active_route,
                'current_location': {
                    'lat': driver.latitude,
                    'lng': driver.longitude,
                    'label': driver.current_location,
                },
            },
            'truck': None,
            'shipments': [],
            'today_summary': {
                'stops_completed': 0,
                'stops_remaining': 0,
                'distance_covered_km': 0,
                'hours_driven': 0,
            },
        }

        truck = getattr(driver, 'assigned_truck', None)
        if truck:
            trip_sheet['truck'] = {
                'fleet_id': truck.fleet_id,
                'plate': truck.plate,
                'make': truck.make,
                'model': truck.model,
                'fuel_capacity_l': truck.fuel_capacity_l,
                'fuel_type': truck.fuel_type,
                'odometer_km': truck.odometer_km,
                'status': truck.status,
            }

        for s in shipments:
            events = list(s.events.order_by('-timestamp').values(
                'event_type', 'location', 'timestamp', 'notes',
            )[:10])

            shipment_data = {
                'tracking_number': s.tracking_number,
                'status': s.status,
                'dispatch_status': s.dispatch_status,
                'route': {
                    'origin': s.route.origin,
                    'destination': s.route.destination,
                    'distance_km': s.route.distance_km,
                    'estimated_hours': s.route.estimated_hours,
                },
                'weight_kg': s.weight_kg,
                'scheduled_departure': s.scheduled_departure.isoformat(),
                'scheduled_arrival': s.scheduled_arrival.isoformat(),
                'recent_events': events,
                'checklist': self._build_checklist(s),
            }
            trip_sheet['shipments'].append(shipment_data)

        return Response(trip_sheet)

    def _build_checklist(self, shipment):
        """Generate a delivery checklist for the driver."""
        items = [
            {'id': 'load_verified', 'label': 'Cargo loaded & verified', 'done': False},
            {'id': 'docs_check', 'label': 'Documents on board (BOL, customs, permits)', 'done': False},
            {'id': 'seal_check', 'label': 'Container/trailer seal verified', 'done': False},
            {'id': 'fuel_check', 'label': 'Fuel sufficient for first leg', 'done': False},
            {'id': 'tyre_check', 'label': 'Tyres & lights checked', 'done': False},
            {'id': 'gps_check', 'label': 'GPS tracker active', 'done': False},
            {'id': 'departed', 'label': 'Departed origin', 'done': False},
        ]

        events = {e['event_type'] for e in shipment.events.values_list('event_type', flat=True)}
        if 'DEPARTURE' in events:
            items[6]['done'] = True

        # If a POD exists, mark cargo loaded & docs items done
        if hasattr(shipment, 'proof_of_delivery'):
            for item in items[:3]:
                item['done'] = True
            items[6]['done'] = True

        return items


class DriverExpenseViewSet(viewsets.ModelViewSet):
    """
    CRUD for driver-captured expenses.

    Drivers see only their own expenses. Finance officers and admins see all.
    """
    permission_classes = [IsAuthenticated, CanManageFinance]
    serializer_class = DriverExpenseSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_driver:
            try:
                driver = Driver.objects.get(user=user)
                return DriverExpense.objects.filter(driver=driver).select_related('shipment')
            except Driver.DoesNotExist:
                return DriverExpense.objects.none()
        if user.can_manage_finances() or user.is_admin:
            return DriverExpense.objects.select_related('driver', 'shipment').all()
        return DriverExpense.objects.none()

    def perform_create(self, serializer):
        if self.request.user.is_driver:
            driver = Driver.objects.get(user=self.request.user)
            serializer.save(driver=driver)
        else:
            serializer.save()


class OfflineSyncView(APIView):
    """
    POST /api/v1/fleet/offline-sync/

    Accepts a batch of items captured while the driver was offline:
    - location_pings: [{latitude, longitude, location, timestamp}, ...]
    - tracking_events: [{shipment_id, event_type, location, notes, timestamp}, ...]
    - expenses: [{expense_type, amount, currency, location, receipt_image, ...}, ...]
    - pod_submissions: [{shipment_id, delivered_at, received_by_name, ...}, ...]

    All items are processed in a single transaction.
    """
    permission_classes = [IsAuthenticated, CanViewFleet]

    def post(self, request):
        user = request.user
        if not user.is_driver:
            return Response({'error': 'Only drivers can sync offline data'}, status=403)

        try:
            driver = Driver.objects.get(user=user)
        except Driver.DoesNotExist:
            return Response({'error': 'No driver profile'}, status=404)

        results = {'location_pings': 0, 'tracking_events': 0, 'expenses': 0, 'pod_submissions': 0, 'errors': []}
        sync_time = timezone.now()

        # 1. Location pings — update driver and truck GPS
        pings = request.data.get('location_pings', [])
        if pings:
            last = pings[-1]
            driver.latitude = float(last['latitude'])
            driver.longitude = float(last['longitude'])
            driver.current_location = last.get('location', '')
            driver.save(update_fields=['latitude', 'longitude', 'current_location'])

            truck = getattr(driver, 'assigned_truck', None)
            if truck:
                truck.latitude = driver.latitude
                truck.longitude = driver.longitude
                truck.current_location = driver.current_location
                truck.save(update_fields=['latitude', 'longitude', 'current_location'])
            results['location_pings'] = len(pings)

        # 2. Tracking events
        events_data = request.data.get('tracking_events', [])
        for evt in events_data:
            try:
                shipment = Shipment.objects.get(pk=evt['shipment_id'])
                TrackingEvent.objects.create(
                    shipment=shipment,
                    event_type=evt['event_type'],
                    location=evt.get('location', ''),
                    notes=evt.get('notes', ''),
                    timestamp=evt.get('timestamp', sync_time),
                    recorded_by=user,
                )
                results['tracking_events'] += 1
            except (Shipment.DoesNotExist, KeyError) as e:
                results['errors'].append(f'Tracking event error: {e}')

        # 3. Expenses
        expenses_data = request.data.get('expenses', [])
        for exp in expenses_data:
            try:
                DriverExpense.objects.create(
                    driver=driver,
                    shipment_id=exp.get('shipment_id'),
                    expense_type=exp['expense_type'],
                    amount=float(exp['amount']),
                    currency=exp.get('currency', 'KES'),
                    description=exp.get('description', ''),
                    location=exp.get('location', ''),
                    latitude=exp.get('latitude'),
                    longitude=exp.get('longitude'),
                    captured_at=exp.get('captured_at', sync_time),
                    synced_at=sync_time,
                )
                results['expenses'] += 1
            except (KeyError, ValueError) as e:
                results['errors'].append(f'Expense error: {e}')

        # 4. POD submissions
        pod_data = request.data.get('pod_submissions', [])
        if pod_data:
            from pod.models import ProofOfDelivery, PODPhoto
            for pod in pod_data:
                try:
                    shipment = Shipment.objects.get(pk=pod['shipment_id'])
                    pod_obj, created = ProofOfDelivery.objects.update_or_create(
                        shipment=shipment,
                        defaults={
                            'delivered_at': pod.get('delivered_at', sync_time),
                            'received_by_name': pod.get('received_by_name', ''),
                            'received_by_phone': pod.get('received_by_phone', ''),
                            'received_by_signature': pod.get('received_by_signature', ''),
                            'location_lat': pod.get('location_lat'),
                            'location_lng': pod.get('location_lng'),
                            'condition': pod.get('condition', 'GOOD'),
                            'notes': pod.get('notes', ''),
                            'captured_by': user,
                        },
                    )
                    if created:
                        shipment.status = 'DELIVERED'
                        shipment.actual_arrival = sync_time
                        shipment.save(update_fields=['status', 'actual_arrival'])
                    results['pod_submissions'] += 1
                except (Shipment.DoesNotExist, KeyError) as e:
                    results['errors'].append(f'POD error: {e}')

        return Response(results, status=status.HTTP_200_OK)


class AssignTruckView(APIView):
    """
    POST /api/v1/fleet/trucks/<pk>/assign-truck/

    Assign or unassign a driver to/from a truck.
    Body: {driver_id: "DRV-001"} to assign, {driver_id: null} to unassign.
    """
    permission_classes = [IsAuthenticated, CanAssignFleet]

    def post(self, request, pk=None):
        try:
            truck = Truck.objects.get(pk=pk)
        except Truck.DoesNotExist:
            return Response({'error': 'Truck not found'}, status=404)

        driver_id = request.data.get('driver_id')

        if driver_id is None:
            # Unassign
            if truck.assigned_driver:
                old_driver = truck.assigned_driver
                old_driver.status = 'AVAILABLE'
                old_driver.save(update_fields=['status'])
            truck.assigned_driver = None
            truck.status = 'IDLE'
            truck.save(update_fields=['assigned_driver', 'status'])
            return Response({'status': 'unassigned'})

        try:
            driver = Driver.objects.get(driver_id=driver_id)
        except Driver.DoesNotExist:
            return Response({'error': f'Driver {driver_id} not found'}, status=404)

        # Unassign previous driver if any
        if truck.assigned_driver and truck.assigned_driver != driver:
            truck.assigned_driver.status = 'AVAILABLE'
            truck.assigned_driver.save(update_fields=['status'])

        # Unassign driver from previous truck if any
        previous_truck = getattr(driver, 'assigned_truck', None)
        if previous_truck and previous_truck != truck:
            previous_truck.assigned_driver = None
            previous_truck.status = 'IDLE'
            previous_truck.save(update_fields=['assigned_driver', 'status'])

        truck.assigned_driver = driver
        truck.status = 'ACTIVE'
        truck.save(update_fields=['assigned_driver', 'status'])

        driver.status = 'ON_ROUTE'
        driver.save(update_fields=['status'])

        return Response({
            'truck_id': truck.fleet_id,
            'driver_id': driver.driver_id,
            'driver_name': driver.full_name,
        })
