"""Verify encryption audit command and key health — no database needed."""
import os
import sys
from io import StringIO

from django.test import SimpleTestCase


class EncryptionKeyTests(SimpleTestCase):
    """Tests that don't require database access."""
    def test_fernet_key_derivation(self):
        from cargotrack.encryption import get_fernet
        fernet = get_fernet()
        test_token = fernet.encrypt(b"integration-test")
        self.assertEqual(fernet.decrypt(test_token), b"integration-test")

    def test_encrypt_decrypt_roundtrip(self):
        from cargotrack.encryption import encrypt, decrypt
        plaintext = "test-phone-number-123"
        token = encrypt(plaintext)
        self.assertNotEqual(token, plaintext)
        self.assertEqual(decrypt(token), plaintext)

    def test_encrypt_empty_string(self):
        from cargotrack.encryption import encrypt, decrypt
        self.assertEqual(encrypt(""), "")
        self.assertEqual(decrypt(""), "")

    def test_encrypted_field_type(self):
        from cargotrack.encryption import EncryptedTextField
        field = EncryptedTextField(max_length=30)
        self.assertEqual(field.max_length, 30)
