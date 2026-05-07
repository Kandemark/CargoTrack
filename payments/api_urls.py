"""payments/api_urls.py"""
from django.urls import path
from cargotrack.async_views import (
    async_airtel_webhook,
    async_flutterwave_webhook,
    async_m_pesa_webhook,
    async_mtn_webhook,
    async_stripe_webhook,
)
from .api_views import (
    InvoiceListCreateAPIView,
    InvoiceDetailAPIView,
    InvoicePayAPIView,
    InvoicePDFAPIView,
    MpesaWebhookView,
    AirtelWebhookView,
    MTNWebhookView,
    FlutterwaveWebhookView,
    StripeWebhookView,
)

urlpatterns = [
    # Invoices
    path('invoices/',               InvoiceListCreateAPIView.as_view(), name='invoice-list'),
    path('invoices/<int:pk>/',      InvoiceDetailAPIView.as_view(),     name='invoice-detail'),
    path('invoices/<int:pk>/pay/',  InvoicePayAPIView.as_view(),        name='invoice-pay'),
    path('invoices/<int:pk>/pdf/',  InvoicePDFAPIView.as_view(),        name='invoice-pdf'),

    # Payment provider webhooks — sync (kept for backwards compatibility)
    path('payments/webhook/mpesa/',         MpesaWebhookView.as_view(),        name='webhook-mpesa'),
    path('payments/webhook/airtel/',        AirtelWebhookView.as_view(),       name='webhook-airtel'),
    path('payments/webhook/mtn/',           MTNWebhookView.as_view(),          name='webhook-mtn'),
    path('payments/webhook/flutterwave/',   FlutterwaveWebhookView.as_view(),  name='webhook-flutterwave'),
    path('payments/webhook/stripe/',        StripeWebhookView.as_view(),       name='webhook-stripe'),

    # Payment provider webhooks — async (preferred for high-throughput scenarios)
    path('payments/webhook/mpesa/async/',         async_m_pesa_webhook,       name='webhook-mpesa-async'),
    path('payments/webhook/airtel/async/',        async_airtel_webhook,       name='webhook-airtel-async'),
    path('payments/webhook/mtn/async/',           async_mtn_webhook,          name='webhook-mtn-async'),
    path('payments/webhook/flutterwave/async/',   async_flutterwave_webhook,  name='webhook-flutterwave-async'),
    path('payments/webhook/stripe/async/',        async_stripe_webhook,       name='webhook-stripe-async'),
]
