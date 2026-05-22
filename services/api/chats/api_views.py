"""chats/api_views.py — REST API views for conversations and messages."""
import hashlib
import hmac
import time

from decouple import config
from django.db import models as db_models
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from cargotrack.authz import CanSendChat

from .models import Conversation, Message
from .serializers import (
    ConversationCreateSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    MessageSerializer,
    SocialPostSerializer,
    SocialCommentSerializer,
)


class ConversationListCreateView(APIView):
    """GET /api/v1/chat/conversations/ — list user's conversations. POST — create new."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def get(self, request, **kwargs):
        conversations = request.user.conversations.prefetch_related(
            'participants', 'messages',
        ).annotate(
            last_msg_time=db_models.Max('messages__created_at'),
        ).order_by('-last_msg_time')
        serializer = ConversationListSerializer(
            conversations, many=True, context={'request': request},
        )
        return Response(serializer.data)

    def post(self, request, **kwargs):
        serializer = ConversationCreateSerializer(
            data=request.data, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        conversation = serializer.save()
        return Response(
            ConversationDetailSerializer(conversation, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ConversationDetailView(APIView):
    """GET /api/v1/chat/conversations/<pk>/ — full conversation with messages."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def get(self, request, pk, **kwargs):
        try:
            conversation = Conversation.objects.prefetch_related(
                'participants', 'messages__sender',
            ).get(pk=pk, participants=request.user)
        except Conversation.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        # Mark unread messages as read
        Message.objects.filter(
            conversation=conversation, is_read=False,
        ).exclude(sender=request.user).update(is_read=True)

        serializer = ConversationDetailSerializer(
            conversation, context={'request': request},
        )
        return Response(serializer.data)


class MessageCreateView(APIView):
    """POST /api/v1/chat/conversations/<pk>/messages/ — send a message via REST."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def post(self, request, pk, **kwargs):
        try:
            conversation = Conversation.objects.get(pk=pk, participants=request.user)
        except Conversation.DoesNotExist:
            return Response({'detail': 'Conversation not found.'}, status=404)

        serializer = MessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save(
            conversation=conversation, sender=request.user,
        )
        conversation.save()  # update updated_at

        # Push to channel layer
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel = get_channel_layer()
        if channel:
            async_to_sync(channel.group_send)(
                f'chat_{pk}',
                {
                    'type': 'chat_message',
                    'payload': MessageSerializer(message).data,
                },
            )

        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


class MessageEditView(APIView):
    """PATCH /api/v1/chat/conversations/<pk>/messages/<msg_id>/ — edit own message."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def patch(self, request, pk, msg_id, **kwargs):
        try:
            msg = Message.objects.get(id=msg_id, conversation_id=pk, sender=request.user, is_deleted=False)
        except Message.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        from django.utils import timezone
        msg.content = request.data.get('content', '').strip()
        if not msg.content:
            return Response({'detail': 'Content cannot be empty.'}, status=400)
        msg.is_edited = True
        msg.edited_at = timezone.now()
        msg.save(update_fields=['content', 'is_edited', 'edited_at'])

        # Push to channel layer
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel = get_channel_layer()
        if channel:
            async_to_sync(channel.group_send)(
                f'chat_{pk}',
                {
                    'type': 'message_edited',
                    'payload': {
                        'message_id': msg.id,
                        'content': msg.content,
                        'edited_at': msg.edited_at.isoformat(),
                        'editor_id': request.user.id,
                        'editor_name': request.user.get_full_name() or request.user.username,
                    },
                },
            )

        return Response(MessageSerializer(msg).data)


