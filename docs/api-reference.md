# CargoTrack API Reference

**Base URL:** `http://localhost:8000` (development) / `https://api.cargotrack.io` (production)
**API Version:** `v1`
**Authentication:** JWT Bearer token (`Authorization: Bearer <access_token>`) or httpOnly cookie (`ct_access`)
**Content-Type:** `application/json`
**Pagination:** All list endpoints return `{ count, next, previous, results }`. Default page size: 20.

---

## JWT Authentication Flow

```
POST /api/auth/token/         → { access, refresh }
POST /api/auth/token/refresh/ → { access, refresh }  (rotates refresh token)
POST /api/auth/token/verify/  → { } or 401
POST /api/auth/token/logout/  → 205 (blacklists refresh token)
POST /api/auth/register/      → { access, refresh }  (AllowAny)
```

**Token lifetimes:**
- Access token: 60 minutes (HS256)
- Refresh token: 7 days (rotated on every refresh)
- Account lockout: 5 failed attempts → 15-minute cooldown

---

## Role-Based Access Control

| Role | Value | Key Permissions |
|---|---|---|
| Administrator | `ADMIN` | Full system access |
| Logistics Manager | `LOGISTICS_MGR` | Shipment CRUD, dispatch, alert management |
| Carrier | `CARRIER` | Read shipments, log tracking events |
| Client / Shipper | `CLIENT` | Read own shipments, tracking |
| Driver | `DRIVER` | Log events, capture POD |
| Dispatcher | `DISPATCHER` | Create shipments, dispatch |
| Customs Broker | `CUSTOMS_BROKER` | Customs clearance |
| Warehouse Manager | `WAREHOUSE_MGR` | Create shipments, capture POD |
| Port Agent | `PORT_AGENT` | Log events, customs |
| Finance Officer | `FINANCE_OFFICER` | Invoices, payments |

---

## Complete Endpoint Catalog

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/token/` | None | Obtain JWT token pair |
| POST | `/api/auth/token/refresh/` | None | Refresh access token |
| POST | `/api/auth/token/verify/` | None | Verify token validity |
| POST | `/api/auth/token/logout/` | Authenticated | Blacklist refresh token |
| POST | `/api/auth/register/` | None | Create account (all 9 roles self-assignable) |

### Accounts & Profile

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/accounts/me/` | Authenticated | Get user profile |
| PATCH | `/api/v1/accounts/me/` | Authenticated | Update profile fields |
| POST | `/api/v1/accounts/change-password/` | Authenticated | Change password |
| GET/PATCH | `/api/v1/accounts/notification-prefs/` | Authenticated | Notification preferences |
| GET/PATCH | `/api/v1/accounts/me/preferences/` | Authenticated | Display/locale preferences |
| POST | `/api/v1/accounts/me/totp/setup/` | Authenticated | Set up 2FA (returns QR URI) |
| POST | `/api/v1/accounts/me/totp/verify/` | Authenticated | Verify and enable 2FA |
| POST | `/api/v1/accounts/me/totp/disable/` | Authenticated | Disable 2FA |
| GET | `/api/v1/accounts/me/totp/status/` | Authenticated | Check 2FA status |
| GET | `/api/v1/accounts/me/export/` | Authenticated | GDPR data export (JSON) |
| DELETE | `/api/v1/accounts/me/delete/` | Authenticated | Delete account (irreversible) |
| GET | `/api/v1/accounts/me/activity/` | Authenticated | User activity timeline |
| GET | `/api/v1/accounts/me/sessions/` | Authenticated | Active JWT sessions |
| DELETE | `/api/v1/accounts/me/sessions/<id>/` | Authenticated | Revoke a session |
| GET | `/api/v1/accounts/me/stats/` | Authenticated | Personal KPIs |
| GET | `/api/v1/accounts/me/security-log/` | Authenticated | Security audit entries |
| GET | `/api/v1/accounts/api-keys/` | Authenticated | List API keys |
| POST | `/api/v1/accounts/api-keys/` | Authenticated | Create API key (shown once) |
| DELETE | `/api/v1/accounts/api-keys/<pk>/` | Authenticated | Revoke API key |
| GET/POST | `/api/v1/accounts/organizations/` | Authenticated | List/create organizations |
| POST | `/api/v1/accounts/organizations/join/` | Authenticated | Join org by invite code |
| GET/PATCH | `/api/v1/accounts/organizations/<pk>/` | Authenticated | Org detail/update |
| GET/PATCH | `/api/v1/accounts/users/` | Admin | List/update users |
| GET/PATCH | `/api/v1/accounts/users/<id>/` | Admin | User detail/update role |

