"""
finance/services.py — Multi-currency financial calculations.

Handles:
    - Currency conversion at current/latest exchange rate
    - VAT calculation per country
    - Withholding tax computation
    - Fuel surcharge by country
    - Invoice total calculation with tax breakdown
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.db.models import Q

logger = logging.getLogger(__name__)


# ── EAC Country Tax Defaults ───────────────────────────────────────────────

EAC_TAX_DEFAULTS = {
    "KE": {
        "vat": Decimal("0.16"),
        "withholding_tax": Decimal("0.05"),
        "excise_duty": {},  # product-specific
        "fuel_surcharge_enabled": True,
        "currency": "KES",
    },
    "TZ": {
        "vat": Decimal("0.18"),
        "withholding_tax": Decimal("0.05"),
        "excise_duty": {},
        "fuel_surcharge_enabled": True,
        "currency": "TZS",
    },
    "UG": {
        "vat": Decimal("0.18"),
        "withholding_tax": Decimal("0.06"),
        "excise_duty": {},
        "fuel_surcharge_enabled": True,
        "currency": "UGX",
    },
    "RW": {
        "vat": Decimal("0.18"),
        "withholding_tax": Decimal("0.05"),
        "excise_duty": {},
        "fuel_surcharge_enabled": True,
        "currency": "RWF",
    },
    "BI": {
        "vat": Decimal("0.18"),
        "withholding_tax": Decimal("0.05"),
        "excise_duty": {},
        "fuel_surcharge_enabled": False,
        "currency": "BIF",
    },
}

# ── Static Exchange Rates (updated from CBK, BOT, BOU APIs in production) ──

STATIC_RATES: dict[str, dict[str, Decimal]] = {
    "USD": {"KES": Decimal("129.50"), "TZS": Decimal("2560.00"), "UGX": Decimal("3760.00"),
            "RWF": Decimal("1350.00"), "BIF": Decimal("2900.00")},
    "KES": {"USD": Decimal("0.0077"), "TZS": Decimal("19.77"), "UGX": Decimal("29.03"),
            "RWF": Decimal("10.42"), "BIF": Decimal("22.39")},
    "TZS": {"KES": Decimal("0.0506"), "USD": Decimal("0.00039"), "UGX": Decimal("1.47"),
            "RWF": Decimal("0.53"), "BIF": Decimal("1.13")},
    "UGX": {"KES": Decimal("0.0345"), "TZS": Decimal("0.68"), "USD": Decimal("0.00027"),
            "RWF": Decimal("0.36"), "BIF": Decimal("0.77")},
    "RWF": {"KES": Decimal("0.096"), "TZS": Decimal("1.90"), "UGX": Decimal("2.79"),
            "USD": Decimal("0.00074"), "BIF": Decimal("2.15")},
    "BIF": {"KES": Decimal("0.045"), "TZS": Decimal("0.88"), "UGX": Decimal("1.30"),
            "RWF": Decimal("0.47"), "USD": Decimal("0.00034")},
    "EUR": {"KES": Decimal("142.00"), "TZS": Decimal("2810.00"), "UGX": Decimal("4130.00"),
            "USD": Decimal("1.10")},
    "GBP": {"KES": Decimal("164.00"), "TZS": Decimal("3240.00"), "UGX": Decimal("4780.00"),
            "USD": Decimal("1.27")},
}


def get_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """Get the current exchange rate between two EAC currencies."""
    if from_currency == to_currency:
        return Decimal("1")

    rates = STATIC_RATES.get(from_currency.upper(), {})
    rate = rates.get(to_currency.upper())

    if rate is None and from_currency.upper() != "USD":
        # Cross-rate via USD
        to_usd = STATIC_RATES.get(from_currency.upper(), {}).get("USD")
        from_usd = STATIC_RATES.get("USD", {}).get(to_currency.upper())
        if to_usd and from_usd:
            rate = to_usd * from_usd

    return rate or Decimal("1")


def convert_currency(amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
    """Convert an amount from one currency to another."""
    rate = get_exchange_rate(from_currency, to_currency)
    return (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_country_tax(country_code: str, tax_type: str = "vat") -> Decimal:
    """Get the tax rate for a given EAC country."""
    country = EAC_TAX_DEFAULTS.get(country_code.upper(), EAC_TAX_DEFAULTS["KE"])
    return country.get(tax_type, Decimal("0"))


def calculate_vat(net_amount: Decimal, country_code: str) -> Decimal:
    """Calculate VAT for a net amount in a given country."""
    vat_rate = get_country_tax(country_code, "vat")
    return (net_amount * vat_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_withholding_tax(amount: Decimal, country_code: str) -> Decimal:
    """Calculate withholding tax."""
    wht_rate = get_country_tax(country_code, "withholding_tax")
    return (amount * wht_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_fuel_surcharge(
    transport_cost: Decimal, country_code: str,
    base_fuel_price: Optional[Decimal] = None,
    current_fuel_price: Optional[Decimal] = None,
) -> Decimal:
    """
    Calculate fuel surcharge based on fuel price variance.
    
    Formula: surcharge = transport_cost * ((current_price - base_price) / base_price)
    Only applied if variance exceeds 5% threshold.
    """
    country = EAC_TAX_DEFAULTS.get(country_code.upper(), EAC_TAX_DEFAULTS["KE"])
    if not country.get("fuel_surcharge_enabled", False):
        return Decimal("0")

    # Default fuel prices for EAC (USD per litre, approximate)
    if base_fuel_price is None:
        base_prices = {"KE": Decimal("1.20"), "TZ": Decimal("1.15"), "UG": Decimal("1.25"),
                        "RW": Decimal("1.30"), "BI": Decimal("1.35")}
        base_fuel_price = base_prices.get(country_code.upper(), Decimal("1.20"))
    
    if current_fuel_price is None:
        current_prices = {"KE": Decimal("1.35"), "TZ": Decimal("1.25"), "UG": Decimal("1.40"),
                          "RW": Decimal("1.42"), "BI": Decimal("1.38")}
        current_fuel_price = current_prices.get(country_code.upper(), Decimal("1.30"))

    if base_fuel_price == 0:
        return Decimal("0")

    variance_pct = (current_fuel_price - base_fuel_price) / base_fuel_price
    if variance_pct <= Decimal("0.05"):
        return Decimal("0")

    surcharge = transport_cost * variance_pct
    return surcharge.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_invoice_total(
    line_items: list[dict],
    currency: str = "USD",
    country_code: str = "KE",
    include_vat: bool = True,
    include_wht: bool = False,
    include_fuel_surcharge: bool = False,
    transport_cost: Decimal = Decimal("0"),
) -> dict:
    """
    Calculate a complete invoice breakdown.

    Returns dict with subtotal, tax breakdown, and total.
    """
    subtotal = sum(Decimal(str(item.get("unit_price", 0))) *
                   Decimal(str(item.get("quantity", 1)))
                   for item in line_items)
    subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    breakdown = {
        "currency": currency,
        "country_code": country_code,
        "subtotal": str(subtotal),
        "taxes": {},
        "total": str(subtotal),
    }

    vat_amount = Decimal("0")
    if include_vat:
        vat_amount = calculate_vat(subtotal, country_code)
        breakdown["taxes"]["vat"] = {
            "rate": str(get_country_tax(country_code, "vat") * 100) + "%",
            "amount": str(vat_amount),
        }

    wht_amount = Decimal("0")
    if include_wht:
        wht_amount = calculate_withholding_tax(subtotal, country_code)
        breakdown["taxes"]["withholding_tax"] = {
            "rate": str(get_country_tax(country_code, "withholding_tax") * 100) + "%",
            "amount": str(wht_amount),
        }

    fuel_surcharge = Decimal("0")
    if include_fuel_surcharge and transport_cost > 0:
        fuel_surcharge = calculate_fuel_surcharge(transport_cost, country_code)
        if fuel_surcharge > 0:
            breakdown["taxes"]["fuel_surcharge"] = {
                "amount": str(fuel_surcharge),
                "transport_cost_base": str(transport_cost),
            }

    total = subtotal + vat_amount - wht_amount + fuel_surcharge
    breakdown["total"] = str(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    # Add conversions to common currencies
    breakdown["conversions"] = {}
    for target in ["KES", "USD", "EUR"]:
        if target != currency.upper():
            try:
                rate = get_exchange_rate(currency.upper(), target)
                breakdown["conversions"][target] = str(
                    (total * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                )
            except Exception:
                pass

    return breakdown


def get_eac_tax_summary() -> list[dict]:
    """Return a summary of tax rates across all EAC countries."""
    summary = []
    for country_code, taxes in EAC_TAX_DEFAULTS.items():
        country_names = {"KE": "Kenya", "TZ": "Tanzania", "UG": "Uganda",
                         "RW": "Rwanda", "BI": "Burundi"}
        summary.append({
            "country_code": country_code,
            "country_name": country_names.get(country_code, country_code),
            "currency": taxes["currency"],
            "vat_rate": str(taxes["vat"] * 100) + "%",
            "withholding_tax_rate": str(taxes["withholding_tax"] * 100) + "%",
            "fuel_surcharge_enabled": taxes["fuel_surcharge_enabled"],
        })
    return summary
