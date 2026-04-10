"""
accounts/api_views.py — API views for user accounts
=====================================================

Views
-----
RegisterAPIView
    ``POST /api/auth/register/`` — public endpoint (AllowAny).
    Creates a new user and returns a JWT token pair so the client can
    authenticate immediately after registration.

MeAPIView
    ``GET  /api/v1/accounts/me/`` — return the authenticated user's profile.
    ``PATCH /api/v1/accounts/me/`` — update mutable profile fields.
    Email, username, and role are immutable via this endpoint to prevent
    self-escalation; role changes require admin action.
"""
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from cargotrack.permissions import IsAdminUser, IsClientUser
from .models import CustomUser
from .serializers import RegisterSerializer, UserAdminSerializer, UserMeSerializer


class RegisterAPIView(APIView):
    """
    POST /api/auth/register/

    Open endpoint — no authentication required.

    Accepts: first_name, last_name, email, company, phone, role (CLIENT|CARRIER),
             password, password2.

    On success, creates the user and returns a JWT token pair so the client
    can log in immediately without a second round-trip.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user: CustomUser = serializer.save()  # type: ignore[assignment]

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'access':  str(refresh.access_token),  # type: ignore[attr-defined]
                'refresh': str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class UserAdminViewSet(viewsets.ModelViewSet):
    """
    GET   /api/v1/accounts/users/       — paginated list of all users.
    GET   /api/v1/accounts/users/<id>/  — retrieve a single user.
    PATCH /api/v1/accounts/users/<id>/  — update role or is_active.

    ADMIN only.  Read-only fields (username, email, date_joined, last_login)
    are enforced by UserAdminSerializer.
    """

    permission_classes = [IsAdminUser]
    serializer_class = UserAdminSerializer
    queryset = CustomUser.objects.all().order_by('-date_joined')
    http_method_names = ['get', 'patch', 'head', 'options']

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class MeAPIView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/v1/accounts/me/  — return the authenticated user's profile.
    PATCH /api/v1/accounts/me/ — update first_name, last_name, company, phone.

    Email, username, and role are immutable via this endpoint.
    """
    serializer_class = UserMeSerializer
    permission_classes = [IsClientUser]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):  # type: ignore[override]
        return self.request.user

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
