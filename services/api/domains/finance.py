"""
Domain: Finance
───────────────
Multi-currency financial calculations for the East African Community —
currency conversion (cross-rate triangulation via USD), per-country VAT /
withholding tax / fuel surcharge, invoice total calculation with line-item
breakdown, and EAC tax summaries.

Aggregate Roots
~~~~~~~~~~~~~~~
**Invoice** (``finance.models.Invoice``)
    A bill for freight services rendered.

    Invariants:
    - An invoice MUST have at least one line item.
    - ``total`` = sum(line_items) + VAT - WHT + fuel_surcharge.
    - Currency MUST be a supported EAC or reference currency.

**Currency** (``finance.models.Currency``)
    An ISO 4217 currency definition with EAC metadata.
    Reference data — rarely changes.

    Invariants:
    - ``code`` is unique (ISO 4217).
    - ``decimal_places`` >= 0.

Owns
~~~~
- ``finance``             Library module — models + services (NOT a Django app)
- ``payments``            Django app — Invoice, payment gateway integrations

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment model (invoice line-item FK)
- ``domains.identity``    User model (client FK)
"""

from domains._value_objects import Money

from finance.services import (
    EAC_TAX_DEFAULTS,
    STATIC_RATES,
    calculate_fuel_surcharge,
    calculate_invoice_total,
    calculate_vat,
    calculate_withholding_tax,
    convert_currency,
    get_country_tax,
    get_eac_tax_summary,
    get_exchange_rate,
)

from shipments.api_views import (
    CurrencyConvertView,
    InvoiceCalculateView,
    TaxSummaryView,
)

__all__ = [
    # Value Objects
    "Money",
    # Tax data
    "EAC_TAX_DEFAULTS",
    "STATIC_RATES",
    # Services
    "calculate_fuel_surcharge",
    "calculate_invoice_total",
    "calculate_vat",
    "calculate_withholding_tax",
    "convert_currency",
    "CurrencyConvertView",
    "get_country_tax",
    "get_eac_tax_summary",
    "get_exchange_rate",
    "InvoiceCalculateView",
    "TaxSummaryView",
]
