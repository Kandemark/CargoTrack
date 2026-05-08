# CargoTrack API Reference

All endpoints are mounted at `/api/v1/` and require JWT authentication unless noted.

## Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/accounts/token/` | Obtain JWT token pair (access + refresh) |
| POST | `/api/v1/accounts/token/refresh/` | Refresh expired access token |
| POST | `/api/v1/accounts/token/verify/` | Verify token validity |

## Shipments

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/shipments/` | List shipments (paginated) |
| POST | `/api/v1/shipments/` | Create shipment |
| GET | `/api/v1/shipments/<id>/` | Shipment detail |
| PUT | `/api/v1/shipments/<id>/` | Update shipment |
| DELETE | `/api/v1/shipments/<id>/` | Delete shipment |
| POST | `/api/v1/routes/` | Create route |
| GET | `/api/v1/routes/` | List routes |

## Tracking

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/tracking/events/` | Ingest tracking event |
| GET | `/api/v1/tracking/<tracking_number>/` | Get tracking history |

## Alerts

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/alerts/` | List alerts |
| PUT | `/api/v1/alerts/<id>/acknowledge/` | Acknowledge alert |
| PUT | `/api/v1/alerts/<id>/resolve/` | Resolve alert |

## Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/notifications/` | List notifications |
| POST | `/api/v1/notifications/mark-all-read/` | Mark all read |
| POST | `/api/v1/notifications/<id>/read/` | Mark one read |
| DELETE | `/api/v1/notifications/<id>/` | Dismiss notification |

## OCR Document Extraction

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/documents/extract/` | Upload document for OCR (multipart: PNG/JPEG/TIFF/PDF/GIF/BMP/WebP) |
| GET | `/api/v1/documents/<id>/extraction/` | Get extraction result |
| DELETE | `/api/v1/documents/<id>/extraction/` | Delete extraction |

## Customs Integration

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/customs/declare/` | Submit customs declaration to TradeNet/ASYCUDA/TANCIS |
| GET | `/api/v1/customs/status/?id=<id>&system=<TRADENET\|ASYCUDA\|TANCIS>` | Query declaration status |
| GET | `/api/v1/customs/tariff/?hs=<code>&country=<KE\|TZ\|UG\|RW\|BI>` | Look up HS code tariff |
| GET | `/api/v1/customs/borders/` | List EAC border crossings and customs systems |

## Real-Time ETA

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/eta/?tracking=<num>&lat=<lat>&lon=<lon>&speed=<kmh>&weather=<clear\|rain>` | Calculate ETA for a shipment |
| POST | `/api/v1/eta/batch/` | Batch ETA for multiple positions |

**ETA Response fields**:
- `estimated_arrival`, `estimated_remaining_hours`
- `confidence_low` (optimistic), `confidence_high` (pessimistic)
- `current_speed_kmh`, `progress_pct`
- `upcoming_border`, `border_wait_minutes`
- `next_rest_break_at`

## Multi-Currency Finance

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/finance/convert/?from=USD&to=KES&amount=100` | Convert currency |
| GET | `/api/v1/finance/taxes/` | Get EAC tax rates summary |
| POST | `/api/v1/finance/calculate/` | Calculate invoice with tax breakdown |

**Invoice Calculate request body**:
```json
{
  "line_items": [{"description": "Freight", "quantity": 1, "unit_price": 500}],
  "currency": "USD",
  "country_code": "KE",
  "include_vat": true,
  "include_wht": false,
  "include_fuel_surcharge": false,
  "transport_cost": 500
}
```

## Rates & Contracts

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/rates/?origin=Mombasa&dest=Nairobi&weight=5000` | Look up rate for a shipment |
| GET | `/api/v1/rates/compare/?origin=Mombasa&dest=Nairobi&weight=5000` | Compare contract vs spot rates |

**Supported currencies**: KES, TZS, UGX, RWF, BIF, USD, EUR, GBP

## Demurrage & Detention

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/demurrage/?port=KEMBA&container_type=20FT_DRY&type=IMPORT&arrival=2026-05-01` | Calculate demurrage charges |
| GET | `/api/v1/demurrage/port/?port=KEMBA` | Get all containers' demurrage status at a port |

**Port codes**: KEMBA (Mombasa), TZDAR (Dar es Salaam), KENBO (Nairobi ICD), UGKAM (Kampala ICD), RWKGL (Kigali ICD)

## Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/analytics/` | General analytics |
| GET | `/api/v1/analytics/profit/` | Profit analytics |
| GET | `/api/v1/analytics/routes/` | Route analytics |
| GET | `/api/v1/analytics/carrier-benchmark/` | Carrier benchmark |
| GET | `/api/v1/analytics/corridors/` | Corridor analytics |
| GET | `/api/v1/analytics/customers/` | Customer analytics |
| GET | `/api/v1/analytics/temporal/` | Temporal trends |
| GET | `/api/v1/analytics/performance/` | Performance metrics |
| GET | `/api/v1/analytics/driver-leaderboard/` | Driver leaderboard |
| GET | `/api/v1/analytics/bid-analytics/` | Bid analytics |
| GET | `/api/v1/analytics/export/` | Export analytics data |
| GET | `/api/v1/sla/` | SLA compliance |
| GET | `/api/v1/carbon/` | Carbon emissions |

## Predictions (ML)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/predictions/delay/` | Predict shipment delay risk |
| POST | `/api/v1/predictions/demand/` | Demand forecast |
| POST | `/api/v1/predictions/pricing/` | Dynamic pricing recommendation |
| POST | `/api/v1/predictions/theft-risk/` | Cargo theft risk score |
| POST | `/api/v1/predictions/driver-score/` | Driver performance score |
| POST | `/api/v1/predictions/border-delay/` | Border crossing delay prediction |

## Other Resources

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/compliance/` | Compliance documents list |
| POST | `/api/v1/compliance/` | Create compliance doc |
| GET | `/api/v1/compliance/<id>/` | Compliance doc detail |
| GET | `/api/v1/audit/` | Audit log entries |
| POST | `/api/v1/audit/create/` | Create audit entry |
| GET | `/api/v1/integrations/` | Integration configurations |
| GET | `/api/v1/integrations/<id>/` | Integration detail |

## WebSocket Events

WebSocket at `ws://<host>/ws/` (Phoenix Channels):

| Event | Description |
|---|---|
| `tracking:<tracking_number>` | Live GPS position updates |
| `shipment:<id>` | Shipment state changes |
| `alert:<id>` | New alert notification |
| `chat:<room_id>` | Real-time chat messages |
