"""
payments/providers/stripe_provider.py — Stripe (international cards).

Env vars:
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
"""
import hashlib
import hmac
import logging
import time
from typing import Any

import requests
from decouple import config

from .base import BaseProvider, PaymentResult

logger = logging.getLogger(__name__)

STRIPE_HOST = 'https://api.stripe.com/v1'


class StripeProvider(BaseProvider):
    def __init__(self):
        self.secret_key      = config('STRIPE_SECRET_KEY',      default='')
        self.webhook_secret  = config('STRIPE_WEBHOOK_SECRET',  default='')

    def _headers(self) -> dict[str, str]:
        return {'Authorization': f'Bearer {self.secret_key}'}

    def initiate_payment(self, invoice: Any, phone_or_card: str) -> PaymentResult:
        if not self.secret_key:
            return PaymentResult(False, message='Stripe not configured.')
        try:
            # Convert KES to USD (approximate; real impl would use FX rate)
            amount_cents = int(float(invoice.amount_kes) * 100)  # cents
            currency = 'usd'
            resp = requests.post(
                f'{STRIPE_HOST}/payment_intents',
                data={
                    'amount':      str(amount_cents),
                    'currency':    currency,
                    'description': f'CargoTrack invoice {invoice.invoice_number}',
                    'metadata[invoice]': invoice.invoice_number,
                },
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            ref = data.get('id', '')
            client_secret = data.get('client_secret', '')
            return PaymentResult(True, reference=ref, data={'client_secret': client_secret, **data})
        except Exception as exc:
            logger.exception('Stripe payment failed: %s', exc)
            return PaymentResult(False, message=str(exc))

    def verify_payment(self, reference: str) -> PaymentResult:
        try:
            resp = requests.get(
                f'{STRIPE_HOST}/payment_intents/{reference}',
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            paid = data.get('status') == 'succeeded'
            return PaymentResult(paid, reference=reference, data=data)
        except Exception as exc:
            return PaymentResult(False, message=str(exc))

    def parse_webhook(self, data: dict[str, Any]) -> PaymentResult:
        event_type = data.get('type', '')
        pi_data    = data.get('data', {}).get('object', {})
        ref = pi_data.get('id', '')
        return PaymentResult(event_type == 'payment_intent.succeeded', reference=ref, data=data)

    def verify_webhook_signature(self, payload: bytes, sig_header: str) -> bool:
        if not self.webhook_secret:
            return True
        try:
            parts = {k: v for part in sig_header.split(',') for k, v in [part.split('=', 1)]}
            ts    = int(parts.get('t', '0'))
            sigs  = parts.get('v1', '')
            signed = f'{ts}.{payload.decode()}'
            expected = hmac.new(self.webhook_secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
            if abs(time.time() - ts) > 300:
                return False
            return hmac.compare_digest(expected, sigs)
        except Exception:
            return False
