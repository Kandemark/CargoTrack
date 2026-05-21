"""chats/api_urls.py — URL patterns for the chats app. Mounted at /api/v1/chat/."""
from django.urls import path
from .api_views import (
    AnnouncementView,
    AttachmentUploadView,
    ConversationListCreateView,
    ConversationDetailView,
    MessageCreateView,
    MessageEditView,
    MarkReadView,
    SocialFeedView,
    SocialPostDetailView,
    SocialPostLikeView,
    SocialCommentView,
    WebRTCConfigView,
)

urlpatterns = [
    path('conversations/', ConversationListCreateView.as_view(), name='v1-conversation-list'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='v1-conversation-detail'),
    path('conversations/<int:pk>/messages/', MessageCreateView.as_view(), name='v1-message-create'),
    path('conversations/<int:pk>/messages/<int:msg_id>/', MessageEditView.as_view(), name='v1-message-edit-delete'),
    path('conversations/<int:pk>/attachments/', AttachmentUploadView.as_view(), name='v1-attachment-upload'),
    path('conversations/<int:pk>/announcement/', AnnouncementView.as_view(), name='v1-announcement'),
    path('conversations/<int:pk>/mark-read/', MarkReadView.as_view(), name='v1-mark-read'),
    path('webrtc-config/', WebRTCConfigView.as_view(), name='v1-webrtc-config'),
    # Social feed
    path('social/feed/', SocialFeedView.as_view(), name='v1-social-feed'),
    path('social/posts/<int:pk>/', SocialPostDetailView.as_view(), name='v1-social-post-detail'),
    path('social/posts/<int:pk>/like/', SocialPostLikeView.as_view(), name='v1-social-post-like'),
    path('social/posts/<int:pk>/comments/', SocialCommentView.as_view(), name='v1-social-post-comment'),
]
