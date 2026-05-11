# CargoTrack Development Guide

## Prerequisites

- Docker Desktop 24+
- Python 3.11+ (for local development)
- Node.js 22+ (for frontend)
- Rust toolchain (for Rust services)
- Go 1.22+ (for Go services)
- Java 21+ / Maven (for Java services)
- Elixir 1.17+ / OTP 27+ (for Phoenix WS)

---

## Quick Start (Docker)

### 1. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
```env
DEBUG=True
SECRET_KEY=<generate-random-key>
DB_PASSWORD=a-strong-local-password
```

### 2. Build and Start

```bash
make build   # First run — builds all Docker images
make up      # Start all services
```

Or without Make:
```bash
docker compose build --no-cache
docker compose up -d
```

### 3. Access Services

| Service | URL |
|---|---|
| React Frontend (Vite) | http://localhost:5173 |
| Django API | http://localhost:8000/api/ |
| Django Admin | http://localhost:8000/admin/ |
| Kafka UI | http://localhost:8088 |
| Grafana | http://localhost:3000 |
| Jaeger UI | http://localhost:16686 |
| EMQX Dashboard | http://localhost:18083 |
| MinIO Console | http://localhost:9001 |
| Traefik Dashboard | http://localhost:8082 |
| Keycloak Admin | http://localhost:8080 |

### 4. Sandbox Environment (Lightweight)

For a minimal dev setup with synthetic data:

```bash
make sandbox              # Start sandbox services
make seed-sandbox         # Load demo data
```

Or manually:
```bash
docker compose -f docker-compose.sandbox.yml up -d
docker compose -f docker-compose.sandbox.yml exec backend python manage.py seed_demo
```

---

## Local Development (Without Docker)

### Backend (Windows PowerShell)

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r services/api/requirements.txt
.\scripts\run-dev.ps1
```

The script automatically:
- Opens Windows Firewall for inbound TCP port 8000
- Applies pending database migrations
- Detects and prints LAN IP addresses (for mobile app connection)
- Starts Daphne ASGI on `0.0.0.0:8000`

### Backend (macOS / Linux)

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r services/api/requirements.txt
cd services/api
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 cargotrack.asgi:application
```

### Frontend (React Web App)

```bash
cd apps/web
npm install
npm run dev
```

### Mobile App (React Native / Expo)

```bash
cd apps/mobile
npm install
npx expo run:android
```

The mobile app requires a development build (not Expo Go) due to native modules (biometrics, maps, notifications).

---

## Makefile Targets

### Docker Compose

```bash
make up                # docker compose up (foreground)
make down              # stop and remove containers
make build             # rebuild all images from scratch
make build-no-cache    # rebuild without layer cache
make logs              # tail backend logs
```

### Django Management

```bash
make shell             # Django management shell
make migrate           # run pending migrations
make makemigrations    # create new migrations
make createsuperuser   # create Django admin account
make seed              # load demo data
make schema            # regenerate OpenAPI schema
make audit             # audit encryption config
```

### ML Model Training

```bash
make train-demand      # train demand forecasting model
make train-theft       # train theft risk model
make train-pricing     # train dynamic pricing model
make generate-training-data  # generate synthetic training data
make train-model       # train delay prediction model
```

### Testing

```bash
make test              # run API + Go tests
make test-api          # Django API tests (pytest)
make test-go           # Go service tests
make test-rust         # Rust service tests
make test-ws           # Elixir WS tests
make test-web          # Frontend lint check
```

### Native Builds (No Docker)

```bash
make build-tracking-native     # build Go tracking service
make build-ws-native           # build Elixir WS
make build-gps-native          # build Rust GPS ingest (release)
make build-notification-native # build Go notification service
make build-webhook-native      # build Go webhook dispatcher
```

### Full Verification

```bash
make check             # Django check + Go build + Rust check
make lint              # API (ruff) + Web (eslint) linting
make proto             # regenerate Protobuf code
make clean             # remove build artifacts
```

---

## Frontend Development

### Web App (`apps/web/`)

**Stack**: React 19 + TypeScript 6 + Vite 8 + Tailwind CSS v4 + React Router 7

