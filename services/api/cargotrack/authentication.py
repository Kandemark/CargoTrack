"""
cargotrack/authentication.py — Cookie-based JWT authentication for DRF.

Provides CookieJWTAuthentication that reads the access token from an httpOnly
cookie instead of the Authorization header.  Falls back to Bearer header auth
so mobile clients (which cannot use httpOnly cookies) continue to work.
"""
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class CookieJWTAuthentication(BaseAuthentication):
    """
    Authenticate via httpOnly ``ct_access`` cookie OR ``Authorization: Bearer`` header.

    Cookie auth is the preferred path for the web frontend (prevents XSS token theft).
    Header auth is retained for mobile and API key clients.

    The cookie is set by CookieTokenObtainPairView and refreshed by
    CookieTokenRefreshView.
    """

    ACCESS_COOKIE = 'ct_access'
    REFRESH_COOKIE = 'ct_refresh'

    def authenticate(self, request):
        # 1. Try cookie first (web frontend)
        raw_token = request.COOKIES.get(self.ACCESS_COOKIE)
        if raw_token:
            try:
                validated = JWTAuthentication().get_validated_token(raw_token)
                user = JWTAuthentication().get_user(validated)
                return (user, validated)
            except InvalidToken:
                pass  # Fall through to header auth

        # 2. Fall back to Authorization header (mobile / API clients)
        header_auth = JWTAuthentication()
        try:
            return header_auth.authenticate(request)
        except InvalidToken:
            return None

    def authenticate_header(self, request):
        return 'Bearer realm="cargotrack"'
