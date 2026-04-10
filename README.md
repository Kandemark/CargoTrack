# CargoTrack

**Real-time freight tracking, ML-powered delay prediction, and logistics management for the East African corridor.**

CargoTrack is a B2B SaaS platform connecting freight forwarders, 3PLs, carriers, and importers across Kenya, Uganda, Tanzania, Rwanda, and beyond.

---

## Stack

| Layer | Technology |
| --- | --- |
| API | Django 4.2 + Django REST Framework |
| Auth | JWT (simplejwt) with refresh rotation |
| Database | PostgreSQL 16 |
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Mobile | Expo (React Native) |
| ML | scikit-learn RandomForestClassifier |
| Containerisation | Docker Compose |

---

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+
- A `.env` file in the project root (see below)

### 1. Create your `.env`

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
DEBUG=True
SECRET_KEY=<generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DB_PASSWORD=a-strong-local-password
```

> `DB_HOST` does **not** need to be changed — Docker Compose overrides it to `db` (the Postgres service name) automatically.

### 2. Build and start

```bash
make build   # first run — builds images
make up      # start all services
```

Or without Make:

```bash
docker compose build --no-cache
docker compose up
```

### 3. Access the services

| Service | URL |
| --- | --- |
| React frontend (Vite) | <http://localhost:5173> |
| Django API | <http://localhost:8000/api/> |
| Django Admin | <http://localhost:8000/admin/> |
| PostgreSQL | `localhost:5432` |

Migrations run automatically on backend startup. The first `make up` will apply all pending migrations before the server accepts requests.

---

## Common Makefile targets

```bash
make up               # docker compose up (foreground)
make down             # stop and remove containers
make build            # rebuild all images from scratch
make logs             # tail backend logs
make shell            # Django management shell
make migrate          # run pending migrations
make createsuperuser  # create a Django admin account
make seed             # load demo data (seed_data management command)
make frontend-install # npm install inside the frontend container
```

---

## Local Development (without Docker)

### Backend

```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Ensure DB_HOST=localhost in .env and PostgreSQL is running locally
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Mobile (Expo — always runs natively, not in Docker)

```bash
cd mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000` in `mobile/.env` so the device can reach the Django API.

---

## Architecture overview

```text
cargotrack/          Django project root (settings, urls, wsgi)
accounts/            Custom user model + JWT auth endpoints
shipments/           Shipment & Route models, CRUD API
tracking/            TrackingEvent model, log-event endpoint
alerts/              Alert model, AlertManager, severity pipeline
dashboard/           KPI aggregation views
frontend/            React SPA (Vite + Tailwind CSS)
mobile/              Expo app (React Native + NativeWind)
shared/              Platform-agnostic API factories (web + mobile)
```

---

## API reference

The REST API is versioned under `/api/v1/`. Authentication uses JWT Bearer tokens.

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register/` | Create account, returns token pair |
| POST | `/api/token/` | Obtain access + refresh tokens |
| POST | `/api/token/refresh/` | Rotate refresh token |
| GET | `/api/v1/shipments/` | Paginated shipment list |
| POST | `/api/v1/shipments/` | Create shipment |
| GET | `/api/v1/shipments/:id/` | Shipment detail |
| GET | `/api/v1/shipments/:id/tracking-events/` | Event timeline |
| POST | `/api/v1/shipments/:id/tracking-events/` | Log tracking event |
| GET | `/api/v1/routes/` | Available routes (flat array) |
| GET | `/api/v1/dashboard/` | KPI summary |
| GET | `/api/v1/alerts/` | Alert list |
| GET | `/api/v1/predictions/` | Delay risk scores |

---

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `SECRET_KEY` | insecure dev key | Django secret — must be rotated in production |
| `DEBUG` | `False` | Enable debug mode |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hostnames |
| `DB_NAME` | `cargotrack` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | *(required)* | PostgreSQL password |
| `DB_HOST` | `localhost` | PostgreSQL host (auto-overridden to `db` in Docker) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |

---

## Running tests

```bash
# From the project root with venv active:
pytest tests/ -q

# Or inside Docker:
docker compose exec backend pytest tests/ -q
```
