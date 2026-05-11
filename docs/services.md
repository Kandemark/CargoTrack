# CargoTrack Microservices

## Service Inventory

CargoTrack uses a polyglot microservices architecture with services written in Python, Go, Rust, Java, and Elixir.

---

## 1. Django API (`services/api/`) — Python

**Role**: Core business logic, REST API, ML predictions, admin interface.

**Stack**: Django 4.2 + Django REST Framework + Daphne ASGI + PostgreSQL + Redis + Kafka

**Key Files**:
- `cargotrack/settings.py` — Environment-aware settings with decouple, JWT, OIDC, CORS, ML thresholds
- `cargotrack/urls.py` — Root URL router (auth, API versions, SPA catch-all, OpenAPI docs)
- `cargotrack/api_urls.py` — Versioned API router mounting all domain app URLs
- `cargotrack/authentication.py` — CookieJWTAuthentication (httpOnly cookie + Bearer header fallback)
- `cargotrack/permissions.py` — Granular role-based permission classes
- `cargotrack/authz.py` — Authorization shortcuts (CanViewShipments, CanDispatchShipments, etc.)
- `cargotrack/roles.py` — UserRole enum with 9 roles
- `cargotrack/middleware.py` — TenantMiddleware for multi-tenant isolation
- `cargotrack/encryption.py` — EncryptedTextField using AES-256-GCM
- `cargotrack/csp.py` — Content Security Policy middleware
- `cargotrack/oidc.py` — Keycloak OIDC configuration
- `cargotrack/streams.py` — Kafka producer/consumer integration
- `cargotrack/cache.py` — Redis cache helpers + dashboard cache invalidation
- `cargotrack/async_cache.py` — AsyncCacheMixin for view-level caching
- `cargotrack/tracing.py` — OpenTelemetry tracing setup
- `cargotrack/consumers.py` — Django Channels WebSocket consumers
- `cargotrack/routing.py` — WebSocket URL routing
- `cargotrack/health.py` — Health check endpoint

**Management Commands**:
- `audit_encryption` — Verify/audit encryption key configuration
- `stream_worker` — Kafka stream consumer worker
- `webhook_inspector` — Local webhook testing tool with replay capability
- `train_model` — Train delay prediction RandomForest model
- `train_demand` — Train demand forecasting model
- `train_pricing` — Train dynamic pricing model
- `train_theft` — Train theft risk model
- `generate_training_data` — Generate synthetic training data for ML
- `seed_demo` — Load demo data for development
- `seed_kande` — Custom seed data

### Domain Apps

#### accounts — User Management & Auth
- **Models**: CustomUser (9 roles), UserProfile, APIKey, Notification, AuditEntry, Integration, Organization
- **API**: `/api/v1/accounts/me/`, `/api/v1/accounts/users/`, `/api/v1/accounts/organizations/`
- **Features**: TOTP 2FA setup/verify/disable, session management, API key management, data export (GDPR), account deletion, user activity timeline, security log, notification preferences

#### shipments — Core Shipment Management
- **Models**: Route, Shipment (dual state machine: status + dispatch_status), Document, ComplianceDoc, DocumentExtraction
- **API**: `/api/v1/shipments/`, `/api/v1/routes/`, `/api/v1/documents/extract/`, `/api/v1/compliance/`
- **Features**: Tracking number auto-generation (CT-YYYYMMDD-XXXX), dispatch state machine (UNASSIGNED→OFFERED→ACCEPTED→DISPATCHED), ML delay prediction offloaded to thread pool, OCR document extraction (8 document types), customs declaration submission, ETA engine, analytics (profit, route, carrier, corridor, customer, temporal, bid), CSV export, SLA compliance, carbon emissions

#### tracking — Event Logging
- **Models**: TrackingEvent (7 event types: DEPARTURE, CHECKPOINT, CUSTOMS_ENTRY, CUSTOMS_CLEAR, ARRIVAL, DELAY, NOTE)
- **API**: `/api/v1/tracking/events/`, `/api/v1/tracking/<tracking_number>/events/`

#### alerts — Alert Management
- **Models**: Alert (with severity pipeline: CRITICAL≥0.85, HIGH≥0.70, MEDIUM≥0.50, LOW<0.50)
- **API**: `/api/v1/alerts/`, `/api/v1/alerts/<id>/acknowledge/`
- **Handlers**: InAppAlertHandler (Notification record), EmailAlertHandler (SMTP)

#### fleet — Fleet Management
- **Models**: Truck, Driver, JobHistory
- **API**: `/api/v1/fleet/`
- **Features**: Driver leaderboard, performance metrics, license tracking

