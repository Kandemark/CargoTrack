"""payments/providers — One module per payment gateway."""
from .mpesa           import MpesaProvider
from .airtel          import AirtelProvider
from .mtn             import MTNProvider
from .flutterwave     import FlutterwaveProvider
from .stripe_provider import StripeProvider
from .pesapal         import PesapalProvider

PROVIDER_MAP = {
    'MPESA':       MpesaProvider,
    'AIRTEL':      AirtelProvider,
    'MTN':         MTNProvider,
    'FLUTTERWAVE': FlutterwaveProvider,
    'STRIPE':      StripeProvider,
    'PESAPAL':     PesapalProvider,
}

def get_provider(name: str):
    """Return an instantiated provider by its uppercase name."""
    cls = PROVIDER_MAP.get(name.upper())
    if not cls:
        raise ValueError(f'Unknown payment provider: {name}')
    return cls()

COUNTRY_DEFAULTS = {
    'KE': ['MPESA', 'PESAPAL', 'FLUTTERWAVE', 'STRIPE'],
    'UG': ['AIRTEL', 'MTN', 'FLUTTERWAVE', 'STRIPE'],
    'RW': ['MTN', 'AIRTEL', 'FLUTTERWAVE', 'STRIPE'],
    'TZ': ['MPESA', 'AIRTEL', 'FLUTTERWAVE', 'STRIPE'],
}