### Shipments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/shipments/` | Authenticated | Paginated shipment list |
| POST | `/api/v1/shipments/` | Authenticated | Create shipment |
| GET | `/api/v1/shipments/<id>/` | Authenticated | Shipment detail |
| PATCH | `/api/v1/shipments/<id>/` | Authenticated | Update status only |
| POST | `/api/v1/shipments/<id>/predict/` | Authenticated | ML delay prediction |
| POST | `/api/v1/shipments/<id>/dispatch/` | CanDispatch | Assign carrier/truck/driver |
| GET | `/api/v1/shipments/<id>/tracking-events/` | Authenticated | Shipment event timeline |
| POST | `/api/v1/shipments/<id>/tracking-events/` | Authenticated | Log tracking event |
| GET | `/api/v1/shipments/<id>/documents/` | Authenticated | Shipment documents |
| POST | `/api/v1/shipments/<id>/documents/` | Authenticated | Upload document |
| GET | `/api/v1/shipments/<id>/compliance/` | Authenticated | Compliance docs |

### Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/routes/` | Authenticated | All routes (unpaginated, 5-min cache) |

### Tracking

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/tracking/events/` | Authenticated | Global tracking events (filterable by tracking_number) |
| POST | `/api/v1/tracking/events/` | Authenticated | Create tracking event |
| GET | `/api/v1/track/<tracking_number>/` | None | Public tracking (AllowAny, 1-min cache) |

### Alerts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/alerts/` | Authenticated | Alert list (unacknowledged by default) |
| POST | `/api/v1/alerts/<id>/acknowledge/` | Manager+ | Acknowledge alert |

### Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/dashboard/kpis/` | Authenticated | KPI summary cards |
| GET | `/api/v1/dashboard/stats/` | Authenticated | Full dashboard payload |
| GET | `/api/v1/dashboard/map/` | Authenticated | GeoJSON FeatureCollection |

### Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/analytics/` | Authenticated | General analytics (2-min cache) |
| GET | `/api/v1/analytics/profit/` | Authenticated | Profit/margin analysis (3-min cache) |
| GET | `/api/v1/analytics/routes/` | Authenticated | Per-route KPIs |
| GET | `/api/v1/analytics/carrier-benchmark/` | Authenticated | Carrier rankings with percentiles |
| GET | `/api/v1/analytics/corridors/` | Authenticated | Northern/Central/LAPSSET corridor comparison |
| GET | `/api/v1/analytics/customers/` | Authenticated | Customer analytics |
| GET | `/api/v1/analytics/temporal/` | Authenticated | Hour/day/month seasonality |
| GET | `/api/v1/analytics/export/` | Authenticated | CSV export (shipments/carriers/financial/drivers) |
| GET | `/api/v1/analytics/performance/` | Authenticated | On-time rates, avg miles, bid success |
| GET | `/api/v1/analytics/driver-leaderboard/` | Authenticated | Ranked driver performance |
| GET | `/api/v1/analytics/bid-analytics/` | Authenticated | Bid trends and success rates |
| GET | `/api/v1/sla/` | Authenticated | SLA compliance |
| GET | `/api/v1/carbon/` | Authenticated | Carbon emissions (0.096 kg CO2/tonne-km, 5-min cache) |

### Customs Integration

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/customs/declare/` | CanSubmitCustoms | Submit customs declaration |
| GET | `/api/v1/customs/status/` | Authenticated | Query declaration status |
| GET | `/api/v1/customs/tariff/` | Authenticated | Look up HS code tariff |
| GET | `/api/v1/customs/borders/` | Authenticated | List EAC border crossings |

### Real-Time ETA

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/eta/` | Authenticated | Calculate ETA (Kalman filter) |
| POST | `/api/v1/eta/batch/` | Authenticated | Fleet-wide batch ETA |

### Multi-Currency Finance

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/finance/convert/` | Authenticated | Currency conversion |
| GET | `/api/v1/finance/taxes/` | Authenticated | EAC tax rates summary |
| POST | `/api/v1/finance/calculate/` | Authenticated | Invoice with tax breakdown |

### Rates & Contracts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/rates/` | Authenticated | Look up freight rate |
| GET | `/api/v1/rates/compare/` | Authenticated | Contract vs spot comparison |

