"""chats/models.py — Conversation and Message models for real-time messaging."""
from django.conf import settings
from django.db import models


class Conversation(models.Model):
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name='conversations',
    )
    shipment = models.ForeignKey(
        'shipments.Shipment', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='conversations',
    )
    is_group = models.BooleanField(default=False)
    subject = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_conversations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.subject or f'Conversation {self.pk}'


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='messages',
    )
    content = models.TextField()
    attachment_url = models.URLField(blank=True)
    is_read = models.BooleanField(default=False)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender} — {self.content[:50]}'


class VideoCall(models.Model):
    """Tracks WebRTC video call state for 1:1 calling."""
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='video_calls',
    )
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='video_calls_initiated',
    )
    callee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        null=True, blank=True, related_name='video_calls_received',
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('RINGING', 'Ringing'),
            ('ACTIVE', 'Active'),
            ('MISSED', 'Missed'),
            ('ENDED', 'Ended'),
        ],
        default='RINGING',
    )
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
