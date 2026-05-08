"""
Django management command: audit all EncryptedTextField usage and generate a PII inventory.

Usage:
    python manage.py audit_encryption
    python manage.py audit_encryption --output pii_report.json
    python manage.py audit_encryption --check-key  # verify Fernet key is valid

The report lists every model field encrypted at rest, its data category,
the owning model/table, and whether the encryption key is operational.
"""
import json
import os
import sys
from datetime import datetime, timezone

from django.apps import apps
from django.core.management.base import BaseCommand

from cargotrack.encryption import EncryptedTextField, get_fernet


# ── PII data category taxonomy ──────────────────────────────────────────────
FIELD_CATEGORIES = {
    "phone": "PII — Contact (Phone)",
    "phone_number": "PII — Contact (Phone)",
    "received_by_phone": "PII — Contact (Phone)",
    "email": "PII — Contact (Email)",
    "tax_id": "PII — Financial (Tax ID)",
    "license_number": "PII — Government ID (Driver License)",
    "totp_secret": "Secrets — TOTP Key Material",
}


def sniff_category(field_name: str) -> str:
    """Return a human-readable data category for an encrypted field."""
    return FIELD_CATEGORIES.get(field_name, f"PII — Unclassified ({field_name})")


class Command(BaseCommand):
    help = "Audit EncryptedTextField usage and generate a PII inventory report."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output", type=str,
            help="Write JSON report to this file path.",
        )
        parser.add_argument(
            "--check-key", action="store_true",
            help="Only verify the Fernet encryption key is valid; exit 1 if not.",
        )

    def handle(self, **options):
        # ── 1. Key health check ──────────────────────────────────────────
        print("=" * 72)
        print("  CargoTrack Field-Level Encryption Audit")
        print("=" * 72)

        key_source = "env:ENCRYPTION_KEY" if os.getenv("ENCRYPTION_KEY") else "SECRET_KEY (fallback)"
        print(f"\n  Key source  : {key_source}")

        try:
            fernet = get_fernet()
            test_token = fernet.encrypt(b"audit-probe")
            assert fernet.decrypt(test_token) == b"audit-probe"
            print("  Key status  : HEALTHY — encrypt/decrypt round-trip OK")
            key_healthy = True
        except Exception as e:
            print(f"  Key status  : BROKEN — {e}")
            key_healthy = False
            if options["check_key"]:
                sys.exit(1)

        if options["check_key"]:
            sys.exit(0 if key_healthy else 1)

        # ── 2. Scan all models for EncryptedTextField ─────────────────────
        print(f"\n{'Model':<48} {'Field':<24} {'Category'}")
        print("-" * 72)

        inventory = []
        count = 0

        for model in apps.get_models():
            for field in model._meta.get_fields():
                if not isinstance(field, EncryptedTextField):
                    continue
                count += 1
                category = sniff_category(field.name)
                row = {
                    "app": model._meta.app_label,
                    "model": model.__name__,
                    "table": model._meta.db_table,
                    "field": field.name,
                    "category": category,
                }
                inventory.append(row)
                print(
                    f"  {model._meta.app_label}.{model.__name__:<40} "
                    f"{field.name:<24} {category}"
                )

        print("-" * 72)
        print(f"  Total encrypted fields found: {count}")

        # ── 3. Per-app summary ───────────────────────────────────────────
        apps_touched = sorted(set(r["app"] for r in inventory))
        print(f"\n  Apps with encrypted data: {', '.join(apps_touched)}")

        # ── 4. Risk assessment ───────────────────────────────────────────
        print(f"\n  Risk flags:")
        if not os.getenv("ENCRYPTION_KEY"):
            print(
                "    WARNING  — ENCRYPTION_KEY is not set. "
                "Data is encrypted with a key derived from SECRET_KEY. "
                "If SECRET_KEY is rotated, all encrypted fields become unreadable."
            )
        if not os.getenv("FERNET_KEY_ROTATION_DATE"):
            print(
                "    INFO     — FERNET_KEY_ROTATION_DATE not set. "
                "No evidence of key rotation schedule."
            )
        else:
            print(f"    OK       — Last key rotation: {os.getenv('FERNET_KEY_ROTATION_DATE')}")

        # ── 5. Output ────────────────────────────────────────────────────
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "key_source": key_source,
            "key_healthy": key_healthy,
            "total_encrypted_fields": count,
            "apps": apps_touched,
            "fields": inventory,
        }

        if options["output"]:
            with open(options["output"], "w") as f:
                json.dump(report, f, indent=2)
            print(f"\n  Report written to: {options['output']}")

        print("\n  Audit complete.")
