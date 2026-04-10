# CargoTrack REST API Reference

**Base URL:** `http://localhost:8000` (development)  
**API Version:** `v1`  
**Authentication:** JWT Bearer token (`Authorization: Bearer <access_token>`)  
**Content-Type:** `application/json`  
**Pagination:** All list endpoints return `{ count, next, previous, results }`.  
**Default page size:** 20 items.

---

## JWT Authentication Flow

```
Client                         Django Backend
  │                                │
  │  POST /api/auth/token/         │
  │  { username, password }        │
  │ ──────────────────────────────>│
  │                                │  Validate credentials
  │  200 OK                        │
  │  { access, refresh }           │
  │ <──────────────────────────────│
  │                                │
  │  GET /api/v1/... (any call)    │
  │  Authorization: Bearer <access>│
  │ ──────────────────────────────>│
  │                                │  Validate access token (HS256)
  │  200 OK  { ... }               │
  │ <──────────────────────────────│
  │                                │
  │  [access token expires 60 min] │
  │                                │
  │  POST /api/auth/token/refresh/ │
  │  { refresh: <refresh_token> }  │
  │ ──────────────────────────────>│
  │                                │  Blacklist old refresh token
  │  200 OK                        │  Issue new access + refresh pair
  │  { access, refresh }           │  (ROTATE_REFRESH_TOKENS=True)
  │ <──────────────────────────────│
  │                                │
  │  POST /api/auth/token/blacklist│
  │  { refresh: <refresh_token> }  │
  │ ──────────────────────────────>│  (logout — invalidates refresh)
  │  205 Reset Content             │
  │ <──────────────────────────────│
```

**Token lifetimes:**
- Access token: 60 minutes
- Refresh token: 7 days (rotated on every refresh)

---

## Role-Based Access Control

| Role          | Value          | Permissions                                            |
|---------------|----------------|--------------------------------------------------------|
| Administrator | `ADMIN`        | All endpoints                                          |
| Logistics Mgr | `LOGISTICS_MGR`| Shipment CRUD, status updates, alert acknowledgement   |
| Carrier       | `CARRIER`      | Read shipments, log tracking events                    |
| Client        | `CLIENT`       | Read own shipments, read tracking events               |

Permission classes used in views:
- `IsAuthenticated` — any valid JWT (default)
- `IsManagerUser` — `LOGISTICS_MGR` or `ADMIN`
- `IsAdminUser` — `ADMIN` only
- `IsClientUser` — alias for `IsAuthenticated`

---

## Endpoints

### Authentication

#### POST /api/auth/token/
Obtain an access + refresh token pair.

**Auth:** None (public)

**Request body:**
```json
{
  "username": "logistics@example.com",
  "password": "securepassword"
}
```

**Response 200:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

```bash
curl -s -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass"}' | python -m json.tool
```

---

#### POST /api/auth/token/refresh/
Exchange a refresh token for a new access token (and rotated refresh token).

**Auth:** None

**Request body:**
```json
{ "refresh": "<refresh_token>" }
```

**Response 200:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### POST /api/auth/token/verify/
Confirm an access token is still valid.

**Auth:** None

**Request body:**
```json
{ "token": "<access_token>" }
```

**Response 200:** `{}`  
**Response 401:** `{ "detail": "Token is invalid or expired" }`

---

#### POST /api/auth/register/
Create a new user account and receive a token pair immediately.  
Only `CLIENT` and `CARRIER` roles are self-assignable.

**Auth:** None (public)

**Request body:**
```json
{
  "first_name": "Amara",
  "last_name":  "Osei",
  "email":      "amara@example.com",
  "company":    "Osei Logistics Ltd",
  "phone":      "+254712345678",
  "role":       "CLIENT",
  "password":   "securepass123",
  "password2":  "securepass123"
}
```

