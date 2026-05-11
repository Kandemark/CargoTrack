# CargoTrack Deployment Guide

## Deployment Architecture

CargoTrack supports multiple deployment targets:
- **Local development**: Docker Compose (full stack or sandbox)
- **Production**: Docker Compose with Traefik + Let's Encrypt
- **Kubernetes**: K8s manifests in `deploy/kubernetes/`
- **Cloud infrastructure**: Terraform IaC in `deploy/terraform/`

---

## Docker Compose Deployment

### Full Production Stack

The main `docker-compose.yml` defines 30+ services:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Sandbox (Lightweight Dev)

```bash
docker compose -f docker-compose.sandbox.yml up -d
docker compose -f docker-compose.sandbox.yml run backend python manage.py seed_demo
```

### Service Dependencies

```
coturn (TURN/STUN) — standalone, host network
pgBouncer → db (PostgreSQL)
kafka (KRaft mode) — standalone
schema-registry → kafka
kafka-ui → kafka, schema-registry
db (PostgreSQL + TimescaleDB) — standalone
backend (Django) → db, redis
elixir-ws (Phoenix) → redis
go-tracking → db
emqx (MQTT) — standalone
gps-ingest (Rust) → emqx, kafka
notification (Go) → kafka
webhook-dispatcher (Go) → kafka
route-optimizer (Rust) — standalone gRPC
workflow-engine (Java) → db, kafka
edi-integration (Java) → kafka
keycloak — standalone (imports realm)
traefik → backend, web, keycloak, elixir-ws, go-tracking, workflow-engine, edi-integration
prometheus — standalone (scrapes targets)
grafana → prometheus, loki
jaeger — standalone (OTLP collector)
loki — standalone (log storage)
promtail → loki
minio — standalone (S3-compatible)
postgres-exporter → db
redis-exporter → redis
web (React/Vite) → backend
```

### Named Volumes

| Volume | Purpose |
|---|---|
| `postgres_data` | PostgreSQL data (persistent) |
| `redis_data` | Redis snapshots |
| `kafka_data` | Kafka log segments |
| `emqx_data` | EMQX MQTT state |
| `letsencrypt` | TLS certificates |
| `prometheus_data` | Time-series metrics (15-day retention) |
| `grafana_data` | Dashboard configs |
| `loki_data` | Log storage |
| `minio_data` | S3-compatible object storage |

---

## Kubernetes Deployment

Kustomize-based manifests in `deploy/kubernetes/`:

```
deploy/kubernetes/
├── base/                   # Shared base configuration
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── configmap.yaml
│   └── secrets.yaml
└── services/               # Per-service overlays
    ├── api/
    ├── web/
    ├── tracking-ingest/
    ├── gps-ingest/
    ├── notification/
    ├── webhook-dispatcher/
    ├── route-optimizer/
    ├── workflow-engine/
    ├── edi-integration/
    └── ws/
```

Apply base configuration:
```bash
kubectl apply -k deploy/kubernetes/base
```

Apply specific service:
```bash
kubectl apply -k deploy/kubernetes/services/api
```

---

## Terraform Infrastructure

Infrastructure as Code in `deploy/terraform/`:

| File | Purpose |
|---|---|
| `main.tf` | Primary infrastructure definition (compute, networking, database) |
| `variables.tf` | Input variable declarations |
| `outputs.tf` | Output value definitions |

---

## API Gateway (Traefik)

Configuration in `deploy/traefik/`:

- `traefik.yml` — Static configuration (entrypoints, providers, dashboard)
- `dynamic/` — Dynamic routing rules, middleware chains

Features:
- TLS termination with Let's Encrypt auto-renewal
- Rate limiting middleware
- Path-based routing to backend services
- WebSocket support
- gRPC passthrough
- Dashboard on port 8082

---

## Identity Provider (Keycloak)

Realm configuration in `deploy/keycloak/cargotrack-realm.json`.

The realm is imported at startup (`--import-realm` flag). It pre-configures:
- OIDC client (`cargotrack-api`)
- Realm roles mapped to CargoTrack's 9 user roles
- SSO session settings
- Token policies

---

## Monitoring Stack

### Prometheus (`deploy/prometheus/`)
- `prometheus.yml` — Scrape configuration for all services
- `rules/` — Alerting rules (SLI/SLO thresholds)

### Grafana (`deploy/grafana/`)
- `provisioning/` — Datasource and dashboard provider configs
- `dashboards/` — Pre-built dashboard JSON files

### Loki + Promtail (`deploy/loki/`, `deploy/promtail/`)
- Centralized log aggregation from all Docker containers
- Promtail collects Docker container logs and forwards to Loki

---

## Coturn TURN/STUN Server

Configuration at `coturn/turnserver.conf`.

Used for WebRTC video calls in the chat system. Deployed with host network mode for direct UDP access.

---

## Environment-Specific Configuration

### Development
```env
DEBUG=True
ALLOWED_HOSTS=*
DB_HOST=db
OIDC_ENABLED=true
```

### Production
```env
DEBUG=False
ALLOWED_HOSTS=cargotrack.io,api.cargotrack.io
DB_HOST=<managed-db-host>
OIDC_ENABLED=true
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
```

When `DEBUG=False`, the following are automatically enabled:
- SSL redirect
- HSTS (1 year, include subdomains, preload)
- Secure session/CSRF cookies
- JSON-only API responses (no browsable API)

---

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

### `ci.yml` — Continuous Integration
Triggered on push/PR to `main`. Runs:
- Backend tests (pytest)
- Frontend lint (ESLint)
- Frontend type check (TypeScript)
- Go build verification
- Rust build verification

### `deploy.yml` — Continuous Deployment
Triggered on merge to `main`. Handles:
- Docker image builds
- Image push to container registry
- Kubernetes manifest updates
- Deployment rollout

---

## Database Migrations

In Docker, migrations run automatically on backend startup:
```yaml
command: >
  sh -c "python manage.py migrate &&
         daphne -b 0.0.0.0 -p 8000 cargotrack.asgi:application"
```

Manual migration:
```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py makemigrations
```

Migrations are regenerated per-environment (`**/migrations/0*.py` in `.gitignore`).

---

## Backup Strategy

Key persistent data:
- **PostgreSQL**: `postgres_data` volume — use `pg_dump` for logical backups
- **Redis**: `redis_data` volume — append-only file persistence
- **Kafka**: `kafka_data` volume — log segments with 168-hour retention
- **MinIO**: `minio_data` volume — S3-compatible object storage

---

## Scaling Considerations

- **Django API**: Horizontally scalable behind Traefik load balancer. Use pgBouncer for connection pooling.
- **Kafka**: Single broker in dev, multi-broker cluster in production
- **Phoenix WS**: Multi-node with Redis PubSub for message distribution
- **Go services**: Stateless, horizontally scalable
- **Rust services**: CPU-bound, scale based on load
- **PostgreSQL**: TimescaleDB extension supports automatic time-based partitioning for hypertables
