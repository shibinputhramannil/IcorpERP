from django.db import models
from django.contrib.auth.models import User
from company.models import Company
from crm.models import Customer, Lead, Deal


class EmailMessage(models.Model):
    FOLDER_CHOICES = [
        ("inbox", "Inbox"),
        ("sent", "Sent"),
        ("drafts", "Drafts"),
        ("trash", "Trash"),
    ]

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("queued", "Queued"),
        ("sent", "Sent"),
        ("delivered", "Delivered"),
        ("failed", "Failed"),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="emails",
        db_index=True,
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_emails",
    )
    sender_name = models.CharField(max_length=150, blank=True)
    sender_email = models.EmailField(blank=True)
    recipient = models.EmailField()
    recipient_name = models.CharField(max_length=150, blank=True)
    cc = models.CharField(max_length=255, blank=True)
    bcc = models.CharField(max_length=255, blank=True)
    subject = models.CharField(max_length=255)
    body = models.TextField()
    folder = models.CharField(
        max_length=20,
        choices=FOLDER_CHOICES,
        default="sent",
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="sent",
    )
    is_read = models.BooleanField(default=True)
    is_starred = models.BooleanField(default=False)

    # CRM linkages
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emails",
    )
    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emails",
    )
    deal = models.ForeignKey(
        Deal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emails",
    )

    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "folder"]),
            models.Index(fields=["company", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.folder.upper()}] {self.subject} to {self.recipient}"
