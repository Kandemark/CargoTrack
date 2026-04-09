"""
accounts/urls.py
Authentication and registration URL configuration.
"""
from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

app_name = "accounts"

urlpatterns = [
    path(
        'login/',
        auth_views.LoginView.as_view(
            template_name='accounts/login.html',
            redirect_authenticated_user=True,
            next_page='/dashboard/',
        ),
        name='login',
    ),
    path(
        'logout/',
        auth_views.LogoutView.as_view(next_page='/accounts/login/'),
        name='logout',
    ),
    path('register/', views.RegisterView.as_view(), name='register'),
]
