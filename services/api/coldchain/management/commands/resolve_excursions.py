"""
Management command: auto-resolve cold chain excursions when temperature returns to normal.

Run every 5 minutes via cron or scheduled task:
  python manage.py resolve_excursions
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from coldchain.models import TemperatureExcursion, TemperatureReading


class Command(BaseCommand):
    help = 'Auto-resolve cold chain excursions when temperature returns to range.'

    def handle(self, *args, **options):
        active = TemperatureExcursion.objects.filter(
            resolved_at__isnull=True,
        ).select_related('coldchain_shipment')

        resolved_count = 0
        escalated_count = 0

        for exc in active:
            cc = exc.coldchain_shipment
            try:
                latest = TemperatureReading.objects.filter(
                    coldchain_shipment=cc,
                ).order_by('-timestamp').first()

                if latest is None:
                    continue

                if exc.try_auto_resolve(
                    latest.temperature_c, cc.tolerance_minutes,
                ):
                    resolved_count += 1
                elif exc.check_escalation(cc.tolerance_minutes):
                    escalated_count += 1

                # Update SLA tracking
                if hasattr(cc, 'sla'):
                    sla = cc.sla
                    sla.total_excursion_minutes = sum(
                        e.duration_minutes or 0 for e in cc.excursions.all()
                    )
                    sla.total_excursions = cc.excursions.count()
                    sla.save(update_fields=['total_excursion_minutes', 'total_excursions'])
                    sla.check_breach()

            except Exception as e:
                self.stderr.write(f'Error processing excursion {exc.pk}: {e}')

        self.stdout.write(
            f'Processed {active.count()} active excursions: '
            f'{resolved_count} resolved, {escalated_count} escalated.'
        )
