"""WebSocket consumers for real-time features."""
import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from cargotrack.ws_auth import WebSocketAuthMixin

logger = logging.getLogger(__name__)


class NotificationConsumer(WebSocketAuthMixin, AsyncJsonWebsocketConsumer):
    """
    Pushes real-time notifications to authenticated WebSocket clients.

    Auth: challenge-response protocol (legacy query-string token also accepted).
    Group: ``notifications_{user_id}`` — one group per user.
    """

    async def connect(self):
        await self.accept()

        user = self.scope.get('user')
        if user is not None and user.is_authenticated:
            # Legacy: already authenticated via query-string token
            self.authenticated = True
            await self._join_group()
            await self.send_json({'type': 'connected', 'detail': 'Notification stream active.'})

    async def on_auth_success(self):
        await self._join_group()

    async def _join_group(self):
        user = self.scope.get('user')
        if user and user.is_authenticated:
            self.group_name = f'notifications_{user.pk}'
            await self.channel_layer.group_add(self.group_name, self.channel_name)

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        msg_type = content.get('type')

        if msg_type == 'auth':
            await self.handle_auth_message(content)
            return

        if not self.require_auth():
            await self.send_auth_required()
            return

        # No other message types supported on this channel

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
