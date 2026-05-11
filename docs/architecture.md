# CargoTrack Architecture

## System Architecture Diagram

```
                         ┌──────────────────────┐
                         │    API Gateway        │
                         │   Traefik :80/:443    │
                         │  TLS + Rate Limiting  │
                         └──────────┬───────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
   ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
   │  Django API  │          │  Phoenix WS  │          │  Keycloak    │
   │  (Daphne)    │◄─REST──►│  :4000       │          │  OIDC :8080  │
   │  :8000       │          │  WebSocket   │          │              │
   └──────┬───────┘          └──────────────┘          └──────────────┘
          │
          │ Kafka Events
          ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                     Apache Kafka (KRaft)                      │
   │  cargotrack.gps.positions    cargotrack.shipments.state      │
   │  cargotrack.gps.geofence     cargotrack.tracking.events      │
   │  cargotrack.alerts.triggered cargotrack.notifications        │
   └──────┬───────────────┬──────────────────┬────────────────────┘
          │               │                  │
   ┌──────▼──────┐ ┌──────▼──────┐  ┌───────▼──────────┐
   │ Go Notify   │ │ Go Webhook  │  │ Rust GPS Ingest  │
   │ SMS/Email   │ │ Dispatcher  │  │ MQTT→Kafka       │
   │ Push/USSD   │ │ Retry+HMAC  │  │ + Geofencing     │
   └─────────────┘ └─────────────┘  └──────────────────┘
          │
   ┌──────▼──────┐ ┌──────────────┐ ┌──────────────────┐
   │ EMQX MQTT   │ │ Rust Route   │ │ Java Camunda     │
   │ :1883       │ │ Optimizer    │ │ Workflow Engine  │
   │ IoT Devices │ │ gRPC :50051  │ │ BPMN + DMN       │
   └─────────────┘ └──────────────┘ └──────────────────┘

   ┌──────────────┐ ┌──────────────────────────────────┐
   │ Java Camel   │ │     Observability Stack           │
   │ EDI Gateway  │ │ Prometheus + Grafana + Jaeger     │
   │ EDIFACT/X12  │ │ Loki + Promtail + Postgres/Redis  │
   └──────────────┘ │ Exporters                         │
                    └──────────────────────────────────┘
```

---

## Inter-Service Communication Patterns

### 1. Synchronous REST (External API)
- Traefik → Django API → PostgreSQL/Redis
- Used for: CRUD operations, dashboard queries, auth

### 2. Asynchronous Event Stream (Kafka)
- GPS Ingest → Kafka → Notification / Webhook Dispatcher / Django
- Workflow Engine ↔ Kafka ↔ Django API
- EDI Gateway → Kafka → Django API

### 3. gRPC (Internal Service)
- Django API / Workflow Engine → Route Optimizer (TSP/MVRP solving)

### 4. WebSocket (Real-time)
- Phoenix Channels for live tracking, chat, notifications
- Django Channels for async operations

### 5. MQTT (IoT)
- GPS trackers → EMQX → Rust GPS Ingest → Kafka

---

## Django API App Architecture

The Django API (`services/api/`) is organized into domain apps:

| App | Purpose | Has DB Models |
|---|---|---|
| `accounts` | Custom user model (9 roles), JWT auth, 2FA, API keys, organizations, audit log | Yes |
| `shipments` | Core shipment & route CRUD, OCR, customs, ETA, analytics, demurrage, carbon | Yes |
| `tracking` | Tracking event logging and querying | Yes |
| `alerts` | Delay alerts with severity pipeline and notification handlers | Yes |
| `dashboard` | Aggregated KPI views | No |
| `predictions` | ML prediction endpoints (delay, pricing, theft, demand) | No |
| `payments` | Invoices, payment gateway integrations (M-Pesa, Airtel, MTN, Stripe, Flutterwave) | Yes |
| `fleet` | Truck and driver fleet management | Yes |
| `carriers` | Carrier company profiles and rate cards | Yes |
| `chats` | Real-time messaging and video calls | Yes |
| `marketplace` | Freight marketplace, listings, and bidding | Yes |
| `pod` | Digital proof of delivery with signature capture | Yes |
| `coldchain` | Cold chain temperature monitoring and GDP compliance | Yes |
| `cargotrack` | Django project config (settings, URLs, middleware, ML, auth) | No |
| `domains` | Cross-cutting domain layer for analytics, finance, customs, etc. | No |

### Library Modules (no views, reusable logic)

| Module | Purpose | Has DB Models |
|---|---|---|
| `demurrage` | Demurrage and detention calculator for EAC ports | Yes |
| `contracts` | Contract pricing, rate cards, spot comparison | Yes |
| `finance` | Multi-currency conversion, tax calculation, invoicing | Yes |

---

## Kafka Topic Layout

| Topic | Producer | Consumer(s) | Description |
|---|---|---|---|
| `cargotrack.gps.positions` | gps-ingest (Rust) | Django, tracking-ingest | Real-time GPS position updates |
| `cargotrack.gps.geofence` | gps-ingest (Rust) | Django, notification | Geofence enter/exit events |
| `cargotrack.shipments.state` | Django API | webhook-dispatcher, workflow-engine | Shipment lifecycle transitions |
| `cargotrack.tracking.events` | Django API, tracking-ingest | webhook-dispatcher | Tracking event ingestion |
| `cargotrack.alerts.triggered` | Django API (AlertManager) | notification, webhook-dispatcher | Alert notifications |
| `cargotrack.notifications` | Django API | notification (Go) | Outbound notification requests |

---

## Observability Stack

| Component | Port | Purpose |
|---|---|---|
| Prometheus | 9090 | Metrics collection (15-day retention) |
| Grafana | 3000 | Dashboards (anonymous viewer access) |
| Jaeger | 16686 | Distributed tracing UI (OTLP) |
| Loki | 3100 | Log aggregation |
| Promtail | — | Docker log collector → Loki |
| Postgres Exporter | 9187 | PostgreSQL metrics → Prometheus |
| Redis Exporter | 9121 | Redis metrics → Prometheus |

---

## Security Architecture

- **API Authentication**: JWT (HS256) with httpOnly cookies for web, Bearer header for mobile
- **Token Lifecycle**: 60-min access tokens, 7-day refresh tokens with rotation and blacklisting
- **OIDC/SSO**: Keycloak integration with RS256 signing (configurable)
- **2FA**: TOTP with backup codes, password + TOTP 2-step verification
- **Account Lockout**: 5 failed attempts → 15-minute cooldown
- **API Keys**: SHA-256 hashed per-user keys with prefix identification
- **CSRF**: Cookie-based CSRF protection (CSRF_COOKIE_HTTPONLY=False for SPA)
- **CSP**: Content Security Policy middleware
- **CORS**: Configurable origins with credential support
- **Encryption**: EncryptedTextField for sensitive data (phone, tax IDs)
- **TLS**: Traefik handles TLS termination with Let's Encrypt
- **Webhook Signatures**: HMAC-SHA256 per-endpoint secret