### Demurrage & Detention

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/demurrage/` | Authenticated | Calculate demurrage charges |
| GET | `/api/v1/demurrage/port/` | Authenticated | All containers at a port |

### Document OCR

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/documents/extract/` | Authenticated | Upload + OCR (PNG/JPEG/TIFF/PDF/GIF/BMP/WebP) |
| GET | `/api/v1/documents/<pk>/extraction/` | Authenticated | Get extraction result |
| DELETE | `/api/v1/documents/<pk>/extraction/` | Authenticated | Delete extraction (re-extract) |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/notifications/` | Authenticated | List notifications (filterable by type, unread) |
| PATCH | `/api/v1/notifications/<pk>/read/` | Authenticated | Mark one read |
| PATCH | `/api/v1/notifications/mark-all-read/` | Authenticated | Mark all read |
| DELETE | `/api/v1/notifications/<pk>/` | Authenticated | Dismiss notification |

### Compliance

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/compliance/` | Authenticated | All compliance docs (filterable by status) |
| POST | `/api/v1/compliance/` | Authenticated | Create compliance doc |
| GET/PATCH/DELETE | `/api/v1/compliance/<pk>/` | Authenticated | Detail/update/delete |

### Predictions (ML)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/predictions/delay/` | Authenticated | Delay risk prediction |
| POST | `/api/v1/predictions/demand/` | Authenticated | Demand forecast |
| POST | `/api/v1/predictions/pricing/` | Authenticated | Dynamic pricing |
| POST | `/api/v1/predictions/theft-risk/` | Authenticated | Theft risk score |
| POST | `/api/v1/predictions/driver-score/` | Authenticated | Driver performance score |
| POST | `/api/v1/predictions/border-delay/` | Authenticated | Border delay prediction |

### Audit & Integrations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/audit/` | CanViewAudit | Audit log entries (filterable) |
| POST | `/api/v1/audit/create/` | Authenticated | Create audit entry |
| GET/POST | `/api/v1/integrations/` | CanAdminSystem | List/create integrations |
| GET/PATCH/DELETE | `/api/v1/integrations/<pk>/` | CanAdminSystem | Integration detail |

### Fleet, Carriers, Marketplace, Chat, POD, Coldchain

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/v1/fleet/` | Truck and driver management |
| GET/POST | `/api/v1/carriers/` | Carrier companies and rate cards |
| GET/POST | `/api/v1/marketplace/listings/` | Freight listings |
| GET/POST | `/api/v1/marketplace/bids/` | Bids on listings |
| GET/POST | `/api/v1/chat/` | Chat conversations and messages |
| GET/POST | `/api/v1/pod/` | Proof of delivery |
| GET/POST | `/api/v1/coldchain/` | Cold chain monitoring |

### OpenAPI Schema

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/schema/` | OpenAPI 3.1 schema (drf-spectacular) |
| GET | `/api/docs/swagger/` | Swagger UI |
| GET | `/api/docs/redoc/` | ReDoc UI |
| GET | `/api/health/` | Health check endpoint |

---

## WebSocket Events (Phoenix Channels)

WebSocket at `ws://<host>/ws/`:

| Channel | Event | Description |
|---|---|---|
| `tracking:<tracking_number>` | Live position updates | GPS telemetry stream |
| `shipment:<id>` | State changes | Shipment lifecycle transitions |
| `alert:<id>` | New alert | Real-time alert notifications |
| `chat:<room_id>` | Chat messages | Real-time messaging |

---

## ML Prediction Pipeline

```
Shipment QuerySet → FeatureEngineer.fit_transform()
  ├── distance_km, estimated_hours, weight_kg
  ├── hour_of_departure, day_of_week, month
  ├── route_origin_encoded, route_destination_encoded
  ├── num_tracking_events
  └── has_customs_stop
       │
       ▼
DelayPredictor.train(X, y) — RandomForestClassifier/XGBoost
  ├── 5-fold cross-validated F1 score
       │
       ▼
DelayPredictor.predict() → [(label, probability), ...]
       │
       ▼
POST /api/v1/shipments/<id>/predict/
  ├── Updates shipment.delay_risk_score
  └── Triggers AlertManager if ≥ 0.70 threshold
```

**Severity Bands:**

| Band | Score Threshold |
|---|---|
| CRITICAL | ≥ 0.85 |
| HIGH | ≥ 0.70 |
| MEDIUM | ≥ 0.50 |
| LOW | < 0.50 |

---

## Error Responses

| Status | Meaning |
|---|---|
| 400 | Validation error — see field keys |
| 401 | Missing or expired token |
| 403 | Insufficient role permissions |
| 404 | Resource not found |
| 429 | Rate limited (20/min anon, 100/min auth) or account locked |
| 503 | ML model not trained |
| 504 | Prediction timed out |

**Example 400:**
```json
{
  "weight_kg": ["weight_kg must be greater than zero."],
  "scheduled_departure": ["scheduled_departure must be before scheduled_arrival."]
}
```

**Example 401:**
```json
{ "detail": "Given token not valid for any token type", "code": "token_not_valid" }
```
