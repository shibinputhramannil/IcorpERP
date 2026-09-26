from django.urls import path
from emails.views import (
    EmailListCreateView,
    EmailDetailView,
    EmailFolderCountsView,
)

urlpatterns = [
    path("", EmailListCreateView.as_view(), name="email_list_create"),
    path("counts/", EmailFolderCountsView.as_view(), name="email_folder_counts"),
    path("<int:pk>/", EmailDetailView.as_view(), name="email_detail"),
]
