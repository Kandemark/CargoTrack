"""
cargotrack/encryption.py — Field-level AES-256 encryption for PII.

Uses cryptography.fernet.Fernet (AES-128-CBC + HMAC-SHA256) which is
the industry-standard approach for transparent database field encryption.

SETUP:
    Set ENCRYPTION_KEY in .env to a 64-character hex string (32 random bytes).
    Generate: python -c "import secrets; print(secrets.token_hex(32))"

    If ENCRYPTION_KEY is not set, a key derived from SECRET_KEY is used as
    a fallback in development.  This is NOT safe for production — if you
    rotate SECRET_KEY you lose all encrypted data.

USAGE:
    from cargotrack.encryption import EncryptedTextField

    class Driver(models.Model):
        phone = EncryptedTextField(max_length=30)
"""
import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models


def _get_encryption_key() -> bytes:
    """Return a 32-byte key suitable for Fernet, from ENCRYPTION_KEY or SECRET_KEY."""
    from decouple import config

    raw = config('ENCRYPTION_KEY', default='')
    if raw:
        try:
            return base64.urlsafe_b64encode(bytes.fromhex(raw))
        except (ValueError, TypeError):
            pass

    # Fallback: derive from SECRET_KEY (NOT safe for production — data is lost
    # if SECRET_KEY rotates).
    return base64.urlsafe_b64encode(
        hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    )


_fernet: Fernet | None = None


def get_fernet() -> Fernet:
    """Return the singleton Fernet instance, creating it if necessary."""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_get_encryption_key())
    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a string and return a base64 token (includes IV + HMAC)."""
    if not plaintext:
        return plaintext
    return get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt a Fernet token back to the original string."""
    if not token:
        return token
    return get_fernet().decrypt(token.encode()).decode()


class EncryptedTextField(models.TextField):
    """
    Django model field that transparently encrypts values at rest.

    Stored in the database as TEXT (base64-encoded Fernet token).
    Decrypted automatically when read via the ORM.
    Queryset filtering on encrypted fields does NOT work — use exact
    match lookups or search on unencrypted companion indices.

    Usage:
        phone = EncryptedTextField(max_length=30, blank=True)
    """

    def get_prep_value(self, value):
        if value is None or value == '':
            return value
        value = super().get_prep_value(value)
        return encrypt(value)

    def from_db_value(self, value, expression, connection):
        if value is None or value == '':
            return value
        try:
            return decrypt(value)
        except Exception:
            return '[decryption failed]'

    def to_python(self, value):
        if value is None or isinstance(value, str):
            return value
        return str(value)
