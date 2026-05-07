"""
payments/providers/mtn.py — MTN MoMo Collections API (Uganda, Rwanda).

Env vars:
  MTN_SUBSCRIPTION_KEY
  MTN_API_USER
  MTN_API_KEY
  MTN_ENVIRONMENT      (sandbox | production, default: sandbox)
"""
import logging
import uuid
from typing import Any

import requests
from decouple import config

from .base import BaseProvider, PaymentResult

logger = logging.getLogger(__name__)

SANDBOX_HOST    = 'https://sandbox.momodeveloper.mtn.com'
PRODUCTION_HOST = 'https://proxy.momoapi.mtn.com'


class MTNProvider(BaseProvider):
    def __init__(self):
        self.subscription_key = config('MTN_MOMO_PRIMARY_KEY', default='')
        self.api_user         = config('MTN_MOMO_USER_ID',     default='')
        self.api_key          = config('MTN_MOMO_API_KEY',     default='')
        env = config('MTN_ENVIRONMENT', default='sandbox')
        self.host        = PRODUCTION_HOST if env == 'production' else SANDBOX_HOST
        self.environment = 'mtnuganda' if env == 'production' else 'sandbox'

    def _get_token(self) -> str:
        import base64
        creds = base64.b64encode(f'{self.api_user}:{self.api_key}'.encode()).decode()
        resp = requests.post(
            f'{self.host}/collection/token/',
            headers={
                'Authorization':            f'Basic {creds}',
                'Ocp-Apim-Subscription-Key': self.subscription_key,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()['access_token']

    def initiate_payment(self, invoice: Any, phone_or_card: str) -> PaymentResult:
        if not self.subscription_key:
            return PaymentResult(False, message='MTN MoMo not configured.')
        try:
            token = self._get_token()
            ref = str(uuid.uuid4())
            resp = requests.post(
                f'{self.host}/collection/v1_0/requesttopay',
                json={
                    'amount':      str(invoice.amount_kes),
                    'currency':    'EUR',   # MTN sandbox only supports EUR
                    'externalId':  invoice.invoice_number,
                    'payer':       {'partyIdType': 'MSISDN', 'partyId': phone_or_card.lstrip('+')},
                    'payerMessage': f'Invoice {invoice.invoice_number}',
                    'payeeNote':   'CargoTrack payment',
                },
                headers={
                    'Authorization':            f'Bearer {token}',
                    'X-Reference-Id':           ref,
                    'X-Target-Environment':      self.environment,
                    'Ocp-Apim-Subscription-Key': self.subscription_key,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return PaymentResult(True, reference=ref)
        except Exception as exc:
            logger.exception('MTN payment failed: %s', exc)
            return PaymentResult(False, message=str(exc))

    def verify_payment(self, reference: str) -> PaymentResult:
        try:
            token = self._get_token()
            resp = requests.get(
                f'{self.host}/collection/v1_0/requesttopay/{reference}',
                headers={
                    'Authorization':            f'Bearer {token}',
                    'X-Target-Environment':      self.environment,
                    'Ocp-Apim-Subscription-Key': self.subscription_key,
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return PaymentResult(data.get('status') == 'SUCCESSFUL', reference=reference, data=data)
        except Exception as exc:
            return PaymentResult(False, message=str(exc))

    def parse_webhook(self, data: dict[str, Any]) -> PaymentResult:
        ref    = data.get('referenceId', data.get('externalId', ''))
        status = data.get('status', '')
        return PaymentResult(status == 'SUCCESSFUL', reference=ref, data=data)
