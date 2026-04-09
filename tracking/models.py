"""
tracking/models.py
Tracking event model for CargoTrack.

OOP Concepts:
    - Inheritance:   TrackingEvent fulfils the ShipmentEvent ABC contract
                     (get_event_type, get_timestamp, to_dict).
    - Encapsulation: event location data and serialisation logic in one class.
    - Association:   linked to Shipment and to the user who recorded the event.
"""
from datetime import datetime

from django.conf import settings
from django.db import models
from django.utils import timezone


class TrackingEvent(models.Model):
    """
    A concrete location/status update logged for a shipment during transit.

    Implements the ShipmentEvent ABC interface (conceptually) by providing
    get_event_type(), get_timestamp(), and to_dict() methods, making it
    interchangeable with any other ShipmentEvent implementation.
    """

    EVENT_TYPES = [
        ('DEPARTURE',     'Departure'),
        ('CHECKPOINT',    'Checkpoint'),
        ('CUSTOMS_ENTRY', 'Customs Entry'),
        ('CUSTOMS_CLEAR', 'Customs Clear'),
        ('ARRIVAL',       'Arrival'),
        ('DELAY',         'Delay Reported'),
        ('NOTE',          'Note'),
    ]

    shipment    = models.ForeignKey(
        'shipments.Shipment',
        on_delete=models.CASCADE,
        related_name='events',
    )
    event_type  = models.CharField(max_length=20, choices=EVENT_TYPES)
    location    = models.CharField(max_length=150)
    notes       = models.TextField(blank=True)
    timestamp   = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )

    # ── ShipmentEvent ABC interface ───────────────────────────────────────────

    def get_event_type(self) -> str:
        """
        Return the event type code for this tracking update.

        Fulfils the ShipmentEvent.get_event_type() abstract contract.

        Returns:
            str: One of the EVENT_TYPES codes, e.g. 'DEPARTURE'.
        """
        return self.event_type

    def get_timestamp(self) -> datetime:
        """
        Return the datetime at which this event was recorded.

        Fulfils the ShipmentEvent.get_timestamp() abstract contract.

        Returns:
            datetime: The timezone-aware timestamp of the event.
        """
        return self.timestamp

    def to_dict(self) -> dict:
        """
        Serialise all event fields to a plain Python dictionary.

        Fulfils the ShipmentEvent.to_dict() abstract contract.
        The timestamp is converted to an ISO-8601 string so the result
        is immediately JSON-serialisable.

        Returns:
            dict: Mapping of field names to their values.
        """
        return {
            'id':          self.pk,
            'shipment_id': self.shipment_id,
            'event_type':  self.event_type,
            'location':    self.location,
            'notes':       self.notes,
            'timestamp':   self.timestamp.isoformat(),
            'recorded_by': self.recorded_by_id,
        }

    def __str__(self) -> str:
        return f"{self.event_type} @ {self.location} ({self.timestamp})"

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["shipment", "timestamp"]),
            models.Index(fields=["event_type"]),
        ]