#### carriers — Carrier Management
- **Models**: Carrier, RateCard
- **API**: `/api/v1/carriers/`

#### payments — Payment Processing
- **Models**: Invoice, Payment
- **API**: `/api/v1/invoices/`, `/api/v1/payments/`
- **Providers**: M-Pesa, Airtel Money, MTN Mobile Money, Stripe, Flutterwave, Pesapal

#### marketplace — Freight Marketplace
- **Models**: FreightListing, Bid
- **API**: `/api/v1/marketplace/listings/`, `/api/v1/marketplace/bids/`

#### chats — Messaging
- **Models**: Conversation, Message
- **API**: `/api/v1/chat/`
- **WebSocket**: Real-time message delivery via Django Channels

#### pod — Proof of Delivery
- **Models**: ProofOfDelivery (signature, photo, GPS coordinates)
- **API**: `/api/v1/pod/`

#### coldchain — Cold Chain Monitoring
- **Models**: ColdChainShipment, TemperatureReading, TemperatureExcursion, ColdChainSLA, ColdChainCertificate
- **API**: `/api/v1/coldchain/`
- **Features**: Mean Kinetic Temperature (MKT) calculation per USP <1079>, GDP compliance reports, excursion management (WARNING→BREACH→CRITICAL→SPOILAGE_ALERT), digital certificates

#### predictions — ML Endpoints
- **API**: `/api/v1/predictions/delay/`, `/api/v1/predictions/demand/`, `/api/v1/predictions/pricing/`, `/api/v1/predictions/theft-risk/`, `/api/v1/predictions/driver-score/`, `/api/v1/predictions/border-delay/`

### ML Pipeline (`cargotrack/ml/`)
- `delay_predictor.py` — RandomForestClassifier/XGBoost delay prediction with FeatureEngineer
- `feature_engineer.py` — Feature extraction (distance, weight, hour/day/month, route encoding, tracking events, customs stops)
- `demand_forecaster.py` — Demand forecasting model
- `dynamic_pricing.py` — Dynamic pricing recommendation engine
- `theft_risk.py` — Cargo theft risk scoring
- `driver_scoring.py` — Driver performance scoring model
- `border_delay.py` — Border crossing delay prediction
- `container_matching.py` — Container consolidation optimization (PyO3 bridge to Rust)
- `fuel_optimizer.py` — Fuel stop optimization (PyO3 bridge to Rust)

### OCR Pipeline (`shipments/ocr/`)
- `engine.py` — OCRPipeline: preprocessing (grayscale→threshold→deskew→denoise), Tesseract OCR, EAC-specific word lists
- `classifier.py` — Document type classification (8 types: B/L, Customs Declaration, Invoice, CMR, Scale Ticket, Packing List, Insurance, Phytosanitary)
- `extractors/bol.py` — Bill of Lading field extraction
- `extractors/customs.py` — Customs declaration field extraction
- `extractors/invoice.py` — Commercial invoice field extraction
- `extractors/cmr.py` — CMR consignment note extraction
- `extractors/scale_ticket.py` — Weighbridge scale ticket extraction

### Domain Layer (`domains/`)
Cross-cutting domain modules that import from apps rather than apps importing from each other:
- `analytics.py` — Analytics views (general, profit, route, carrier benchmark, corridor, customer, temporal, performance, driver leaderboard, bid)
- `shipments.py` — Cross-cutting shipment views (customs, ETA, documents, compliance)
- `finance.py` — Currency conversion, tax summary, invoice calculation
- `contracts.py` — Rate lookup and contract vs spot comparison
- `ports.py` — Demurrage calculation and port status
- `identity.py` — Audit log, integrations, notifications
- `customs.py`, `documents.py`, `fleet.py`, `partners.py`, `coldchain.py`, `communications.py`
- `_value_objects.py` — Shared value objects
- `_tenants.py` — Multi-tenant isolation logic
- `_authz.py` — Authorization enforcement
- `_abac.py` — Attribute-based access control
- `_events.py` — Domain event definitions

### Library Modules

#### demurrage
- `calculator.py` — Tiered tariff escalation for 5 EAC ports (KEMBA, TZDAR, KENBO, UGKAM, RWKGL), 4 container types, demurrage + detention + storage charges, responsibility attribution

#### contracts
- `services.py` — Rate card matching, tiered pricing (volume discounts), contract vs spot comparison, 9 EAC corridors with rates

#### finance
- `services.py` — Multi-currency conversion (KES, TZS, UGX, RWF, BIF, USD, EUR, GBP), EAC tax rates (VAT: 16-18%, WHT: 5-6%), invoice calculation with tax breakdown, fuel surcharge

