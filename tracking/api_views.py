"""
tracking/api_views.py — DRF API views for tracking events
==========================================================

Views
-----
TrackingEventListCreateView
    ``GET  /api/v1/tracking/events/``    — paginated list; supports
    ``?tracking_number=CT-…`` query param for shipment-scoped filtering.
    ``POST /api/v1/tracking/events/``    — create a new tracking event;
    ``recorded_by`` is set from ``request.user`` automatically.

TrackingEventDetailView
    ``GET  /api/v1/tracking/events/<pk>/`` — retrieve a single event.

ShipmentEventsView
    ``GET  /api/v1/tracking/<tracking_number>/events/``
    Legacy endpoint retained for backwards compatibility with older clients.
    Returns events as plain dicts via ``TrackingEvent.to_dict()``.

ShipmentTrackingEventsAPIView
    ``GET  /api/v1/shipments/<pk>/tracking-events/`` — list events for a shipment.
    ``POST /api/v1/shipments/<pk>/tracking-events/`` — log a new event.
    Preferred over ShipmentEventsView; mounted under shipments/ URL namespace.
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from shipments.models import Shipment
from .models import TrackingEvent
from .serializers import ShipmentEventCreateSerializer, TrackingEventSerializer


class TrackingEventListCreateView(generics.ListCreateAPIView):
    serializer_class = TrackingEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = TrackingEvent.objects.select_related("shipment", "recorded_by")
        tracking_number = self.request.query_params.get("tracking_number")
        if tracking_number:
            qs = qs.filter(shipment__tracking_number=tracking_number.upper())
        return qs

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class TrackingEventDetailView(generics.RetrieveAPIView):
    queryset = TrackingEvent.objects.all()
    serializer_class = TrackingEventSerializer
    permission_classes = [permissions.IsAuthenticated]


class ShipmentEventsView(APIView):
    """Return all events for a shipment by tracking number (legacy endpoint)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, tracking_number):
        shipment = get_object_or_404(Shipment, tracking_number=tracking_number.upper())
        events = TrackingEvent.objects.filter(shipment=shipment)
        return Response([e.to_dict() for e in events])


class ShipmentTrackingEventsAPIView(generics.ListCreateAPIView):
    """
    GET  /api/v1/shipments/<pk>/tracking-events/
    POST /api/v1/shipments/<pk>/tracking-events/

    GET  — Returns all tracking events for a shipment identified by PK.
    POST — Logs a new event against the shipment; sets recorded_by to
           the authenticated user. Request body: event_type, location, notes.
           The shipment FK is injected from the URL — do not include it in
           the request body.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ShipmentEventCreateSerializer
        return TrackingEventSerializer

    def _get_shipment(self):
        return get_object_or_404(
            Shipment.objects.only('id', 'tracking_number'),
            pk=self.kwargs['pk'],
        )

    def get_queryset(self):
        return (
            TrackingEvent.objects
            .filter(shipment_id=self.kwargs['pk'])
            .select_related('recorded_by')
            .order_by('-timestamp')
        )

    def perform_create(self, serializer):
        shipment = self._get_shipment()
        serializer.save(shipment=shipment, recorded_by=self.request.user)
