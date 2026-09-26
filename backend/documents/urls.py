from django.urls import path
from documents.views import (
    DocumentListCreateView,
    DocumentDetailView,
    DocumentDownloadView,
)

urlpatterns = [
    path("", DocumentListCreateView.as_view(), name="document_list_create"),
    path("<int:pk>/", DocumentDetailView.as_view(), name="document_detail"),
    path("<int:pk>/download/", DocumentDownloadView.as_view(), name="document_download"),
]
