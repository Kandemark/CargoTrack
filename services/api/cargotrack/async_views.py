"""
cargotrack/async_views.py — Async versions of high-traffic endpoints.

Converts the most heavily-hit synchronous endpoints to async so Daphne
can interleave request handling during I/O waits.  Database operations
still run synchronously via sync_to_async — the win is at the ASGI
connection-handling level, not at the ORM level.

Endpoints:
  POST /api/v1/payments/webhook/mpesa/async/        — M-Pesa callback (async)
  POST /api/v1/payments/webhook/airtel/async/       — Airtel callback (async)
  POST /api/v1/payments/webhook/mtn/async/          — MTN MoMo callback (async)
  POST /api/v1/payments/webhook/flutterwave/async/  — Flutterwave webhook (async)
  POST /api/v1/payments/webhook/stripe/async/       — Stripe webhook (async)
  POST /api/v1/tracking/events/async/               — tracking event ingestion
"""
import json
import logging

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from cargotrack.cache import invalidate_dashboard_caches

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _process_webhook_sync(provider_name: str, data: dict) -> None:
    """Synchronous webhook processing — DB write + cache invalidation."""
    from datetime import datetime

    from payments.models import Payment
    from payments.providers import get_provider

    try:
        provider = get_provider(provider_name)
        result = provider.parse_webhook(data)
        if not result.reference:
            return

        payment = Payment.objects.filter(
            provider=provider_name,
            provider_reference=result.reference,
        ).first()

        if not payment:
            logger.warning(
                '%s webhook: no payment found for ref %s',
                provider_name, result.reference,
            )
            return

        payment.status = 'SUCCESS' if result.success else 'FAILED'
        payment.raw_webhook = data
        payment.save(update_fields=['status', 'raw_webhook'])

        if result.success:
            invoice = payment.invoice
            invoice.status = 'PAID'
            invoice.paid_at = datetime.utcnow()
            invoice.save(update_fields=['status', 'paid_at'])
            invalidate_dashboard_caches()
    except Exception:
        logger.exception('%s webhook processing failed', provider_name)


def _create_tracking_event_sync(user_id: int, data: dict) -> dict:
    """Synchronous tracking event creation. Returns the created event as dict."""
    from accounts.models import CustomUser
    from shipments.models import Shipment
    from tracking.models import TrackingEvent

    user = CustomUser.objects.get(id=user_id)
    shipment_id = data.get('shipment')
    if shipment_id:
        shipment = Shipment.objects.get(pk=shipment_id)
    else:
        raise ValueError('shipment ID is required')

    event = TrackingEvent.objects.create(
        shipment=shipment,
        event_type=data.get('event_type', 'CHECKPOINT'),
        location=data.get('location', ''),
        notes=data.get('notes', ''),
        recorded_by=user,
    )
    invalidate_dashboard_caches()
    return event.to_dict()


# ── Async webhook views ────────────────────────────────────────────────────────

@csrf_exempt
async def async_m_pesa_webhook(request: HttpRequest) -> JsonResponse:
    body = json.loads(request.body) if request.body else {}
    await sync_to_async(_process_webhook_sync)('MPESA', body)
    return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})


@csrf_exempt
async def async_airtel_webhook(request: HttpRequest) -> JsonResponse:
    body = json.loads(request.body) if request.body else {}
    await sync_to_async(_process_webhook_sync)('AIRTEL', body)
    return JsonResponse({'status': 'ok'})


@csrf_exempt
async def async_mtn_webhook(request: HttpRequest) -> JsonResponse:
    body = json.loads(request.body) if request.body else {}
    await sync_to_async(_process_webhook_sync)('MTN', body)
    return JsonResponse({'status': 'ok'})


@csrf_exempt
async def async_flutterwave_webhook(request: HttpRequest) -> JsonResponse:
    from payments.providers import get_provider

    body = json.loads(request.body) if request.body else {}
    sig = request.headers.get('verif-hash', '')

    provider = await sync_to_async(get_provider)('FLUTTERWAVE')
    valid = await sync_to_async(provider.verify_webhook_signature)(request.body, sig)
    if not valid:
        return JsonResponse({'error': 'invalid signature'}, status=403)

    await sync_to_async(_process_webhook_sync)('FLUTTERWAVE', body)
    return JsonResponse({'status': 'ok'})


@csrf_exempt
async def async_stripe_webhook(request: HttpRequest) -> JsonResponse:
    from payments.providers import get_provider

    body = request.body
    sig = request.headers.get('Stripe-Signature', '')

    provider = await sync_to_async(get_provider)('STRIPE')
    valid = await sync_to_async(provider.verify_webhook_signature)(body, sig)
    if not valid:
        return JsonResponse({'error': 'invalid signature'}, status=403)

    payload = json.loads(body) if body else {}
    await sync_to_async(_process_webhook_sync)('STRIPE', payload)
    return JsonResponse({'status': 'ok'})


# ── Async tracking event ingestion ─────────────────────────────────────────────

@csrf_exempt
async def async_tracking_event_create(request: HttpRequest) -> JsonResponse:
    """
    POST /api/v1/tracking/events/async/

    Optimised async endpoint for high-throughput tracking event ingestion
    from mobile devices and IoT gateways.  Accepts the same JSON body as
    the synchronous DRF endpoint but handles connection multiplexing at
    the ASGI level for higher throughput under Daphne.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'authentication required'}, status=401)

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'error': 'invalid JSON'}, status=400)

    try:
        event_dict = await sync_to_async(_create_tracking_event_sync)(
            request.user.id, body,
        )
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except Exception:
        logger.exception('Failed to create tracking event via async endpoint')
        return JsonResponse({'error': 'internal error'}, status=500)

    return JsonResponse(event_dict, status=201)
