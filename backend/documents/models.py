from django.contrib.auth.models import User
from django.db import models
from company.models import Company


class Document(models.Model):
    """
    Company-scoped document management model with tenant isolation.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="documents",
        db_index=True,
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="documents/%Y/%m/")
    file_type = models.CharField(max_length=50)
    file_size = models.BigIntegerField(default=0, help_text="File size in bytes")
    related_module = models.CharField(max_length=50, blank=True, null=True)
    related_object_id = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "created_at"]),
            models.Index(fields=["company", "file_type"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.file_type}) - {self.company.name}"
