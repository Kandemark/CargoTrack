"""pod/views.py — Proof of Delivery, verification, disputes, and QR code endpoints."""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import ProofOfDelivery, PODPhoto, PODDispute
from .serializers import (
    ProofOfDeliverySerializer,
    PODPhotoSerializer,
    PODDisputeSerializer,
)


class ProofOfDeliveryViewSet(viewsets.ModelViewSet):
    queryset = ProofOfDelivery.objects.select_related(
        'shipment', 'captured_by', 'verified_by',
    ).prefetch_related('photos').all()
    serializer_class = ProofOfDeliverySerializer

    def create(self, request, *args, **kwargs):
        """Create POD — must be a driver, dispatcher, or warehouse manager."""
        if not request.user.can_capture_pod():
            return Response(
                {'error': 'You do not have permission to capture proof of delivery'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def upload_photo(self, request, pk=None):
        pod = self.get_object()
        serializer = PODPhotoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(pod=pod)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """POST /api/v1/pod/<id>/verify/ — client verifies delivery acceptance."""
        pod = self.get_object()
        if pod.verification_status == 'VERIFIED':
            return Response({'message': 'Already verified', 'status': 'VERIFIED'})

        pod.verification_status = 'VERIFIED'
        pod.verified_by = request.user
        pod.verified_at = timezone.now()
        pod.save(update_fields=['verification_status', 'verified_by', 'verified_at'])
        return Response(ProofOfDeliverySerializer(pod).data)

    @action(detail=True, methods=['post'])
    def raise_dispute(self, request, pk=None):
        """POST /api/v1/pod/<id>/raise-dispute/ — client disputes delivery."""
        pod = self.get_object()
        if hasattr(pod, 'dispute'):
            return Response(
                PODDisputeSerializer(pod.dispute).data,
                status=status.HTTP_200_OK,
            )

        serializer = PODDisputeSerializer(data={
            **request.data, 'pod': pod.pk,
        })
        if serializer.is_valid():
            dispute = serializer.save(raised_by=request.user)
            return Response(
                PODDisputeSerializer(dispute).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def resolve_dispute(self, request, pk=None):
        """POST /api/v1/pod/<id>/resolve-dispute/ — admin resolves dispute."""
        pod = self.get_object()
        if not hasattr(pod, 'dispute'):
            return Response({'error': 'No dispute found'}, status=status.HTTP_404_NOT_FOUND)

        dispute = pod.dispute
        dispute.resolution_status = request.data.get('resolution_status', 'CLOSED')
        dispute.resolution_notes = request.data.get('resolution_notes', '')
        dispute.resolution_amount = request.data.get('resolution_amount')
        if dispute.resolution_status in (
            'RESOLVED_REFUND', 'RESOLVED_REDELIVERY',
            'RESOLVED_ACCEPTED', 'CLOSED',
        ):
            dispute.resolved_at = timezone.now()
            pod.verification_status = (
                'VERIFIED' if dispute.resolution_status == 'RESOLVED_ACCEPTED'
                else 'DISPUTED'
            )
            pod.save(update_fields=['verification_status'])
        dispute.assigned_to = request.user
        dispute.save()
        return Response(PODDisputeSerializer(dispute).data)


class PODDisputeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only list/detail of all disputes. Resolution happens via the POD endpoint."""
    queryset = PODDispute.objects.select_related('pod', 'raised_by', 'assigned_to').all()
    serializer_class = PODDisputeSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('resolution_status')
        if status_filter:
            qs = qs.filter(resolution_status=status_filter)
        return qs


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_pod_by_code(request):
    """
    GET /api/v1/pod/verify-by-code/?code=CT-POD-XXXXXX

    Public endpoint — receiver clicks the QR link and sees the POD.
    They can sign/confirm from this page (no auth required for viewing).
    """
    code = request.query_params.get('code', '')
    if not code:
        return Response({'error': 'Verification code required'}, status=400)
    try:
        pod = ProofOfDelivery.objects.select_related('shipment').get(verification_code=code)
    except ProofOfDelivery.DoesNotExist:
        return Response({'error': 'Invalid verification code'}, status=404)
    return Response({
        'tracking_number': pod.shipment.tracking_number,
        'delivered_at': pod.delivered_at.isoformat(),
        'received_by_name': pod.received_by_name,
        'condition': pod.get_condition_display(),
        'verification_status': pod.verification_status,
        'location': {
            'lat': pod.location_lat,
            'lng': pod.location_lng,
        },
        'photos': PODPhotoSerializer(pod.photos.all(), many=True).data,
    })
