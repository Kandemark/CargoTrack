"""
accounts/api_views.py — API views for user accounts
=====================================================

Views
-----
RegisterAPIView
    ``POST /api/auth/register/`` — public endpoint (AllowAny).
    Creates a new user and returns a JWT token pair so the client can
    authenticate immediately after registration.

SecureTokenObtainPairView
    ``POST /api/auth/token/`` — JWT token obtain with account lockout
    protection and audit logging for every authentication attempt.

MeAPIView
    ``GET  /api/v1/accounts/me/`` — return the authenticated user's profile.
    ``PATCH /api/v1/accounts/me/`` — update mutable profile fields.
    Email, username, and role are immutable via this endpoint to prevent
    self-escalation; role changes require admin action.
"""
import datetime

from django.db import models as db_models
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from cargotrack.authz import CanAdminUsers, CanAdminSystem, CanViewAudit, OrgScopedQueryset
from .models import APIKey, AuditEntry, CustomUser, Integration, Notification, Organization
from .serializers import (
    APIKeyCreateSerializer,
    APIKeySerializer,
    AuditEntrySerializer,
    ChangePasswordSerializer,
    IntegrationSerializer,
    NotificationSerializer,
    OrganizationCreateSerializer,
    OrganizationSerializer,
    RegisterSerializer,
    UserAdminSerializer,
    UserMeSerializer,
)


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


class SecureTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/auth/token/

    Extends SimpleJWT's TokenObtainPairView with:
    - TOTP two-factor authentication (if enabled on the account).
    - Account lockout after 5 consecutive failed attempts (15-minute cooldown).
    - Audit logging for every login attempt (success and failure).
    - IP address and User-Agent capture for security forensics.
    - Auth-scoped throttling (30 req/min from settings).

    When TOTP is enabled, the client must include a ``totp_code`` field in
    the request body.  If TOTP is enabled and the field is missing, a
    ``totp_required`` response is returned so the client can prompt the user
    for their authenticator code without re-entering the password.
    """
    permission_classes = [AllowAny]
    from rest_framework.throttling import ScopedRateThrottle
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request, *args, **kwargs):
        username = request.data.get('username', '')
        totp_code = request.data.get('totp_code', '').strip()
        ip = request.META.get('REMOTE_ADDR', '')
        ua = request.META.get('HTTP_USER_AGENT', '')[:500]

        # Lookup user for lockout check
        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            user = None

        # Lockout check
        if user and user.is_locked_out:
            lock_time = user.locked_until.strftime('%H:%M UTC') if user.locked_until else 'later'
            AuditEntry.objects.create(
                user=user, action='LOGIN', resource='auth/token',
                description=f'Blocked — account locked until {lock_time}',
                ip_address=ip, result='FAILURE',
                metadata={'username': username, 'reason': 'account_locked', 'user_agent': ua},
            )
            return Response(
                {'detail': f'Account temporarily locked due to multiple failed attempts. Try again at {lock_time}.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # TOTP check — before password verification so we can short-circuit
        # if the client needs to prompt for a TOTP code.
        if user and user.totp_enabled and not totp_code:
            # First, verify the password so we don't leak whether TOTP is enabled.
            # authenticate() checks credentials without issuing tokens.
            from django.contrib.auth import authenticate
            auth_user = authenticate(
                request=request,
                username=username,
                password=request.data.get('password', ''),
            )
            if auth_user is None:
                if user:
                    user.record_failed_login()
                AuditEntry.objects.create(
                    user=user, action='LOGIN', resource='auth/token',
                    description='Failed login — invalid credentials',
                    ip_address=ip, result='FAILURE',
                    metadata={'username': username, 'reason': 'invalid_credentials', 'user_agent': ua},
                )
                return Response(
                    {'detail': 'Invalid credentials.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            # Password is valid but TOTP is needed
            return Response(
                {
                    'detail': 'TOTP code required.',
                    'totp_required': True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if user and user.totp_enabled and totp_code:
            from .totp_utils import verify_totp, verify_backup_code
            if not verify_totp(user.totp_secret, totp_code) and not verify_backup_code(totp_code, user.totp_backup_codes):
                user.record_failed_login()
                AuditEntry.objects.create(
                    user=user, action='LOGIN', resource='auth/token',
                    description='Failed login — invalid TOTP code',
                    ip_address=ip, result='FAILURE',
                    metadata={'username': username, 'reason': 'invalid_totp', 'user_agent': ua},
                )
                return Response(
                    {'detail': 'Invalid TOTP code.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            # Valid TOTP — persist backup code consumption
            if not verify_totp(user.totp_secret, totp_code):
                user.save(update_fields=['totp_backup_codes'])

        try:
            response = super().post(request, *args, **kwargs)
        except Exception as exc:
            if user:
                user.record_failed_login()
            AuditEntry.objects.create(
                user=user, action='LOGIN', resource='auth/token',
                description='Failed login — invalid credentials',
                ip_address=ip, result='FAILURE',
                metadata={'username': username, 'reason': 'invalid_credentials', 'user_agent': ua},
            )
            raise

        # Success — reset failed counter and log
        if user:
            user.clear_failed_logins()
        AuditEntry.objects.create(
            user=user, action='LOGIN', resource='auth/token',
            description='Successful login'
                + (' (2FA verified)' if user.totp_enabled else ''),
            ip_address=ip, result='SUCCESS',
            metadata={'user_agent': ua},
        )
        return response


class UserAdminViewSet(OrgScopedQueryset, viewsets.ModelViewSet):
    """
    GET   /api/v1/accounts/users/       — paginated list of all users.
    GET   /api/v1/accounts/users/<id>/  — retrieve a single user.
    PATCH /api/v1/accounts/users/<id>/  — update role or is_active.

    ADMIN only.  Read-only fields (username, email, date_joined, last_login)
    are enforced by UserAdminSerializer.
    """

    permission_classes = [IsAuthenticated, CanAdminUsers]
    serializer_class = UserAdminSerializer
    queryset = CustomUser.objects.all().order_by('-date_joined')
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        return self.scope_by_org(qs)

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
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):  # type: ignore[override]
        return self.request.user

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class ChangePasswordView(APIView):
    """POST /api/v1/accounts/change-password/ — change the authenticated user's password."""

    permission_classes = [IsAuthenticated]

    def post(self, request, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data['old_password']):
            return Response(
                {'old_password': ['Incorrect current password.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Password changed successfully.'})


class NotificationPrefsView(APIView):
    """GET/PATCH /api/v1/accounts/notification-prefs/ — read or update notification preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        return Response(request.user.profile.notification_prefs)

    def patch(self, request, **kwargs):
        profile = request.user.profile
        profile.notification_prefs = {**profile.notification_prefs, **request.data}
        profile.save(update_fields=['notification_prefs'])
        return Response(profile.notification_prefs)


class UserPreferencesView(APIView):
    """GET/PATCH /api/v1/accounts/me/preferences/ — read or update display & locale preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        return Response(request.user.profile.display_prefs)

    def patch(self, request, **kwargs):
        profile = request.user.profile
        profile.display_prefs = {**profile.display_prefs, **request.data}
        profile.save(update_fields=['display_prefs'])
        return Response(profile.display_prefs)


class APIKeyListCreateView(APIView):
    """
    GET  /api/v1/accounts/api-keys/ — list the authenticated user's API keys.
    POST /api/v1/accounts/api-keys/ — create a new key (full key returned once only).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        keys = APIKey.objects.filter(user=request.user)
        return Response(APIKeySerializer(keys, many=True).data)

    def post(self, request, **kwargs):
        serializer = APIKeyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        key_obj, raw_key = APIKey.generate(request.user, serializer.validated_data['name'])
        return Response(
            {'id': key_obj.pk, 'name': key_obj.name, 'key': raw_key},
            status=status.HTTP_201_CREATED,
        )


class APIKeyDeleteView(APIView):
    """DELETE /api/v1/accounts/api-keys/<pk>/ — revoke one of the user's API keys."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, **kwargs):
        try:
            key = APIKey.objects.get(pk=pk, user=request.user)
        except APIKey.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        key.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    """GET /api/v1/notifications/ — list notifications for the current user."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user, is_dismissed=False)
        ntype = self.request.query_params.get('type')
        if ntype:
            qs = qs.filter(type=ntype)
        unread = self.request.query_params.get('unread')
        if unread == '1':
            qs = qs.filter(is_read=False)
        return qs


class NotificationMarkReadView(APIView):
    """PATCH /api/v1/notifications/<pk>/read/ — mark a single notification as read."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, **kwargs):
        try:
            n = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        n.is_read = True
        n.save(update_fields=['is_read'])
        return Response(NotificationSerializer(n).data)


class NotificationMarkAllReadView(APIView):
    """PATCH /api/v1/notifications/mark-all-read/ — mark all notifications as read."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, **kwargs):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All notifications marked as read.'})


class NotificationDismissView(APIView):
    """DELETE /api/v1/notifications/<pk>/ — dismiss (soft-delete) a notification."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, **kwargs):
        try:
            n = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        n.is_dismissed = True
        n.save(update_fields=['is_dismissed'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditEntryListView(generics.ListAPIView):
    """GET /api/v1/audit/ — list audit entries (manager/admin only)."""
    serializer_class = AuditEntrySerializer
    permission_classes = [IsAuthenticated, CanViewAudit]

    def get_queryset(self):
        qs = AuditEntry.objects.select_related('user').all()
        action = self.request.query_params.get('action')
        result = self.request.query_params.get('result')
        q = self.request.query_params.get('q')
        if action and action != 'ALL':
            qs = qs.filter(action=action)
        if result and result != 'ALL':
            qs = qs.filter(result=result)
        if q:
            qs = qs.filter(description__icontains=q) | qs.filter(resource__icontains=q)
        return qs


class AuditEntryCreateView(generics.CreateAPIView):
    """POST /api/v1/audit/ — create an audit entry (internal use)."""
    serializer_class = AuditEntrySerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        ip = self.request.META.get('REMOTE_ADDR')
        serializer.save(user=self.request.user, ip_address=ip)


# ── Integrations ──────────────────────────────────────────────────────────────

class IntegrationListView(generics.ListCreateAPIView):
    """GET/POST /api/v1/integrations/ — list or create integrations."""
    serializer_class = IntegrationSerializer
    permission_classes = [IsAuthenticated, CanAdminSystem]

    def get_queryset(self):
        qs = Integration.objects.all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs


class IntegrationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/v1/integrations/<pk>/"""
    serializer_class = IntegrationSerializer
    permission_classes = [IsAuthenticated, CanAdminSystem]
    queryset = Integration.objects.all()


# ── User Activity Timeline ──────────────────────────────────────────────────

class UserActivityView(APIView):
    """
    GET /api/v1/accounts/me/activity/?page_size=30&page=1
    Returns chronological timeline of the user's actions aggregated from
    TrackingEvent, Document uploads, and AuditEntry records.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        from tracking.models import TrackingEvent
        from shipments.models import Document

        page_size = int(request.query_params.get('page_size', 30))
        page = int(request.query_params.get('page', 1))
        activities = []

        # Tracking events logged by the user
        events = TrackingEvent.objects.filter(
            recorded_by=request.user
        ).select_related('shipment').order_by('-timestamp')[:200]
        for e in events:
            activities.append({
                'timestamp': e.timestamp.isoformat(),
                'action_type': 'tracking_event',
                'description': f'{e.get_event_type_display()} — {e.shipment.tracking_number}',
                'resource': f'shipment/{e.shipment_id}',
                'detail': e.location or e.notes or '',
            })

        # Documents uploaded by the user
        docs = Document.objects.filter(
            uploaded_by=request.user
        ).select_related('shipment').order_by('-created_at')[:200]
        for d in docs:
            activities.append({
                'timestamp': d.created_at.isoformat(),
                'action_type': 'document_upload',
                'description': f'Uploaded {d.get_doc_type_display()} — {d.filename}',
                'resource': f'shipment/{d.shipment_id}',
                'detail': d.shipment.tracking_number,
            })

        # Audit entries
        audit_entries = AuditEntry.objects.filter(
            user=request.user
        ).order_by('-created_at')[:200]
        for a in audit_entries:
            activities.append({
                'timestamp': a.created_at.isoformat(),
                'action_type': a.action.lower(),
                'description': a.description,
                'resource': a.resource,
                'detail': a.result or '',
            })

        # Sort by timestamp desc and paginate
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        total = len(activities)
        start = (page - 1) * page_size
        paged = activities[start:start + page_size]

        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'activities': paged,
        })


# ── Session Management ──────────────────────────────────────────────────────

class SessionListView(APIView):
    """
    GET /api/v1/accounts/me/sessions/
    Returns active JWT sessions (refresh tokens) for the current user.
    Includes IP address, user agent, and device info from correlated login events.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            tokens = OutstandingToken.objects.filter(user=request.user).order_by('-created_at')[:20]

            # Gather login audit entries to correlate IP / user-agent with tokens
            login_entries = list(
                AuditEntry.objects.filter(
                    user=request.user, action='LOGIN', result='SUCCESS',
                ).order_by('-created_at')[:50]
            )

            sessions = []
            for t in tokens:
                is_current = False
                try:
                    current_token = request.auth
                    if current_token and hasattr(current_token, 'payload'):
                        is_current = t.jti == current_token.payload.get('jti')
                except Exception:
                    pass

                # Correlate: find the closest login audit entry within 30s of token creation
                ip_address = ''
                user_agent = ''
                device = 'desktop'
                browser = ''
                if t.created_at:
                    best = None
                    best_delta = datetime.timedelta(seconds=30)
                    for entry in login_entries:
                        if entry.created_at:
                            delta = abs(t.created_at - entry.created_at)
                            if delta < best_delta:
                                best_delta = delta
                                best = entry
                    if best:
                        ip_address = best.ip_address or ''
                        ua_str = (best.metadata or {}).get('user_agent', '')
                        user_agent = ua_str[:500] if isinstance(ua_str, str) else ''
                        device, browser = self._parse_user_agent(user_agent)

                sessions.append({
                    'id': t.id,
                    'created_at': t.created_at.isoformat() if t.created_at else None,
                    'is_current': is_current,
                    'expires_at': t.expires_at.isoformat() if t.expires_at else None,
                    'ip_address': ip_address,
                    'user_agent': user_agent,
                    'device': device,
                    'browser': browser,
                })
            return Response({'sessions': sessions})
        except ImportError:
            return Response({'sessions': [], 'message': 'Token blacklist app not enabled.'})

    @staticmethod
    def _parse_user_agent(ua: str) -> tuple[str, str]:
        """Return (device_type, browser_name) from a User-Agent string."""
        ua_lower = ua.lower()
        # Device
        if any(k in ua_lower for k in ('iphone', 'ipad', 'android', 'mobile')):
            device = 'mobile'
        elif 'tablet' in ua_lower or 'ipad' in ua_lower:
            device = 'tablet'
        else:
            device = 'desktop'

        # Browser
        if 'edg/' in ua_lower:
            browser = 'Edge'
        elif 'firefox/' in ua_lower:
            browser = 'Firefox'
        elif 'chrome/' in ua_lower and 'safari/' in ua_lower:
            browser = 'Chrome'
        elif 'safari/' in ua_lower:
            browser = 'Safari'
        elif 'opr/' in ua_lower or 'opera/' in ua_lower:
            browser = 'Opera'
        else:
            browser = 'Unknown'

        return device, browser


class SessionRevokeView(APIView):
    """
    DELETE /api/v1/accounts/me/sessions/<id>/
    Blacklists the specified refresh token, effectively ending that session.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, **kwargs):
        try:
            from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
            token = OutstandingToken.objects.get(pk=pk, user=request.user)
            BlacklistedToken.objects.get_or_create(token=token)
            return Response({'detail': 'Session revoked.'})
        except Exception:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


