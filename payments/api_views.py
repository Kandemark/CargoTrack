"""
payments/api_views.py — DRF views for Invoice and Payment endpoints.

Endpoints:
  GET  /api/v1/invoices/                — paginated invoice list
  POST /api/v1/invoices/                — create invoice
  GET  /api/v1/invoices/<pk>/           — invoice detail
  POST /api/v1/invoices/<pk>/pay/       — initiate payment
  GET  /api/v1/invoices/<pk>/pdf/       — download PDF invoice
  POST /api/v1/payments/webhook/mpesa/        — M-Pesa Daraja callback (AllowAny)
  POST /api/v1/payments/webhook/airtel/       — Airtel callback
  POST /api/v1/payments/webhook/mtn/          — MTN MoMo callback
  POST /api/v1/payments/webhook/flutterwave/  — Flutterwave webhook
  POST /api/v1/payments/webhook/stripe/       — Stripe webhook
"""
import logging
from datetime import datetime

from django.http import HttpResponse
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Invoice, Payment
from .providers import get_provider
from .serializers import InvoiceCreateSerializer, InvoiceSerializer, PayInitiateSerializer

logger = logging.getLogger(__name__)


# ── Invoice endpoints ─────────────────────────────────────────────────────────

class InvoiceListCreateAPIView(generics.ListCreateAPIView):
    """GET/POST /api/v1/invoices/"""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Invoice.objects.select_related('shipment').prefetch_related('payments')

    def get_serializer_class(self):
        return InvoiceCreateSerializer if self.request.method == 'POST' else InvoiceSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        out = InvoiceSerializer(ser.instance, context=self.get_serializer_context())
        return Response(out.data, status=status.HTTP_201_CREATED)


class InvoiceDetailAPIView(generics.RetrieveAPIView):
    """GET /api/v1/invoices/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Invoice.objects.select_related('shipment').prefetch_related('payments')
    serializer_class = InvoiceSerializer


class InvoicePayAPIView(APIView):
    """
    POST /api/v1/invoices/<pk>/pay/
    Body: { provider, phone_number?, card_token? }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk=None):
        invoice = Invoice.objects.select_related('shipment').get(pk=pk)
        if invoice.status == 'PAID':
            return Response({'error': 'Invoice already paid.'}, status=status.HTTP_400_BAD_REQUEST)

        ser = PayInitiateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data

        provider_name = vd['provider']
        phone_or_card = vd.get('phone_number') or vd.get('card_token') or ''

        try:
            provider = get_provider(provider_name)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        result = provider.initiate_payment(invoice, phone_or_card)

        # Record the attempt
        Payment.objects.create(
            invoice=invoice,
            provider=provider_name,
            provider_reference=result.reference,
            amount=invoice.amount_kes,
            currency=invoice.currency,
            phone_number=phone_or_card,
            status='PENDING' if result.success else 'FAILED',
        )

        if not result.success:
            return Response({'error': result.message}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'success':   True,
            'provider':  provider_name,
            'reference': result.reference,
            'data':      result.data,
        })


class InvoicePDFAPIView(APIView):
    """
    GET /api/v1/invoices/<pk>/pdf/
    Returns a simple text-based PDF for the invoice (production would use reportlab).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk=None):
        invoice = Invoice.objects.select_related('shipment', 'created_by').get(pk=pk)
        content = (
            f'CargoTrack Invoice\n'
            f'==================\n\n'
            f'Invoice #:  {invoice.invoice_number}\n'
            f'Shipment:   {invoice.shipment.tracking_number}\n'
            f'Amount:     {invoice.amount_kes} {invoice.currency}\n'
            f'Status:     {invoice.get_status_display()}\n'
            f'Date:       {invoice.created_at.strftime("%d %b %Y")}\n\n'
            f'Description:\n{invoice.description or "—"}\n\n'
            f'CargoTrack Logistics Intelligence\n'
        )
        resp = HttpResponse(content, content_type='text/plain')
        resp['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.txt"'
        return resp


# ── Webhook handlers ──────────────────────────────────────────────────────────

def _process_webhook(provider_name: str, data: dict) -> None:
    """Common webhook processing: verify, parse, and update Payment + Invoice."""
    try:
        provider = get_provider(provider_name)
        result = provider.parse_webhook(data)
        if not result.reference:
            return

        payment = Payment.objects.filter(
            provider=provider_name,
            provider_reference=result.reference,
        ).first()

        if not payment:
            logger.warning('%s webhook: no payment found for ref %s', provider_name, result.reference)
            return

        payment.status      = 'SUCCESS' if result.success else 'FAILED'
        payment.raw_webhook = data
        payment.save(update_fields=['status', 'raw_webhook'])

        if result.success:
            invoice = payment.invoice
            invoice.status  = 'PAID'
            invoice.paid_at = datetime.utcnow()
            invoice.save(update_fields=['status', 'paid_at'])
    except Exception:
        logger.exception('%s webhook processing failed', provider_name)


class MpesaWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        _process_webhook('MPESA', request.data)
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


class AirtelWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        _process_webhook('AIRTEL', request.data)
        return Response({'status': 'ok'})


class MTNWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        _process_webhook('MTN', request.data)
        return Response({'status': 'ok'})


class FlutterwaveWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Verify signature
        provider = get_provider('FLUTTERWAVE')
        sig = request.headers.get('verif-hash', '')
        if not provider.verify_webhook_signature(request.body, sig):
            return Response(status=status.HTTP_403_FORBIDDEN)
        _process_webhook('FLUTTERWAVE', request.data)
        return Response({'status': 'ok'})


class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        provider = get_provider('STRIPE')
        sig = request.headers.get('Stripe-Signature', '')
        if not provider.verify_webhook_signature(request.body, sig):
            return Response(status=status.HTTP_403_FORBIDDEN)
        _process_webhook('STRIPE', request.data)
        return Response({'status': 'ok'})
