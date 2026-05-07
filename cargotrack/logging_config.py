"""
cargotrack/logging_config.py — Structured JSON logging with PII redaction.

Provides a JsonFormatter that emits each log record as a single JSON line,
and a PIIRedactionFilter that masks sensitive fields (email, phone, tax ID,
license numbers, IP addresses) before they reach handlers.

Usage: set LOGGING = get_logging_config() in settings.py.
"""
import json
import logging
import re
import sys
from datetime import datetime, timezone

# Fields whose values should be redacted in log messages and extra data.
_PII_PATTERNS = [
    # Email addresses
    (re.compile(r'[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}'), '[EMAIL]'),
    # Phone numbers (various formats)
    (re.compile(r'\b\+?\d[\d\s\-().]{7,20}\d\b'), '[PHONE]'),
    # Tax IDs / KRA PINs
    (re.compile(r'\b[AP]\d{9}[A-Z]\b'), '[TAX_ID]'),
    # License numbers (alphanumeric, 6-20 chars)
    (re.compile(r'\blicense[=:]\s*["\']?[\w\-]+["\']?', re.IGNORECASE), 'license=[LICENSE]'),
    # IP addresses
    (re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'), '[IP]'),
]

_PII_FIELD_NAMES = {
    'email', 'phone', 'phone_number', 'tax_id', 'license_number',
    'password', 'password2', 'old_password', 'new_password',
    'token', 'access', 'refresh', 'access_token', 'refresh_token',
    'secret', 'api_key', 'key', 'credential', 'authorization',
    'ip_address', 'user_agent', 'first_name', 'last_name',
    'contact_name', 'address', 'website',
}


class PIIRedactionFilter(logging.Filter):
    """Redact PII from log record message and extra fields."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Redact the formatted message
        msg = record.getMessage()
        for pattern, replacement in _PII_PATTERNS:
            msg = pattern.sub(replacement, msg)
        record.msg = msg
        record.args = ()  # Clear args — msg is already formatted

        # Redact any PII-named keys in the record's extra dict
        if hasattr(record, 'extra') and isinstance(record.extra, dict):
            for key in list(record.extra.keys()):
                if key.lower() in _PII_FIELD_NAMES:
                    record.extra[key] = '[REDACTED]'

        return True


class JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON with standard fields."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'funcName': record.funcName,
            'lineno': record.lineno,
        }

        if record.exc_info and record.exc_info[1]:
            log_entry['exc'] = str(record.exc_info[1])

        # Fold in extra fields passed via logger.info(..., extra={...})
        if hasattr(record, 'extra') and isinstance(record.extra, dict):
            log_entry.update(record.extra)

        return json.dumps(log_entry, default=str)


def get_logging_config(debug: bool = False) -> dict:
    """
    Return the Django LOGGING configuration dict.

    In production (debug=False), logs go to stdout as JSON for ingestion
    by log aggregators (ELK, Datadog, Grafana Loki).  In development,
    logs use a human-readable format with the same PII filter.
    """
    return {
        'version': 1,
        'disable_existing_loggers': False,
        'filters': {
            'pii_redact': {
                '()': 'cargotrack.logging_config.PIIRedactionFilter',
            },
        },
        'formatters': {
            'json': {
                '()': 'cargotrack.logging_config.JsonFormatter',
            },
            'simple': {
                'format': '[{levelname}] {name} {message}',
                'style': '{',
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'stream': sys.stdout,
                'filters': ['pii_redact'],
                'formatter': 'simple' if debug else 'json',
            },
        },
        'root': {
            'handlers': ['console'],
            'level': 'INFO' if not debug else 'DEBUG',
        },
        'loggers': {
            'django': {
                'handlers': ['console'],
                'level': 'INFO',
                'propagate': False,
            },
            'django.request': {
                'handlers': ['console'],
                'level': 'WARNING',
                'propagate': False,
            },
            'django.security': {
                'handlers': ['console'],
                'level': 'INFO',
                'propagate': False,
            },
            # Application loggers — inherit root handler
            'accounts': {'level': 'INFO', 'propagate': True},
            'shipments': {'level': 'INFO', 'propagate': True},
            'tracking': {'level': 'INFO', 'propagate': True},
            'alerts': {'level': 'INFO', 'propagate': True},
            'payments': {'level': 'INFO', 'propagate': True},
            'chats': {'level': 'INFO', 'propagate': True},
            'fleet': {'level': 'INFO', 'propagate': True},
            'carriers': {'level': 'INFO', 'propagate': True},
            'predictions': {'level': 'INFO', 'propagate': True},
            'cargotrack': {'level': 'INFO', 'propagate': True},
        },
    }
