"""
cargotrack/streams.py — Redis Streams event bus.

Replaces the synchronous alert/notification pipeline with a persistent,
at-least-once event stream backed by Redis Streams.  Producers publish
domain events without blocking request threads; consumers process them
asynchronously with retry and dead-letter support.

Streams (created automatically on first use):
  ct:events:shipments   — shipment.status_changed
  ct:events:alerts      — alert.triggered, alert.resolved
  ct:events:payments    — payment.received, payment.failed
  ct:events:tracking    — tracking.event_created

Usage (publish):
    from cargotrack.streams import publish

    publish('shipments', 'status_changed', {
        'shipment_id': str(shipment.pk),
        'old_status': old,
        'new_status': new,
    })

Usage (consume — run via management command):
    python manage.py stream_worker
"""
import json
import logging
import time
import uuid
from typing import Callable

import redis
from decouple import config
from django.conf import settings

logger = logging.getLogger(__name__)

REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')

# Stream naming convention: ct:events:{domain}
STREAM_PREFIX = 'ct:events'
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # seconds — exponential: 2, 4, 8
CLAIM_TIMEOUT = 60_000  # ms — claim messages idle for >60s (recovery from crashed consumers)

# Handler registry: {event_type: handler_fn}
_handlers: dict[str, Callable] = {}


def _get_redis() -> redis.Redis:
    """Return a fresh Redis connection from the pool."""
    return redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _stream_name(domain: str) -> str:
    return f'{STREAM_PREFIX}:{domain}'


# ── Publisher ──────────────────────────────────────────────────────────────────

def publish(domain: str, event_type: str, payload: dict) -> str:
    """
    Publish a domain event to the appropriate Redis Stream.

    Returns the message ID assigned by Redis.
    The publish is fire-and-forget — no synchronous processing happens here.
    """
    data = {
        'event_type': event_type,
        'timestamp': str(time.time()),
        'payload': json.dumps(payload),
    }
    try:
        r = _get_redis()
        msg_id = r.xadd(_stream_name(domain), data, maxlen=100_000)
        logger.debug('Published %s:%s → %s', domain, event_type, msg_id)
        return msg_id
    except redis.RedisError:
        logger.exception('Failed to publish event %s:%s', domain, event_type)
        return ''


# ── Consumer ───────────────────────────────────────────────────────────────────

def register_handler(event_type: str):
    """Decorator: register a function to handle a specific event_type."""
    def decorator(fn: Callable):
        _handlers[event_type] = fn
        return fn
    return decorator


def _process_message(domain: str, msg_id: str, data: dict) -> bool:
    """
    Dispatch a single stream message to its registered handler.
    Returns True on success, False on failure.
    """
    event_type = data.get('event_type', 'unknown')
    handler = _handlers.get(event_type)

    if handler is None:
        logger.warning('No handler registered for event_type=%s', event_type)
        return True  # ACK unknown events — they're not retriable

    try:
        payload = json.loads(data.get('payload', '{}'))
        handler(domain, event_type, payload)
        return True
    except Exception:
        logger.exception(
            'Handler failed for %s:%s (msg %s)', domain, event_type, msg_id,
        )
        return False