**Response 201:**
```json
{
  "access":  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

```bash
curl -s -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","email":"test@example.com","role":"CLIENT","password":"pass1234","password2":"pass1234"}'
```

---

### User Profile

#### GET /api/v1/accounts/me/
Return the authenticated user's profile.

**Auth:** IsAuthenticated

**Response 200:**
```json
{
  "id":           1,
  "username":     "amara@example.com",
  "email":        "amara@example.com",
  "first_name":   "Amara",
  "last_name":    "Osei",
  "role":         "CLIENT",
  "role_display": "Client / Shipper",
  "company":      "Osei Logistics Ltd",
  "phone":        "+254712345678",
  "date_joined":  "2024-01-15T09:00:00Z",
  "last_login":   "2024-04-10T08:30:00Z"
}
```

---

#### PATCH /api/v1/accounts/me/
Update mutable profile fields. `role`, `username`, and `email` are read-only.

**Auth:** IsAuthenticated

**Request body (all fields optional):**
```json
{
  "first_name": "Amara",
  "last_name":  "Osei-Mensah",
  "company":    "Osei-Mensah Freight",
  "phone":      "+254799999999"
}
```

**Response 200:** Updated `UserMeSerializer` payload (same shape as GET /me/).

---

### Routes

#### GET /api/v1/routes/
Return all available routes (unpaginated — for dropdown population).

**Auth:** IsAuthenticated

**Response 200:**
```json
[
  {
    "id":               1,
    "origin":           "Mombasa",
    "destination":      "Nairobi",
    "distance_km":      480.0,
    "estimated_hours":  8.5,
    "created_at":       "2024-01-10T00:00:00Z"
  }
]
```

```bash
ACCESS=<your_token>
curl -s http://localhost:8000/api/v1/routes/ \
  -H "Authorization: Bearer $ACCESS" | python -m json.tool
```

---

### Shipments

#### GET /api/v1/shipments/
Paginated list of all shipments, newest first.

**Auth:** IsAuthenticated

**Query params:**

| Param       | Type   | Description                        |
|-------------|--------|------------------------------------|
| `page`      | int    | Page number (default: 1)           |
| `page_size` | int    | Items per page (default: 20)       |

**Response 200:**
```json
{
  "count": 42,
  "next":  "http://localhost:8000/api/v1/shipments/?page=2",
  "previous": null,
  "results": [
    {
      "id":                  1,
      "tracking_number":     "CT-20240410-ABCD",
      "route": {
        "id":               1,
        "origin":           "Mombasa",
        "destination":      "Nairobi",
        "distance_km":      480.0,
        "estimated_hours":  8.5,
        "created_at":       "2024-01-10T00:00:00Z"
      },
      "status":              "IN_TRANSIT",
      "status_display":      "In Transit",
      "carrier_name":        "Rift Valley Carriers",
      "weight_kg":           2500.0,
      "scheduled_departure": "2024-04-10T06:00:00Z",
      "scheduled_arrival":   "2024-04-10T14:30:00Z",
      "actual_departure":    "2024-04-10T06:15:00Z",
      "actual_arrival":      null,
      "delay_risk_score":    0.23,
      "created_at":          "2024-04-10T05:45:00Z",
      "updated_at":          "2024-04-10T06:15:00Z"
    }
  ]
}
```

---

#### POST /api/v1/shipments/
Create a new shipment. `tracking_number` is auto-generated (format: `CT-YYYYMMDD-XXXX`).

**Auth:** IsAuthenticated

**Request body:**
```json
{
  "route":                1,
  "carrier_name":         "Rift Valley Carriers",
  "weight_kg":            2500.0,
  "scheduled_departure":  "2024-04-15T06:00:00Z",
  "scheduled_arrival":    "2024-04-15T14:30:00Z",
  "status":               "PENDING"
}
```

**Status choices:** `PENDING` | `IN_TRANSIT` | `CUSTOMS` | `DELIVERED` | `DELAYED`

**Response 201:** Full `ShipmentSerializer` payload (same shape as GET list item).

```bash
curl -s -X POST http://localhost:8000/api/v1/shipments/ \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"route":1,"carrier_name":"Test Carrier","weight_kg":1000,"scheduled_departure":"2024-05-01T06:00:00Z","scheduled_arrival":"2024-05-01T14:00:00Z","status":"PENDING"}'
```

---

#### GET /api/v1/shipments/{id}/
Full detail for a single shipment.

**Auth:** IsAuthenticated

**Response 200:** Same shape as shipment list item above.

---

#### PATCH /api/v1/shipments/{id}/
Update the `status` field only.

**Auth:** IsAuthenticated

**Request body:**
```json
{ "status": "DELIVERED" }
```

**Response 200:**
```json
{
  "id":              1,
  "tracking_number": "CT-20240410-ABCD",
  "status":          "DELIVERED"
}
```

---

#### POST /api/v1/shipments/{id}/predict/
Run the ML delay predictor on a shipment and update its `delay_risk_score`.

**Auth:** IsAuthenticated  
**Note:** Returns 503 if no trained model exists at `cargotrack/ml/delay_model.pkl`.

**Request body:** `{}` (empty, or `{ "shipment_id": N }` for backwards compat)

**Response 200:**
```json
{
  "shipment_id":       1,
  "tracking_number":   "CT-20240410-ABCD",
  "delay_risk_score":  0.8312,
  "predicted_delayed": true,
  "confidence":        0.8312
}
```

**Response 503:**
```json
{ "error": "Model not trained yet. Run 'python manage.py train_model'." }
```

---

#### GET /api/v1/shipments/{id}/tracking-events/
List all tracking events for a shipment in reverse-chronological order.

**Auth:** IsAuthenticated

**Response 200:**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id":                 5,
      "shipment":           1,
      "event_type":         "CHECKPOINT",
      "event_type_display": "Checkpoint",
      "location":           "Nairobi Inland Container Depot",
      "timestamp":          "2024-04-10T11:00:00Z",
      "notes":              "Cargo intact, driver verified",
      "recorded_by":        2,
      "recorded_by_name":   "James Mwangi"
    }
  ]
}
```

