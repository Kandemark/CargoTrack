from django.apps import AppConfig


class CargotrackConfig(AppConfig):
    name = "cargotrack"
    verbose_name = "CargoTrack Configuration"

    def ready(self):
        from cargotrack.tracing import init_tracing
        init_tracing()
