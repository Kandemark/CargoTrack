"""chats/consumers.py — ChatConsumer and VideoSignalingConsumer for real-time messaging."""
import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from cargotrack.ws_auth import WebSocketAuthMixin
from .models import Conversation, Message, VideoCall

logger = logging.getLogger(__name__)


class ChatConsumer(WebSocketAuthMixin, AsyncJsonWebsocketConsumer):
    """
    Real-time chat consumer.

    Auth: challenge-response protocol (legacy query-string token also accepted).
    Route: ws/chat/<conversation_id>/
    Group: chat_<conversation_id>
    """

    async def connect(self):
        await self.accept()
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']

        user = self.scope.get('user')
        if user is not None and user.is_authenticated:
            is_participant = await self._is_participant(user, self.conversation_id)
            if not is_participant:
                await self.close(code=4003)
                return
            self.authenticated = True
            await self._join_group()
            await self.send_json({
                'type': 'connected',
                'conversation_id': int(self.conversation_id),
            })

    async def on_auth_success(self):
        user = self.scope.get('user')
        is_participant = await self._is_participant(user, self.conversation_id)
        if not is_participant:
            await self.send_json({'type': 'error', 'detail': 'Not a participant.'})
            await self.close(code=4003)
            return
        await self._join_group()
        await self.send_json({
            'type': 'connected',
            'conversation_id': int(self.conversation_id),
        })

    async def _join_group(self):
        self.group_name = f'chat_{self.conversation_id}'
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

        user = self.scope.get('user')
        if not user:
            return

        if msg_type == 'message':
            text = content.get('content', '').strip()
            if not text:
                return
            message = await self._save_message(user, text)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'chat_message',
                    'payload': {
                        'id': message.id,
                        'conversation_id': int(self.conversation_id),
                        'sender_id': user.id,
                        'sender_name': user.get_full_name() or user.username,
                        'sender_role': user.role,
                        'content': message.content,
                        'created_at': message.created_at.isoformat(),
                        'is_read': False,
                    },
                },
            )

        elif msg_type == 'typing':
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'typing_indicator',
                    'payload': {
                        'conversation_id': int(self.conversation_id),
                        'user_id': user.id,
                        'user_name': user.get_full_name() or user.username,
                    },
                },
            )

        elif msg_type == 'read':
            await self._mark_read(user)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'read_receipt',
                    'payload': {
                        'conversation_id': int(self.conversation_id),
                        'reader_id': user.id,
                    },
                },
            )

    # Event handlers (called by channel layer group_send)

    async def chat_message(self, event):
        await self.send_json({'type': 'message', 'payload': event['payload']})

    async def typing_indicator(self, event):
        user = self.scope.get('user')
        if user and event['payload']['user_id'] != user.id:
            await self.send_json({'type': 'typing', 'payload': event['payload']})

    async def read_receipt(self, event):
        await self.send_json({'type': 'read', 'payload': event['payload']})

    # Database helpers

    @database_sync_to_async
    def _is_participant(self, user, conversation_id):
        return Conversation.objects.filter(
            id=conversation_id, participants=user,
        ).exists()

    @database_sync_to_async
    def _save_message(self, user, text):
        conversation = Conversation.objects.get(id=self.conversation_id)
        msg = Message.objects.create(
            conversation=conversation,
            sender=user,
            content=text,
        )
        conversation.save()
        return msg

    @database_sync_to_async
    def _mark_read(self, user):
        Message.objects.filter(
            conversation_id=self.conversation_id,
            is_read=False,
        ).exclude(sender=user).update(is_read=True)


