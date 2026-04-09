from django.urls import path
from . import api_views

urlpatterns = [
    path('me/', api_views.MeAPIView.as_view(), name='v1-me'),
]
