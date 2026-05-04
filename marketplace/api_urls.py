"""marketplace/api_urls.py — URL patterns for freight marketplace and bidding."""
from django.urls import path
from . import api_views

urlpatterns = [
    path('listings/',                   api_views.FreightListingListCreateView.as_view(), name='v1-marketplace-listings'),
    path('listings/<int:pk>/',          api_views.FreightListingDetailView.as_view(),     name='v1-marketplace-listing-detail'),
    path('listings/<int:pk>/bid/',      api_views.BidCreateView.as_view(),                name='v1-marketplace-bid-create'),
    path('bids/<int:pk>/accept/',       api_views.BidAcceptView.as_view(),                name='v1-marketplace-bid-accept'),
    path('my-bids/',                    api_views.MyBidsView.as_view(),                   name='v1-marketplace-my-bids'),
    path('my-listings/',                api_views.MyListingsView.as_view(),               name='v1-marketplace-my-listings'),
]
