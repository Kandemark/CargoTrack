"""
Management command to run the Redis Streams event consumer.

Usage:
    python manage.py stream_worker

Run this as a long-lived process alongside the web server (e.g., in a
separate Docker container or a Supervisor-managed process).  The worker
listens on all CargoTrack event streams and dispatches to registered
handlers with retry and dead-letter support.

Scaling: you can run multiple instances of this command in parallel; Redis
consumer groups ensure each message is delivered to exactly one worker.
"""
from django.core.management.base import BaseCommand

from cargotrack.streams import run_consumer


class Command(BaseCommand):
    help = 'Run the Redis Streams event consumer (blocking, long-lived)'

    def handle(self, **options):
        self.stdout.write(self.style.SUCCESS('Starting stream worker...'))
        self.stdout.write('Listening on streams: ct:events:shipments, alerts, payments, tracking')
        self.stdout.write('Press Ctrl+C to stop.')
        run_consumer()
