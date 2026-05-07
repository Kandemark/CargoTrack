"""
cargotrack/ws_auth.py — Challenge-response WebSocket authentication.

Replaces the insecure query-string token pattern (?token=...) with a
challenge-response protocol:

  1. Client connects to WebSocket without credentials.
  2. Server accepts but keeps the client in "unauthenticated" state,
     rejecting any non-auth messages with an error.
  3. Client sends:  {"type": "auth", "token": "<JWT access token>"}
  4. Server validates, sets scope['user'], and joins authenticated groups.
  5. If the access token expires mid-session, client can send another
     auth message with a fresh token from the refresh endpoint.

Backwards-compatible: query-string tokens are still accepted for mobile
clients that can't easily implement the challenge-response handshake.
"""
import logging

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


@database_sync_to_async
def validate_token(token_str: str):
    """Validate a JWT access token and return (user, payload) or (AnonymousUser, None)."""
    try:
        token = AccessToken(token_str)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(id=token['user_id'])
        return user, token.payload
    except (InvalidToken, TokenError, KeyError, User.DoesNotExist, Exception):
        return AnonymousUser(), None


class WebSocketAuthMixin:
    """
    Mixin for AsyncJsonWebsocketConsumer that adds challenge-response auth.

    Subclasses must:
      - Call ``await self.accept()`` first in connect()
      - Implement ``on_auth_success()`` to join groups after auth
      - Call ``self.require_auth()`` at the top of receive_json()

    Messages received before authentication receive an error response.
    """

    authenticated: bool = False

    async def handle_auth_message(self, content: dict) -> bool:
        """
        Process an auth message. Returns True if authentication succeeded.

        Expected message format:
            {"type": "auth", "token": "<JWT access token>"}
        """
        token = content.get('token', '')
        if not token:
            await self.send_json({
                'type': 'auth_error',
                'detail': 'Token is required.',
            })
            return False

        user, payload = await validate_token(token)
        if user is None or not user.is_authenticated:
            await self.send_json({
                'type': 'auth_error',
                'detail': 'Invalid or expired token.',
            })
            return False

        self.scope['user'] = user
        self.scope['token_payload'] = payload
        self.authenticated = True

        await self.on_auth_success()
        await self.send_json({
            'type': 'auth_success',
            'user_id': user.pk,
            'username': user.username,
        })
        logger.info('WebSocket auth success: user %s', user.pk)
        return True

    async def on_auth_success(self):
        """Override in subclasses — called after successful authentication."""
        pass

    def require_auth(self) -> bool:
        """
        Check that the client is authenticated.  Call at the top of
        receive_json(). Returns True if authenticated, False if an
        error was already sent.
        """
        if not self.authenticated:
            return False
        return True

    async def send_auth_required(self):
        """Send error indicating authentication is required first."""
        await self.send_json({
            'type': 'error',
            'detail': 'Authentication required. Send {"type": "auth", "token": "..."} first.',
            'code': 'AUTH_REQUIRED',
        })
