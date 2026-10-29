"""Custom ViewSet actions must accept the URL's extra keyword arguments.

The API is versioned in the URL (/api/v1/...), so DRF passes `version` to
every handler. An @action written as `def readings(self, request, pk=None)`
then fails with a TypeError on every call.
"""
import inspect

from django.urls import get_resolver
from rest_framework.viewsets import ViewSetMixin


def _viewsets(patterns):
    for p in patterns:
        if hasattr(p, 'url_patterns'):
            yield from _viewsets(p.url_patterns)
        else:
            cls = getattr(p.callback, 'cls', None)
            if cls and issubclass(cls, ViewSetMixin):
                yield cls


def test_every_action_accepts_kwargs():
    missing = []
    for cls in set(_viewsets(get_resolver().url_patterns)):
        for extra in cls.get_extra_actions():
            params = inspect.signature(extra).parameters.values()
            if not any(p.kind is p.VAR_KEYWORD for p in params):
                missing.append(f'{cls.__module__}.{cls.__name__}.{extra.__name__}')
    assert not missing, f'actions without **kwargs: {sorted(missing)}'
