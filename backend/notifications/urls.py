from django.urls import path
from notifications.views import (
    NotificationListView,
    NotificationReadView,
    NotificationReadAllView,
    NotificationUnreadCountView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification_list"),
    path("<int:pk>/read/", NotificationReadView.as_view(), name="notification_read"),
    path("read-all/", NotificationReadAllView.as_view(), name="notification_read_all"),
    path("unread-count/", NotificationUnreadCountView.as_view(), name="notification_unread_count"),
]
