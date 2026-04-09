"""
tracking/views.py
Class-based JSON views for TrackingEvent CRUD.

OOP:
    - Inheritance:   all views extend Django's View base class.
    - Encapsulation: HTTP method dispatch (get/post/delete) is contained
                     within each view class, not scattered across functions.
"""
import json

from django.http import JsonResponse
from django.views import View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, render, redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from shipments.models import Shipment
from .models import TrackingEvent

VALID_EVENT_TYPES = {et[0] for et in TrackingEvent.EVENT_TYPES}


@method_decorator(csrf_exempt, name="dispatch")
class ShipmentTrackingView(View):
    """
    List all TrackingEvents for a given shipment.

    GET /tracking/shipment/<shipment_id>/
        Returns a JSON array of event.to_dict() for every event belonging
        to the shipment, ordered oldest-first.
        404 JSON if the shipment does not exist.
    """

    def get(self, request, shipment_id):
        try:
            shipment = Shipment.objects.get(pk=shipment_id)
        except Shipment.DoesNotExist:
            return JsonResponse(
                {"error": f"Shipment {shipment_id} not found."},
                status=404,
            )

        events = (
            TrackingEvent.objects
            .filter(shipment=shipment)
            .order_by("timestamp")
        )
        return JsonResponse([e.to_dict() for e in events], safe=False)


@method_decorator(csrf_exempt, name="dispatch")
class LogEventView(View):
    """
    Create a new TrackingEvent from a JSON request body.

    POST /tracking/log/
        Body (JSON): {
            "shipment_id":  <int>     required,
            "event_type":   <str>     required — must be a valid EVENT_TYPES key,
            "location":     <str>     required,
            "notes":        <str>     optional
        }
        Returns 201 with the new event's to_dict() on success.
        Returns 400 with error details on validation failure.
        Sets recorded_by to request.user when the user is authenticated.
    """

    def post(self, request):
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({"error": "Invalid JSON body."}, status=400)

        # ── Required field validation ──────────────────────────────────────
        missing = [f for f in ("shipment_id", "event_type", "location")
                   if not body.get(f)]
        if missing:
            return JsonResponse(
                {"error": f"Missing required fields: {', '.join(missing)}."},
                status=400,
            )

        event_type = body["event_type"]
        if event_type not in VALID_EVENT_TYPES:
            return JsonResponse(
                {
                    "error": f"Invalid event_type '{event_type}'.",
                    "valid_choices": sorted(VALID_EVENT_TYPES),
                },
                status=400,
            )

        try:
            shipment = Shipment.objects.get(pk=body["shipment_id"])
        except Shipment.DoesNotExist:
            return JsonResponse(
                {"error": f"Shipment {body['shipment_id']} not found."},
                status=404,
            )

        recorded_by = request.user if request.user.is_authenticated else None

        event = TrackingEvent.objects.create(
            shipment=shipment,
            event_type=event_type,
            location=body["location"],
            notes=body.get("notes", ""),
            recorded_by=recorded_by,
        )

        return JsonResponse(event.to_dict(), status=201)


@method_decorator(csrf_exempt, name="dispatch")
class EventDetailView(View):
    """
    Retrieve or delete a single TrackingEvent by primary key.

    GET    /tracking/<pk>/   — return event.to_dict() as JSON.
    DELETE /tracking/<pk>/   — delete the event, return 204 No Content.
    """

    def _get_event(self, pk):
        try:
            return TrackingEvent.objects.get(pk=pk), None
        except TrackingEvent.DoesNotExist:
            return None, JsonResponse(
                {"error": f"TrackingEvent {pk} not found."},
                status=404,
            )

    def get(self, request, pk):
        event, err = self._get_event(pk)
        if err:
            return err
        return JsonResponse(event.to_dict())

    def delete(self, request, pk):
        event, err = self._get_event(pk)
        if err:
            return err
        event.delete()
        return JsonResponse({}, status=204)


# ── Public template views (no login required) ─────────────────────────────────

class PublicTrackView(View):
    """
    No login required. Any visitor can look up a shipment by tracking number.

    GET  — render the empty search form.
    POST — look up the tracking number and render results or an error.

    Security:
        - Uses exact-match ORM lookup (no LIKE / raw SQL) — safe from injection.
        - CSRF token is required on POST (standard Django form protection).
        - Does not expose internal PKs or user data in the response.
        - Tracking number is stripped and limited to what the model stores;
          no user-supplied value is rendered unescaped (Django auto-escapes).
    """

    template = 'tracking/public_track.html'

    def get(self, request):
        return render(request, self.template, {'events': None})

    def post(self, request):
        tracking_number = request.POST.get('tracking_number', '').strip().upper()

        if not tracking_number:
            return render(request, self.template, {
                'error': 'Please enter a tracking number.',
                'tracking_number': '',
            })

        try:
            shipment = Shipment.objects.select_related('route').get(
                tracking_number=tracking_number
            )
            events = (
                TrackingEvent.objects
                .filter(shipment=shipment)
                .order_by('timestamp')
            )
            return render(request, self.template, {
                'shipment': shipment,
                'events': events,
                'tracking_number': tracking_number,
            })
        except Shipment.DoesNotExist:
            return render(request, self.template, {
                'error': f'No shipment found with tracking number "{tracking_number}". '
                         f'Please check the number and try again.',
                'tracking_number': tracking_number,
            })


# ── Authenticated template views ──────────────────────────────────────────────

class LogEventFormView(LoginRequiredMixin, View):
    """
    HTML form for logging a TrackingEvent against a specific shipment.

    GET  /tracking/<tracking_number>/log/  — render blank form
    POST /tracking/<tracking_number>/log/  — save event, redirect to shipment detail
    """

    def get(self, request, tracking_number):
        from .forms import TrackingEventForm
        shipment = get_object_or_404(Shipment, tracking_number=tracking_number)
        return render(request, 'tracking/log_event.html', {
            'form': TrackingEventForm(),
            'shipment': shipment,
        })

    def post(self, request, tracking_number):
        from .forms import TrackingEventForm
        shipment = get_object_or_404(Shipment, tracking_number=tracking_number)
        form = TrackingEventForm(request.POST)
        if form.is_valid():
            event = form.save(commit=False)
            event.shipment = shipment
            event.recorded_by = request.user
            event.save()
            from django.contrib import messages
            messages.success(request, f"Event logged for {tracking_number}.")
            return redirect('shipments:detail', tracking_number=tracking_number)
        return render(request, 'tracking/log_event.html', {
            'form': form,
            'shipment': shipment,
        })


