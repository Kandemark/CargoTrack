/**
 * currency.ts — East African currency localization.
 *
 * Detects user country from browser locale and provides currency conversion
 * from USD to local currency with proper symbol and formatting.
 */

// ── EAC currency definitions ──────────────────────────────────────────────

export interface CurrencyInfo {
  code: string
  symbol: string
  name: string
  rateToUSD: number
  locale: string
  decimalPlaces: number
}

const EAC_CURRENCIES: Record<string, CurrencyInfo> = {
  KE: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', rateToUSD: 129, locale: 'en-KE', decimalPlaces: 2 },
  TZ: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', rateToUSD: 2650, locale: 'sw-TZ', decimalPlaces: 0 },
  UG: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', rateToUSD: 3720, locale: 'en-UG', decimalPlaces: 0 },
  RW: { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', rateToUSD: 1400, locale: 'rw-RW', decimalPlaces: 0 },
  BI: { code: 'BIF', symbol: 'FBu', name: 'Burundian Franc', rateToUSD: 2950, locale: 'fr-BI', decimalPlaces: 0 },
  SS: { code: 'SSP', symbol: 'SSP', name: 'South Sudanese Pound', rateToUSD: 1600, locale: 'en-SS', decimalPlaces: 2 },
  US: { code: 'USD', symbol: '$', name: 'US Dollar', rateToUSD: 1, locale: 'en-US', decimalPlaces: 2 },
}

// ── Country detection ──────────────────────────────────────────────────────

const LOCALE_TO_COUNTRY: Record<string, string> = {
  'en-KE': 'KE', 'sw-KE': 'KE',
  'sw-TZ': 'TZ', 'en-TZ': 'TZ',
  'en-UG': 'UG', 'sw-UG': 'UG', 'lg-UG': 'UG',
  'rw-RW': 'RW', 'en-RW': 'RW', 'fr-RW': 'RW',
  'fr-BI': 'BI', 'rn-BI': 'BI', 'en-BI': 'BI',
  'en-SS': 'SS', 'ar-SS': 'SS',
}

function detectCountry(): string {
  if (typeof navigator === 'undefined') return 'KE'
  const lang = navigator.language
  if (LOCALE_TO_COUNTRY[lang]) return LOCALE_TO_COUNTRY[lang]
  for (const [locale, country] of Object.entries(LOCALE_TO_COUNTRY)) {
    if (lang.startsWith(locale.split('-')[0])) return country
  }
  return 'KE'
}

// ── Public API ─────────────────────────────────────────────────────────────

let _cached: CurrencyInfo | null = null

export function getLocalCurrency(): CurrencyInfo {
  if (_cached) return _cached
  const country = detectCountry()
  _cached = EAC_CURRENCIES[country] ?? EAC_CURRENCIES['US']
  return _cached
}

export function convertFromUSD(usdAmount: number): number {
  const currency = getLocalCurrency()
  return Math.round(usdAmount * currency.rateToUSD)
}

export function formatLocalCurrency(usdAmount: number, compact = false): string {
  const currency = getLocalCurrency()
  const localAmount = convertFromUSD(usdAmount)

  if (compact && localAmount >= 1_000_000) {
    return `${currency.symbol} ${(localAmount / 1_000_000).toFixed(1)}M`
  }
  if (compact && localAmount >= 1_000) {
    return `${currency.symbol} ${(localAmount / 1_000).toFixed(0)}K`
  }

  // For zero-decimal currencies, format without decimals
  if (currency.decimalPlaces === 0) {
    return `${currency.symbol} ${localAmount.toLocaleString('en')}`
  }

  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: currency.decimalPlaces,
    }).format(localAmount)
  } catch {
    return `${currency.symbol} ${localAmount.toLocaleString('en')}`
  }
}
