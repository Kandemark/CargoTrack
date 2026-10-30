from django.core.management.base import BaseCommand

from shipments.models import Route
from shipments.road import fill_route_geometry


class Command(BaseCommand):
    help = 'Store the road path for every route that has none (or all routes with --force).'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Refetch paths that are already stored.')

    def handle(self, *args, force=False, **options):
        done = sum(fill_route_geometry(r, force=force) for r in Route.objects.all())
        self.stdout.write(self.style.SUCCESS(f'Road paths stored for {done} route(s).'))
