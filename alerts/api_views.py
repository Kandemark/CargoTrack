"""
alerts/api_views.py — DRF API views for the alerts app
=======================================================

Views
-----
AlertListAPIView
    ``GET /api/v1/alerts/`` — returns unacknowledged alerts by default.
    Managers and admins can pass ``?all=1`` to include acknowledged alerts.
    Requires IsClientUser (any authenticated user).

AlertAcknowledgeAPIView
    ``POST /api/v1/alerts/<pk>/acknowledge/`` — marks an alert as acknowledged
    and records the acknowledging user.  Requires IsManagerUser (LOGISTICS_MGR
    or ADMIN).
"""
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from cargotrack.permissions import IsClientUser, IsManagerUser
from .models import Alert
from .serializers import AlertSerializer, AlertAcknowledgeSerializer


class AlertListAPIView(generics.ListAPIView):
    """
    GET /api/v1/alerts/
    Returns all unacknowledged alerts, newest first.
    Managers also see acknowledged alerts via ?all=1.
    """
    serializer_class = AlertSerializer
    permission_classes = [IsClientUser]

    def get_queryset(self):
        qs = Alert.objects.select_related('shipment').order_by('-sent_at')
        show_all = self.request.query_params.get('all') == '1'
        user = self.request.user
        if not show_all or not (user.is_admin or user.is_logistics_manager):
            qs = qs.filter(acknowledged=False)
        return qs


class AlertAcknowledgeAPIView(APIView):
    """
    POST /api/v1/alerts/<pk>/acknowledge/
    Marks an alert as acknowledged. Requires Manager or Admin role.
    """
    permission_classes = [IsManagerUser]

    def post(self, request, pk):
        try:
            alert = Alert.objects.get(pk=pk)
        except Alert.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if alert.acknowledged:
            return Response({'detail': 'Alert already acknowledged.'}, status=status.HTTP_200_OK)

        alert.acknowledged = True
        alert.acknowledged_by = request.user
        alert.save(update_fields=['acknowledged', 'acknowledged_by'])
        return Response(AlertSerializer(alert).data)
