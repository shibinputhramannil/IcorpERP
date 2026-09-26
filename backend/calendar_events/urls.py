from django.urls import path
from calendar_events.views import (
    CalendarEventListCreateView,
    CalendarEventDetailView,
    CalendarEventUpcomingView,
)

urlpatterns = [
    path("events/", CalendarEventListCreateView.as_view(), name="calendar_events_list_create"),
    path("events/<int:pk>/", CalendarEventDetailView.as_view(), name="calendar_event_detail"),
    path("upcoming/", CalendarEventUpcomingView.as_view(), name="calendar_events_upcoming"),
]
