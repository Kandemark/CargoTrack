"""
payments/providers/pesapal.py — Pesapal (Kenya: local cards + bank transfer).

Env vars:
  PESAPAL_CONSUMER_KEY
  PESAPAL_CONSUMER_SECRET
  PESAPAL_ENVIRONMENT  (sandbox | production, default: sandbox)
"""
import logging
from typing import Any

import requests
from decouple import config

from .base import BaseProvider, PaymentResult

logger = logging.getLogger(__name__)

SANDBOX_HOST    = 'https://cybqa.pesapal.com/pesapalv3'
PRODUCTION_HOST = 'https://pay.pesapal.com/v3'


class PesapalProvider(BaseProvider):
    def __init__(self):
        self.consumer_key    = config('PESAPAL_CONSUMER_KEY',    default='')
        self.consumer_secret = config('PESAPAL_CONSUMER_SECRET', default='')
        env = config('PESAPAL_ENVIRONMENT', default='sandbox')
        self.host = PRODUCTION_HOST if env == 'production' else SANDBOX_HOST

    def _get_token(self) -> str:
        resp = requests.post(
            f'{self.host}/api/Auth/RequestToken',
            json={'consumer_key': self.consumer_key, 'consumer_secret': self.consumer_secret},
            headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()['token']

    def initiate_payment(self, invoice: Any, phone_or_card: str) -> PaymentResult:
        if not self.consumer_key:
            return PaymentResult(False, message='Pesapal not configured.')
        try:
            token = self._get_token()
            resp = requests.post(
                f'{self.host}/api/Transactions/SubmitOrderRequest',
                json={
                    'id':          invoice.invoice_number,
                    'currency':    'KES',
                    'amount':      float(invoice.amount_kes),
                    'description': f'Invoice {invoice.invoice_number}',
                    'callback_url': 'https://example.com/payments/callback/',
                    'billing_address': {'phone_number': phone_or_card},
                },
                headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            redirect = data.get('redirect_url', '')
            ref = data.get('order_tracking_id', invoice.invoice_number)
            return PaymentResult(True, reference=ref, data={'redirect_url': redirect, **data})
        except Exception as exc:
            logger.exception('Pesapal payment failed: %s', exc)
            return PaymentResult(False, message=str(exc))

    def verify_payment(self, reference: str) -> PaymentResult:
        try:
            token = self._get_token()
            resp = requests.get(
                f'{self.host}/api/Transactions/GetTransactionStatus?orderTrackingId={reference}',
                headers={'Authorization': f'Bearer {token}'},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            paid = data.get('payment_status_description') == 'Completed'
            return PaymentResult(paid, reference=reference, data=data)
        except Exception as exc:
            return PaymentResult(False, message=str(exc))

    def parse_webhook(self, data: dict[str, Any]) -> PaymentResult:
        ref    = data.get('OrderTrackingId', data.get('order_tracking_id', ''))
        status = data.get('OrderPaymentStatus', data.get('payment_status_description', ''))
        return PaymentResult(status in ('Completed', 'COMPLETED'), reference=ref, data=data)
