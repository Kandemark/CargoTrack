"""WebSocket consumers for real-time features."""
import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """
    Pushes real-time notifications to authenticated WebSocket clients.

    Auth: JWT token validated by WebSocketAuthMiddleware; scope['user'] is set.
    Group: ``notifications_{user_id}`` — one group per user so notifications
    are delivered only to the intended recipient.
    """

    async def connect(self):
        user = self.scope.get('user')
        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f'notifications_{user.pk}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({'type': 'connected', 'detail': 'Notification stream active.'})

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        pass  # clients don't send messages on this channel

    # ── Event handlers (called by channel layer) ────────────────────────

    async def notification_message(self, event):
        """Forward a notification payload to the WebSocket client."""
        await self.send_json({
            'type': 'notification',
            'payload': event.get('payload', {}),
        })

    async def alert_message(self, event):
        """Forward an alert payload to the WebSocket client."""
        await self.send_json({
            'type': 'alert',
            'payload': event.get('payload', {}),
        })
