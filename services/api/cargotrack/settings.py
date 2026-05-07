"""
CargoTrack Django Settings
==========================

Single settings module for all environments.  Environment-specific values
(SECRET_KEY, database credentials, DEBUG flag) are injected via a .env file
read by ``python-decouple``.  Sensitive defaults are only safe in development;
see .env.example for production requirements.

Key responsibilities:
    - Django app registration and middleware ordering.
    - Database, auth, and JWT configuration.
    - CORS policy for the React SPA (http://localhost:5173 in dev).
    - REST framework defaults: JWT auth, PageNumberPagination (page_size=20).
    - ML alert threshold constants consumed by AlertManager and handlers.

Dependencies:
    python-decouple — reads .env without exposing secrets in source.
    djangorestframework-simplejwt — JWT token generation and rotation.
    django-cors-headers — cross-origin request policy for the Vite dev server.
"""
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

from .logging_config import get_logging_config

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Core security ─────────────────────────────────────────────────────────────
# In development the insecure default is used automatically.
# In production, set SECRET_KEY in the environment or .env file.
SECRET_KEY = config(
    'SECRET_KEY',
    default='django-insecure-x7k#p!m$v@8wq2ns&4e%yrj6_tf0zhu3ba9odcig5le1',
)

# Enables the Django debug toolbar, detailed error pages, and DEBUG SQL logging.
# Must be False in any internet-facing environment.
DEBUG = config('DEBUG', default=False, cast=bool)

# Comma-separated list of hostnames Django will serve.  The docker-compose
# backend service is typically localhost:8000; add the production domain here.
# 'backend' is required so Django accepts requests proxied by the Vite dev
# server with Host: backend:8000 (the Docker service name).
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1,backend',
    cast=Csv(),
)

# In DEBUG mode, accept all hosts so physical devices and emulators on the same
# network can reach the dev server without manual IP configuration.
# Also enumerate LAN IPs for the startup banner.
if DEBUG:
    ALLOWED_HOSTS = ['*']

    print(f'[CargoTrack] DEBUG mode — accepting connections from all hosts.')
    print(f'[CargoTrack] Android emulator: http://10.0.2.2:8000')
    print(f'[CargoTrack] Physical device:  port 8000 on this machine')
    print(f'[CargoTrack] Run .\\scripts\\dev.ps1 status to see your LAN IPs.')

# ── Installed apps ────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'daphne',  # ASGI server — must be listed first

    # Django built-ins
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party packages
    'channels',                            # Django Channels — WebSocket support
    'rest_framework',                      # DRF — API framework
    'rest_framework_simplejwt',            # JWT token generation
    'rest_framework_simplejwt.token_blacklist',  # refresh-token revocation
    'corsheaders',                         # Cross-Origin Resource Sharing
    'drf_spectacular',                     # OpenAPI 3.1 schema generation

    # CargoTrack project config
    'cargotrack.apps.CargotrackConfig',    # project-level commands (audit, workers)

    # CargoTrack domain apps
    'accounts.apps.AccountsConfig',        # custom user model + JWT auth endpoints
    'shipments.apps.ShipmentsConfig',      # shipment & route CRUD
    'tracking.apps.TrackingConfig',        # tracking event logging
    'alerts.apps.AlertsConfig',            # delay alerts and notification pipeline
    'dashboard.apps.DashboardConfig',      # aggregated KPI views (no models)
    'predictions.apps.PredictionsConfig',  # ML prediction domain types
    'payments',                            # Invoice & payment gateway integrations
    'fleet.apps.FleetConfig',              # Truck & driver fleet management
    'carriers.apps.CarriersConfig',        # Carrier companies & rate cards
    'chats.apps.ChatsConfig',              # Real-time messaging & video calls
    'marketplace.apps.MarketplaceConfig',  # Freight marketplace & job board
]

# ── Middleware ────────────────────────────────────────────────────────────────
# CorsMiddleware must appear before CommonMiddleware so preflight OPTIONS
# requests are handled before Django's common checks run.
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # GZip compression: placed early so all downstream responses are compressed.
    'django.middleware.gzip.GZipMiddleware',
    # Content Security Policy: prevents XSS by restricting resource origins.
    # Must come early so all responses get the header.
    'cargotrack.csp.ContentSecurityPolicyMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',      # CORS headers — before Common
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'cargotrack.urls'

# ── Templates ─────────────────────────────────────────────────────────────────
# frontend/dist is the Vite production build output.  In development the Vite
# dev server serves the SPA; Django only needs the built files in production.
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'frontend' / 'dist'],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

