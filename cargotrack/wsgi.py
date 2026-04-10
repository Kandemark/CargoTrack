"""
cargotrack/wsgi.py — WSGI entry point
======================================

Exposes the ``application`` callable required by any WSGI server (Gunicorn,
uWSGI, mod_wsgi).  The Dockerfile.backend CMD uses Gunicorn with 4 workers:

    gunicorn cargotrack.wsgi:application --bind 0.0.0.0:8000 \
        --workers 4 --timeout 120

``DJANGO_SETTINGS_MODULE`` is set here as a fallback for WSGI servers that
don't inherit the shell environment.  The ``env_file`` directive in
docker-compose.yml ensures the production ``.env`` is loaded before Gunicorn
starts, so the ``setdefault`` only takes effect in bare-WSGI environments
(e.g. manual uWSGI invocations without an env file).
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cargotrack.settings')

application = get_wsgi_application()
