"""workflows URL routing — mounted at /api/<version>/workflows/"""
from django.urls import path
from .views import WorkflowRuleListCreateView, WorkflowRuleDetailView

urlpatterns = [
    path('', WorkflowRuleListCreateView.as_view(), name='workflow-list-create'),
    path('<int:pk>/', WorkflowRuleDetailView.as_view(), name='workflow-detail'),
]
