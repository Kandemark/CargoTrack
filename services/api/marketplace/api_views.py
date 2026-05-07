"""marketplace/api_views.py — REST API views for freight listings and bids."""
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from carriers.models import Carrier
from .models import FreightListing, Bid
from .serializers import (
    BidAcceptSerializer,
    BidCreateSerializer,
    BidSerializer,
    FreightListingCreateSerializer,
    FreightListingSerializer,
)


class FreightListingListCreateView(APIView):
    """GET /api/v1/marketplace/listings/ — list open listings. POST — create new listing."""
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        listings = FreightListing.objects.select_related('posted_by').prefetch_related(
            'bids', 'bids__carrier',
        ).order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            listings = listings.filter(status=status_filter)
        else:
            listings = listings.filter(status__in=['OPEN', 'IN_PROGRESS'])

        cargo_type = request.query_params.get('cargo_type')
        if cargo_type:
            listings = listings.filter(cargo_type=cargo_type)

        origin = request.query_params.get('origin')
        if origin:
            listings = listings.filter(origin__icontains=origin)

        destination = request.query_params.get('destination')
        if destination:
            listings = listings.filter(destination__icontains=destination)

        page = self.paginate_results(listings, request)
        if page is not None:
            serializer = FreightListingSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = FreightListingSerializer(listings, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, **kwargs):
        serializer = FreightListingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        listing = serializer.save(posted_by=request.user)
        return Response(
            FreightListingSerializer(listing, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @property
    def paginator(self):
        from rest_framework.pagination import PageNumberPagination
        if not hasattr(self, '_paginator'):
            self._paginator = PageNumberPagination()
        return self._paginator

    def paginate_results(self, queryset, request):
        page = self.paginator.paginate_queryset(queryset, request)
        if page is not None:
            return page
        return None

    def get_paginated_response(self, data):
        return self.paginator.get_paginated_response(data)


class FreightListingDetailView(APIView):
    """GET /api/v1/marketplace/listings/<pk>/ — single listing with bids."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, **kwargs):
        try:
            listing = FreightListing.objects.select_related('posted_by').prefetch_related(
                'bids', 'bids__carrier', 'bids__truck', 'bids__driver',
            ).get(pk=pk)
        except FreightListing.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        serializer = FreightListingSerializer(listing, context={'request': request})
        return Response(serializer.data)


class BidCreateView(APIView):
    """POST /api/v1/marketplace/listings/<pk>/bid/ — place a bid on a listing."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, **kwargs):
        try:
            listing = FreightListing.objects.get(pk=pk, status__in=['OPEN', 'IN_PROGRESS'])
        except FreightListing.DoesNotExist:
            return Response(
                {'detail': 'Listing not found or no longer open.'}, status=404,
            )

        org = request.user.organization
        if not org:
            return Response(
                {'detail': 'You must belong to an organization to bid.'},
                status=400,
            )
        carrier = Carrier.objects.filter(organization=org, status='ACTIVE').first()
        if not carrier:
            return Response(
                {'detail': 'Your organization has no active carrier to bid with.'},
                status=400,
            )

        if Bid.objects.filter(listing=listing, carrier=carrier).exists():
            return Response(
                {'detail': 'You have already bid on this listing.'}, status=409,
            )

        serializer = BidCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bid = serializer.save(listing=listing, carrier=carrier)

        return Response(
            BidSerializer(bid, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class BidAcceptView(APIView):
    """POST /api/v1/marketplace/bids/<pk>/accept/ — accept a bid and create a shipment."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk, **kwargs):
        try:
            bid = Bid.objects.select_related(
                'listing', 'listing__posted_by', 'carrier', 'truck', 'driver',
            ).get(pk=pk, status='PENDING')
        except Bid.DoesNotExist:
            return Response(
                {'detail': 'Bid not found or not pending.'}, status=404,
            )

        if bid.listing.posted_by != request.user:
            return Response(
                {'detail': 'Only the listing owner can accept a bid.'}, status=403,
            )

        # Accept the selected bid
        bid.status = 'ACCEPTED'
        bid.save(update_fields=['status'])

        # Reject all other bids
        Bid.objects.filter(listing=bid.listing).exclude(pk=bid.pk).update(status='REJECTED')

        # Update listing status
        bid.listing.status = 'AWARDED'
        bid.listing.save(update_fields=['status'])

        # Create a shipment from the awarded listing
        from shipments.models import Shipment
        shipment = Shipment.objects.create(
            client=bid.listing.posted_by,
            carrier=bid.carrier,
            assigned_truck=bid.truck,
            assigned_driver=bid.driver,
            carrier_name=bid.carrier.name,
            origin=bid.listing.origin,
            destination=bid.listing.destination,
            weight_kg=bid.listing.weight_kg,
            status='PENDING',
            dispatch_status='ACCEPTED',
            scheduled_departure=bid.listing.pickup_date,
            scheduled_arrival=bid.listing.delivery_date,
        )
        bid.listing.awarded_shipment = shipment
        bid.listing.save(update_fields=['awarded_shipment'])

        return Response({
            'detail': 'Bid accepted.',
            'bid': BidSerializer(bid, context={'request': request}).data,
            'shipment_id': shipment.id,
        })


class MyBidsView(APIView):
    """GET /api/v1/marketplace/my-bids/ — bids placed by carriers in the current user's organization."""
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        org = request.user.organization
        if not org:
            return Response([])

        carrier_ids = Carrier.objects.filter(organization=org).values_list('pk', flat=True)
        if not carrier_ids:
            return Response([])

        bids = Bid.objects.filter(carrier_id__in=carrier_ids).select_related(
            'listing', 'truck', 'driver',
        ).order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            bids = bids.filter(status=status_filter)

        serializer = BidSerializer(bids, many=True, context={'request': request})
        return Response(serializer.data)


class MyListingsView(APIView):
    """GET /api/v1/marketplace/my-listings/ — listings posted by the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        listings = FreightListing.objects.filter(
            posted_by=request.user,
        ).prefetch_related('bids', 'bids__carrier').order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            listings = listings.filter(status=status_filter)

        serializer = FreightListingSerializer(listings, many=True, context={'request': request})
        return Response(serializer.data)
