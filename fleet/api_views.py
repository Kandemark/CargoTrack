"""
fleet/api_views.py — Fleet REST API views.

Endpoints:
  GET/POST       /api/v1/fleet/trucks/
  GET/PATCH/PUT  /api/v1/fleet/trucks/<pk>/
  GET/POST       /api/v1/fleet/drivers/
  GET/PATCH/PUT  /api/v1/fleet/drivers/<pk>/
  GET            /api/v1/fleet/stats/
"""
from django.db.models import Avg, Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Driver, Truck
from .serializers import (
    DriverListSerializer,
    DriverSerializer,
    TruckListSerializer,
    TruckSerializer,
)


class TruckViewSet(viewsets.ModelViewSet):
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

    permission_classes = [IsAuthenticated]
    queryset = Truck.objects.select_related('assigned_driver').prefetch_related('maintenance_logs')

    def get_serializer_class(self):
        # Use lightweight list serializer to avoid N+1 on nested relations
        if self.action == 'list':
            return TruckListSerializer
        return TruckSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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


class DriverViewSet(viewsets.ModelViewSet):
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

    permission_classes = [IsAuthenticated]
    queryset = Driver.objects.prefetch_related('job_history', 'assigned_truck')

    def get_serializer_class(self):
        # Lightweight serializer for list to avoid prefetching job_history unnecessarily
        if self.action == 'list':
            return DriverListSerializer
        return DriverSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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
