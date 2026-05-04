"""chats/api_urls.py — URL patterns for the chats app. Mounted at /api/v1/chat/."""
from django.urls import path
from .api_views import (
    ConversationListCreateView,
    ConversationDetailView,
    MessageCreateView,
    MarkReadView,
)

urlpatterns = [
    path('conversations/', ConversationListCreateView.as_view(), name='v1-conversation-list'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='v1-conversation-detail'),
    path('conversations/<int:pk>/messages/', MessageCreateView.as_view(), name='v1-message-create'),
    path('conversations/<int:pk>/mark-read/', MarkReadView.as_view(), name='v1-mark-read'),
]
