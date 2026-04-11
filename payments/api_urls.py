"""payments/api_urls.py"""
from django.urls import path
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

    # Payment provider webhooks (AllowAny — verified by signature)
    path('payments/webhook/mpesa/',         MpesaWebhookView.as_view(),        name='webhook-mpesa'),
    path('payments/webhook/airtel/',        AirtelWebhookView.as_view(),       name='webhook-airtel'),
    path('payments/webhook/mtn/',           MTNWebhookView.as_view(),          name='webhook-mtn'),
    path('payments/webhook/flutterwave/',   FlutterwaveWebhookView.as_view(),  name='webhook-flutterwave'),
    path('payments/webhook/stripe/',        StripeWebhookView.as_view(),       name='webhook-stripe'),
]
