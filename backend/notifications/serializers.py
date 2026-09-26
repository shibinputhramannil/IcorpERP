from rest_framework import serializers
from notifications.models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    recipient_username = serializers.CharField(source="recipient.username", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "company",
            "company_name",
            "recipient",
            "recipient_username",
            "notification_type",
            "title",
            "message",
            "related_module",
            "related_object_id",
            "is_read",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "recipient",
            "recipient_username",
            "created_at",
        ]


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "email_notifications",
            "system_notifications",
            "low_stock_alerts",
            "sales_alerts",
            "purchase_alerts",
            "finance_alerts",
            "hr_alerts",
        ]
