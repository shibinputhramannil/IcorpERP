from django.db import models
from django.contrib.auth.models import User
from company.models import Company
from crm.models import Customer, Lead, Deal


class CalendarEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ("meeting", "Meeting"),
        ("call", "Call"),
        ("task", "Task"),
        ("reminder", "Reminder"),
        ("deadline", "Deadline"),
        ("holiday", "Holiday"),
        ("other", "Other"),
    ]

    STATUS_CHOICES = [
        ("scheduled", "Scheduled"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="calendar_events",
        db_index=True,
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_calendar_events",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    event_type = models.CharField(
        max_length=30,
        choices=EVENT_TYPE_CHOICES,
        default="meeting",
        db_index=True,
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="scheduled",
    )
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(db_index=True)
    all_day = models.BooleanField(default=False)
    location = models.CharField(max_length=255, blank=True)

    # Entity Linkages
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calendar_events",
    )
    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calendar_events",
    )
    deal = models.ForeignKey(
        Deal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calendar_events",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_time"]
        indexes = [
            models.Index(fields=["company", "start_time"]),
            models.Index(fields=["company", "event_type"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_event_type_display()}) - {self.company.name}"
