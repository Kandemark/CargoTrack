"""alerts/views.py"""
from django.views.generic import ListView
from django.views import View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from .models import Alert


class AlertListView(LoginRequiredMixin, ListView):
    model = Alert
    template_name = "alerts/notifications.html"
    context_object_name = "notifications"
    paginate_by = 30

    def get_queryset(self):
        return Alert.objects.filter(acknowledged=False).order_by("-sent_at")


class AcknowledgeAlertView(LoginRequiredMixin, View):
    def post(self, request, pk):
        alert = get_object_or_404(Alert, pk=pk)
        alert.acknowledged = True
        alert.acknowledged_by = request.user
        alert.save(update_fields=["acknowledged", "acknowledged_by"])
        return redirect("alerts:list")