class VideoSignalingConsumer(WebSocketAuthMixin, AsyncJsonWebsocketConsumer):
    """
    WebRTC video call signaling consumer.

    Auth: challenge-response protocol (legacy query-string token also accepted).
    Route: ws/video/<conversation_id>/
    Group: video_<conversation_id>
    """

    async def connect(self):
        await self.accept()
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']

        user = self.scope.get('user')
        if user is not None and user.is_authenticated:
            self.user_id = user.id
            self.user_name = user.get_full_name() or user.username
            is_participant = await self._is_participant(user, self.conversation_id)
            if not is_participant:
                await self.close(code=4003)
                return
            self.authenticated = True
            await self._join_group()

    async def on_auth_success(self):
        user = self.scope.get('user')
        self.user_id = user.id
        self.user_name = user.get_full_name() or user.username
        is_participant = await self._is_participant(user, self.conversation_id)
        if not is_participant:
            await self.send_json({'type': 'error', 'detail': 'Not a participant.'})
            await self.close(code=4003)
            return
        await self._join_group()

    async def _join_group(self):
        self.group_name = f'video_{self.conversation_id}'
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

        user = self.scope.get('user')
        if not user:
            return

        if msg_type == 'call':
            # Initiate a call — notify other participants
            callee_id = content.get('callee_id')
            call = await self._create_call(user, callee_id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'incoming_call',
                    'payload': {
                        'call_id': call.id,
                        'caller_id': user.id,
                        'caller_name': self.user_name,
                        'conversation_id': int(self.conversation_id),
                    },
                },
            )

        elif msg_type == 'accept':
            call_id = content.get('call_id')
            await self._update_call_status(call_id, 'ACTIVE')
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'call_accepted',
                    'payload': {
                        'call_id': call_id,
                        'conversation_id': int(self.conversation_id),
                        'accepted_by': user.id,
                    },
                },
            )

        elif msg_type == 'signal':
            # Forward SDP offer/answer or ICE candidate
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'signal',
                    'payload': {
                        'from_id': user.id,
                        'from_name': self.user_name,
                        'conversation_id': int(self.conversation_id),
                        'sdp': content.get('sdp'),
                        'candidate': content.get('candidate'),
                    },
                },
            )

        elif msg_type == 'end':
            call_id = content.get('call_id')
            if call_id:
                await self._update_call_status(call_id, 'ENDED')
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'call_ended',
                    'payload': {
                        'call_id': call_id,
                        'by_id': user.id,
                        'conversation_id': int(self.conversation_id),
                    },
                },
            )

        elif msg_type == 'missed':
            call_id = content.get('call_id')
            if call_id:
                await self._update_call_status(call_id, 'MISSED')
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'call_missed',
                    'payload': {
                        'call_id': call_id,
                        'conversation_id': int(self.conversation_id),
                    },
                },
            )

    # Event handlers (called by channel layer group_send)

    async def incoming_call(self, event):
        # Only forward to participants who are NOT the caller
        if event['payload']['caller_id'] != self.user_id:
            await self.send_json({'type': 'incoming_call', 'payload': event['payload']})

    async def call_accepted(self, event):
        if event['payload']['accepted_by'] != self.user_id:
            await self.send_json({'type': 'call_accepted', 'payload': event['payload']})

    async def signal(self, event):
        if event['payload']['from_id'] != self.user_id:
            await self.send_json({'type': 'signal', 'payload': event['payload']})

    async def call_ended(self, event):
        if event['payload']['by_id'] != self.user_id:
            await self.send_json({'type': 'call_ended', 'payload': event['payload']})
        else:
            await self.send_json({'type': 'call_ended', 'payload': event['payload']})

    async def call_missed(self, event):
        await self.send_json({'type': 'call_missed', 'payload': event['payload']})

    # Database helpers

    @database_sync_to_async
    def _is_participant(self, user, conversation_id):
        return Conversation.objects.filter(
            id=conversation_id, participants=user,
        ).exists()

    @database_sync_to_async
    def _create_call(self, caller, callee_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        conversation = Conversation.objects.get(id=self.conversation_id)
        callee = User.objects.filter(id=callee_id).first() if callee_id else None
        call = VideoCall.objects.create(
            conversation=conversation,
            caller=caller,
            callee=callee,
            status='RINGING',
        )
        return call

    @database_sync_to_async
    def _update_call_status(self, call_id, status):
        from django.utils import timezone
        try:
            call = VideoCall.objects.get(pk=call_id)
            call.status = status
            if status == 'ACTIVE':
                call.started_at = timezone.now()
            elif status in ('ENDED', 'MISSED'):
                call.ended_at = timezone.now()
            call.save(update_fields=['status', 'started_at', 'ended_at'])
        except VideoCall.DoesNotExist:
            pass
