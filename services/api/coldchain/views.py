"""coldchain/views.py — Temperature monitoring, bulk IoT ingest, and compliance reporting."""
import json

from asgiref.sync import async_to_sync
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ColdChainShipment, TemperatureReading,
    TemperatureExcursion, ColdChainCertificate, ColdChainSLA,
)
from .serializers import (
    ColdChainShipmentSerializer, TemperatureReadingSerializer,
    TemperatureExcursionSerializer, ColdChainCertificateSerializer,
)


class ColdChainShipmentViewSet(viewsets.ModelViewSet):
    queryset = ColdChainShipment.objects.select_related(
        'shipment', 'certificate',
    ).prefetch_related('readings', 'excursions').all()
    serializer_class = ColdChainShipmentSerializer

    @action(detail=True, methods=['get'])
    def readings(self, request, pk=None):
        cc = self.get_object()
        qs = cc.readings.order_by('-timestamp')[:100]
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(TemperatureReadingSerializer(page, many=True).data)
        return Response(TemperatureReadingSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'])
    def excursions(self, request, pk=None):
        cc = self.get_object()
        qs = cc.excursions.order_by('-started_at')
        return Response(TemperatureExcursionSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def acknowledge_excursion(self, request, pk=None):
        cc = self.get_object()
        excursion_id = request.data.get('excursion_id')
        try:
            exc = cc.excursions.get(pk=excursion_id, resolved_at__isnull=True)
        except TemperatureExcursion.DoesNotExist:
            return Response(
                {'error': 'active excursion not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        exc.acknowledged_by = request.user
        exc.acknowledged_at = timezone.now()
        exc.resolution_notes = request.data.get('resolution_notes', '')
        exc.save()
        return Response(TemperatureExcursionSerializer(exc).data)

    @action(detail=True, methods=['post'])
    def generate_certificate(self, request, pk=None):
        cc = self.get_object()
        if hasattr(cc, 'certificate'):
            return Response(ColdChainCertificateSerializer(cc.certificate).data)

        readings = cc.readings.order_by('timestamp')
        if not readings.exists():
            return Response(
                {'error': 'no temperature readings available'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        excursions = cc.excursions.all()
        temps = list(readings.values_list('temperature_c', flat=True))
        cert = ColdChainCertificate.objects.create(
            coldchain_shipment=cc,
            total_readings=readings.count(),
            excursions_count=excursions.count(),
            total_excursion_minutes=sum(e.duration_minutes or 0 for e in excursions),
            min_temp_recorded_c=min(temps),
            max_temp_recorded_c=max(temps),
            avg_temp_c=sum(temps) / len(temps),
            is_compliant=all(
                cc.temp_min_c <= t <= cc.temp_max_c for t in temps
            ) and excursions.filter(
                severity__in=['CRITICAL', 'SPOILAGE_ALERT'],
            ).count() == 0,
        )
        return Response(
            ColdChainCertificateSerializer(cert).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def compliance_report(self, request, pk=None):
        """GET /api/v1/coldchain/<id>/compliance-report/ — full compliance summary."""
        cc = self.get_object()
        readings = cc.readings.order_by('timestamp')
        excursions = cc.excursions.all()

        if not readings.exists():
            return Response({'error': 'No readings available'}, status=404)

        temps = list(readings.values_list('temperature_c', flat=True))
        total_minutes = max(
            (readings.last().timestamp - readings.first().timestamp).total_seconds() / 60,
            1,
        )
        in_range = sum(1 for t in temps if cc.temp_min_c <= t <= cc.temp_max_c)
        compliance_pct = round(in_range / len(temps) * 100, 1)

        return Response({
            'tracking_number': cc.shipment.tracking_number,
            'product_type': cc.get_product_type_display(),
            'temp_range': {'min_c': cc.temp_min_c, 'max_c': cc.temp_max_c},
            'tolerance_minutes': cc.tolerance_minutes,
            'monitoring_period_hours': round(total_minutes / 60, 1),
            'total_readings': len(temps),
            'compliance_pct': compliance_pct,
            'temperature_stats': {
                'min_c': min(temps),
                'max_c': max(temps),
                'avg_c': round(sum(temps) / len(temps), 2),
                'stddev_c': round(
                    (sum((t - sum(temps) / len(temps)) ** 2 for t in temps) / len(temps)) ** 0.5, 2,
                ),
            },
            'excursions': {
                'total': excursions.count(),
                'total_minutes': sum(e.duration_minutes or 0 for e in excursions),
                'by_severity': {
                    sev: excursions.filter(severity=sev).count()
                    for sev in ['WARNING', 'BREACH', 'CRITICAL', 'SPOILAGE_ALERT']
                },
            },
            'sla': {
                'is_breached': cc.sla.is_breached if hasattr(cc, 'sla') else False,
                'max_excursion_minutes': cc.sla.max_excursion_minutes if hasattr(cc, 'sla') else None,
            } if hasattr(cc, 'sla') else None,
            'certificate': ColdChainCertificateSerializer(cc.certificate).data if hasattr(cc, 'certificate') else None,
        })


class TemperatureReadingViewSet(viewsets.ModelViewSet):
    queryset = TemperatureReading.objects.all()
    serializer_class = TemperatureReadingSerializer

    def create(self, request, *args, **kwargs):
        """Handle single or bulk IoT ingestion. Bulk uses bulk_create for performance."""
        many = isinstance(request.data, list)

        if many and len(request.data) > 1000:
            return Response(
                {'error': 'Max 1000 readings per batch'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data, many=many)
        serializer.is_valid(raise_exception=True)

        if many:
            instances = serializer.save()
            self._detect_excursions_bulk(instances)
            self._push_to_channel_layer(instances)
        else:
            instance = serializer.save()
            self._detect_excursion(instance)
            self._push_to_channel_layer([instance])

        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers,
        )

    def _detect_excursion(self, reading):
        try:
            cc = ColdChainShipment.objects.select_related('shipment').get(
                monitoring_device_id=reading.device_id,
            )
        except ColdChainShipment.DoesNotExist:
            return

        is_breach = (
            reading.temperature_c < cc.temp_min_c
            or reading.temperature_c > cc.temp_max_c
        )

        active = cc.excursions.filter(resolved_at__isnull=True).first()

        if is_breach:
            if active:
                active.peak_temp_c = max(active.peak_temp_c or -100, reading.temperature_c)
                active.min_temp_c = min(active.min_temp_c or 100, reading.temperature_c)
                active.save()
                active.check_escalation(cc.tolerance_minutes)
            else:
                exc = cc.excursions.create(
                    started_at=reading.timestamp,
                    peak_temp_c=reading.temperature_c,
                    min_temp_c=reading.temperature_c,
                    temp_limit_breached=(
                        'OVER_MAX' if reading.temperature_c > cc.temp_max_c else 'UNDER_MIN'
                    ),
                    severity='BREACH',
                )
                # SLA tracking
                if not hasattr(cc, 'sla'):
                    ColdChainSLA.objects.create(coldchain_shipment=cc)
                cc.sla.total_excursions = cc.excursions.count()
                cc.sla.save(update_fields=['total_excursions'])
                cc.sla.check_breach()

                # Push excursion alert to channel layer
                self._push_excursion_alert(exc)

        elif active:
            # Temperature is back in range — try auto-resolve
            if active.try_auto_resolve(reading.temperature_c, cc.tolerance_minutes):
                self._push_excursion_resolved(active)

    def _detect_excursions_bulk(self, readings):
        for r in readings:
            self._detect_excursion(r)

    def _push_to_channel_layer(self, readings):
        """Push new readings to WebSocket channel layer for live dashboard."""
        from channels.layers import get_channel_layer
        try:
            layer = get_channel_layer()
            if layer is None:
                return
            for r in readings:
                async_to_sync(layer.group_send)(
                    f'coldchain_{r.coldchain_shipment_id or "all"}',
                    {
                        'type': 'temperature_reading',
                        'data': {
                            'temperature_c': r.temperature_c,
                            'humidity_pct': r.humidity_pct,
                            'battery_level': r.battery_level,
                            'timestamp': r.timestamp.isoformat(),
                            'location': {
                                'lat': r.location_lat,
                                'lng': r.location_lng,
                            },
                        },
                    },
                )
        except Exception:
            pass  # Channel layer not available (e.g., during tests)

    def _push_excursion_alert(self, exc):
        from channels.layers import get_channel_layer
        try:
            layer = get_channel_layer()
            if layer is None:
                return
            cc = exc.coldchain_shipment
            payload = {
                'type': 'excursion_alert',
                'data': {
                    'shipment_id': cc.shipment_id,
                    'tracking_number': cc.shipment.tracking_number,
                    'severity': exc.severity,
                    'temp_limit_breached': exc.temp_limit_breached,
                    'peak_temp_c': exc.peak_temp_c,
                    'min_temp_c': exc.min_temp_c,
                    'started_at': exc.started_at.isoformat(),
                    'product_type': cc.get_product_type_display(),
                    'temp_range': f'{cc.temp_min_c}–{cc.temp_max_c}°C',
                },
            }
            async_to_sync(layer.group_send)(
                f'coldchain_{cc.shipment.tracking_number}', payload,
            )
            async_to_sync(layer.group_send)('coldchain_all', payload)
        except Exception:
            pass

    def _push_excursion_resolved(self, exc):
        from channels.layers import get_channel_layer
        try:
            layer = get_channel_layer()
            if layer is None:
                return
            payload = {
                'type': 'excursion_resolved',
                'data': {
                    'excursion_id': exc.pk,
                    'duration_minutes': exc.duration_minutes,
                    'severity': exc.severity,
                    'resolved_at': exc.resolved_at.isoformat() if exc.resolved_at else None,
                },
            }
            cc = exc.coldchain_shipment
            async_to_sync(layer.group_send)(
                f'coldchain_{cc.shipment.tracking_number}', payload,
            )
        except Exception:
            pass


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def compliance_dashboard(request):
    """
    GET /api/v1/coldchain/compliance-dashboard/

    Fleet-wide cold chain compliance overview:
    - Active cold chain shipments
    - Compliance percentage across fleet
    - Active excursions count
    - SLA breach count
    """
    active_cc = ColdChainShipment.objects.filter(
        shipment__status__in=['PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELAYED'],
    ).select_related('shipment').prefetch_related('excursions')

    total = active_cc.count()
    active_excursions = TemperatureExcursion.objects.filter(
        resolved_at__isnull=True,
        coldchain_shipment__in=active_cc,
    ).count()

    sla_breaches = ColdChainSLA.objects.filter(
        is_breached=True,
        coldchain_shipment__in=active_cc,
    ).count()

    by_product_type = {}
    for cc in active_cc:
        pt = cc.get_product_type_display()
        if pt not in by_product_type:
            by_product_type[pt] = 0
        by_product_type[pt] += 1

    return Response({
        'total_active': total,
        'active_excursions': active_excursions,
        'sla_breaches': sla_breaches,
        'by_product_type': by_product_type,
        'critical_shipments': [
            {
                'tracking_number': cc.shipment.tracking_number,
                'product_type': cc.get_product_type_display(),
                'temp_range': f'{cc.temp_min_c}–{cc.temp_max_c}°C',
                'active_excursion': cc.excursions.filter(resolved_at__isnull=True).first().severity if cc.excursions.filter(resolved_at__isnull=True).exists() else None,
            }
            for cc in active_cc.filter(excursions__resolved_at__isnull=True).distinct()[:20]
        ],
    })
