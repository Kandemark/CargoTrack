# CargoTrack

**B2B SaaS for real-time freight tracking, ML-powered delay prediction, and logistics management across East Africa.**

CargoTrack connects freight forwarders, 3PLs, carriers, importers, customs brokers, and port agents across Kenya, Uganda, Tanzania, Rwanda, and Burundi.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Core API | Django 4.2 + Django REST Framework + Daphne ASGI |
| Database | PostgreSQL 16 + TimescaleDB 2.16 |
| Event Bus | Apache Kafka (KRaft mode) + Schema Registry |
| Cache | Redis 7 |
| Identity | Keycloak 26 (OIDC) |
| API Gateway | Traefik v3 |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS v4 |
| Mobile | Expo (React Native) — development builds, not Expo Go |
| ML | scikit-learn (RandomForestClassifier) + XGBoost |
| Workflow Engine | Java 21 + Camunda 7 (BPMN + DMN) |
| EDI Gateway | Java 21 + Apache Camel (EDIFACT + X12 + AS2) |
| WebSocket | Elixir + Phoenix |
| GPS Ingest | Rust (tokio, rumqttc, rdkafka) |
| Route Optimizer | Rust (tonic gRPC, geo) |
| Notification | Go (Kafka consumer, FCM/Email/SMS/WhatsApp/USSD) |
| Webhook Dispatcher | Go (HMAC-SHA256, exponential backoff) |
| Observability | Prometheus + Grafana + Jaeger + Loki + Promtail |
| Object Storage | MinIO (S3-compatible) |

Full architecture details: [docs/architecture.md](docs/architecture.md)

---

## Quick Start (Docker)

### Prerequisites

- Docker Desktop 24+
- A `.env` file in the project root

### 1. Create your `.env`

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DEBUG=True
SECRET_KEY=<generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DB_PASSWORD=a-strong-local-password
```

### 2. Build and start

**Sandbox (lightweight dev — recommended for first run):**

```bash
docker compose -f docker-compose.sandbox.yml up -d
```

**Full production stack (30+ services):**

```bash
docker compose up -d
```

Migrations run automatically on backend startup.

### 3. Access the services

| Service | URL |
|---|---|
| React frontend | http://localhost:5173 |
| Django API | http://localhost:8000/api/ |
| Django Admin | http://localhost:8000/admin/ |
| Keycloak Admin | http://localhost:8080 (admin/admin) |
| Traefik Dashboard | http://localhost:8082 |
| Kafka UI | http://localhost:8088 |
| EMQX Dashboard | http://localhost:18083 |
| Grafana | http://localhost:3000 (admin/admin) |
| Jaeger | http://localhost:16686 |
| MinIO Console | http://localhost:9001 |

---

## Makefile Targets

```bash
make up                # docker compose up (foreground)
make down              # stop and remove containers
make build             # rebuild all images
make logs              # tail backend logs
make shell             # Django management shell
make migrate           # run pending migrations
make createsuperuser   # create Django admin account
make seed              # load demo data
make test              # run tests
make check             # run full CI suite (lint, type-check, test)
make lint              # run linters across all languages
make proto             # regenerate gRPC protobuf stubs
make clean             # remove containers, volumes, built assets
make sandbox-up        # start sandbox environment
make sandbox-seed      # seed sandbox with demo data
make train-model       # train ML delay prediction model
```

---

## Local Development (without Docker)

### Backend

```powershell
# Windows
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\scripts\run-dev.ps1
```

```bash
# macOS / Linux
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 cargotrack.asgi:application
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

### Mobile App (Android)

> Requires a development build, not Expo Go (uses native modules for biometrics, maps, notifications).

```bash
cd mobile
npm install
npx expo run:android
```

For EAS cloud builds: `npx eas build --platform android --profile development`

