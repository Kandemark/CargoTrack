"""
payments/providers/mpesa.py — Safaricom Daraja 2.0 (M-Pesa STK Push).

Env vars required:
  MPESA_CONSUMER_KEY
  MPESA_CONSUMER_SECRET
  MPESA_SHORTCODE
  MPESA_PASSKEY
  MPESA_CALLBACK_URL   (defaults to https://<host>/api/v1/payments/webhook/mpesa/)
  MPESA_ENVIRONMENT    (sandbox | production, default: sandbox)
"""
import base64
import hashlib
import hmac
import logging
from datetime import datetime
from typing import Any

import requests
from decouple import config

from .base import BaseProvider, PaymentResult

logger = logging.getLogger(__name__)

SANDBOX_HOST    = 'https://sandbox.safaricom.co.ke'
PRODUCTION_HOST = 'https://api.safaricom.co.ke'


class MpesaProvider(BaseProvider):
    def __init__(self):
        self.consumer_key    = config('MPESA_CONSUMER_KEY',    default='')
        self.consumer_secret = config('MPESA_CONSUMER_SECRET', default='')
        self.shortcode       = config('MPESA_SHORTCODE',       default='174379')
        self.passkey         = config('MPESA_PASSKEY',         default='')
        self.callback_url    = config('MPESA_CALLBACK_URL',    default='https://example.com/api/v1/payments/webhook/mpesa/')
        env = config('MPESA_ENVIRONMENT', default='sandbox')
        self.host = PRODUCTION_HOST if env == 'production' else SANDBOX_HOST

    def _get_access_token(self) -> str:
        creds = base64.b64encode(f'{self.consumer_key}:{self.consumer_secret}'.encode()).decode()
        resp = requests.get(
            f'{self.host}/oauth/v1/generate?grant_type=client_credentials',
            headers={'Authorization': f'Basic {creds}'},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()['access_token']

    def _password(self) -> tuple[str, str]:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        raw = f'{self.shortcode}{self.passkey}{timestamp}'
        password = base64.b64encode(raw.encode()).decode()
        return password, timestamp

    def initiate_payment(self, invoice: Any, phone_or_card: str) -> PaymentResult:
        if not self.consumer_key:
            return PaymentResult(False, message='M-Pesa not configured.')
        try:
            token = self._get_access_token()
            password, timestamp = self._password()
            amount = int(float(invoice.amount_kes))
            payload = {
                'BusinessShortCode': self.shortcode,
                'Password':          password,
                'Timestamp':         timestamp,
                'TransactionType':   'CustomerPayBillOnline',
                'Amount':            amount,
                'PartyA':            phone_or_card.lstrip('+'),
                'PartyB':            self.shortcode,
                'PhoneNumber':       phone_or_card.lstrip('+'),
                'CallBackURL':       self.callback_url,
                'AccountReference':  invoice.invoice_number,
                'TransactionDesc':   f'CargoTrack invoice {invoice.invoice_number}',
            }
            resp = requests.post(
                f'{self.host}/mpesa/stkpush/v1/processrequest',
                json=payload,
                headers={'Authorization': f'Bearer {token}'},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            checkout_id = data.get('CheckoutRequestID', '')
            return PaymentResult(True, reference=checkout_id, data=data)
        except Exception as exc:
            logger.exception('M-Pesa STK Push failed: %s', exc)
            return PaymentResult(False, message=str(exc))

    def verify_payment(self, reference: str) -> PaymentResult:
        try:
            token = self._get_access_token()
            password, timestamp = self._password()
            resp = requests.post(
                f'{self.host}/mpesa/stkpushquery/v1/query',
                json={
                    'BusinessShortCode': self.shortcode,
                    'Password':          password,
                    'Timestamp':         timestamp,
                    'CheckoutRequestID': reference,
                },
                headers={'Authorization': f'Bearer {token}'},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            paid = data.get('ResultCode') == '0'
            return PaymentResult(paid, reference=reference, data=data)
        except Exception as exc:
            return PaymentResult(False, message=str(exc))

    def parse_webhook(self, data: dict[str, Any]) -> PaymentResult:
        try:
            callback = data.get('Body', {}).get('stkCallback', {})
            result_code = callback.get('ResultCode')
            ref = callback.get('CheckoutRequestID', '')
            paid = result_code == 0
            return PaymentResult(paid, reference=ref, data=data)
        except Exception as exc:
            return PaymentResult(False, message=str(exc))

    def verify_webhook_signature(self, request_body: bytes, signature: str) -> bool:
        """Verify M-Pesa webhook signature (basic HMAC-SHA256)."""
        secret = config('MPESA_WEBHOOK_SECRET', default='')
        if not secret:
            return True  # Skip in dev when secret not set
        expected = hmac.new(secret.encode(), request_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
