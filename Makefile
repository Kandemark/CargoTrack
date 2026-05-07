# CargoTrack — Developer Makefile
# =================================
# Top-level build orchestrator for the polyglot monorepo.
# Run `make <target>` from the repository root.

.PHONY: up down build build-no-cache logs shell migrate makemigrations \
        createsuperuser seed test lint proto clean \
        build-api build-ws build-tracking build-web \
        build-tracking-native build-ws-native

# ── Docker Compose ──────────────────────────────────────────────────────────

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

build-no-cache:
	docker compose build --no-cache

logs:
	docker compose logs -f backend

# ── Individual service builds (native, no Docker) ────────────────────────────

build-tracking-native:
	cd services/tracking-ingest && go build -o tracking-server ./cmd/tracking-server

build-ws-native:
	cd services/ws && mix compile

# ── Django management ────────────────────────────────────────────────────────

shell:
	docker compose exec backend python manage.py shell

migrate:
	docker compose exec backend python manage.py migrate

makemigrations:
	docker compose exec backend python manage.py makemigrations

createsuperuser:
	docker compose exec backend python manage.py createsuperuser

seed:
	docker compose exec backend python manage.py seed_data

# ── Tests ────────────────────────────────────────────────────────────────────

test-api:
	cd services/api && python -m pytest tests/ -v

test-ws:
	cd services/ws && mix test

test-web:
	cd apps/web && npm run lint

test: test-api

# ── Linting ──────────────────────────────────────────────────────────────────

lint-api:
	cd services/api && ruff check .

lint-web:
	cd apps/web && npm run lint

lint: lint-api lint-web

# ── Protobuf ─────────────────────────────────────────────────────────────────

proto:
	buf generate libs/proto

# ── Frontend deps ────────────────────────────────────────────────────────────

frontend-install:
	docker compose exec frontend npm install

# ── Cleanup ──────────────────────────────────────────────────────────────────

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name '*.pyc' -delete 2>/dev/null || true
	rm -rf services/ws/_build services/ws/deps 2>/dev/null || true
	rm -rf services/tracking-ingest/tracking-server 2>/dev/null || true
	rm -rf apps/web/dist 2>/dev/null || true
	rm -f erl_crash.dump 2>/dev/null || true
