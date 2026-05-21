"""
workflows/models.py — WorkflowRule model for the rule engine.

Each rule pairs a trigger (e.g. status change, geofence entry) with an
action (e.g. send notification, update status, call webhook).
"""
from django.db import models


class WorkflowRule(models.Model):
    """An automated workflow rule with trigger → action pairing."""

    TRIGGER_CHOICES = [
        ('STATUS_CHANGE',   'Status Change'),
        ('GEOFENCE_ENTER',  'Geofence Enter'),
        ('GEOFENCE_EXIT',   'Geofence Exit'),
        ('TEMPERATURE',     'Temperature Alert'),
        ('DOCUMENT_UPLOAD', 'Document Upload'),
        ('TIME_SCHEDULE',   'Scheduled'),
        ('DELAY_DETECTED',  'Delay Detected'),
    ]

    ACTION_CHOICES = [
        ('NOTIFY_USER',   'Notify User'),
        ('NOTIFY_ROLE',   'Notify Role'),
        ('UPDATE_STATUS', 'Update Status'),
        ('CREATE_TASK',   'Create Task'),
        ('WEBHOOK',       'Call Webhook'),
    ]

    SEVERITY_CHOICES = [
        ('LOW',    'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH',   'High'),
    ]

    name            = models.CharField(max_length=200)
    trigger_type    = models.CharField(max_length=30, choices=TRIGGER_CHOICES)
    trigger_config  = models.JSONField(default=dict, blank=True)
    action_type     = models.CharField(max_length=30, choices=ACTION_CHOICES)
    action_config   = models.JSONField(default=dict, blank=True)
    severity        = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM')
    is_active       = models.BooleanField(default=True)
    execution_count = models.PositiveIntegerField(default=0)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{'ON' if self.is_active else 'OFF'}] {self.name} ({self.trigger_type} → {self.action_type})"

    class Meta:
        ordering = ['-created_at']