class MessageDeleteView(APIView):
    """DELETE /api/v1/chat/conversations/<pk>/messages/<msg_id>/ — soft-delete own message."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def delete(self, request, pk, msg_id, **kwargs):
        try:
            msg = Message.objects.get(id=msg_id, conversation_id=pk, sender=request.user)
        except Message.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        from django.utils import timezone
        msg.is_deleted = True
        msg.deleted_at = timezone.now()
        msg.save(update_fields=['is_deleted', 'deleted_at'])

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel = get_channel_layer()
        if channel:
            async_to_sync(channel.group_send)(
                f'chat_{pk}',
                {
                    'type': 'message_deleted',
                    'payload': {
                        'message_id': msg.id,
                        'deleted_by': request.user.id,
                        'deleted_at': msg.deleted_at.isoformat(),
                    },
                },
            )

        return Response({'detail': 'Message deleted.'})


class AnnouncementView(APIView):
    """POST /api/v1/chat/conversations/<pk>/announcement/ — set community announcement."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def post(self, request, pk, **kwargs):
        try:
            conv = Conversation.objects.get(pk=pk, participants=request.user, is_community=True)
        except Conversation.DoesNotExist:
            return Response({'detail': 'Not found or not a community.'}, status=404)

        conv.announcement = request.data.get('content', '').strip()
        conv.save(update_fields=['announcement', 'updated_at'])

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel = get_channel_layer()
        if channel:
            async_to_sync(channel.group_send)(
                f'chat_{pk}',
                {
                    'type': 'announcement_updated',
                    'payload': {
                        'conversation_id': int(pk),
                        'content': conv.announcement,
                        'set_by': request.user.id,
                        'set_by_name': request.user.get_full_name() or request.user.username,
                    },
                },
            )

        return Response({'content': conv.announcement})


class AttachmentUploadView(APIView):
    """POST /api/v1/chat/conversations/<pk>/attachments/ — upload a file attachment."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def post(self, request, pk, **kwargs):
        try:
            conversation = Conversation.objects.get(pk=pk, participants=request.user)
        except Conversation.DoesNotExist:
            return Response({'detail': 'Conversation not found.'}, status=404)

        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=400)

        content_type = file.content_type or ''
        if content_type.startswith('image/'):
            attachment_type = 'IMAGE'
        elif content_type.startswith('audio/'):
            attachment_type = 'AUDIO'
        elif content_type.startswith('video/'):
            attachment_type = 'VIDEO'
        else:
            attachment_type = 'DOCUMENT'

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=request.data.get('content', '').strip(),
            attachment=file,
            attachment_type=attachment_type,
            file_size=file.size,
        )
        conversation.save()

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel = get_channel_layer()
        if channel:
            async_to_sync(channel.group_send)(
                f'chat_{pk}',
                {
                    'type': 'chat_message',
                    'payload': MessageSerializer(message, context={'request': request}).data,
                },
            )

        return Response(MessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)


class MarkReadView(APIView):
    """POST /api/v1/chat/conversations/<pk>/mark-read/ — mark conversation as read."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def post(self, request, pk, **kwargs):
        updated = Message.objects.filter(
            conversation_id=pk, is_read=False,
        ).exclude(sender=request.user).update(is_read=True)

        if updated:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel = get_channel_layer()
            if channel:
                async_to_sync(channel.group_send)(
                    f'chat_{pk}',
                    {
                        'type': 'read_receipt',
                        'payload': {
                            'conversation_id': int(pk),
                            'reader_id': request.user.id,
                        },
                    },
                )

        return Response({'marked_read': updated})


# ── Social Feed ──────────────────────────────────────────────────────────────

class SocialFeedView(APIView):
    """GET /api/v1/social/feed/ — list posts; POST — create a post."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def get(self, request, **kwargs):
        from .models import SocialPost
        from domains._authz import get_user_role
        posts = SocialPost.objects.select_related('author', 'author__organization')\
            .prefetch_related('liked_by', 'comments')
        if get_user_role(request.user) != 'PLATFORM_OWNER':
            org_id = getattr(request.user, 'organization_id', None)
            if org_id:
                posts = posts.filter(author__organization_id=org_id)
        posts = posts[:50]
        serializer = SocialPostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, **kwargs):
        from .models import SocialPost
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'detail': 'Content is required.'}, status=400)
        post = SocialPost.objects.create(
            author=request.user,
            content=content,
            conversation_id=request.data.get('conversation_id'),
            is_announcement=request.data.get('is_announcement', False),
        )
        serializer = SocialPostSerializer(post, context={'request': request})
        return Response(serializer.data, status=201)


class SocialPostDetailView(APIView):
    """GET /api/v1/social/posts/<pk>/ — get post detail; DELETE — delete own post."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def get(self, request, pk, **kwargs):
        from .models import SocialPost
        from domains._authz import get_user_role
        try:
            posts_qs = SocialPost.objects.select_related('author', 'author__organization')\
                .prefetch_related('liked_by', 'comments', 'comments__author')
            if get_user_role(request.user) != 'PLATFORM_OWNER':
                org_id = getattr(request.user, 'organization_id', None)
                if org_id:
                    posts_qs = posts_qs.filter(author__organization_id=org_id)
            post = posts_qs.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        serializer = SocialPostSerializer(post, context={'request': request})
        data = serializer.data
        data['comments'] = SocialCommentSerializer(post.comments.all(), many=True).data
        return Response(data)

    def delete(self, request, pk, **kwargs):
        from .models import SocialPost
        try:
            post = SocialPost.objects.get(pk=pk, author=request.user)
        except SocialPost.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        post.delete()
        return Response({'detail': 'Post deleted.'})


