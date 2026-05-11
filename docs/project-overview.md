# CargoTrack — Project Overview

**Real-time freight tracking, ML-powered delay prediction, and logistics management for the East African corridor.**

CargoTrack is a B2B SaaS platform connecting freight forwarders, 3PLs, carriers, importers, and customs brokers across Kenya, Uganda, Tanzania, Rwanda, Burundi, and neighboring countries.

---

## Product Identity

- **Product:** CargoTrack
- **Company:** CargoTrack Ltd
- **Target users:** Freight forwarders, 3PLs, importers/exporters, carriers, customs brokers, port agents
- **Tone:** Professional, enterprise-grade (Flexport/ShipBob quality)
- **License:** GNU Affero General Public License v3.0

---

## Repository Structure

```
cargotrack/
├── services/                  # Backend microservices (polyglot)
│   ├── api/                   # Django REST API (Python) — core business logic
│   ├── ws/                    # Phoenix WebSocket server (Elixir)
│   ├── tracking-ingest/       # GPS tracking batch ingestion (Go)
│   ├── gps-ingest/            # Real-time GPS telematics (Rust) — MQTT→Kafka
│   ├── route-optimizer/       # Route optimization TSP/MVRP solver (Rust/gRPC)
│   ├── notification/          # Push/SMS/Email/USSD dispatcher (Go)
│   ├── webhook-dispatcher/    # External webhook fan-out with retries (Go)
│   ├── workflow-engine/       # BPMN state machines — Camunda (Java)
│   ├── edi-integration/       # EDI/EDIFACT gateway — Apache Camel (Java)
│   ├── container-matcher/     # Container consolidation optimizer (Rust/PyO3)
│   └── fuel-optimizer/        # Fuel stop optimizer (Rust/PyO3)
├── apps/                      # Client applications
│   ├── web/                   # React SPA (TypeScript, Vite, Tailwind CSS v4)
│   ├── mobile/                # Mobile app (Expo/React Native, NativeWind)
│   └── shared/                # Platform-agnostic API factories
├── libs/                      # Shared libraries
│   ├── shared-types/          # TypeScript type definitions
│   ├── proto/                 # Protobuf/gRPC service definitions
│   ├── api-client/            # TypeScript API client
│   └── rust-core/             # Shared Rust types and utilities
├── deploy/                    # Infrastructure as Code
│   ├── kubernetes/            # K8s manifests (base + services)
│   ├── terraform/             # Terraform IaC
│   ├── traefik/               # API Gateway configuration
│   ├── keycloak/              # Identity provider realm export
│   ├── prometheus/            # Metrics scraping + alerting rules
│   ├── grafana/               # Dashboard provisioning
│   ├── loki/                  # Log aggregation configuration
│   └── promtail/              # Log collector configuration
├── scripts/                   # Development tooling
├── docs/                      # Existing documentation
├── Makefile                   # Build orchestration
├── docker-compose.yml         # Full production stack (30+ services)
└── docker-compose.sandbox.yml # Lightweight development sandbox
```

---

## Technology Stack

| Layer | Technology | Language | Purpose |
|---|---|---|---|
| API Gateway | Traefik v3.7 | Go | TLS termination, rate limiting, routing |
| Identity | Keycloak 26 | Java | OAuth2/OIDC, SSO, 2FA |
| Business Logic | Django 4.2 + DRF | Python | CRUD, admin, reporting, ML |
| Real-time | Phoenix | Elixir | WebSocket, LiveView, presence |
| Event Bus | Apache Kafka 7.8 | Java | Event streaming, replay, schema registry |
| Workflow | Camunda 7.21 | Java | BPMN state machines, DMN decisions |
| EDI Gateway | Apache Camel 4.4 | Java | EDIFACT, ANSI X12, XML customs |
| Tracking Ingest | Go | Go | Batch ingestion with PostgreSQL COPY |
| GPS Ingest | Rust (rumqttc + rdkafka) | Rust | MQTT → Kafka, geofencing |
| Route Optimizer | Rust (tonic gRPC) | Rust | TSP/MVRP solving with caching |
| Notification | Go | Go | Push/SMS/Email/USSD/Voice |
| Webhooks | Go | Go | Fan-out with circuit breakers, HMAC signing |
| ML | scikit-learn + XGBoost | Python | Delay, pricing, theft, demand prediction |
| Database | PostgreSQL 16 + TimescaleDB 2.16 | C | Time-series + relational |
| Cache | Redis 7 | C | Caching, rate limiting, sessions, Channels |
| MQTT Broker | EMQX 5.10 | Erlang | IoT device connectivity |
| Object Storage | MinIO | Go | S3-compatible document storage |
| Monitoring | Prometheus + Grafana + Jaeger + Loki | Go | Metrics, dashboards, tracing, logging |
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 | TypeScript | SPA |
| Mobile | Expo SDK 54 + React Native 0.81 | TypeScript | Cross-platform mobile |

---

## Key Design Decisions

1. **Polyglot by strength**: Each language chosen for its specific strength — Rust for CPU-bound GPS/optimization, Go for concurrent I/O, Java for enterprise integration, Python for ML and rapid feature development, Elixir for real-time WebSocket.

2. **Event-driven core**: Apache Kafka serves as the central nervous system. All state changes flow through Kafka topics, enabling replay, audit, and loose coupling between services.

3. **REST at the edge, gRPC internally**: External API is REST (via DRF + Traefik). Internal service communication uses gRPC (route optimizer) or Kafka event streams.

4. **Offline-first mobile**: The mobile app uses local storage with background sync. USSD (*384#) provides access for feature phones.

5. **EAC-first design**: Customs integrations target TradeNet (Kenya), ASYCUDA World (Uganda/Rwanda/Burundi), and TANCIS (Tanzania). Border crossings, currencies, and tax rules are EAC-specific.

---

## Quick Links

- [Architecture Deep Dive](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [Microservices](SERVICES.md)
- [Development Guide](DEVELOPMENT.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Data Models](DATA_MODELS.md)
- [Webhook Events](WEBHOOK_EVENTS.md)
- [Features Catalog](FEATURES.md)