---

#### POST /api/v1/shipments/{id}/tracking-events/
Log a new tracking event against a shipment.  
`recorded_by` is set from `request.user`; do not include it in the body.

**Auth:** IsAuthenticated

**Request body:**
```json
{
  "event_type": "CHECKPOINT",
  "location":   "Nakuru Weighbridge",
  "notes":      "Weight verified: 2498 kg"
}
```

**Event type choices:** `DEPARTURE` | `CHECKPOINT` | `CUSTOMS_ENTRY` | `CUSTOMS_CLEAR` | `ARRIVAL` | `DELAY` | `NOTE`

**Response 201:** Same shape as list item above.

---

### Tracking

#### GET /api/v1/tracking/events/
Global paginated list of all tracking events.  
Supports filtering by tracking number.

**Auth:** IsAuthenticated

**Query params:**

| Param              | Type   | Description                             |
|--------------------|--------|-----------------------------------------|
| `tracking_number`  | string | Filter to events for one shipment       |
| `page`             | int    | Page number (default: 1)                |

```bash
curl -s "http://localhost:8000/api/v1/tracking/events/?tracking_number=CT-20240410-ABCD" \
  -H "Authorization: Bearer $ACCESS"
```

---

#### POST /api/v1/tracking/events/
Create a tracking event, supplying the `shipment` FK in the body.

**Auth:** IsAuthenticated

**Request body:**
```json
{
  "shipment":   1,
  "event_type": "NOTE",
  "location":   "Dispatch office",
  "notes":      "Documents verified"
}
```

---

#### GET /api/v1/tracking/{tracking_number}/events/
Legacy endpoint — return all events for a shipment by tracking number.  
Response is a plain JSON array (not paginated).  
Prefer the `/shipments/{id}/tracking-events/` sub-resource for new clients.

**Auth:** IsAuthenticated

---

### Alerts

#### GET /api/v1/alerts/
Paginated list of alerts.  
Unacknowledged alerts only by default; managers can pass `?all=1`.

**Auth:** IsAuthenticated

**Query params:**

| Param | Value | Description                                    |
|-------|-------|------------------------------------------------|
| `all` | `1`   | Include acknowledged alerts (managers+ only)   |

**Response 200:**
```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id":               1,
      "shipment":         3,
      "shipment_tracking": "CT-20240410-WXYZ",
      "message":          "Shipment CT-20240410-WXYZ has a 84% probability of delay...",
      "risk_score":       0.84,
      "severity":         "CRITICAL",
      "severity_display": "Critical",
      "sent_at":          "2024-04-10T09:30:00Z",
      "acknowledged":     false
    }
  ]
}
```

---

#### POST /api/v1/alerts/{id}/acknowledge/
Mark an alert as acknowledged and record the acknowledging user.

**Auth:** IsManagerUser (LOGISTICS_MGR or ADMIN)

**Request body:** `{}` (empty)

