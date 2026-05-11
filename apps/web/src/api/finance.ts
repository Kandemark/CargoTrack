/**
 * finance.ts — API client for currency conversion, tax rates, and invoice calculation.
 */
import apiClient from './client'

export interface CurrencyConversion {
  from_currency: string
  to_currency: string
  amount: string
  rate: string
  converted: string
}

export interface TaxCountryEntry {
  country_code: string
  country_name: string
  currency: string
  vat_rate: string
  withholding_tax_rate: string
  fuel_surcharge_enabled: boolean
}

export interface TaxSummary {
  countries: TaxCountryEntry[]
}

export interface InvoiceCalculation {
  currency: string
  country_code: string
  subtotal: string
  taxes: {
    vat?: { rate: string; amount: string }
    withholding_tax?: { rate: string; amount: string }
    fuel_surcharge?: { amount: string; transport_cost_base: string }
  }
  total: string
  conversions: Record<string, string>
}

export const financeApi = {
  convert: (params: { from: string; to: string; amount: number }) =>
    apiClient.get<CurrencyConversion>('/api/v1/finance/convert/', { params }),

  taxes: () =>
    apiClient.get<TaxSummary>('/api/v1/finance/taxes/'),

  calculate: (data: { shipment_id?: number; amount_kes?: string; country?: string }) =>
    apiClient.post<InvoiceCalculation>('/api/v1/finance/calculate/', data),
}
