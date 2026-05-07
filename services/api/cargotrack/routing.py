"""WebSocket URL routing — maps ws:// connections to consumers."""
from django.urls import path
from .consumers import NotificationConsumer
from chats.consumers import ChatConsumer, VideoSignalingConsumer

websocket_urlpatterns = [
    path('ws/notifications/', NotificationConsumer.as_asgi()),
    path('ws/chat/<int:conversation_id>/', ChatConsumer.as_asgi()),
    path('ws/video/<int:conversation_id>/', VideoSignalingConsumer.as_asgi()),
]