Connect the app to Django:
- **Emulator:** `http://10.0.2.2:8000`
- **Physical device (same WiFi):** `http://<lan-ip>:8000`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | insecure dev key | Django secret — must be rotated in production |
| `DEBUG` | `False` | Enable debug mode |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hostnames |
| `DB_NAME` | `cargotrack` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | *(required)* | PostgreSQL password |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |
| `OIDC_ENABLED` | `true` | Enable Keycloak OIDC |
| `KEYCLOAK_SERVER_URL` | `http://localhost:8080` | Keycloak base URL |
| `JWT_SECRET_KEY` | insecure dev key | JWT signing key for cross-service auth |

---

## API Overview

**Base URL:** `http://localhost:8000` | **Version:** `v1` | **Auth:** JWT Bearer token

```text
POST /api/auth/register/          Create account, returns JWT pair
POST /api/auth/token/             Obtain access + refresh tokens
POST /api/auth/token/refresh/     Rotate refresh token
POST /api/auth/token/logout/      Blacklist refresh token
GET  /api/v1/shipments/           Paginated shipment list
POST /api/v1/shipments/           Create shipment
GET  /api/v1/shipments/<id>/      Shipment detail
POST /api/v1/shipments/<id>/tracking-events/   Log tracking event
GET  /api/v1/dashboard/           KPI summary
GET  /api/v1/alerts/              Alert list
POST /api/v1/predict-delay/       ML delay prediction
```

Full API reference: [docs/api-reference.md](docs/api-reference.md)

---

## Repository Structure

```
cargotrack/
├── services/
│   ├── api/                     # Django REST API — core business logic
│   ├── ws/                      # Phoenix WebSocket server (Elixir)
│   ├── tracking-ingest/         # GPS batch ingestion (Go)
│   ├── gps-ingest/              # Real-time GPS → Kafka (Rust)
│   ├── route-optimizer/         # TSP/MVRP solver via gRPC (Rust)
│   ├── notification/            # Push/SMS/Email/WhatsApp/USSD (Go)
│   ├── webhook-dispatcher/      # External webhook fan-out (Go)
│   ├── workflow-engine/         # Camunda BPMN workflow engine (Java)
│   └── edi-integration/         # Apache Camel EDI gateway (Java)
├── apps/web/                    # React + Vite + TypeScript frontend
├── mobile/                      # Expo React Native mobile app
├── libs/shared-types/           # Shared TypeScript types
├── deploy/                      # Traefik, Keycloak, Prometheus, Grafana, Loki, K8s, Terraform
├── docs/                        # Full documentation → docs/index.md
├── docker-compose.yml           # Full production stack (30+ services)
├── docker-compose.sandbox.yml   # Lightweight sandbox environment
├── Makefile                     # 30+ convenience targets
├── README.md                    # This file
├── CONTRIBUTING.md              # Contribution guidelines
├── LICENSE                      # GNU AGPL v3.0
└── FUNDING.yml                  # Funding configuration
```

---

## Documentation

All detailed documentation lives in [`docs/`](docs/index.md):

| Document | Covers |
|---|---|
| [Index](docs/index.md) | Documentation hub with port map and architecture overview |
| [Project Overview](docs/project-overview.md) | Product identity, design decisions, stack rationale |
| [Architecture](docs/architecture.md) | System diagram, Kafka event flows, security model |
| [Services](docs/services.md) | All microservices detailed with ports, env vars, key files |
| [API Reference](docs/api-reference.md) | 100+ endpoints, JWT auth flow, RBAC |
| [Data Models](docs/data-models.md) | Full DB schemas across 17 Django apps |
| [Features](docs/features.md) | OCR, customs, USSD, ETA, finance, cold chain, ML |
| [Development](docs/development.md) | Setup guide, Makefile targets, troubleshooting |
| [Deployment](docs/deployment.md) | Docker, Kubernetes, Terraform, monitoring |
| [Webhook Events](docs/webhook-events.md) | 8 event types, delivery guarantees, retry schedule |

---

## Running Tests

```bash
# With venv active
pytest tests/ -q

# Inside Docker
docker compose exec backend pytest tests/ -q
```

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).
