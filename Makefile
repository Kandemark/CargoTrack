# CargoTrack — Developer Makefile
# =================================
# Convenience targets for common Docker Compose operations.
# All targets assume docker compose v2 is installed and .env is populated.
# Run `make <target>` from the repository root.

.PHONY: up down build logs shell migrate createsuperuser seed frontend-install

# Start all services (db, backend, frontend) in the foreground.
# Use `make up &` or `docker compose up -d` to run in the background.
up:
	docker compose up

# Stop and remove all running containers (data volumes are preserved).
down:
	docker compose down

# Rebuild all Docker images from scratch, ignoring the layer cache.
# Use after changing Dockerfile.*, requirements.txt, or package.json.
build:
	docker compose build --no-cache

# Stream the Django backend container logs in real time (Ctrl-C to exit).
logs:
	docker compose logs -f backend

# Open a Django management shell inside the running backend container.
# Useful for one-off ORM queries and data inspection in development.
shell:
	docker compose exec backend python manage.py shell

# Apply any pending Django database migrations inside the running backend.
# The backend entrypoint already runs migrate on startup; use this to
# re-run after creating new migrations without restarting the container.
migrate:
	docker compose exec backend python manage.py migrate

# Create a Django superuser account interactively inside the backend container.
# Required for accessing the Django admin panel at /admin/.
createsuperuser:
	docker compose exec backend python manage.py createsuperuser

# Populate the database with sample data using the seed_data management command.
# Idempotent — safe to run multiple times; will not duplicate existing records.
seed:
	docker compose exec backend python manage.py seed_data

# Install npm packages inside the running frontend container.
# Use after adding a new dependency to frontend/package.json without rebuilding
# the image (quicker iteration than `make build`).
frontend-install:
	docker compose exec frontend npm install