def run_consumer(batch_size: int = 10, block_ms: int = 5000):
    """
    Blocking event loop: read from all domain streams and dispatch to handlers.

    Uses Redis consumer groups for at-least-once delivery.  Messages that
    fail after MAX_RETRIES are moved to a dead-letter stream
    (ct:events:{domain}:dead) and acknowledged so they don't block the queue.

    Run this via ``python manage.py stream_worker`` in a separate process.
    """
    r = _get_redis()
    consumer_id = f'worker-{uuid.uuid4().hex[:8]}'
    domains = ['shipments', 'alerts', 'payments', 'tracking']

    # Ensure consumer groups exist for every stream
    for domain in domains:
        stream = _stream_name(domain)
        try:
            r.xgroup_create(stream, 'cargotrack', id='0', mkstream=True)
        except redis.RedisError:
            pass  # Group already exists

    logger.info('Stream worker %s started, listening on %d streams', consumer_id, len(domains))

    while True:
        try:
            # Read from all streams using consumer group
            streams = {_stream_name(d): '>' for d in domains}
            results = r.xreadgroup(
                'cargotrack', consumer_id, streams,
                count=batch_size, block=block_ms,
            )

            # Reclaim orphaned messages (from crashed workers)
            for domain in domains:
                try:
                    claimed = r.xautoclaim(
                        _stream_name(domain), 'cargotrack', consumer_id,
                        min_idle_time=CLAIM_TIMEOUT, count=batch_size,
                    )
                    if claimed and claimed[1]:
                        results.append((_stream_name(domain), claimed[1]))
                except redis.RedisError:
                    pass

            for stream_name, messages in results:
                domain = stream_name.replace(f'{STREAM_PREFIX}:', '')
                for msg_id, data in messages:
                    retries = _get_retry_count(stream_name, msg_id, data)

                    success = _process_message(domain, msg_id, data)

                    if success:
                        r.xack(stream_name, 'cargotrack', msg_id)
                    elif retries >= MAX_RETRIES:
                        # Move to dead-letter stream
                        dlq = f'{stream_name}:dead'
                        r.xadd(dlq, data, maxlen=10_000)
                        r.xack(stream_name, 'cargotrack', msg_id)
                        logger.error(
                            'Moved %s:%s to DLQ after %d retries',
                            domain, msg_id, retries,
                        )
                    else:
                        # Don't ACK — message will be redelivered on next read
                        _set_retry_count(data, retries + 1)
                        sleep_time = RETRY_BACKOFF_BASE ** (retries + 1)
                        logger.warning(
                            'Retry %d/%d for %s:%s in %ds',
                            retries + 1, MAX_RETRIES, domain, msg_id, sleep_time,
                        )
                        time.sleep(sleep_time)

        except redis.RedisError:
            logger.exception('Redis error in consumer loop — retrying in 5s')
            time.sleep(5)
        except KeyboardInterrupt:
            logger.info('Stream worker %s shutting down', consumer_id)
            break


def _get_retry_count(stream_name: str, msg_id: str, data: dict) -> int:
    """Extract retry count from message data (stored in a metadata field)."""
    try:
        meta = json.loads(data.get('_retry_meta', '{}'))
        return meta.get('retries', 0)
    except (json.JSONDecodeError, TypeError):
        return 0


def _set_retry_count(data: dict, count: int):
    """Store retry count in message metadata."""
    data['_retry_meta'] = json.dumps({'retries': count, 'last_attempt': time.time()})


# ── Built-in handlers ──────────────────────────────────────────────────────────

@register_handler('status_changed')
def _on_shipment_status_changed(domain: str, event_type: str, payload: dict):
    """When a shipment status changes, invalidate caches and create notifications."""
    from cargotrack.cache import invalidate_dashboard_caches
    invalidate_dashboard_caches()

    # Create a notification for the shipment owner
    from accounts.models import Notification
    from shipments.models import Shipment

    try:
        shipment = Shipment.objects.only('id', 'client_id', 'tracking_number').get(
            pk=payload.get('shipment_id'),
        )
        Notification.objects.create(
            user_id=shipment.client_id,
            type='SHIPMENT',
            title=f'Shipment {shipment.tracking_number} updated',
            message=f'Status changed to {payload.get("new_status", "UNKNOWN")}.',
            severity='INFO',
            related_url=f'/shipments/{shipment.pk}',
        )
    except Shipment.DoesNotExist:
        pass


@register_handler('alert.triggered')
def _on_alert_triggered(domain: str, event_type: str, payload: dict):
    """When a delay alert triggers, create a high-severity notification."""
    from accounts.models import Notification

    Notification.objects.create(
        user_id=payload.get('user_id'),
        type='ALERT',
        title=payload.get('title', 'Delay Alert'),
        message=payload.get('message', ''),
        severity=payload.get('severity', 'HIGH'),
        related_url=payload.get('url', ''),
    )


@register_handler('payment.received')
def _on_payment_received(domain: str, event_type: str, payload: dict):
    """When a payment is confirmed, update invoice and notify."""
    from cargotrack.cache import invalidate_dashboard_caches
    invalidate_dashboard_caches()

    from accounts.models import Notification
    from payments.models import Invoice, Payment

    try:
        payment = Payment.objects.select_related('invoice__shipment').get(
            pk=payload.get('payment_id'),
        )
        Notification.objects.create(
            user_id=payment.invoice.created_by_id,
            type='PAYMENT',
            title='Payment Received',
            message=f'{payment.amount} {payment.currency} via {payment.provider}',
            severity='INFO',
            related_url=f'/invoices/{payment.invoice_id}',
        )
    except Payment.DoesNotExist:
        pass


@register_handler('tracking.event_created')
def _on_tracking_event_created(domain: str, event_type: str, payload: dict):
    """When a tracking event is logged, invalidate caches for that shipment."""
    from cargotrack.cache import invalidate_dashboard_caches
    invalidate_dashboard_caches()
