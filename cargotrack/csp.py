"""
cargotrack/csp.py — Content Security Policy middleware.

Adds Content-Security-Policy headers to every response to prevent XSS,
clickjacking, and data injection attacks.

Policy is relaxed in DEBUG mode to allow HMR (hot module replacement) from
the Vite dev server.  In production, the policy is strict.
"""
from django.conf import settings


class ContentSecurityPolicyMiddleware:
    """
    Add Content-Security-Policy header to every HTTP response.

    The middleware reads ``settings.CSP_POLICY`` if set; otherwise uses a
    sensible default that allows:
      - Scripts, styles, fonts, images, and API calls from the same origin
      - Inline styles (required by Tailwind CSS and some React libraries)
      - WebSocket connections (wss:) for real-time features
      - Map tile images from https: (Leaflet/MapLibre)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['Content-Security-Policy'] = self._build_policy(request)
        return response

    def _build_policy(self, request) -> str:
        if settings.DEBUG:
            return self._dev_policy()
        return getattr(settings, 'CSP_POLICY', self._production_policy())

    @staticmethod
    def _dev_policy() -> str:
        # Relaxed for Vite HMR (ws://localhost:5173) and inline style injection
        directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # HMR requires eval
            "style-src 'self' 'unsafe-inline'",                 # Tailwind, CSS-in-JS
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:*",  # Vite proxy + WebSocket
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        return '; '.join(directives)

    @staticmethod
    def _production_policy() -> str:
        directives = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",  # Tailwind needs inline styles
            "img-src 'self' data: blob: https:",  # map tiles, uploaded documents
            "font-src 'self'",
            "connect-src 'self' wss:",  # API + WebSocket
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        return '; '.join(directives)