class SocialPostLikeView(APIView):
    """POST /api/v1/social/posts/<pk>/like/ — toggle like."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def post(self, request, pk, **kwargs):
        from .models import SocialPost
        from domains._authz import get_user_role
        try:
            posts_qs = SocialPost.objects.all()
            if get_user_role(request.user) != 'PLATFORM_OWNER':
                org_id = getattr(request.user, 'organization_id', None)
                if org_id:
                    posts_qs = posts_qs.filter(author__organization_id=org_id)
            post = posts_qs.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        if post.liked_by.filter(id=request.user.id).exists():
            post.liked_by.remove(request.user)
            post.like_count = max(0, post.like_count - 1)
            post.save(update_fields=['like_count'])
            return Response({'liked': False, 'like_count': post.like_count})
        else:
            post.liked_by.add(request.user)
            post.like_count += 1
            post.save(update_fields=['like_count'])
            return Response({'liked': True, 'like_count': post.like_count})


class SocialCommentView(APIView):
    """POST /api/v1/social/posts/<pk>/comments/ — add a comment."""
    permission_classes = [IsAuthenticated, CanSendChat]

    def post(self, request, pk, **kwargs):
        from .models import SocialPost, SocialComment
        from domains._authz import get_user_role
        try:
            posts_qs = SocialPost.objects.all()
            if get_user_role(request.user) != 'PLATFORM_OWNER':
                org_id = getattr(request.user, 'organization_id', None)
                if org_id:
                    posts_qs = posts_qs.filter(author__organization_id=org_id)
            post = posts_qs.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'detail': 'Content is required.'}, status=400)
        comment = SocialComment.objects.create(post=post, author=request.user, content=content)
        post.reply_count = post.comments.count()
        post.save(update_fields=['reply_count'])
        return Response(SocialCommentSerializer(comment).data, status=201)


class WebRTCConfigView(APIView):
    """
    GET /api/v1/chat/webrtc-config/

    Returns ICE server configuration (STUN + TURN) for WebRTC clients.
    TURN credentials are time-limited (24h) HMAC-SHA1 tokens generated
    from the shared secret, following the TURN REST API standard.
    """
    permission_classes = [IsAuthenticated, CanSendChat]

    def get(self, request, **kwargs):
        turn_secret = config('TURN_SECRET', default='')
        turn_host = config('TURN_HOST', default='localhost')
        turn_port = config('TURN_PORT', default='3478')

        ice_servers = [
            {
                'urls': [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                ],
            },
        ]

        if turn_secret:
            # Generate time-limited credentials (valid for 24 hours)
            timestamp = int(time.time()) + 86400
            username = str(timestamp)

            # HMAC-SHA1 of the timestamped username
            mac = hmac.new(
                turn_secret.encode(),
                username.encode(),
                hashlib.sha1,
            )
            credential = mac.hexdigest()

            turn_url = f'turn:{turn_host}:{turn_port}'
            ice_servers.append({
                'urls': [turn_url],
                'username': username,
                'credential': credential,
                'credentialType': 'password',
            })

        return Response({
            'iceServers': ice_servers,
            'iceTransportPolicy': 'all',
            'bundlePolicy': 'max-bundle',
            'rtcpMuxPolicy': 'require',
        })
