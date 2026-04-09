from django.http import HttpResponse
from django.urls import path
from . import views

app_name = "alerts"


def placeholder(request):
    return HttpResponse("alerts")


urlpatterns = [
    path("",                    views.AlertListView.as_view(),        name="list"),
    path("<int:pk>/ack/",       views.AcknowledgeAlertView.as_view(), name="acknowledge"),
    path("<int:pk>/mark-read/", views.AcknowledgeAlertView.as_view(), name="mark-read"),
]