---

## 2. Phoenix WebSocket Server (`services/ws/`) — Elixir

**Role**: Real-time bidirectional communication via WebSocket channels.

**Stack**: Elixir + Phoenix Framework + Redis PubSub

**Features**:
- `tracking:<tracking_number>` — Live GPS position updates
- `shipment:<id>` — Shipment state changes
- `alert:<id>` — New alert notifications
- `chat:<room_id>` — Real-time chat messages

**Config**: `config/` directory, Redis-backed PubSub for multi-node message distribution

---

## 3. Tracking Ingest Service (`services/tracking-ingest/`) — Go

**Role**: Batch GPS tracking data ingestion with PostgreSQL COPY protocol for high throughput.

**Stack**: Go + PostgreSQL + Kafka

**Port**: 8080 (internal), mapped to 8086

**Structure**:
- `cmd/` — Main server entry point
- `internal/` — Business logic (ingestion, database, models)

---

## 4. GPS Telematics Ingestion (`services/gps-ingest/`) — Rust

**Role**: Real-time GPS data ingestion from IoT devices via MQTT, transformed and published to Kafka with geofence detection.

**Stack**: Rust (tokio, rumqttc, rdkafka, geo, prost, tonic)

**Flow**: EMQX MQTT Broker → gps-ingest → Kafka topics (`cargotrack.gps.positions`, `cargotrack.gps.geofence`)

**Dependencies**:
- `rumqttc` 0.24 — MQTT client for EMQX
- `rdkafka` 0.36 — Kafka producer (librdkafka C++ bindings)
- `geo` 0.28 — Geospatial calculations (geofencing)
- `prost` + `tonic` — Protobuf/gRPC support
- `tracing` — Structured logging with JSON output

---

## 5. Route Optimization Engine (`services/route-optimizer/`) — Rust

**Role**: TSP (Traveling Salesman Problem) and MVRP (Multi-Vehicle Route Planning) solver exposed via gRPC.

**Stack**: Rust (tokio, tonic gRPC, geo, lru cache)

**Port**: 50051 (internal), mapped to 50052

**Features**:
- gRPC API defined via Protobuf (`proto/`)
- LRU cache (capacity 1024) for repeated route queries
- SHA-256 content addressing for cache keys
- Build script (`build.rs`) compiles protobuf definitions

---

## 6. Notification Dispatch Service (`services/notification/`) — Go

**Role**: Multi-channel notification dispatcher consuming from Kafka.

**Stack**: Go + Kafka consumer + multiple notification providers

**Channels**:
- **Push**: Firebase Cloud Messaging (FCM)
- **Email**: SMTP (MailHog in dev)
- **SMS**: Africa's Talking API, Twilio
- **WhatsApp**: WhatsApp Business API
- **USSD**: Africa's Talking USSD gateway (*384# driver self-service portal)
- **Voice**: Africa's Talking Voice API (text-to-speech alerts)
- **Airtime**: Africa's Talking Airtime API (driver incentives)

**Structure**:
- `main.go` + `config.go` — Service entry point and configuration
- `consumer/` — Kafka consumer with message routing
- `dispatcher/` — Template engine, message dispatch with retry
- `providers/` — FCM, Email, SMS, WhatsApp, Africa's Talking client
- `ratelimit/` — Per-user rate limiting (10/min, 100/hr)
- `ussd/` — USSD menu server for driver self-service

**18 SMS Templates**: Shipment assigned/departed/arrived/delayed, border crossing, payment, fleet alerts (fuel, maintenance, geofence), cold chain excursions, marketplace bid results

