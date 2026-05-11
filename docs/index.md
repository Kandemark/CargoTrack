# CargoTrack Documentation

**B2B SaaS for real-time freight tracking, ML-powered delay prediction, and logistics management across the East African corridor.**

---

## Getting Oriented

| Doc | Covers |
|---|---|
| [Project Overview](project-overview.md) | Product identity, repo structure, tech stack decisions, key design choices |
| [Architecture](architecture.md) | System diagram, inter-service communication, Kafka event flows, Django app structure, security model |
| [Services](services.md) | All 11 microservices detailed — language, role, key files, ports, environment variables |
| [API Reference](api-reference.md) | 100+ REST endpoints, JWT auth flow, role-based access control, pagination, error codes |
| [Data Models](data-models.md) | Full DB schema across 17 Django apps, field types, role permissions, state machines |
| [Features](features.md) | OCR pipeline, customs integration, USSD, Kalman ETA, multi-currency finance, cold chain, demurrage, ML predictions, marketplace, fleet management |
| [Development](development.md) | Prerequisites, Docker quick start, Makefile targets, env vars, testing, linting, troubleshooting |
| [Deployment](deployment.md) | Docker Compose, Kubernetes manifests, Terraform IaC, monitoring setup, backup strategy |
| [Webhook Events](webhook-events.md) | 8 event types, delivery guarantees, HMAC signing, retry schedule, circuit breaker |

---

## Quick Reference

### Repository Map

```
cargotrack/
├── services/
│   ├── api/                  # Django REST API (Python) — core business logic
│   ├── ws/                   # Phoenix WebSocket server (Elixir)
│   ├── tracking-ingest/      # GPS batch ingestion (Go)
│   ├── gps-ingest/           # Real-time GPS → Kafka (Rust)
│   ├── route-optimizer/      # TSP/MVRP solver via gRPC (Rust)
│   ├── notification/         # Push/SMS/Email/USSD dispatcher (Go)
│   ├── webhook-dispatcher/   # External webhook fan-out (Go)
│   ├── workflow-engine/      # Camunda BPMN workflow engine (Java)
│   └── edi-integration/      # Apache Camel EDI gateway (Java)
├── apps/web/                 # React + Vite frontend
├── libs/shared-types/        # Shared TypeScript types
├── deploy/                   # Traefik, Keycloak, Prometheus, Grafana, Loki, K8s, Terraform
├── docs/                     # This documentation
├── docker-compose.yml        # Full production stack (30+ services)
├── docker-compose.sandbox.yml # Lightweight dev environment
└── Makefile                  # 30+ convenience targets
```

### Key Ports

| Service | Port | Dashboard |
|---|---|---|
| Django API | 8000 | — |
| React Frontend | 5173 | http://localhost:5173 |
| Keycloak | 8080 | http://auth.cargotrack.localhost:8080 |
| Traefik Dashboard | 8082 | http://localhost:8082 |
| Kafka | 9092 | http://localhost:8088 (Kafka UI) |
| Schema Registry | 8081 | — |
| EMQX MQTT | 1883 (tcp), 8083 (ws) | http://localhost:18083 |
| Grafana | 3000 | http://localhost:3000 (admin/admin) |
| Prometheus | 9090 | http://localhost:9090 |
| Jaeger | 16686 | http://localhost:16686 |
| MinIO | 9000 (api), 9001 (console) | http://localhost:9001 |
| Redis | 6379 | — |
| PostgreSQL | 5432 | — |

### Quick Start

```bash
cp .env.example .env
docker compose up -d
# or for lightweight dev:
docker compose -f docker-compose.sandbox.yml up -d
```

---

## Architecture at a Glance

```
Client → Traefik (:80/:443) → Django API (:8000) → PostgreSQL + TimescaleDB
                            → Phoenix WS (:4000)
                            → Keycloak (:8080)
                            → Go Tracking (:8086)
                            → Workflow Engine (:8084)
                            → EDI Integration (:8085)

IoT Devices → EMQX MQTT (:1883) → Rust GPS Ingest → Kafka → Django API
                                                          → Go Notification
                                                          → Go Webhook Dispatcher

Kafka Topics:
  cargotrack.gps.positions    cargotrack.shipments.state
  cargotrack.gps.geofence     cargotrack.tracking.events
  cargotrack.alerts.triggered cargotrack.notifications
```
