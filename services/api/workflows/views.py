"""
workflows/views.py — CRUD REST endpoints for WorkflowRule.

Endpoints (mounted at /api/<version>/workflows/):
  GET   /           — list all rules
  POST  /           — create a rule
  GET   /<id>/     — get rule detail
  PATCH /<id>/     — partial update
  DELETE /<id>/    — delete a rule
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from cargotrack.authz import HasPermission
from domains._authz import Permission
from .models import WorkflowRule


CanManageWorkflows = HasPermission(Permission.ADMIN_SYSTEM)


class WorkflowRuleListCreateView(APIView):
    """GET list all rules / POST create a new rule."""
    permission_classes = [IsAuthenticated, CanManageWorkflows]

    def get(self, request, **kwargs):
        rules = WorkflowRule.objects.all()
        data = [
            {
                'id': r.id,
                'name': r.name,
                'trigger_type': r.trigger_type,
                'trigger_config': r.trigger_config,
                'action_type': r.action_type,
                'action_config': r.action_config,
                'severity': r.severity,
                'is_active': r.is_active,
                'execution_count': r.execution_count,
                'created_at': r.created_at.isoformat(),
                'updated_at': r.updated_at.isoformat(),
            }
            for r in rules
        ]
        return Response(data)

    def post(self, request, **kwargs):
        rule = WorkflowRule.objects.create(
            name=request.data.get('name', ''),
            trigger_type=request.data.get('trigger_type', 'STATUS_CHANGE'),
            trigger_config=request.data.get('trigger_config', {}),
            action_type=request.data.get('action_type', 'NOTIFY_USER'),
            action_config=request.data.get('action_config', {}),
            severity=request.data.get('severity', 'MEDIUM'),
            is_active=request.data.get('is_active', True),
        )
        return Response({
            'id': rule.id,
            'name': rule.name,
            'trigger_type': rule.trigger_type,
            'trigger_config': rule.trigger_config,
            'action_type': rule.action_type,
            'action_config': rule.action_config,
            'severity': rule.severity,
            'is_active': rule.is_active,
            'execution_count': rule.execution_count,
            'created_at': rule.created_at.isoformat(),
            'updated_at': rule.updated_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class WorkflowRuleDetailView(APIView):
    """GET / PATCH / DELETE a single workflow rule."""
    permission_classes = [IsAuthenticated, CanManageWorkflows]

    def _get_rule(self, pk):
        return WorkflowRule.objects.get(pk=pk)

    def _serialize(self, rule):
        return {
            'id': rule.id,
            'name': rule.name,
            'trigger_type': rule.trigger_type,
            'trigger_config': rule.trigger_config,
            'action_type': rule.action_type,
            'action_config': rule.action_config,
            'severity': rule.severity,
            'is_active': rule.is_active,
            'execution_count': rule.execution_count,
            'created_at': rule.created_at.isoformat(),
            'updated_at': rule.updated_at.isoformat(),
        }

    def get(self, request, pk, **kwargs):
        rule = self._get_rule(pk)
        return Response(self._serialize(rule))

    def patch(self, request, pk, **kwargs):
        rule = self._get_rule(pk)
        for field in ('name', 'trigger_type', 'trigger_config',
                       'action_type', 'action_config', 'severity', 'is_active'):
            if field in request.data:
                setattr(rule, field, request.data[field])
        rule.save()
        return Response(self._serialize(rule))

    def delete(self, request, pk, **kwargs):
        rule = self._get_rule(pk)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
