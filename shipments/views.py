"""shipments/views.py — Django template-based views."""
from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import render
from .models import Shipment


class ShipmentListView(LoginRequiredMixin, ListView):
    model = Shipment
    template_name = "shipments/list.html"
    context_object_name = "shipments"
    paginate_by = 20

    def get_queryset(self):
        return Shipment.objects.select_related("route").all()


class ShipmentDetailView(LoginRequiredMixin, DetailView):
    model = Shipment
    template_name = "shipments/detail.html"
    context_object_name = "shipment"
    slug_field = "tracking_number"
    slug_url_kwarg = "tracking_number"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["events"] = self.object.events.order_by("-timestamp")
        return ctx


class ShipmentCreateView(LoginRequiredMixin, CreateView):
    model = Shipment
    template_name = "shipments/create.html"
    fields = [
        "tracking_number", "route", "carrier_name", "weight_kg",
        "scheduled_departure", "scheduled_arrival",
    ]
    success_url = reverse_lazy('shipments:list')


class TrackByNumberView(View):
    """Public tracking view — no login required."""

    def get(self, request):
        return render(request, "shipments/track.html")

    def post(self, request):
        number = request.POST.get("tracking_number", "").strip().upper()
        shipment = Shipment.objects.filter(tracking_number=number).first()
        return render(request, "shipments/track.html", {
            "shipment": shipment,
            "not_found": shipment is None and bool(number),
        })
