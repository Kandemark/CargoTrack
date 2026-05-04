"""
carriers/api_views.py — CRUD API views for Carrier and RateCard.
"""
from rest_framework import generics, filters, status
from rest_framework.response import Response

from cargotrack.permissions import IsClientUser, IsManagerUser
from .models import Carrier, RateCard
from .serializers import CarrierSerializer, RateCardSerializer


class CarrierListCreateView(generics.ListCreateAPIView):
    serializer_class = CarrierSerializer
    permission_classes = [IsClientUser]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code', 'country', 'headquarters']

    def get_queryset(self):
        qs = Carrier.objects.prefetch_related('rate_cards').all()
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        return qs


class CarrierDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CarrierSerializer
    permission_classes = [IsManagerUser]
    queryset = Carrier.objects.prefetch_related('rate_cards').all()


class RateCardListCreateView(generics.ListCreateAPIView):
    serializer_class = RateCardSerializer
    permission_classes = [IsClientUser]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'origin', 'destination', 'cargo_type']

    def get_queryset(self):
        qs = RateCard.objects.select_related('carrier').all()
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        carrier = self.request.query_params.get('carrier')
        if carrier:
            qs = qs.filter(carrier_id=carrier)
        return qs


class RateCardDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RateCardSerializer
    permission_classes = [IsManagerUser]
    queryset = RateCard.objects.select_related('carrier').all()
