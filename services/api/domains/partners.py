"""
Domain: Partners
────────────────
Carrier company management and freight marketplace — carrier profiles,
rate cards (pricing side is in ``domains.contracts``), service-level
agreements, marketplace job postings, and carrier bidding.

Aggregate Roots
~~~~~~~~~~~~~~~
**Carrier** (``carriers.models.Carrier``)
    A logistics company that transports freight.  Owns trucks, drivers,
    and rate cards.

    Invariants:
    - ``name`` is unique.
    - A carrier MUST have at least one contact person (User with carrier_admin role).
    - Rate cards belong to exactly one carrier.

Owns
~~~~
- ``carriers``            Django app — Carrier model, carrier API
- ``marketplace``         Django app — Freight marketplace, job board, bids

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment model (carrier FK, marketplace FK)
- ``domains.identity``    User model (carrier contact FK)
- ``domains.contracts``   Rate cards belong to carriers
"""

# Partners currently expose their API through their own api_urls routers.
# Domain services should be added here as they are extracted from views.

__all__: list[str] = []
