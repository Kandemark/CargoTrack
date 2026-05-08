"""coldchain/consumers.py — WebSocket consumer for live temperature monitoring dashboard."""
import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebSocketConsumer
from django.core.exceptions import ObjectDoesNotExist


class ColdChainMonitorConsumer(AsyncWebSocketConsumer):
    """
    WebSocket consumer for real-time temperature monitoring.

    Clients connect to: ws://host/ws/coldchain/<shipment_id>/

    On connect, the client starts receiving live temperature readings
    as they're ingested. The server pushes:
      - New temperature readings (every 30 seconds typical)
      - Excursion alerts (when temp goes out of range)
      - Device status (battery, signal strength)

    Groups:
      coldchain_{shipment_id}  — per-shipment feed
      coldchain_all            — fleet-wide dashboard feed
    """

    async def connect(self):
        self.shipment_id = self.scope['url_route']['kwargs'].get('shipment_id', 'all')
        self.group_name = f'coldchain_{self.shipment_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current state on connect
        if self.shipment_id != 'all':
            snapshot = await self._get_shipment_snapshot(self.shipment_id)
            if snapshot:
                await self.send(text_data=json.dumps({
                    'type': 'snapshot',
                    'data': snapshot,
                }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle messages from client (subscribe/unsubscribe to specific shipments)."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        action = data.get('action')
        if action == 'subscribe':
            target = data.get('shipment_id')
            if target:
                await self.channel_layer.group_add(f'coldchain_{target}', self.channel_name)
        elif action == 'unsubscribe':
            target = data.get('shipment_id')
            if target:
                await self.channel_layer.group_discard(f'coldchain_{target}', self.channel_name)

    # ── Event handlers (called by channel layer) ──────────────────────────

    async def temperature_reading(self, event):
        """A new temperature reading is available."""
        await self.send(text_data=json.dumps({
            'type': 'reading',
            'data': event['data'],
        }))

    async def excursion_alert(self, event):
        """An excursion has been detected or escalated."""
        await self.send(text_data=json.dumps({
            'type': 'excursion',
            'data': event['data'],
        }))

    async def device_status(self, event):
        """Device battery or signal status update."""
        await self.send(text_data=json.dumps({
            'type': 'device_status',
            'data': event['data'],
        }))

    async def excursion_resolved(self, event):
        """An excursion has been resolved."""
        await self.send(text_data=json.dumps({
            'type': 'excursion_resolved',
            'data': event['data'],
        }))

    # ── DB helpers ────────────────────────────────────────────────────────

    @sync_to_async
    def _get_shipment_snapshot(self, shipment_id):
        from coldchain.models import ColdChainShipment, TemperatureExcursion
        try:
            cc = ColdChainShipment.objects.select_related('shipment').get(
                shipment__tracking_number=shipment_id,
            )
        except ObjectDoesNotExist:
            return None

        latest = cc.readings.order_by('-timestamp').first()
        active_excursion = cc.excursions.filter(resolved_at__isnull=True).first()

        return {
            'tracking_number': cc.shipment.tracking_number,
            'product_type': cc.get_product_type_display(),
            'temp_range': f'{cc.temp_min_c}–{cc.temp_max_c}°C',
            'tolerance_minutes': cc.tolerance_minutes,
            'latest_reading': {
                'temperature_c': latest.temperature_c,
                'humidity_pct': latest.humidity_pct,
                'battery_level': latest.battery_level,
                'timestamp': latest.timestamp.isoformat(),
                'location': {
                    'lat': latest.location_lat,
                    'lng': latest.location_lng,
                },
            } if latest else None,
            'active_excursion': {
                'severity': active_excursion.severity,
                'started_at': active_excursion.started_at.isoformat(),
                'peak_temp_c': active_excursion.peak_temp_c,
                'min_temp_c': active_excursion.min_temp_c,
                'temp_limit_breached': active_excursion.temp_limit_breached,
            } if active_excursion else None,
        }