**Response 200:** Full `AlertSerializer` payload with `acknowledged: true`.

**Response 403:**
```json
{ "detail": "Logistics Manager or Administrator access required." }
```

```bash
curl -s -X POST http://localhost:8000/api/v1/alerts/1/acknowledge/ \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Dashboard

#### GET /api/v1/dashboard/kpis/
Compact KPI summary for the dashboard header cards.

**Auth:** IsAuthenticated

**Response 200:**
```json
{
  "total_shipments":     42,
  "active_shipments":    18,
  "delivered_shipments": 20,
  "delayed_shipments":   4,
  "exception_count":     4,
  "on_time_rate":        90.0,
  "carrier_count":       7,
  "open_alerts":         2
}
```

---

#### GET /api/v1/dashboard/stats/
Full dashboard payload: summary + recent events + carrier performance.

**Auth:** IsAuthenticated

**Response 200:**
```json
{
  "summary": {
    "total_shipments":       42,
    "by_status":             { "PENDING": 5, "IN_TRANSIT": 13, "DELIVERED": 20, "DELAYED": 4 },
    "avg_delay_risk":        0.312,
    "high_risk_count":       6,
    "unacknowledged_alerts": 2
  },
  "recent_events": [
    {
      "shipment__tracking_number": "CT-20240410-ABCD",
      "event_type": "CHECKPOINT",
      "location":   "Nairobi ICD",
      "timestamp":  "2024-04-10T11:00:00Z"
    }
  ],
  "carrier_performance": [
    {
      "carrier_name":    "Rift Valley Carriers",
      "shipment_count":  12,
      "avg_risk":        0.28,
      "on_time":         11
    }
  ]
}
```

**Field notes:**
- `carrier_performance.on_time` — count of DELIVERED shipments where `actual_arrival ≤ scheduled_arrival`
- `carrier_performance.avg_risk` — mean `delay_risk_score` across all carrier shipments

---

#### GET /api/v1/dashboard/map/
GeoJSON FeatureCollection stub for the live shipment map.  
Returns an empty `features` array until geocoding is implemented.

**Auth:** IsAuthenticated

**Response 200:**
```json
{ "type": "FeatureCollection", "features": [] }
```

---

## Error Responses

| Status | Meaning                                      |
|--------|----------------------------------------------|
| 400    | Validation error — see `detail` or field keys |
| 401    | Missing or expired access token              |
| 403    | Authenticated but insufficient role          |
| 404    | Resource not found                           |
| 503    | ML model not trained (predict endpoint only) |

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

---

## ML Delay Prediction Pipeline

The delay predictor uses a **RandomForestClassifier** trained on historical
shipment data.  The pipeline is:

```
Shipment QuerySet
       │
       ▼
FeatureEngineer.fit_transform()
  ├── distance_km, estimated_hours, weight_kg
  ├── hour_of_departure, day_of_week, month
  ├── route_origin_encoded, route_destination_encoded  (label-encoded)
  ├── num_tracking_events  (count of TrackingEvent rows)
  └── has_customs_stop  (1 if any event is CUSTOMS_ENTRY)
       │
       ▼
DelayPredictor.train(X, y)
  ├── model.fit(X, y)
  └── 5-fold cross-validated F1 score recorded in _last_report
       │
       ▼
DelayPredictor.predict(X)  → [(label, probability), ...]
       │
       ▼
POST /api/v1/shipments/<id>/predict/
  ├── Updates shipment.delay_risk_score in DB
  └── Triggers AlertManager if probability ≥ DELAY_ALERT_THRESHOLD (0.70)
       │
       ▼
AlertManager.check_shipment(shipment, prediction)
  ├── InAppAlertHandler → creates Notification record
  └── EmailAlertHandler → sends email to shipment.client (if set)
```

**Severity bands** (configurable in `settings.ALERT_THRESHOLDS`):

| Band     | Score threshold |
|----------|-----------------|
| CRITICAL | ≥ 0.85          |
| HIGH     | ≥ 0.70          |
| MEDIUM   | ≥ 0.50          |
| LOW      | < 0.50          |

**Model persistence:** `cargotrack/ml/delay_model.pkl` (pickle format).  
Call `DelayPredictor.save()` after training; `DelayPredictor.load()` on predict.
