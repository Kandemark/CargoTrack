# CargoTrack Architecture

## Overview

CargoTrack is a polyglot logistics backbone for East African freight corridors. It serves shippers, carriers, customs brokers, fleet managers, and drivers with real-time tracking, document processing, customs integration, and financial management across Kenya, Tanzania, Uganda, Rwanda, Burundi, and neighboring countries.

## Repository Layout

```
cargotrack/
├── services/              # Backend services (polyglot)
│   ├── api/               # Django REST API (Python) — core business logic
│   ├── ws/                # Phoenix WebSocket server (Elixir)
│   ├── tracking-ingest/   # GPS tracking batch ingestion (Go)
│   ├── gps-ingest/        # Real-time GPS telematics (Rust)
│   ├── route-optimizer/   # Route optimization TSP/MVRP solver (Rust)
│   ├── notification/      # Push/SMS/Email/USSD notification dispatcher (Go)
│   ├── webhook-dispatcher/# External webhook fan-out (Go)
│   ├── workflow-engine/   # BPMN state machines — Camunda (Java)
│   ├── edi-integration/   # EDI/EDIFACT gateway — Apache Camel (Java)
│   ├── container-matcher/ # Container consolidation optimizer (Rust/PyO3)
│   └── fuel-optimizer/    # Fuel stop optimizer (Rust/PyO3)
├── apps/                  # Client applications
│   ├── web/               # React SPA (TypeScript, Vite)
│   └── mobile/            # Mobile app (Expo/React Native)
├── libs/                  # Shared libraries
│   ├── shared-types/      # TypeScript type definitions
│   ├── proto/             # Protobuf/gRPC service definitions
│   ├── api-client/        # TypeScript API client
│   └── rust-core/         # Shared Rust types and utilities
├── deploy/                # Infrastructure as Code
│   ├── docker-compose/    # Docker composition files
│   ├── kubernetes/        # K8s manifests
│   ├── terraform/         # Terraform IaC
│   ├── traefik/           # API Gateway configuration
│   ├── keycloak/          # Identity provider realm export
│   ├── prometheus/        # Metrics scraping configuration
│   ├── grafana/           # Dashboard provisioning
│   ├── loki/              # Log aggregation configuration
│   └── promtail/          # Log collector configuration
├── scripts/               # Development tooling (dev.ps1)
├── docs/                  # This documentation
├── Makefile               # Build orchestration
├── docker-compose.yml     # Production deployment
└── docker-compose.sandbox.yml  # Development sandbox
```

## Technology Stack

| Layer | Technology | Language | Purpose |
|---|---|---|---|
| API Gateway | Traefik | Go | TLS termination, rate limiting, routing |
| Identity | Keycloak | Java | OAuth2/OIDC, SSO, 2FA |
| Business Logic | Django + DRF | Python | CRUD, admin, reporting, ML |
| Real-time | Phoenix | Elixir | WebSocket, LiveView, presence |
| Event Bus | Kafka | Java | Event streaming, replay |
| Workflow | Camunda | Java | BPMN state machines, DMN decisions |
| EDI Gateway | Apache Camel | Java | EDIFACT, ANSI X12, XML customs |
| Tracking | Go | Go | Batch ingestion with PostgreSQL COPY |
| GPS | Rust | Rust | MQTT → Kafka, geofencing |
| Route Opt | Rust | Rust | OR-Tools TSP/MVRP solving |
| Notification | Go | Go | Push/SMS/Email/USSD/Voice |
| Webhooks | Go | Go | Fan-out with circuit breakers |
| ML | scikit-learn/XGBoost | Python | Delay, pricing, theft, demand |
| Database | PostgreSQL + TimescaleDB | C | Time-series + relational |
| Cache | Redis | C | Caching, rate limiting, sessions |
| Monitoring | Prometheus + Grafana + Jaeger + Loki | Go | Metrics, dashboards, tracing, logging |
| Frontend | React + Vite | TypeScript | SPA |
| Mobile | Expo SDK | TypeScript | Cross-platform mobile |

## Inter-Service Communication

```
                     ┌──────────────────┐
                     │   API Gateway    │
                     │    (Traefik)     │
                     └────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐         ┌─────▼──────┐        ┌─────▼──────┐
   │ Django  │◄─REST──►│  Phoenix   │        │  Keycloak  │
   │   API   │         │    WS      │        │   (OIDC)   │
   └────┬────┘         └────────────┘        └────────────┘
        │
   ┌────▼────┐     ┌──────────┐     ┌──────────┐
   │  Kafka  │◄───►│  Camel   │────►│ TradeNet │
   │ (Event  │     │   EDI    │     │ ASYCUDA  │
   │  Bus)   │     │ Gateway  │     │  TANCIS  │
   └────┬────┘     └──────────┘     └──────────┘
        │
   ┌────▼────┐  ┌───────────┐  ┌──────────────┐
   │   Go    │  │   Rust    │  │     Rust      │
   │ Notify  │  │ GPS Ingest│  │ Route Optimizer│
   └─────────┘  └───────────┘  └──────────────┘
```

## Django API App Structure

The Django API (`services/api/`) is organized into domain apps:

| App | Purpose | Has Models |
|---|---|---|
| `accounts` | Custom user model, JWT auth, 2FA, notifications | Yes |
| `shipments` | Core shipment & route CRUD, OCR, customs, ETA, finance, rates, demurrage | Yes |
| `tracking` | Tracking event logging and querying | Yes |
| `alerts` | Delay alerts and notification pipeline | Yes |
| `dashboard` | Aggregated KPI views | No |
| `predictions` | ML prediction endpoints (delay, pricing, theft, demand) | No |
| `payments` | Invoice, payment gateway integrations (M-Pesa, Airtel, MTN) | Yes |
| `fleet` | Truck and driver fleet management | Yes |
| `carriers` | Carrier company profiles and rate cards | Yes |
| `chats` | Real-time messaging and video calls | Yes |
| `marketplace` | Freight marketplace and job board | Yes |
| `pod` | Digital proof of delivery | Yes |
| `coldchain` | Cold chain temperature monitoring and GDP compliance | Yes |
| `demurrage` | Demurrage and detention calculator (library module) | Yes |
| `contracts` | Contract and rate management (library module) | Yes |
| `finance` | Multi-currency financial calculations (library module) | Yes |

## Key Design Decisions

1. **Polyglot by strength**: Each language is chosen for its specific strength — Rust for CPU-bound GPS/optimization, Go for concurrent I/O, Java for enterprise integration, Python for ML and rapid feature development, Elixir for real-time WebSocket.

2. **Event-driven core**: Kafka serves as the central nervous system. All state changes flow through Kafka topics, enabling replay, audit, and loose coupling.

3. **REST at the edge, gRPC internally**: External API is REST (via DRF + Traefik). Internal service communication uses gRPC (route optimizer) or Kafka event streams.

4. **Offline-first mobile**: The mobile app uses local storage (Room/AsyncStorage) with background sync. USSD (*384#) provides access for feature phones.

5. **EAC-first design**: Customs integrations target TradeNet (Kenya), ASYCUDA World (Uganda/Rwanda/Burundi), and TANCIS (Tanzania). Border crossings, currencies, and tax rules are EAC-specific.