**Key Dependencies**:
- `@radix-ui/react-*` — Headless UI primitives (avatar, dialog, dropdown, tooltip)
- `react-leaflet` + `leaflet` — Interactive maps
- `recharts` — Charting library
- `@react-three/fiber` + `@react-three/drei` + `three` — 3D visualizations
- `framer-motion` — Animations
- `zustand` — State management
- `axios` — HTTP client
- `@turf/turf` — Geospatial analysis

**Structure**:
- `src/` — Application source code
- `public/` — Static assets
- `shared/` — Symlink to `libs/shared-types/` (shared type definitions)
- `index.html` — SPA entry point
- `vite.config.ts` — Vite configuration with API proxy to Django backend

**Scripts**:
```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # TypeScript compilation + Vite production build
npm run lint     # ESLint with TypeScript strict mode
npm run preview  # Preview production build
```

### Mobile App (`apps/mobile/`)

**Stack**: Expo SDK 54 + React Native 0.81 + NativeWind v4 + TypeScript

**Structure**:
- `app/` — Expo Router file-based routing
- `src/` — Application source
- `components/` — Reusable UI components
- `lib/` — Utilities and hooks
- `constants/` — App constants
- `assets/` — Images and fonts

**Key Features**:
- Biometric authentication (fingerprint/face unlock)
- Hardware-backed credential storage (Android Keystore / iOS Keychain)
- Offline-first with local storage
- Server connection configuration (gear icon on login screen)

### Shared Libraries (`apps/shared/`)

Platform-agnostic API factories shared between web and mobile apps.

---

## Backend Development

### Django API (`services/api/`)

See [SERVICES.md](SERVICES.md) for full app structure.

**Key Patterns**:
- Domain-driven: `domains/` layer for cross-app imports
- Async-safe: ML inference offloaded to dedicated thread pools
- Cached views: `AsyncCacheMixin` provides Redis-backed view caching
- Tenant isolation: `TenantMiddleware` + `OrgScopedQueryset` for multi-tenancy
- AuthZ shortcuts: Granular permission classes in `cargotrack/authz.py`

**Adding a New API Endpoint**:
1. Create serializer in the app's `serializers.py`
2. Create view in the app's `api_views.py` (or `domains/` for cross-cutting)
3. Register URL in the app's `api_urls.py`
4. Wire into `cargotrack/api_urls.py` if needed

### Rust Services

Each Rust service is a standalone crate:
```bash
cd services/gps-ingest
cargo build
cargo test
cargo run
```

### Go Services

Each Go service is a standalone module:
```bash
cd services/tracking-ingest
go build ./...
go test ./...
```

### Java Services

```bash
# EDI Integration (Maven)
cd services/edi-integration
./mvnw spring-boot:run

# Workflow Engine (Gradle)
cd services/workflow-engine
./gradlew bootRun
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | insecure dev key | Django secret key |
| `DEBUG` | `False` | Enable debug mode |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | Comma-separated hostnames |
| `DB_NAME` | `cargotrack` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | *(required)* | PostgreSQL password |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_ENGINE` | `django.db.backends.sqlite3` | Database engine |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | CORS origins |
| `OIDC_ENABLED` | `true` | Enable Keycloak OIDC |
| `KEYCLOAK_SERVER_URL` | `http://keycloak:8080` | Keycloak base URL |
| `KEYCLOAK_REALM` | `cargotrack` | Keycloak realm |
| `WEBHOOK_SECRET_KEY` | `change-me-in-production` | HMAC signing key |
| `SMTP_HOST` | `mailhog` | SMTP server host |
| `EDI_SFTP_HOST` | `sftp-partner` | EDI SFTP host |
| `MINIO_ROOT_USER` | `cargotrack` | MinIO admin user |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | MinIO admin password |
| `GRAFANA_ADMIN` | `admin` | Grafana admin user |
| `GRAFANA_PASSWORD` | `admin` | Grafana admin password |
| `KEYCLOAK_ADMIN` | `admin` | Keycloak admin user |
| `KEYCLOAK_ADMIN_PASSWORD` | `admin` | Keycloak admin password |

---

## Useful Commands

```bash
# Generate OpenAPI schema
cd services/api && python manage.py spectacular --file schema.openapi.yml

# Test webhook delivery locally
python manage.py webhook_inspector --port 9999

# Replay captured webhooks to a real endpoint
python manage.py webhook_inspector --port 9999 --replay https://your-app.example.com/webhooks/cargotrack

# Audit encryption key
python manage.py audit_encryption --check-key
```