WSGI_APPLICATION = 'cargotrack.wsgi.application'
ASGI_APPLICATION = 'cargotrack.asgi.application'

# ── Django Channels ─────────────────────────────────────────────────────────
# Redis-backed channel layer for WebSocket communication across processes.
# Channels handles the ASGI protocol; Daphne serves as the ASGI application server.
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://localhost:6379/0')],
        },
    },
}

# ── Redis Cache ───────────────────────────────────────────────────────────────
# Low-level Redis interface for direct cache operations, pub/sub, and Channels.
# CACHES uses django-redis which pools connections and supports compression.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://localhost:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django.core.cache.backends.redis.RedisClient',
        },
        'TIMEOUT': 300,  # 5-minute default TTL
        'KEY_PREFIX': 'ct',
    },
}

# ── Database ──────────────────────────────────────────────────────────────────
# PostgreSQL 16 is the recommended production database, but SQLite is supported
# for local development. Default to SQLite if no DB_NAME is provided or if
# DB_ENGINE is explicitly set to SQLite.
DB_ENGINE = config('DB_ENGINE', default='django.db.backends.sqlite3')

DATABASES = {
    'default': {
        'ENGINE': DB_ENGINE,
        'NAME': config('DB_NAME', default=BASE_DIR / 'db.sqlite3'),
    }
}

if 'postgresql' in DB_ENGINE:
    DATABASES['default'].update({
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
        # Connection pooling: keep DB connections alive for 10 minutes instead
        # of creating a new one per request.  Set to 0 to disable (one
        # connection per request).  For high-traffic production, also deploy
        # pgBouncer as a sidecar service.
        'CONN_MAX_AGE': config('DB_CONN_MAX_AGE', default=600, cast=int),
        'CONN_HEALTH_CHECKS': True,  # Verify connection health before reuse
        'OPTIONS': {
            'application_name': 'cargotrack',
        },
    })


# ── Auth ──────────────────────────────────────────────────────────────────────
# Points Django to the custom user model that adds role, phone, and company.
AUTH_USER_MODEL = 'accounts.CustomUser'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Localisation ──────────────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
# East African Standard Time (EAT, UTC+3); used for all datetime display.
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

# ── Static & media files ─────────────────────────────────────────────────────
STATIC_URL = '/static/'
# Additional static directories searched by collectstatic.
STATICFILES_DIRS = [BASE_DIR / 'static']
# Output directory for collectstatic (served by Nginx/CDN in production).
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# BigAutoField avoids hitting the 2-billion row limit of AutoField on large tables.
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    # OpenAPI schema introspection via drf-spectacular
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # CookieJWT is primary (reads ct_access httpOnly cookie for web, falls back
    # to Authorization: Bearer header for mobile).  SessionAuth keeps admin working.
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'cargotrack.authentication.CookieJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    # All views require authentication unless they explicitly set AllowAny.
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # Rate limiting: auth endpoints are throttled to prevent brute-force attacks.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/min',   # unauthenticated — register, token obtain
        'user': '100/min',  # authenticated — normal API usage
        'auth': '30/min',   # scoped — login/register endpoints (applied per-view)
    },
    # Standard cursor-less pagination returned as {count, next, previous, results}.
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    # URL-path versioning: /api/v1/ — version string extracted from URL.
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.URLPathVersioning',
    'DEFAULT_VERSION': 'v1',
    'ALLOWED_VERSIONS': ['v1'],
    'VERSION_PARAM': 'version',
    # JSON-only: no browsable API in production reduces attack surface.
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
}

# ── OpenAPI (drf-spectacular) ──────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "CargoTrack API",
    "DESCRIPTION": (
        "Polyglot logistics backbone for East African freight corridors. "
        "REST API for shipment management, fleet tracking, marketplace, "
        "payments, and ML-powered predictions."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "CONTACT": {"email": "ops@cargotrack.io"},
    "LICENSE": {"name": "Proprietary"},
    "TAGS": [
        {"name": "auth", "description": "JWT token lifecycle"},
        {"name": "shipments", "description": "Shipment CRUD & tracking"},
        {"name": "fleet", "description": "Trucks & driver management"},
        {"name": "carriers", "description": "Carrier companies & rate cards"},
        {"name": "marketplace", "description": "Freight listing & bidding"},
        {"name": "payments", "description": "Invoicing & payment gateways"},
        {"name": "alerts", "description": "Delay alerts & notifications"},
        {"name": "dashboard", "description": "KPI aggregation endpoints"},
        {"name": "predictions", "description": "ML prediction endpoints"},
        {"name": "chats", "description": "Real-time messaging"},
        {"name": "accounts", "description": "User profile & organizations"},
    ],
}

