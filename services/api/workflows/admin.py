from django.contrib import admin
from .models import WorkflowRule


@admin.register(WorkflowRule)
class WorkflowRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger_type', 'action_type', 'severity', 'is_active', 'execution_count', 'created_at')
    list_filter = ('is_active', 'trigger_type', 'severity')
    search_fields = ('name',)
