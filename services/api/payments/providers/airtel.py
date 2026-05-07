"""
payments/providers/airtel.py — Airtel Money (Uganda, Rwanda, Tanzania).

Env vars:
  AIRTEL_CLIENT_ID
  AIRTEL_CLIENT_SECRET
  AIRTEL_COUNTRY      (UG | RW | TZ, default: UG)
  AIRTEL_ENVIRONMENT  (sandbox | production, default: sandbox)
"""
import logging
from typing import Any

import requests
from decouple import config

from .base import BaseProvider, PaymentResult

logger = logging.getLogger(__name__)

SANDBOX_HOST    = 'https://openapiuat.airtel.africa'
PRODUCTION_HOST = 'https://openapi.airtel.africa'


class AirtelProvider(BaseProvider):
    def __init__(self):
        self.client_id     = config('AIRTEL_CLIENT_ID',     default='')
        self.client_secret = config('AIRTEL_CLIENT_SECRET', default='')
        self.country       = config('AIRTEL_COUNTRY',       default='UG')
        env = config('AIRTEL_ENVIRONMENT', default='sandbox')
        self.host = PRODUCTION_HOST if env == 'production' else SANDBOX_HOST

    def _get_token(self) -> str:
        resp = requests.post(
            f'{self.host}/auth/oauth2/token',
            json={
                'client_id':     self.client_id,
                'client_secret': self.client_secret,
                'grant_type':    'client_credentials',
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()['access_token']

    def initiate_payment(self, invoice: Any, phone_or_card: str) -> PaymentResult:
        if not self.client_id:
            return PaymentResult(False, message='Airtel Money not configured.')
        try:
            token = self._get_token()
            payload = {
                'reference': invoice.invoice_number,
                'subscriber': {'country': self.country, 'currency': 'KES', 'msisdn': phone_or_card.lstrip('+')},
                'transaction': {'amount': str(invoice.amount_kes), 'country': self.country, 'currency': 'KES', 'id': invoice.invoice_number},
            }
            resp = requests.post(
                f'{self.host}/merchant/v1/payments/',
                json=payload,
                headers={'Authorization': f'Bearer {token}', 'X-Country': self.country, 'X-Currency': 'KES'},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            ref = data.get('data', {}).get('transaction', {}).get('id', '')
            return PaymentResult(True, reference=ref, data=data)
        except Exception as exc:
            logger.exception('Airtel payment failed: %s', exc)
            return PaymentResult(False, message=str(exc))

    def verify_payment(self, reference: str) -> PaymentResult:
        try:
            token = self._get_token()
            resp = requests.get(
                f'{self.host}/standard/v1/payments/{reference}',
                headers={'Authorization': f'Bearer {token}', 'X-Country': self.country},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            status = data.get('data', {}).get('transaction', {}).get('status', '')
            return PaymentResult(status == 'TS', reference=reference, data=data)
        except Exception as exc:
            return PaymentResult(False, message=str(exc))

    def parse_webhook(self, data: dict[str, Any]) -> PaymentResult:
        status = data.get('transaction', {}).get('status', '')
        ref    = data.get('transaction', {}).get('id', '')
        return PaymentResult(status in ('TS', 'SUCCESS'), reference=ref, data=data)
