from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from cargotrack.ml.delay_predictor import DelayPredictor
from shipments.models import Shipment


class Command(BaseCommand):
    help = 'Train and persist the shipment delay prediction model.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--model',
            default='rf',
            choices=sorted(DelayPredictor.MODELS.keys()),
            help='Model backend to train.',
        )

    def handle(self, *args, **options) -> None:
        model_key = options['model']
        shipments = list(
            Shipment.objects.select_related('route').all().order_by('pk')
        )

        labelled_shipments = []
        labels = []

        for shipment in shipments:
            label = self._label_for_shipment(shipment)
            if label is None:
                continue
            labelled_shipments.append(shipment)
            labels.append(label)

        if len(labelled_shipments) < 2:
            raise CommandError(
                'Not enough labelled shipments to train the model. '
                'Need at least 2 completed or delayed shipments.'
            )

        predictor = DelayPredictor(model_key=model_key)
        X = predictor.feature_engineer.fit_transform(labelled_shipments)

        try:
            predictor.train(X, labels)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        predictor.save()
        report = predictor.get_accuracy_report()

        self.stdout.write(
            self.style.SUCCESS(
                f"Model '{model_key}' trained on {report['n_samples']} shipments."
            )
        )
        if report.get('cv_skipped'):
            self.stdout.write(
                self.style.WARNING(
                    f"Cross-validation skipped: {report['cv_skip_reason']}"
                )
            )
        else:
            self.stdout.write(
                f"Cross-validation F1: {report['cv_f1_mean']} "
                f"+/- {report['cv_f1_std']} ({report['cv_folds']} folds)"
            )

    @staticmethod
    def _label_for_shipment(shipment: Shipment) -> int | None:
        if shipment.status == 'DELAYED':
            return 1

        if shipment.actual_arrival is not None:
            return int(shipment.actual_arrival > shipment.scheduled_arrival)

        if shipment.status == 'DELIVERED':
            return 0

        return None
