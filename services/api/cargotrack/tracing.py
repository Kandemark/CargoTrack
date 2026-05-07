"""
CargoTrack distributed tracing via OpenTelemetry → Jaeger.

Traces flow: GPS ingest → Kafka → Go tracking → Django → notification →
mobile push — a single shipment event is traceable across all 8 services.

Enabled via OTLP_TRACING_ENABLED=true in .env (off by default in dev).
"""
import os

from django.conf import settings

OTLP_TRACING_ENABLED = os.getenv("OTLP_TRACING_ENABLED", "false").lower() in (
    "1", "true", "yes",
)

# OTLP collector endpoint (Jaeger all-in-one or OpenTelemetry Collector)
OTLP_ENDPOINT = os.getenv("OTLP_ENDPOINT", "http://jaeger:4317")

# Service name for span attribution
OTLP_SERVICE_NAME = os.getenv("OTLP_SERVICE_NAME", "django-api")


def init_tracing():
    """Initialise OpenTelemetry SDK if tracing is enabled."""
    if not OTLP_TRACING_ENABLED:
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.django import DjangoInstrumentor
        from opentelemetry.instrumentation.logging import LoggingInstrumentor
        from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        from opentelemetry.instrumentation.requests import RequestsInstrumentor
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        print("[tracing] OpenTelemetry SDK not installed — tracing disabled")
        return

    resource = Resource.create({SERVICE_NAME: OTLP_SERVICE_NAME})
    provider = TracerProvider(resource=resource)

    exporter = OTLPSpanExporter(endpoint=OTLP_ENDPOINT, insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    # Auto-instrument the Django stack
    DjangoInstrumentor().instrument()
    LoggingInstrumentor().instrument()
    Psycopg2Instrumentor().instrument()
    RedisInstrumentor().instrument()
    RequestsInstrumentor().instrument()

    print(f"[tracing] OpenTelemetry initialised → {OTLP_ENDPOINT}")
