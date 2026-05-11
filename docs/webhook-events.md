# CargoTrack Webhook Event Catalog

All events delivered as `POST` with `Content-Type: application/json` and `X-CargoTrack-Signature: sha256=<HMAC>` header.

---

## Common Envelope

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

**Data fields**: `shipment_id`, `reference`, `from_status`, `to_status`, `location`, `coordinates` ({lat, lng}), `corridor`, `driver`, `vehicle_reg`, `changed_by`

```json
{
  "event": "shipment.state_changed",
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

**Data fields**: `shipment_id`, `reference`, `planned_eta`, `revised_eta`, `delay_hours`, `reason` (BORDER, BREAKDOWN, WEATHER, CUSTOMS, OTHER), `location`

### 3. `shipment.delivered`
Fired when a shipment reaches its final destination and POD is captured.

**Data fields**: `shipment_id`, `reference`, `delivered_at`, `recipient`, `pod_url`, `on_time`

### 4. `gps.position_changed`
Fired when a vehicle moves into a new geofence zone or deviates from its planned route.

**Data fields**: `vehicle_id`, `vehicle_reg`, `lat`, `lng`, `speed_kmh`, `heading`, `event_type` (zone_enter, zone_exit, deviation, stopped), `zone`, `timestamp`

### 5. `alert.triggered`
Fired when a monitoring rule fires an alert.

**Data fields**: `alert_id`, `rule`, `severity` (INFO, WARNING, CRITICAL), `entity_type` (shipment, vehicle, driver, payment), `entity_id`, `message`, `acknowledged`

### 6. `payment.received`
Fired when a payment is successfully processed.

**Data fields**: `payment_id`, `invoice_id`, `amount_usd`, `amount_local`, `currency_local` (KES, TZS, UGX, etc.), `method` (card, mobile_money, bank_transfer), `provider` (Stripe, M-Pesa, Flutterwave, etc.), `status`

### 7. `documents.created`
Fired when a document is uploaded to a shipment.

**Data fields**: `document_id`, `shipment_id`, `doc_type` (BOL, CUSTOMS, SCALE_TICKET, INVOICE, OTHER), `filename`, `url` (S3 pre-signed), `uploaded_by`, `size_bytes`

### 8. `marketplace.bid_placed`
Fired when a carrier places a bid on a freight listing.

**Data fields**: `listing_id`, `bid_id`, `carrier_id`, `carrier_name`, `bid_amount_usd`, `proposed_pickup`, `proposed_delivery`, `vehicle_type`

---

## Delivery Guarantees

- **At-least-once delivery** — consumers must deduplicate using `event_id`
- **Ordering not guaranteed** across event types. Within a single `shipment_id` across `shipment.*` events, ordering is preserved
- **Idempotency**: use `event_id` as the idempotency key
- **Timeout**: 10-second connection timeout, 30-second response timeout
- **Signature**: HMAC-SHA256. Verify with `HMAC(secret, body) == signature`. Secret is set per webhook registration via the Integrations API

---

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

---

## Local Testing

```bash
# Start webhook inspector
python manage.py webhook_inspector --port 9999

# Replay captured payloads to a real endpoint
python manage.py webhook_inspector --port 9999 --replay https://your-app.example.com/webhooks/cargotrack
```

Register a webhook endpoint pointing to `http://localhost:9999/webhook` in the Integrations API. All received payloads are displayed in the console and written to `webhook_inspector.log`.
