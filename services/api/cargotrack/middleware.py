"""ASGI middleware — JWT authentication for WebSocket connections."""
import logging
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_str: str):
    """Validate JWT access token and return the user, or AnonymousUser."""
    try:
        token = AccessToken(token_str)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        return User.objects.get(id=token['user_id'])
    except (InvalidToken, TokenError, KeyError, Exception):
        return AnonymousUser()


class WebSocketAuthMiddleware(BaseMiddleware):
    """
    Extracts JWT token from WebSocket query string and populates scope['user'].

    Clients connect with:  ws://host/ws/notifications/?token=<jwt-access-token>
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            scope['user'] = await get_user_from_token(token_list[0])
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
