"""
shipments/api_views.py — DRF class-based API views.

OOP:
    Inheritance  — each view extends a DRF generic or APIView base.
    Composition  — PredictDelayAPIView loads DelayPredictor (which composes
                   FeatureEngineer) to run inference without owning that logic.
"""
import datetime
import random
import string

from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Document, Route, Shipment
from .serializers import (
    DocumentSerializer,
    RouteSerializer,
    ShipmentCreateSerializer,
    ShipmentSerializer,
    ShipmentStatusSerializer,
)


def _generate_tracking_number() -> str:
    """Return a unique tracking number in the format CT-YYYYMMDD-XXXX."""
    date_str = datetime.date.today().strftime("%Y%m%d")
    while True:
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        candidate = f"CT-{date_str}-{suffix}"
        if not Shipment.objects.filter(tracking_number=candidate).exists():
            return candidate


class RouteListAPIView(generics.ListAPIView):
    """
    GET /api/v1/routes/

    Returns all available routes without pagination — used to populate the
    route dropdown in the shipment creation form.
    """

    queryset = Route.objects.all()
    serializer_class = RouteSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None


class ShipmentListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /shipments/  — paginated list of all shipments.
    POST /shipments/  — create a new shipment; tracking_number auto-generated.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Shipment.objects.select_related("route").order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ShipmentCreateSerializer
        return ShipmentSerializer

    def perform_create(self, serializer):
        serializer.save(tracking_number=_generate_tracking_number())

    def create(self, request, *args, **kwargs):
        """Return full ShipmentSerializer representation after creation."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Re-serialise with full nested output
        out = ShipmentSerializer(
            serializer.instance,
            context=self.get_serializer_context(),
        )
        return Response(out.data, status=status.HTTP_201_CREATED)


class ShipmentDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    GET   /shipments/<pk>/  — full shipment detail.
    PATCH /shipments/<pk>/  — update the status field only.
    """

    queryset = Shipment.objects.select_related("route").all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return ShipmentStatusSerializer
        return ShipmentSerializer

    def partial_update(self, request, *args, **kwargs):
        """Accept only the 'status' field; ignore any other supplied keys."""
        allowed = {"status": request.data.get("status")}
        if not allowed["status"]:
            return Response(
                {"error": "'status' field is required for PATCH."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(
            self.get_object(), data=allowed, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PredictDelayAPIView(APIView):
    """
    POST /shipments/<pk>/predict/

    Body: {"shipment_id": N}   (pk in URL is ignored for backwards compat;
    the body shipment_id is used so the endpoint can also be called standalone.)

    Loads the persisted DelayPredictor, runs feature extraction on the
    requested shipment, returns the predicted label and probability, and
    updates shipment.delay_risk_score in the database.

    Returns 503 if the model file has not been trained yet.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk=None):
        # Accept shipment_id from body OR URL pk
        shipment_id = request.data.get("shipment_id") or pk
        if not shipment_id:
            return Response(
                {"error": "Provide 'shipment_id' in the request body."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shipment = get_object_or_404(
            Shipment.objects.select_related("route"), pk=shipment_id
        )

        # Load persisted predictor (includes fitted FeatureEngineer)
        try:
            from cargotrack.ml.delay_predictor import DelayPredictor
            dp = DelayPredictor.load()
        except FileNotFoundError:
            return Response(
                {"error": "Model not trained yet. Run 'python manage.py train_model'."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Transform the single shipment using the loaded predictor's engineer
        qs = Shipment.objects.select_related("route").filter(pk=shipment.pk)
        X  = dp.feature_engineer.transform(qs)

        label, prob = dp.predict(X)[0]

        # Persist updated risk score
        shipment.delay_risk_score = round(prob, 4)
        shipment.save(update_fields=["delay_risk_score", "updated_at"])

        # ── Integration (Andrew Maina - Systems Integration) ──────────────────
        # Fire alerts if the risk score crosses the configured threshold.
        # This ties together the ML prediction and the notification system.
        from predictions.base import DelayPrediction
        from alerts.manager import AlertManager

        prediction = DelayPrediction(
            delay_risk_score=prob,
            # If label=1, we assume at least 24h delay as per the model contract.
            predicted_delay_hours=24.0 if label else 0.0,
            shipment_id=shipment.pk
        )

        am = AlertManager()
        am.check_shipment(shipment, prediction)

        return Response({
            "shipment_id":       shipment.pk,
            "tracking_number":   shipment.tracking_number,
            "delay_risk_score":  shipment.delay_risk_score,
            "predicted_delayed": bool(label),
            "confidence":        round(prob, 4),
        })


class ShipmentDocumentListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/v1/shipments/<pk>/documents/ — list documents for a shipment.
    POST /api/v1/shipments/<pk>/documents/ — upload a document (multipart/form-data).
    """
    serializer_class   = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes: list  # accept multipart uploads

    def get_queryset(self):
        return Document.objects.filter(shipment_id=self.kwargs['pk'])

    def perform_create(self, serializer):
        shipment = get_object_or_404(Shipment, pk=self.kwargs['pk'])
        serializer.save(shipment=shipment, uploaded_by=self.request.user)


class PublicTrackingAPIView(APIView):
    """
    GET /api/v1/track/<tracking_number>/
    Public (AllowAny) — returns shipment status and events for client tracking portal.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, tracking_number=None):
        shipment = get_object_or_404(
            Shipment.objects.select_related('route'),
            tracking_number=tracking_number.upper(),
        )
        from tracking.models import TrackingEvent
        events = list(
            TrackingEvent.objects.filter(shipment=shipment)
            .order_by('-timestamp')
            .values('event_type', 'event_type_display', 'location', 'timestamp', 'notes')
        )
        return Response({
            'tracking_number':    shipment.tracking_number,
            'status':             shipment.status,
            'status_display':     shipment.get_status_display(),
            'carrier_name':       shipment.carrier_name,
            'origin':             shipment.route.origin,
            'destination':        shipment.route.destination,
            'scheduled_departure': shipment.scheduled_departure,
            'scheduled_arrival':  shipment.scheduled_arrival,
            'actual_arrival':     shipment.actual_arrival,
            'events':             events,
        })
