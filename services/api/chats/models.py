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
    is_community = models.BooleanField(default=False)
    is_encrypted = models.BooleanField(default=False)
    subject = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    announcement = models.TextField(blank=True)
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
    class AttachmentType(models.TextChoices):
        IMAGE = 'IMAGE', 'Image'
        AUDIO = 'AUDIO', 'Audio'
        DOCUMENT = 'DOCUMENT', 'Document'
        VIDEO = 'VIDEO', 'Video'

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='messages',
    )
    content = models.TextField(blank=True)
    attachment = models.FileField(upload_to='chat_attachments/%Y/%m/', blank=True)
    attachment_type = models.CharField(max_length=10, choices=AttachmentType.choices, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    attachment_url = models.URLField(blank=True)
    is_read = models.BooleanField(default=False)
    is_system = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    is_encrypted = models.BooleanField(default=False)
    encryption_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender} — {self.content[:50]}'

    @property
    def attachment_url_resolved(self):
        """Returns self.attachment_url or the relative path. Absolute URL is built in serializer."""
        if self.attachment:
            return self.attachment.url
        return self.attachment_url or ''


class SocialPost(models.Model):
    """
    Social feed post — like a tweet/thread post for business logistics.
    """
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='social_posts',
    )
    content = models.TextField()
    attachment_url = models.URLField(blank=True)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, null=True, blank=True,
        related_name='feed_posts',
    )
    is_pinned = models.BooleanField(default=False)
    is_announcement = models.BooleanField(default=False)
    like_count = models.PositiveIntegerField(default=0)
    reply_count = models.PositiveIntegerField(default=0)
    liked_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name='liked_posts', blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return f'{self.author} — {self.content[:60]}'


class SocialComment(models.Model):
    """A reply/comment on a SocialPost."""
    post = models.ForeignKey(
        SocialPost, on_delete=models.CASCADE, related_name='comments',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='social_comments',
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


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
