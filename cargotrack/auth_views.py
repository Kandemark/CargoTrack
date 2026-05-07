"""
cargotrack/auth_views.py — Cookie-based JWT token obtain, refresh, and logout views.

These views wrap SimpleJWT's token views and additionally set/clear httpOnly
cookies so the web frontend never touches JWT tokens in JavaScript.
Mobile clients continue to receive tokens in the response body via the
standard JSON flow.
"""
import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from .authentication import CookieJWTAuthentication


COOKIE_ACCESS = CookieJWTAuthentication.ACCESS_COOKIE
COOKIE_REFRESH = CookieJWTAuthentication.REFRESH_COOKIE


def _cookie_secure() -> bool:
    """Return True for secure cookies (only sent over HTTPS)."""
    return not settings.DEBUG


def _set_token_cookies(response: Response, access: str, refresh: str) -> None:
    """Set httpOnly, Secure, SameSite=Strict cookies on the response."""
    secure = _cookie_secure()
    now = timezone.now()

    # Access token cookie — short-lived
    access_lifetime = jwt_settings.ACCESS_TOKEN_LIFETIME
    access_expiry = now + access_lifetime
    response.set_cookie(
        COOKIE_ACCESS, access,
        expires=access_expiry,
        httponly=True,
        secure=secure,
        samesite='Strict',
        path='/',
    )

    # Refresh token cookie — longer-lived
    refresh_lifetime = jwt_settings.REFRESH_TOKEN_LIFETIME
    refresh_expiry = now + refresh_lifetime
    response.set_cookie(
        COOKIE_REFRESH, refresh,
        expires=refresh_expiry,
        httponly=True,
        secure=secure,
        samesite='Strict',
        path='/api/auth/token/refresh/',  # Only sent to refresh endpoint
    )


def _clear_token_cookies(response: Response) -> None:
    """Remove access and refresh cookies from the browser."""
    response.delete_cookie(COOKIE_ACCESS, path='/')
    response.delete_cookie(COOKIE_REFRESH, path='/api/auth/token/refresh/')


class CookieTokenObtainPairView(APIView):
    """
    POST /api/auth/token/

    Authenticates user credentials and returns JWT tokens both as httpOnly
    cookies (for web) and in the response body (for mobile/API clients).
    """
    from rest_framework.throttling import ScopedRateThrottle
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request, *args, **kwargs):
        # Delegate credential validation to the existing secure view
        from accounts.api_views import SecureTokenObtainPairView
        from django.test import RequestFactory
        # Re-use the existing secure login view logic (lockout, audit logging)
        inner_view = SecureTokenObtainPairView.as_view()
        response = inner_view(request)

        if response.status_code != 200:
            return response

        access = response.data.get('access')
        refresh = response.data.get('refresh')

        if access and refresh:
            _set_token_cookies(response, access, refresh)

        return response


class CookieTokenRefreshView(APIView):
    """
    POST /api/auth/token/refresh/

    Reads the refresh token from the ``ct_refresh`` cookie (web) or the
    request body (mobile).  Issues a new access token cookie and returns
    the new access token in the body.
    """

    def post(self, request, *args, **kwargs):
        # Try cookie first, then body
        refresh_value = request.COOKIES.get(COOKIE_REFRESH) or request.data.get('refresh')

        if not refresh_value:
            return Response(
                {'detail': 'No refresh token provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refresh = RefreshToken(refresh_value)
            # Check blacklist if enabled
            if jwt_settings.BLACKLIST_AFTER_ROTATION:
                from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
                if BlacklistedToken.objects.filter(token__jti=refresh['jti']).exists():
                    return Response(
                        {'detail': 'Refresh token has been revoked.'},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

            access = str(refresh.access_token)
            new_refresh = None

            # Rotation: issue new refresh and blacklist old
            if jwt_settings.ROTATE_REFRESH_TOKENS:
                refresh.set_jti()
                refresh.set_exp()
                new_refresh = str(refresh)
                if jwt_settings.BLACKLIST_AFTER_ROTATION:
                    try:
                        refresh.blacklist()
                    except AttributeError:
                        pass

            response = Response({'access': access})
            _set_token_cookies(response, access, new_refresh or refresh_value)

            return response

        except (InvalidToken, TokenError) as exc:
            response = Response(
                {'detail': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_token_cookies(response)
            return response


class CookieTokenLogoutView(APIView):
    """
    POST /api/auth/token/logout/

    Blacklists the refresh token (if blacklist is enabled) and clears all
    auth cookies from the browser.
    """

    def post(self, request, *args, **kwargs):
        response = Response({'detail': 'Logged out.'})

        # Blacklist the refresh token if provided
        refresh_value = request.COOKIES.get(COOKIE_REFRESH) or request.data.get('refresh')
        if refresh_value:
            try:
                token = RefreshToken(refresh_value)
                if jwt_settings.BLACKLIST_AFTER_ROTATION:
                    token.blacklist()
            except Exception:
                pass  # Non-fatal — tokens may already be expired

        _clear_token_cookies(response)
        return response