# ── JWT (simplejwt) ───────────────────────────────────────────────────────────
SIMPLE_JWT = {
    # Short-lived access token; clients must refresh before expiry.
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=60),
    # Refresh tokens survive a work week so users aren't re-prompted on Monday.
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # Rotation: every refresh call issues a new refresh token and blacklists the old one.
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    # Keeps last_login accurate without an extra DB write per request.
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_OBTAIN_SERIALIZER': 'rest_framework_simplejwt.serializers.TokenObtainPairSerializer',
}

# ── ML / Alert thresholds ─────────────────────────────────────────────────────
# Single scalar threshold used by PredictDelayAPIView to decide whether to
# trigger the AlertManager pipeline after a prediction run.
DELAY_ALERT_THRESHOLD = 0.7

# Severity bands consumed by AlertManager (manager.py) and InAppAlertHandler
# (alert_manager.py) to map a delay_risk_score in [0.0, 1.0] to a severity label.
# Keeping them here ensures both callers stay in sync — change once, applied everywhere.
ALERT_THRESHOLDS = {
    'CRITICAL': 0.85,  # Immediate action required; highest-priority alert.
    'HIGH':     0.70,  # Significant delay probability; triggers AlertManager.
    'MEDIUM':   0.50,  # Elevated risk; worth monitoring but not critical.
}

# ── Django system-check silencing ────────────────────────────────────────────
# Silence W009 in CI/local check --deploy runs where SECRET_KEY env var is not
# yet set. The insecure default is never used in production — decouple reads the
# real key from the environment (see .env.example).
SILENCED_SYSTEM_CHECKS = ['security.W009']

# ── Email ─────────────────────────────────────────────────────────────────────
# Development: console backend prints emails to stdout (no SMTP needed).
# Production: set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# and provide EMAIL_HOST/USER/PASSWORD via .env.
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST     = config('EMAIL_HOST',     default='localhost')
EMAIL_PORT     = config('EMAIL_PORT',     default=25,   cast=int)
EMAIL_USE_TLS  = config('EMAIL_USE_TLS',  default=True, cast=bool)
EMAIL_HOST_USER     = config('EMAIL_HOST_USER',     default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL  = config('DEFAULT_FROM_EMAIL',  default='noreply@cargotrack.local')

# ── Authentication redirects ──────────────────────────────────────────────────
# Used by Django's session-based auth (admin).  The React SPA handles its own
# redirect logic via the Axios 401 interceptor and the Zustand auth store.
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/dashboard/'
LOGOUT_REDIRECT_URL = '/accounts/login/'

# ── Session security ──────────────────────────────────────────────────────────
SESSION_COOKIE_HTTPONLY = True
# 8-hour session lifetime — balances security with a full working day.
SESSION_COOKIE_AGE = 28800
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# ── CSRF ─────────────────────────────────────────────────────────────────────
# Must stay False: the React SPA reads the CSRF cookie for AJAX requests.
# Django's CSRF middleware sets the cookie; the frontend reads it with JS.
CSRF_COOKIE_HTTPONLY = False

# ── Request size limits ──────────────────────────────────────────────────────
# JSON body — 1 MB is ample for shipment creation, tracking events, etc.
DATA_UPLOAD_MAX_MEMORY_SIZE = 1_048_576  # 1 MB
# File uploads — 10 MB for shipment documents (BOLs, customs, scale tickets).
FILE_UPLOAD_MAX_MEMORY_SIZE = 10_485_760  # 10 MB
# Max number of fields in a single form/JSON body (prevents hash collision DoS).
DATA_UPLOAD_MAX_NUMBER_FIELDS = 200
# Max number of files in a single multipart upload.
DATA_UPLOAD_MAX_NUMBER_FILES = 5

# ── Clickjacking / content-type protection ────────────────────────────────────
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True

# ── HTTPS security (enabled automatically in production) ─────────────────────
# These settings are toggled on only when DEBUG=False so local development
# over plain HTTP continues to work without certificate configuration.
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000        # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# ── CORS ─────────────────────────────────────────────────────────────────────
# The Vite dev server runs on 5173; this must be in the allowed list so the
# browser doesn't block API calls during development.  In production, set
# CORS_ALLOWED_ORIGINS to the actual frontend domain in .env.
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173',
    cast=Csv(),
)
# Required for JWT cookies and session-based auth to be sent cross-origin.
CORS_ALLOW_CREDENTIALS = True

# ── Logging ──────────────────────────────────────────────────────────────────
LOGGING = get_logging_config(debug=DEBUG)
