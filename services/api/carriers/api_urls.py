"""
carriers/api_urls.py — URL patterns for carriers and rate cards.

Mounted at /api/v1/ by cargotrack/api_urls.py.
"""
from django.urls import path
from . import api_views

urlpatterns = [
    path('carriers/',              api_views.CarrierListCreateView.as_view(),  name='v1-carrier-list'),
    path('carriers/<int:pk>/',     api_views.CarrierDetailView.as_view(),      name='v1-carrier-detail'),
    path('rate-cards/',            api_views.RateCardListCreateView.as_view(), name='v1-ratecards-list'),
    path('rate-cards/<int:pk>/',   api_views.RateCardDetailView.as_view(),     name='v1-ratecards-detail'),
]
