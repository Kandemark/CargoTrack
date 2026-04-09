"""accounts/api_views.py"""
from rest_framework import generics
from cargotrack.permissions import IsClientUser
from .serializers import UserMeSerializer


class MeAPIView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/v1/accounts/me/  — return the authenticated user's profile.
    PATCH /api/v1/accounts/me/ — update first_name, last_name, company, phone.

    Email, username, and role are immutable via this endpoint.
    """
    serializer_class = UserMeSerializer
    permission_classes = [IsClientUser]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return self.request.user

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
