"""chats/serializers.py — DRF serializers for conversations and messages."""
from rest_framework import serializers
from .models import Conversation, Message, VideoCall


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_id', 'sender_name',
            'sender_role', 'content', 'attachment_url', 'is_read',
            'is_system', 'created_at',
        ]
        read_only_fields = ['id', 'sender', 'sender_id', 'sender_name',
                            'sender_role', 'is_read', 'is_system', 'created_at']


class ConversationListSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    participants_display = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'subject', 'shipment', 'is_group',
            'participants', 'participants_display',
            'last_message', 'unread_count', 'created_at', 'updated_at',
        ]

    def get_last_message(self, obj):
        last = obj.messages.last()
        if last:
            return {
                'id': last.id,
                'content': last.content[:120],
                'sender_name': last.sender.get_full_name() if last.sender else 'System',
                'created_at': last.created_at.isoformat(),
                'is_read': last.is_read,
            }
        return None

    def get_unread_count(self, obj):
        user = self.context['request'].user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()

    def get_participants_display(self, obj):
        user = self.context['request'].user
        names = []
        for p in obj.participants.exclude(id=user.id)[:3]:
            names.append(p.get_full_name() or p.username)
        if obj.participants.count() > 4:
            names.append(f'+{obj.participants.count() - 4}')
        return ', '.join(names) if names else 'No one else'


class ConversationDetailSerializer(ConversationListSerializer):
    messages = serializers.SerializerMethodField()

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ['messages']

    def get_messages(self, obj):
        msgs = obj.messages.select_related('sender')[:50]
        return MessageSerializer(msgs, many=True).data


class ConversationCreateSerializer(serializers.ModelSerializer):
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, min_length=1,
    )

    class Meta:
        model = Conversation
        fields = ['subject', 'shipment', 'is_group', 'participant_ids']

    def validate_participant_ids(self, value):
        from accounts.models import CustomUser
        users = CustomUser.objects.filter(id__in=value, is_active=True)
        if users.count() != len(set(value)):
            raise serializers.ValidationError("One or more participant IDs are invalid.")
        return value

    def create(self, validated_data):
        participant_ids = validated_data.pop('participant_ids')
        user = self.context['request'].user
        conversation = Conversation.objects.create(
            created_by=user, **validated_data,
        )
        all_ids = list(set(participant_ids + [user.id]))
        conversation.participants.set(all_ids)
        Message.objects.create(
            conversation=conversation,
            sender=user,
            content=f'{user.get_full_name() or user.username} started the conversation.',
            is_system=True,
        )
        return conversation


class VideoCallSerializer(serializers.ModelSerializer):
    caller_name = serializers.CharField(source='caller.get_full_name', read_only=True)

    class Meta:
        model = VideoCall
        fields = ['id', 'conversation', 'caller', 'caller_name', 'callee',
                  'status', 'started_at', 'ended_at', 'created_at']
        read_only_fields = ['id', 'caller', 'caller_name', 'started_at', 'created_at']


class StartVideoCallSerializer(serializers.Serializer):
    callee_id = serializers.IntegerField()
