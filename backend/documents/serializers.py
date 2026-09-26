from rest_framework import serializers
from documents.models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    file_size_formatted = serializers.SerializerMethodField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "name",
            "file_type",
            "file_size",
            "file_size_formatted",
            "category",
            "category_display",
            "tags",
            "related_module",
            "related_object_id",
            "uploaded_by",
            "uploaded_by_name",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "file_type",
            "file_size",
            "uploaded_by",
            "created_at",
            "updated_at",
        ]

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return "System"
        name = f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
        return name or obj.uploaded_by.username

    def get_download_url(self, obj):
        return f"/api/companies/{obj.company_id}/documents/{obj.id}/download/"

    def get_file_size_formatted(self, obj):
        size = obj.file_size or 0
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size / (1024 * 1024):.2f} MB"
