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

from .models import Conversation, Message
from .serializers import (
    ConversationCreateSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    MessageSerializer,
)


class ConversationListCreateView(APIView):
    """GET /api/v1/chat/conversations/ — list user's conversations. POST — create new."""
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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


class MarkReadView(APIView):
    """POST /api/v1/chat/conversations/<pk>/mark-read/ — mark conversation as read."""
    permission_classes = [IsAuthenticated]

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


class WebRTCConfigView(APIView):
    """
    GET /api/v1/chat/webrtc-config/

    Returns ICE server configuration (STUN + TURN) for WebRTC clients.
    TURN credentials are time-limited (24h) HMAC-SHA1 tokens generated
    from the shared secret, following the TURN REST API standard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        turn_secret = config('TURN_SECRET', default='')
        turn_realm = config('TURN_REALM', default='cargotrack.local')
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
