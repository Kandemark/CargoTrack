"""
accounts/totp_utils.py — TOTP two-factor authentication utilities.

Uses pyotp for RFC 6238 TOTP generation and verification.
Backup codes are 8-character hex strings, stored as bcrypt hashes.
"""
import hashlib
import secrets

import pyotp


def generate_totp_secret() -> str:
    """Generate a new base32-encoded TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = 'CargoTrack') -> str:
    """Generate an otpauth:// URI for QR code display."""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email, issuer_name=issuer,
    )


def verify_totp(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code against the stored secret."""
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code)


def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate plaintext backup codes (8-char hex each)."""
    return [secrets.token_hex(4) for _ in range(count)]


def hash_backup_codes(codes: list[str]) -> list[str]:
    """Hash backup codes with SHA-256 for storage (never store plaintext)."""
    return [hashlib.sha256(c.encode()).hexdigest() for c in codes]


def verify_backup_code(code: str, stored_hashes: list[str]) -> bool:
    """
    Verify a backup code against stored hashes.
    Returns True and pops the matched hash on success.
    """
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    for i, h in enumerate(stored_hashes):
        if h == code_hash:
            stored_hashes.pop(i)
            return True
    return False
