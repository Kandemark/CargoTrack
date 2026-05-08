"""
Domain: Communications
──────────────────────
Real-time messaging and collaboration — in-app chat, video calls, and
WebSocket-based presence tracking.  (SMS, USSD, email, and push notifications
are handled by the ``services/notification`` Go service, not this domain.)

Aggregate Roots
~~~~~~~~~~~~~~~
**ChatRoom** (``chats.models.ChatRoom``)
    A messaging room scoped to a shipment or general topic.

    Invariants:
    - A chat room has at least 2 participants.
    - Shipment-scoped rooms are archived when the shipment is CLOSED.

Owns
~~~~
- ``chats``               Django app — ChatRoom, Message, video call models

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment FK (chat rooms scoped to shipments)
- ``domains.identity``    User FK (chat participants)
"""

# Communications currently expose their API through chats/api_urls.
# Domain services should be added here as they are extracted from views.

__all__: list[str] = []
