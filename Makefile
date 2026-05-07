# CargoTrack — Developer Makefile
# =================================
# Top-level build orchestrator for the polyglot monorepo.
# Run `make <target>` from the repository root.

.PHONY: up down build build-no-cache logs shell migrate makemigrations \
        createsuperuser seed test lint proto clean \
        build-api build-ws build-tracking build-web build-gps build-notification build-webhook \
        build-tracking-native build-ws-native build-gps-native build-notification-native build-webhook-native \
        sandbox sandbox-down schema audit train-demand train-theft train-pricing \
        check test-api test-go test-rust

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

# ── Sandbox (lightweight dev environment) ─────────────────────────────────────

sandbox:
	docker compose -f docker-compose.sandbox.yml up -d
	@echo "Sandbox running — seed data with: make seed-sandbox"

sandbox-down:
	docker compose -f docker-compose.sandbox.yml down

seed-sandbox:
	docker compose -f docker-compose.sandbox.yml exec backend python manage.py seed_demo

# ── Individual service builds (native, no Docker) ────────────────────────────

build-tracking-native:
	cd services/tracking-ingest && go build ./...

build-ws-native:
	cd services/ws && mix compile

build-gps-native:
	cd services/gps-ingest && cargo build --release

build-notification-native:
	cd services/notification && go build ./...

build-webhook-native:
	cd services/webhook-dispatcher && go build ./...

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
	docker compose exec backend python manage.py seed_demo

schema:
	cd services/api && python manage.py spectacular --file schema.openapi.yml

audit:
	cd services/api && python manage.py audit_encryption

# ── ML model training ─────────────────────────────────────────────────────────

train-demand:
	docker compose exec backend python manage.py train_demand

train-theft:
	docker compose exec backend python manage.py train_theft

train-pricing:
	docker compose exec backend python manage.py train_pricing

generate-training-data:
	cd services/api && python manage.py generate_training_data

train-model:
	cd services/api && python manage.py train_model

# ── Tests ────────────────────────────────────────────────────────────────────

test-api:
	cd services/api && python -m pytest . -v --tb=short

test-go:
	cd services/tracking-ingest && go test ./...
	cd services/notification && go test ./...
	cd services/webhook-dispatcher && go test ./...

test-rust:
	cd services/gps-ingest && cargo test
	cd services/route-optimizer && cargo test

test-ws:
	cd services/ws && mix test

test-web:
	cd apps/web && npm run lint

test: test-api test-go

# ── Full verification ─────────────────────────────────────────────────────────

check:
	cd services/api && python manage.py check
	cd services/api && python manage.py audit_encryption --check-key
	cd services/tracking-ingest && go build ./...
	cd services/notification && go build ./...
	cd services/webhook-dispatcher && go build ./...
	cd services/gps-ingest && cargo check
	cd services/route-optimizer && cargo check

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
	rm -f services/api/schema.openapi.yml 2>/dev/null || true
