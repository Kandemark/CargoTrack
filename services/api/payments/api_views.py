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

from cargotrack.cache import invalidate_dashboard_caches
from cargotrack.authz import CanViewFinance, CanManageFinance, OrgScopedQueryset
from .models import Invoice, Payment
from .providers import get_provider
from .serializers import InvoiceCreateSerializer, InvoiceSerializer, PayInitiateSerializer

logger = logging.getLogger(__name__)


# ── Invoice endpoints ─────────────────────────────────────────────────────────

class InvoiceListCreateAPIView(OrgScopedQueryset, generics.ListCreateAPIView):
    """GET/POST /api/v1/invoices/ — view for GET, manage for POST."""
    permission_classes = [permissions.IsAuthenticated, CanViewFinance]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), CanManageFinance()]
        return [permissions.IsAuthenticated(), CanViewFinance()]

    def get_queryset(self):
        qs = Invoice.objects.select_related('shipment').prefetch_related('payments')
        qs = self.scope_by_org(qs)
        return qs

    def get_serializer_class(self):
        return InvoiceCreateSerializer if self.request.method == 'POST' else InvoiceSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        invalidate_dashboard_caches()

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        out = InvoiceSerializer(ser.instance, context=self.get_serializer_context())
        return Response(out.data, status=status.HTTP_201_CREATED)


class InvoiceDetailAPIView(generics.RetrieveAPIView):
    """GET /api/v1/invoices/<pk>/"""
    permission_classes = [permissions.IsAuthenticated, CanViewFinance]
    queryset = Invoice.objects.select_related('shipment').prefetch_related('payments')
    serializer_class = InvoiceSerializer


class InvoicePayAPIView(APIView):
    """
    POST /api/v1/invoices/<pk>/pay/
    Body: { provider, phone_number?, card_token? }
    """
    permission_classes = [permissions.IsAuthenticated, CanManageFinance]

    def post(self, request, pk=None, **kwargs):
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
    Returns a print-ready HTML invoice.
    """
    permission_classes = [permissions.IsAuthenticated, CanViewFinance]

    def get(self, request, pk=None, **kwargs):
        invoice = Invoice.objects.select_related('shipment', 'created_by').get(pk=pk)
        payments = invoice.payments.all()

        payment_rows = ''
        for p in payments:
            payment_rows += f'''
            <tr>
                <td>{p.created_at.strftime('%d %b %Y %H:%M')}</td>
                <td>{p.provider}</td>
                <td>{p.provider_reference or '—'}</td>
                <td>{p.get_status_display()}</td>
            </tr>'''

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice {invoice.invoice_number}</title>
<style>
  body {{ font-family: 'Segoe UI', system-ui, sans-serif; margin: 40px; color: #1e293b; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f2d5e; padding-bottom: 20px; margin-bottom: 30px; }}
  .logo {{ font-size: 24px; font-weight: 800; color: #0f2d5e; }}
  .logo span {{ color: #f97316; }}
  .invoice-title {{ font-size: 28px; font-weight: 700; color: #0f2d5e; }}
  .meta {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px; }}
  .meta-box {{ background: #f8fafc; border-radius: 8px; padding: 16px; }}
  .meta-label {{ font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; margin-bottom: 4px; }}
  .meta-value {{ font-size: 14px; font-weight: 600; }}
  .amount {{ font-size: 32px; font-weight: 800; color: #0f2d5e; text-align: right; margin: 20px 0; }}
  .amount span {{ color: #f97316; }}
  table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
  th {{ background: #0f2d5e; color: white; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }}
  td {{ padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }}
  .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }}
  .status {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }}
  .status-PAID {{ background: #dcfce7; color: #16a34a; }}
  .status-PENDING {{ background: #fef3c7; color: #d97706; }}
  .status-FAILED {{ background: #fee2e2; color: #dc2626; }}
  .status-REFUNDED {{ background: #f1f5f9; color: #64748b; }}
  @media print {{ body {{ margin: 0; }} }}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Cargo<span>Track</span></div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">Logistics Intelligence Platform</div>
  </div>
  <div class="invoice-title">INVOICE</div>
</div>

<div class="meta">
  <div>
    <div class="meta-box">
      <div class="meta-label">Invoice Number</div>
      <div class="meta-value">{invoice.invoice_number}</div>
    </div>
    <div class="meta-box" style="margin-top:8px;">
      <div class="meta-label">Shipment</div>
      <div class="meta-value">{invoice.shipment.tracking_number}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">{invoice.shipment.route.origin} → {invoice.shipment.route.destination}</div>
    </div>
  </div>
  <div>
    <div class="meta-box">
      <div class="meta-label">Date Issued</div>
      <div class="meta-value">{invoice.created_at.strftime('%d %B %Y')}</div>
    </div>
    <div class="meta-box" style="margin-top:8px;">
      <div class="meta-label">Status</div>
      <span class="status status-{invoice.status}">{invoice.get_status_display()}</span>
    </div>
  </div>
</div>

<div class="amount">
  {invoice.amount_kes:,.2f} <span>{invoice.currency}</span>
</div>

<div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;">
  <div class="meta-label">Description</div>
  <div style="font-size:14px;">{invoice.description or 'Freight & logistics services'}</div>
</div>

<h3 style="font-size:14px;color:#0f2d5e;margin-top:24px;">Payment History</h3>
<table>
  <thead>
    <tr><th>Date</th><th>Provider</th><th>Reference</th><th>Status</th></tr>
  </thead>
  <tbody>
    {payment_rows if payment_rows else '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No payment attempts yet</td></tr>'}
  </tbody>
</table>

<div class="footer">
  CargoTrack Logistics Intelligence &mdash; {invoice.created_at.strftime('%Y')} &mdash; support@cargotrack.io
</div>
</body>
</html>'''
        resp = HttpResponse(html, content_type='text/html')
        resp['Content-Disposition'] = f'inline; filename="{invoice.invoice_number}.html"'
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
            invalidate_dashboard_caches()

            # Publish to event stream for async notification processing
            from cargotrack.streams import publish
            publish('payments', 'payment.received', {
                'payment_id': payment.pk,
                'invoice_id': invoice.pk,
                'provider': provider_name,
                'amount': str(payment.amount),
                'currency': payment.currency,
            })
    except Exception:
        logger.exception('%s webhook processing failed', provider_name)


class MpesaWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, **kwargs):
        _process_webhook('MPESA', request.data)
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


class AirtelWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, **kwargs):
        _process_webhook('AIRTEL', request.data)
        return Response({'status': 'ok'})


class MTNWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, **kwargs):
        _process_webhook('MTN', request.data)
        return Response({'status': 'ok'})


class FlutterwaveWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, **kwargs):
        # Verify signature
        provider = get_provider('FLUTTERWAVE')
        sig = request.headers.get('verif-hash', '')
        if not provider.verify_webhook_signature(request.body, sig):
            return Response(status=status.HTTP_403_FORBIDDEN)
        _process_webhook('FLUTTERWAVE', request.data)
        return Response({'status': 'ok'})


class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, **kwargs):
        provider = get_provider('STRIPE')
        sig = request.headers.get('Stripe-Signature', '')
        if not provider.verify_webhook_signature(request.body, sig):
            return Response(status=status.HTTP_403_FORBIDDEN)
        _process_webhook('STRIPE', request.data)
        return Response({'status': 'ok'})
