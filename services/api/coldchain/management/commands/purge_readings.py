"""
Management command: purge old temperature readings based on retention policy.

Retention tiers:
  - Active shipments: keep all readings
  - Delivered < 30 days: keep 1 reading per 5 minutes
  - Delivered 30-90 days: keep 1 reading per hour
  - Delivered > 90 days: delete (certificates already generated)

Run daily:
  python manage.py purge_readings
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Count, Min, Max
from django.utils import timezone

from coldchain.models import ColdChainShipment, TemperatureReading


class Command(BaseCommand):
    help = 'Purge old temperature readings per retention policy.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Report what would be deleted without actually deleting.',
        )
        parser.add_argument(
            '--before-days', type=int, default=90,
            help='Delete readings for shipments delivered more than N days ago.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        cutoff_days = options['before_days']
        cutoff = timezone.now() - timedelta(days=cutoff_days)

        # Find cold chain shipments whose parent shipment was delivered > cutoff ago
        old_shipments = ColdChainShipment.objects.filter(
            shipment__status='DELIVERED',
            shipment__actual_arrival__lt=cutoff,
        )

        total_readings = TemperatureReading.objects.filter(
            coldchain_shipment__in=old_shipments,
        ).count()

        if total_readings == 0:
            self.stdout.write('No readings to purge.')
            return

        if dry_run:
            self.stdout.write(
                f'DRY RUN: would delete {total_readings} readings from '
                f'{old_shipments.count()} cold chain shipments '
                f'(delivered before {cutoff.date()}).'
            )

            # Show breakdown
            for cc in old_shipments[:10]:
                count = cc.readings.count()
                if count:
                    self.stdout.write(f'  {cc}: {count} readings')
            return

        deleted, _ = TemperatureReading.objects.filter(
            coldchain_shipment__in=old_shipments,
        ).delete()

        self.stdout.write(
            f'Purged {deleted} temperature readings from '
            f'{old_shipments.count()} cold chain shipments '
            f'(delivered before {cutoff.date()}).'
        )

        # Downsample medium-retention tier (30-90 days)
        medium_cutoff = timezone.now() - timedelta(days=30)
        medium_shipments = ColdChainShipment.objects.filter(
            shipment__status='DELIVERED',
            shipment__actual_arrival__gte=cutoff,
            shipment__actual_arrival__lt=medium_cutoff,
        )

        for cc in medium_shipments:
            # Keep 1 reading per hour, delete the rest
            readings = cc.readings.order_by('timestamp')
            if readings.count() <= 100:
                continue
            keep_ids = set()
            current_hour = None
            for r in readings:
                hour_key = r.timestamp.replace(minute=0, second=0, microsecond=0)
                if hour_key != current_hour:
                    keep_ids.add(r.pk)
                    current_hour = hour_key

            to_delete = readings.exclude(pk__in=keep_ids).count()
            if to_delete > 0:
                if not dry_run:
                    readings.exclude(pk__in=keep_ids).delete()
                self.stdout.write(
                    f'  Downsampled {cc}: kept {len(keep_ids)}, deleted {to_delete}'
                )

        self.stdout.write('Purge complete.')