# ── Personal Stats ──────────────────────────────────────────────────────────

class UserStatsView(APIView):
    """
    GET /api/v1/accounts/me/stats/
    Returns personal KPIs for the dashboard-style profile card.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        from django.db.models import Count
        from django.utils import timezone
        from tracking.models import TrackingEvent
        from shipments.models import Document
        import datetime

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        user_shipments = request.user.client_shipments.all()
        shipments_mtd = user_shipments.filter(created_at__gte=month_start).count()
        total_shipments = user_shipments.count()

        events_logged = TrackingEvent.objects.filter(recorded_by=request.user).count()
        events_mtd = TrackingEvent.objects.filter(
            recorded_by=request.user, timestamp__gte=month_start
        ).count()

        docs_uploaded = Document.objects.filter(uploaded_by=request.user).count()

        alerts_acknowledged = request.GET.get('alerts', 0)  # placeholder; actual alert ack not tracked per-user

        # Most active carrier
        from shipments.models import Shipment
        top_carrier = Shipment.objects.filter(client=request.user).values(
            'carrier_name'
        ).annotate(c=Count('id')).order_by('-c').first()
        most_used_carrier = top_carrier['carrier_name'] if top_carrier else None

        # Monthly activity
        monthly = []
        for i in range(5, -1, -1):
            ms = (now.replace(day=1) - datetime.timedelta(days=i * 31)).replace(day=1)
            me = (ms + datetime.timedelta(days=32)).replace(day=1)
            monthly.append({
                'month': ms.strftime('%b'),
                'shipments': user_shipments.filter(created_at__gte=ms, created_at__lt=me).count(),
                'events': TrackingEvent.objects.filter(recorded_by=request.user, timestamp__gte=ms, timestamp__lt=me).count(),
                'docs': Document.objects.filter(uploaded_by=request.user, created_at__gte=ms, created_at__lt=me).count(),
            })

        return Response({
            'total_shipments': total_shipments,
            'shipments_mtd': shipments_mtd,
            'events_logged': events_logged,
            'events_mtd': events_mtd,
            'docs_uploaded': docs_uploaded,
            'alerts_acknowledged': alerts_acknowledged,
            'most_used_carrier': most_used_carrier,
            'monthly_activity': monthly,
        })


# ── Security Log ────────────────────────────────────────────────────────────

class UserSecurityLogView(APIView):
    """
    GET /api/v1/accounts/me/security-log/?page_size=30
    Returns security-relevant audit entries for the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        page_size = int(request.query_params.get('page_size', 30))
        entries = AuditEntry.objects.filter(
            user=request.user,
            action__in=['LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'API_KEY_CREATE', 'API_KEY_DELETE'],
        ).order_by('-created_at')[:page_size]

        results = []
        for e in entries:
            results.append({
                'timestamp': e.created_at.isoformat(),
                'action': e.action,
                'result': e.result,
                'description': e.description,
                'ip_address': e.ip_address or '',
            })

        return Response({
            'entries': results,
            'last_login': request.user.last_login.isoformat() if request.user.last_login else None,
        })


# ── Organizations ─────────────────────────────────────────────────────────

class OrganizationListCreateView(APIView):
    """GET/POST /api/v1/accounts/organizations/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        orgs = Organization.objects.filter(
            db_models.Q(members=request.user) | db_models.Q(id=request.user.organization_id)
        ).distinct()
        return Response(OrganizationSerializer(orgs, many=True).data)

    def post(self, request, **kwargs):
        serializer = OrganizationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org = serializer.save()
        request.user.organization = org
        request.user.save(update_fields=['organization'])
        return Response(OrganizationSerializer(org).data, status=status.HTTP_201_CREATED)


class OrganizationDetailView(APIView):
    """GET/PATCH /api/v1/accounts/organizations/<pk>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, **kwargs):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrganizationSerializer(org).data)

    def patch(self, request, pk, **kwargs):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OrganizationJoinView(APIView):
    """POST /api/v1/accounts/organizations/join/ — join org by invite code."""
    permission_classes = [IsAuthenticated]

    def post(self, request, **kwargs):
        code = request.data.get('invite_code', '')
        if not code:
            return Response({'detail': 'Invite code is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            org = Organization.objects.get(invite_code=code)
        except Organization.DoesNotExist:
            return Response({'detail': 'Invalid invite code.'}, status=status.HTTP_404_NOT_FOUND)
        request.user.organization = org
        request.user.save(update_fields=['organization'])
        return Response(OrganizationSerializer(org).data)


# ── Data Export & Account Deletion (GDPR-style compliance) ────────────────────

class DataExportView(APIView):
    """
    GET /api/v1/accounts/me/export/

    Returns all personal data associated with the authenticated user as
    a structured JSON document.  This satisfies data-portability
    requirements (GDPR Art. 20, Kenya DPA Sec. 40).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        user = request.user
        from shipments.models import Document, Shipment
        from tracking.models import TrackingEvent
        from payments.models import Invoice, Payment
        from chats.models import Conversation, Message

        export = {
            'exported_at': timezone.now().isoformat(),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone': user.phone,
                'role': user.role,
                'date_joined': user.date_joined.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None,
            },
            'organization': None,
            'profile': {
                'notification_prefs': user.profile.notification_prefs,
            },
        }

        if user.organization:
            org = user.organization
            export['organization'] = {
                'name': org.name,
                'org_type': org.org_type,
                'tax_id': org.tax_id,
                'country': org.country,
                'address': org.address,
            }

        # Shipments
        shipments = user.client_shipments.all().select_related('route')
        export['shipments'] = []
        for s in shipments:
            events = TrackingEvent.objects.filter(shipment=s).order_by('timestamp')
            docs = Document.objects.filter(shipment=s)
            invoices = Invoice.objects.filter(shipment=s)
            export['shipments'].append({
                'tracking_number': s.tracking_number,
                'status': s.status,
                'origin': s.origin,
                'destination': s.destination,
                'scheduled_arrival': s.scheduled_arrival.isoformat() if s.scheduled_arrival else None,
                'actual_arrival': s.actual_arrival.isoformat() if s.actual_arrival else None,
                'created_at': s.created_at.isoformat(),
                'events': [
                    {
                        'event_type': e.event_type,
                        'location': e.location,
                        'notes': e.notes,
                        'timestamp': e.timestamp.isoformat(),
                    }
                    for e in events
                ],
                'documents': [
                    {'filename': d.filename, 'doc_type': d.doc_type, 'created_at': d.created_at.isoformat()}
                    for d in docs
                ],
                'invoices': [
                    {
                        'invoice_number': inv.invoice_number,
                        'amount': str(inv.amount_kes),
                        'status': inv.status,
                        'created_at': inv.created_at.isoformat(),
                    }
                    for inv in invoices
                ],
            })

        # Payments made
        export['payments'] = list(
            Payment.objects.filter(invoice__created_by=user).values(
                'id', 'provider', 'amount', 'currency', 'status', 'created_at',
            )
        )
        for p in export['payments']:
            p['created_at'] = p['created_at'].isoformat()
            p['amount'] = str(p['amount'])

        # Chat messages
        messages = Message.objects.filter(sender=user).select_related('conversation')[:1000]
        export['chat_messages'] = [
            {
                'content': m.content,
                'conversation_id': m.conversation_id,
                'created_at': m.created_at.isoformat(),
            }
            for m in messages
        ]

        # Audit entries
        audit = AuditEntry.objects.filter(user=user)[:100]
        export['audit_log'] = [
            {
                'action': a.action,
                'resource': a.resource,
                'description': a.description,
                'result': a.result,
                'created_at': a.created_at.isoformat(),
            }
            for a in audit
        ]

        # Log the export
        AuditEntry.objects.create(
            user=user, action='EXPORT', resource='accounts/me/export',
            description='Personal data export requested', result='SUCCESS',
            ip_address=request.META.get('REMOTE_ADDR', ''),
        )

        return Response(export)


class DeleteAccountView(APIView):
    """
    DELETE /api/v1/accounts/me/

    Permanently deletes the authenticated user's account and all
    associated data.  This is a hard delete — it cannot be undone.

    Data deleted:
      - User account (CustomUser + UserProfile)
      - All shipments, tracking events, and documents
      - All invoices and payments
      - All chat messages and conversations
      - All notifications and API keys
      - All JWT sessions (blacklisted)
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, **kwargs):
        user = request.user
        confirmation = request.data.get('confirmation', '')
        if confirmation != f'DELETE {user.username}':
            return Response(
                {
                    'detail': (
                        f'Must confirm by sending {{"confirmation": "DELETE {user.username}"}} '
                        f'in the request body. This action is irreversible.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Log before deletion
        AuditEntry.objects.create(
            user=user, action='DELETE', resource='accounts/me',
            description='Account deletion requested', result='SUCCESS',
            ip_address=request.META.get('REMOTE_ADDR', ''),
        )

        user_id = user.id

        # Delete all user-owned data in dependency order
        from shipments.models import Document, Shipment
        from tracking.models import TrackingEvent
        from payments.models import Invoice, Payment
        from chats.models import Conversation, Message

        # Tracking events recorded by the user
        TrackingEvent.objects.filter(recorded_by=user).delete()
        # Messages sent by the user
        Message.objects.filter(sender=user).delete()
        # Documents uploaded by the user
        Document.objects.filter(uploaded_by=user).delete()
        # Payments
        Payment.objects.filter(invoice__created_by=user).delete()
        Invoice.objects.filter(created_by=user).delete()
        # Shipments owned by the user
        Shipment.objects.filter(client=user).delete()
        # Notifications
        Notification.objects.filter(user=user).delete()
        # API keys
        APIKey.objects.filter(user=user).delete()
        # Audit entries
        AuditEntry.objects.filter(user=user).delete()
        # Remove from conversations
        Conversation.objects.filter(participants=user).delete()

        # Blacklist all outstanding JWT tokens for this user
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            tokens = OutstandingToken.objects.filter(user_id=user_id)
            for token in tokens:
                BlacklistedToken.objects.get_or_create(token=token)
            tokens.delete()
        except Exception:
            pass

        # Delete the user (cascades to user profile via OneToOneField)
        user.delete()

        response = Response(
            {'detail': 'Account permanently deleted.'},
            status=status.HTTP_200_OK,
        )
        # Clear JWT cookies
        from cargotrack.auth_views import _clear_token_cookies
        _clear_token_cookies(response)
        return response


# ── TOTP 2FA ─────────────────────────────────────────────────────────────────

class TOTPSetupView(APIView):
    """
    POST /api/v1/accounts/me/totp/setup/

    Generate a new TOTP secret and return a provisioning URI (otpauth://)
    for displaying as a QR code.  The secret is stored on the user but
    not activated until the user verifies a code via TOTPVerifyView.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, **kwargs):
        user = request.user
        if user.totp_enabled:
            return Response(
                {'detail': 'TOTP is already enabled. Disable it first to re-setup.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .totp_utils import generate_totp_secret, get_totp_uri
        secret = generate_totp_secret()
        user.totp_secret = secret
        user.save(update_fields=['totp_secret'])

        uri = get_totp_uri(secret, user.email)
        return Response({
            'secret': secret,
            'uri': uri,
            'detail': 'Scan the QR code with your authenticator app, then verify with a code.',
        })


class TOTPVerifyView(APIView):
    """
    POST /api/v1/accounts/me/totp/verify/

    Verify a TOTP code from the user's authenticator app and activate 2FA.
    Returns backup codes on first activation (shown once).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, **kwargs):
        user = request.user
        code = request.data.get('code', '').strip()

        if not user.totp_secret:
            return Response(
                {'detail': 'TOTP not set up. Call /totp/setup/ first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .totp_utils import generate_backup_codes, hash_backup_codes, verify_totp
        if not verify_totp(user.totp_secret, code):
            return Response(
                {'detail': 'Invalid verification code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        was_already_enabled = user.totp_enabled

        backup_codes = generate_backup_codes()
        user.totp_enabled = True
        user.totp_backup_codes = hash_backup_codes(backup_codes)
        user.save(update_fields=['totp_enabled', 'totp_backup_codes'])

        AuditEntry.objects.create(
            user=user, action='UPDATE', resource='accounts/me/totp/verify',
            description='TOTP 2FA activated' if not was_already_enabled else 'TOTP re-verified',
            result='SUCCESS',
            ip_address=request.META.get('REMOTE_ADDR', ''),
        )

        response_data = {'detail': 'TOTP two-factor authentication enabled.'}
        if not was_already_enabled:
            response_data['backup_codes'] = backup_codes
            response_data['warning'] = 'Store these backup codes securely. They will not be shown again.'

        return Response(response_data)


class TOTPDisableView(APIView):
    """
    POST /api/v1/accounts/me/totp/disable/

    Disable TOTP 2FA.  Requires current password or a valid TOTP code.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, **kwargs):
        user = request.user
        if not user.totp_enabled:
            return Response(
                {'detail': 'TOTP is not enabled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code = request.data.get('code', '').strip()
        password = request.data.get('password', '').strip()

        authenticated = False

        if code:
            from .totp_utils import verify_totp
            authenticated = verify_totp(user.totp_secret, code)
        elif password:
            authenticated = user.check_password(password)

        if not authenticated:
            return Response(
                {'detail': 'Invalid code or password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.totp_enabled = False
        user.totp_secret = ''
        user.totp_backup_codes = []
        user.save(update_fields=['totp_enabled', 'totp_secret', 'totp_backup_codes'])

        AuditEntry.objects.create(
            user=user, action='UPDATE', resource='accounts/me/totp/disable',
            description='TOTP 2FA disabled', result='SUCCESS',
            ip_address=request.META.get('REMOTE_ADDR', ''),
        )

        return Response({'detail': 'TOTP two-factor authentication disabled.'})


class TOTPStatusView(APIView):
    """
    GET /api/v1/accounts/me/totp/status/

    Return whether TOTP is enabled and how many backup codes remain.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        user = request.user
        return Response({
            'enabled': user.totp_enabled,
            'backup_codes_remaining': len(user.totp_backup_codes or []),
        })
