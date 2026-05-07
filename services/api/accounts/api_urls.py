"""
accounts/api_urls.py — URL patterns for the accounts app.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import api_views

router = DefaultRouter()
router.register('users', api_views.UserAdminViewSet, basename='admin-users')

urlpatterns = [
    path('me/',                      api_views.MeAPIView.as_view(),                  name='v1-me'),
    path('me/totp/setup/',           api_views.TOTPSetupView.as_view(),             name='v1-me-totp-setup'),
    path('me/totp/verify/',          api_views.TOTPVerifyView.as_view(),            name='v1-me-totp-verify'),
    path('me/totp/disable/',         api_views.TOTPDisableView.as_view(),           name='v1-me-totp-disable'),
    path('me/totp/status/',          api_views.TOTPStatusView.as_view(),            name='v1-me-totp-status'),
    path('me/export/',               api_views.DataExportView.as_view(),            name='v1-me-export'),
    path('me/delete/',               api_views.DeleteAccountView.as_view(),         name='v1-me-delete'),
    path('me/activity/',             api_views.UserActivityView.as_view(),          name='v1-me-activity'),
    path('me/sessions/',             api_views.SessionListView.as_view(),           name='v1-me-sessions'),
    path('me/sessions/<int:pk>/',    api_views.SessionRevokeView.as_view(),         name='v1-me-session-revoke'),
    path('me/stats/',                api_views.UserStatsView.as_view(),             name='v1-me-stats'),
    path('me/security-log/',         api_views.UserSecurityLogView.as_view(),       name='v1-me-security-log'),
    path('change-password/',         api_views.ChangePasswordView.as_view(),         name='change-password'),
    path('notification-prefs/',      api_views.NotificationPrefsView.as_view(),      name='notification-prefs'),
    path('api-keys/',                api_views.APIKeyListCreateView.as_view(),        name='api-keys'),
    path('api-keys/<int:pk>/',       api_views.APIKeyDeleteView.as_view(),            name='api-key-detail'),
    path('organizations/',           api_views.OrganizationListCreateView.as_view(),  name='v1-organizations'),
    path('organizations/join/',      api_views.OrganizationJoinView.as_view(),        name='v1-org-join'),
    path('organizations/<int:pk>/',  api_views.OrganizationDetailView.as_view(),      name='v1-org-detail'),
    path('', include(router.urls)),
]
