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

from .models import Route, Shipment
from .serializers import (
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
        return Shipment.objects.select_related("route").order_by("-created_at")

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

        return Response({
            "shipment_id":       shipment.pk,
            "tracking_number":   shipment.tracking_number,
            "delay_risk_score":  shipment.delay_risk_score,
            "predicted_delayed": bool(label),
            "confidence":        round(prob, 4),
        })
