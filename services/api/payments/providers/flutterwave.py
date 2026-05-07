"""
payments/providers/flutterwave.py — Flutterwave (Pan-Africa: cards, bank, mobile money).

Env vars:
  FLW_SECRET_KEY
  FLW_PUBLIC_KEY
"""
import hashlib
import hmac
import json
import logging
from typing import Any

import requests
from decouple import config

from .base import BaseProvider, PaymentResult

logger = logging.getLogger(__name__)

FLW_HOST = 'https://api.flutterwave.com/v3'


class FlutterwaveProvider(BaseProvider):
    def __init__(self):
        self.secret_key = config('FLUTTERWAVE_SECRET_KEY', default='')
        self.public_key = config('FLUTTERWAVE_PUBLIC_KEY', default='')

    def _headers(self) -> dict[str, str]:
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type':  'application/json',
        }

    def initiate_payment(self, invoice: Any, phone_or_card: str) -> PaymentResult:
        if not self.secret_key:
            return PaymentResult(False, message='Flutterwave not configured.')
        try:
            currency = invoice.currency or 'KES'
            resp = requests.post(
                f'{FLW_HOST}/charges?type=mobile_money_rwanda',
                json={
                    'tx_ref':       invoice.invoice_number,
                    'amount':       str(invoice.amount_kes),
                    'currency':     currency,
                    'email':        'client@cargotrack.io',
                    'phone_number': phone_or_card,
                    'order_id':     invoice.invoice_number,
                },
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            ref = data.get('data', {}).get('flw_ref', invoice.invoice_number)
            return PaymentResult(True, reference=ref, data=data)
        except Exception as exc:
            logger.exception('Flutterwave payment failed: %s', exc)
            return PaymentResult(False, message=str(exc))

    def verify_payment(self, reference: str) -> PaymentResult:
        try:
            resp = requests.get(
                f'{FLW_HOST}/transactions/{reference}/verify',
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            paid = data.get('data', {}).get('status') == 'successful'
            return PaymentResult(paid, reference=reference, data=data)
        except Exception as exc:
            return PaymentResult(False, message=str(exc))

    def parse_webhook(self, data: dict[str, Any]) -> PaymentResult:
        """Verify Flutterwave webhook and extract payment status."""
        event = data.get('event', '')
        flw_data = data.get('data', {})
        ref    = str(flw_data.get('id', flw_data.get('tx_ref', '')))
        status = flw_data.get('status', '')
        return PaymentResult(
            success=event == 'charge.completed' and status == 'successful',
            reference=ref,
            data=data,
        )

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        secret = config('FLUTTERWAVE_WEBHOOK_HASH', default='')
        if not secret:
            return True
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
