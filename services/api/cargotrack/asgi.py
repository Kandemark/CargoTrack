"""ASGI config — Daphne entry point with HTTP and WebSocket routing."""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cargotrack.settings')

django_asgi_app = get_asgi_application()

# Silence Daphne protocol-level DEBUG noise. Django's LOGGING config runs
# via dictConfig during setup(), but Daphne's CLI later calls basicConfig()
# and the http_protocol module emits per-request DEBUG logs that flood the
# console.  Force them to WARNING after all imports have settled.
import logging
for _name in ('daphne', 'daphne.http_protocol', 'daphne.server',
              'daphne.websocket_protocol', 'daphne.ws_protocol'):
    _lg = logging.getLogger(_name)
    _lg.setLevel(logging.WARNING)
    _lg.propagate = False
logging.getLogger('daphne.access').setLevel(logging.INFO)

from channels.routing import ProtocolTypeRouter, URLRouter
from .routing import websocket_urlpatterns
from .middleware import WebSocketAuthMiddleware

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': WebSocketAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
