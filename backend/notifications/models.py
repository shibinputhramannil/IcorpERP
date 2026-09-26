from django.contrib.auth.models import User
from django.db import models
from company.models import Company


class Notification(models.Model):
    """
    Centralized ERP notification model with company/tenant isolation.
    """
    TYPE_CHOICES = [
        ("member", "Member / Workspace"),
        ("inventory", "Inventory"),
        ("sales", "Sales"),
        ("purchase", "Purchase"),
        ("finance", "Finance"),
        ("hr", "HR & Employees"),
        ("system", "System"),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    notification_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        default="system",
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    related_module = models.CharField(max_length=50, blank=True, null=True)
    related_object_id = models.IntegerField(blank=True, null=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "recipient", "is_read"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} -> {self.recipient.username}"


class NotificationPreference(models.Model):
    """
    User/Company notification delivery and module preferences.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
        null=True,
        blank=True,
    )
    email_notifications = models.BooleanField(default=True)
    system_notifications = models.BooleanField(default=True)
    low_stock_alerts = models.BooleanField(default=True)
    sales_alerts = models.BooleanField(default=True)
    purchase_alerts = models.BooleanField(default=True)
    finance_alerts = models.BooleanField(default=True)
    hr_alerts = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "company")

    def __str__(self):
        comp = self.company.name if self.company else "Global"
        return f"{self.user.username} - {comp} Preferences"
