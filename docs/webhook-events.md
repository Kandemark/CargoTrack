# CargoTrack Webhook Event Catalog

All events delivered as `POST` with `Content-Type: application/json` and an
`X-CargoTrack-Signature: sha256=<HMAC>` header. Payloads follow a common
envelope shape — see [Envelope](#envelope) below.

Webhooks are configured per-tenant via the Integrations API
(`/api/v1/integrations/`). Each registration specifies an endpoint URL, a
shared secret, and an allowlist of event types. The webhook-dispatcher (Go)
handles delivery with exponential backoff (1m → 5m → 15m → 1h → 6h → 24h →
DLQ).

---

## Envelope

Every webhook payload wraps the event in a common envelope:

```json
{
  "event": "<event-type>",
  "event_id": "evt_abc123",
  "tenant_id": "org_xyz",
  "occurred_at": "2026-05-08T10:30:00Z",
  "version": "1.0",
  "data": { }
}
```

---

## Event Types

### 1. `shipment.state_changed`

Fired when a shipment transitions between lifecycle states.

| Field | Type | Description |
|---|---|---|
| `shipment_id` | string | Unique identifier |
| `reference` | string | Customer-facing reference number |
| `from_status` | string | Previous status (e.g. DISPATCHED) |
| `to_status` | string | New status (e.g. DEPARTED) |
| `location` | string | Human-readable location name |
| `coordinates` | object | `{lat, lng}` of the transition |
| `corridor` | string | Route corridor name |
| `driver` | string | Assigned driver name |
| `vehicle_reg` | string | License plate / registration |
| `changed_by` | string | User or system that triggered the change |

```json
{
  "event": "shipment.state_changed",
  "event_id": "evt_shp_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T10:30:00Z",
  "version": "1.0",
  "data": {
    "shipment_id": "SHP-2026-0042",
    "reference": "FF-IMP-042",
    "from_status": "DISPATCHED",
    "to_status": "DEPARTED",
    "location": "Mombasa Port Gate",
    "coordinates": {"lat": -4.0435, "lng": 39.6682},
    "corridor": "Mombasa-Nairobi",
    "driver": "James Mwangi",
    "vehicle_reg": "KCB 450T",
    "changed_by": "driver_app"
  }
}
```

### 2. `shipment.delayed`

Fired when a shipment is flagged as delayed beyond its planned ETA.

| Field | Type | Description |
|---|---|---|
| `shipment_id` | string | Unique identifier |
| `reference` | string | Customer-facing reference number |
| `planned_eta` | string | ISO 8601 of expected arrival |
| `revised_eta` | string | ISO 8601 of revised arrival |
| `delay_hours` | number | Delay in hours |
| `reason` | string | Reason code (BORDER, BREAKDOWN, WEATHER, CUSTOMS, OTHER) |
| `location` | string | Current location at time of alert |

```json
{
  "event": "shipment.delayed",
  "event_id": "evt_dly_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T12:15:00Z",
  "version": "1.0",
  "data": {
    "shipment_id": "SHP-2026-0042",
    "reference": "FF-IMP-042",
    "planned_eta": "2026-05-08T18:00:00Z",
    "revised_eta": "2026-05-09T06:00:00Z",
    "delay_hours": 12,
    "reason": "BORDER",
    "location": "Namanga Border Post"
  }
}
```

### 3. `shipment.delivered`

Fired when a shipment reaches its final destination and POD is captured.

| Field | Type | Description |
|---|---|---|
| `shipment_id` | string | Unique identifier |
| `reference` | string | Customer-facing reference number |
| `delivered_at` | string | ISO 8601 timestamp of delivery |
| `recipient` | string | Name of receiving party |
| `pod_url` | string | URL to proof-of-delivery document |
| `on_time` | boolean | Whether delivery met the SLA window |

```json
{
  "event": "shipment.delivered",
  "event_id": "evt_pod_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T17:45:00Z",
  "version": "1.0",
  "data": {
    "shipment_id": "SHP-2026-0042",
    "reference": "FF-IMP-042",
    "delivered_at": "2026-05-08T17:45:00Z",
    "recipient": "Nairobi Goods Terminal — Receiving Bay 3",
    "pod_url": "https://docs.cargotrack.io/pod/SHP-2026-0042.pdf",
    "on_time": true
  }
}
```

### 4. `gps.position_changed`

Fired when a vehicle moves into a new geofence zone or deviates from its
planned route.

| Field | Type | Description |
|---|---|---|
| `vehicle_id` | string | Vehicle identifier |
| `vehicle_reg` | string | License plate |
| `lat` | number | Latitude |
| `lng` | number | Longitude |
| `speed_kmh` | number | Speed in km/h |
| `heading` | number | Bearing in degrees |
| `event_type` | string | `zone_enter`, `zone_exit`, `deviation`, `stopped` |
| `zone` | string | Geofence zone name (if applicable) |
| `timestamp` | string | ISO 8601 of position fix |

```json
{
  "event": "gps.position_changed",
  "event_id": "evt_gps_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T14:22:00Z",
  "version": "1.0",
  "data": {
    "vehicle_id": "VH-012",
    "vehicle_reg": "KCB 450T",
    "lat": -2.5154,
    "lng": 36.9985,
    "speed_kmh": 62,
    "heading": 315,
    "event_type": "deviation",
    "zone": null,
    "timestamp": "2026-05-08T14:22:00Z"
  }
}
```

### 5. `alert.triggered`

Fired when a monitoring rule fires an alert.

| Field | Type | Description |
|---|---|---|
| `alert_id` | string | Unique alert identifier |
| `rule` | string | Rule name that triggered |
| `severity` | string | INFO, WARNING, CRITICAL |
| `entity_type` | string | shipment, vehicle, driver, payment |
| `entity_id` | string | Associated entity identifier |
| `message` | string | Human-readable alert message |
| `acknowledged` | boolean | Whether an operator has acked it |

```json
{
  "event": "alert.triggered",
  "event_id": "evt_alrt_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T12:15:00Z",
  "version": "1.0",
  "data": {
    "alert_id": "ALT-2026-0183",
    "rule": "border_delay_over_6h",
    "severity": "WARNING",
    "entity_type": "shipment",
    "entity_id": "SHP-2026-0042",
    "message": "Shipment SHP-2026-0042 delayed 12h at Namanga border",
    "acknowledged": false
  }
}
```

### 6. `payment.received`

Fired when a payment is successfully processed (card, mobile money, or bank
transfer).

| Field | Type | Description |
|---|---|---|
| `payment_id` | string | Unique payment identifier |
| `invoice_id` | string | Associated invoice identifier |
| `amount_usd` | number | Amount in USD |
| `amount_local` | number | Amount in local currency |
| `currency_local` | string | Local currency code (KES, TZS, UGX, etc.) |
| `method` | string | card, mobile_money, bank_transfer |
| `provider` | string | Gateway (Stripe, M-Pesa, Flutterwave, etc.) |
| `status` | string | succeeded, failed, pending |

```json
{
  "event": "payment.received",
  "event_id": "evt_pay_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T09:00:00Z",
  "version": "1.0",
  "data": {
    "payment_id": "PAY-2026-0155",
    "invoice_id": "INV-2026-0042",
    "amount_usd": 1850.00,
    "amount_local": 238650.00,
    "currency_local": "KES",
    "method": "mobile_money",
    "provider": "m-pesa",
    "status": "succeeded"
  }
}
```

### 7. `documents.created`

Fired when a document is uploaded to a shipment (BOL, customs form, scale
ticket, invoice, etc.).

| Field | Type | Description |
|---|---|---|
| `document_id` | string | Unique document identifier |
| `shipment_id` | string | Associated shipment |
| `doc_type` | string | BOL, CUSTOMS, SCALE_TICKET, INVOICE, OTHER |
| `filename` | string | Original filename |
| `url` | string | Download URL (S3 pre-signed) |
| `uploaded_by` | string | User or system that uploaded |
| `size_bytes` | number | File size in bytes |

```json
{
  "event": "documents.created",
  "event_id": "evt_doc_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T08:15:00Z",
  "version": "1.0",
  "data": {
    "document_id": "DOC-2026-0102",
    "shipment_id": "SHP-2026-0042",
    "doc_type": "BOL",
    "filename": "bill_of_lading_042.pdf",
    "url": "https://docs.cargotrack.io/documents/DOC-2026-0102.pdf",
    "uploaded_by": "warehouse_clerk",
    "size_bytes": 245760
  }
}
```

### 8. `marketplace.bid_placed`

Fired when a carrier places a bid on a freight listing.

| Field | Type | Description |
|---|---|---|
| `listing_id` | string | Freight listing identifier |
| `bid_id` | string | Bid identifier |
| `carrier_id` | string | Carrier company identifier |
| `carrier_name` | string | Carrier display name |
| `bid_amount_usd` | number | Bid amount in USD |
| `proposed_pickup` | string | ISO 8601 of proposed pickup date |
| `proposed_delivery` | string | ISO 8601 of proposed delivery date |
| `vehicle_type` | string | Proposed vehicle type |

```json
{
  "event": "marketplace.bid_placed",
  "event_id": "evt_bid_001",
  "tenant_id": "org_fastfreight",
  "occurred_at": "2026-05-08T11:00:00Z",
  "version": "1.0",
  "data": {
    "listing_id": "LST-2026-0089",
    "bid_id": "BID-2026-0150",
    "carrier_id": "CAR-003",
    "carrier_name": "Great Lakes Logistics Ltd",
    "bid_amount_usd": 1750.00,
    "proposed_pickup": "2026-05-09T08:00:00Z",
    "proposed_delivery": "2026-05-10T18:00:00Z",
    "vehicle_type": "40ft_flatbed"
  }
}
```

---

## Delivery Guarantees

- **At-least-once delivery** — consumers must deduplicate using `event_id`.
- **Ordering not guaranteed** across event types. Within a single
  `shipment_id` across `shipment.*` events, ordering is preserved.
- **Idempotency**: use `event_id` as the idempotency key.
- **Timeout**: 10-second connection timeout, 30-second response timeout.
- **Signature**: HMAC-SHA256. Verify with `HMAC(secret, body) == signature`.
  Secret is set per webhook registration via the Integrations API.

## Local Testing

Use the built-in webhook inspector:

```
python manage.py webhook_inspector --port 9999
```

Then register a webhook endpoint pointing to `http://localhost:9999/webhook`
in the Integrations API. All received payloads are displayed in the console
and written to `webhook_inspector.log`.

To replay received payloads to a real endpoint:

```
python manage.py webhook_inspector --port 9999 --replay https://your-app.example.com/webhooks/cargotrack
```

## Retry Schedule

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 15 minutes |
| 5 | 1 hour |
| 6 | 6 hours |
| 7+ | 24 hours → Dead Letter Queue |
