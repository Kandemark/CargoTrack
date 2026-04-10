"""
accounts/api_urls.py — URL patterns for the accounts app
==========================================================

Mounted at ``/api/<version>/accounts/`` by cargotrack/api_urls.py.

Routes
------
GET   /api/v1/accounts/me/           Return the authenticated user's profile.
PATCH /api/v1/accounts/me/           Update mutable profile fields (first/last
                                     name, company, phone). Role and email
                                     are read-only via this endpoint.

GET   /api/v1/accounts/users/        List all users (ADMIN only).
GET   /api/v1/accounts/users/<id>/   Retrieve a single user (ADMIN only).
PATCH /api/v1/accounts/users/<id>/   Update role / is_active (ADMIN only).
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import api_views

router = DefaultRouter()
router.register('users', api_views.UserAdminViewSet, basename='admin-users')

urlpatterns = [
    path('me/', api_views.MeAPIView.as_view(), name='v1-me'),
    path('', include(router.urls)),
]