**USSD Menu Tree** (*384#):
```
1. My Shipments → Pending / In Transit / Delivered
2. Update Status → Departure / Arrival / Border Check-in / Report Delay
3. Request Assistance → Breakdown / Security / Medical
4. My Account → Earnings / Profile
```

---

## 7. Webhook Dispatcher Service (`services/webhook-dispatcher/`) — Go

**Role**: Reliable outbound webhook delivery with exponential backoff and circuit breakers.

**Stack**: Go + Kafka consumer + HMAC-SHA256 signing

**Structure**:
- `main.go` + `config.go` — Service entry point and configuration
- `consumer/` — Kafka consumer + registration store
- `dispatcher/` — HTTP dispatcher with HMAC signing
- `retry/` — Custom backoff schedule (1m → 5m → 15m → 1h → 6h → 24h → DLQ)
- `circuitbreaker/` — Per-endpoint circuit breaker

**Event Types Delivered**: `shipment.state_changed`, `shipment.delayed`, `shipment.delivered`, `gps.position_changed`, `alert.triggered`, `payment.received`, `documents.created`, `marketplace.bid_placed`

---

## 8. Workflow Engine (`services/workflow-engine/`) — Java

**Role**: BPMN 2.0 business process automation with DMN decision tables.

**Stack**: Java 21 + Spring Boot 3.4 + Camunda 7.21 + PostgreSQL + Kafka

**Port**: 8084

**Dependencies**:
- Camunda BPM Spring Boot Starter (REST + Webapp)
- Camunda Spin JSON data format
- Spring Kafka for event-driven process triggers
- PostgreSQL for process instance persistence

---

## 9. EDI Integration Gateway (`services/edi-integration/`) — Java

**Role**: Electronic Data Interchange gateway connecting to East African customs systems.

**Stack**: Java 21 + Spring Boot 3.4 + Apache Camel 4.4 + Kafka

**Port**: 8085

**Protocols Supported**:
- **EDIFACT**: CUSCAR (customs cargo manifest), CUSDEC (customs declaration)
- **ANSI X12**: 309 (customs manifest), 310 (freight receipt)
- **UBL 2.1**: Universal Business Language
- **XML**: Customs-specific XML schemas

**Transports**:
- AS2 (Applicability Statement 2)
- SFTP (Secure File Transfer)
- HTTPS with mTLS
- OFTP2 (Odette File Transfer Protocol)

**Customs Systems**:
| System | Country | Protocol | Transport |
|---|---|---|---|
| TradeNet (KenTrade) | Kenya | SOAP XML | HTTPS + mTLS |
| ASYCUDA World (UNCTAD) | Uganda, Rwanda, Burundi, S. Sudan, DRC | EDIFACT CUSCAR/CUSDEC | SFTP + AS2 |
| TANCIS (TRA) | Tanzania | XML | REST + OAuth2 |

**Camel Components**: Bindy (fixed-width), JAXB (XML), Jackson (JSON), HTTP, FTP, AS2, Kafka

---

## 10. Container Matcher (`services/container-matcher/`) — Rust/PyO3

**Role**: Container consolidation optimization algorithm compiled as a Python extension module.

**Stack**: Rust + PyO3 (Python binding)

**Build Output**: `container_matcher_rs.dll/.so/.dylib` → loaded by `cargotrack/ml/_container_matcher_rs.py`

---

## 11. Fuel Optimizer (`services/fuel-optimizer/`) — Rust/PyO3

**Role**: Fuel stop optimization algorithm compiled as a Python extension module.

**Stack**: Rust + PyO3 (Python binding)

**Build Output**: `fuel_optimizer_rs.dll/.so/.dylib` → loaded by `cargotrack/ml/_fuel_optimizer_rs.py`

---

## Service Port Map

| Service | Internal Port | External Port | Protocol |
|---|---|---|---|
| Django API (Daphne) | 8000 | 8000 | HTTP/WS |
| Phoenix WebSocket | 4000 | 4000 | WebSocket |
| Go Tracking Ingest | 8080 | 8086 | HTTP |
| EMQX MQTT | 1883 | 1883 | MQTT |
| EMQX Dashboard | 18083 | 18083 | HTTP |
| EMQX WebSocket | 8083 | 8083 | WebSocket |
| Rust Route Optimizer | 50051 | 50052 | gRPC |
| Java Workflow Engine | 8084 | 8084 | HTTP |
| Java EDI Gateway | 8085 | 8085 | HTTP |
| Keycloak | 8080 | 8080 | HTTP |
| Traefik | 80/443 | 80/443 | HTTP/HTTPS |
| Traefik Dashboard | 8080 | 8082 | HTTP |
| PostgreSQL | 5432 | 5432 | TCP |
| pgBouncer | 6432 | 6432 | TCP |
| Redis | 6379 | 6379 | TCP |
| Kafka | 9092 | 9092 | TCP |
| Schema Registry | 8081 | 8081 | HTTP |
| Kafka UI | 8080 | 8088 | HTTP |
| Prometheus | 9090 | 9090 | HTTP |
| Grafana | 3000 | 3000 | HTTP |
| Jaeger UI | 16686 | 16686 | HTTP |
| Jaeger OTLP gRPC | 4317 | 4317 | gRPC |
| Jaeger OTLP HTTP | 4318 | 4318 | HTTP |
| Loki | 3100 | 3100 | HTTP |
| MinIO S3 | 9000 | 9000 | HTTP |
| MinIO Console | 9001 | 9001 | HTTP |
| Postgres Exporter | 9187 | 9187 | HTTP |
| Redis Exporter | 9121 | 9121 | HTTP |
| React/Vite Dev | 5173 | 5173 | HTTP |
