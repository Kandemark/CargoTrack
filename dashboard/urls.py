from django.http import HttpResponse
from django.urls import path
from . import views

app_name = "dashboard"


def placeholder(request):
    return HttpResponse("dashboard")


urlpatterns = [
    path("",          views.DashboardView.as_view(),    name="home"),
    path("api/",      views.DashboardAPIView.as_view(), name="api"),
    path("api/kpis/", views.KPIApiView.as_view(),       name="api-kpis"),
    path("api/map/",  views.MapDataAPIView.as_view(),   name="api-map"),
]
