from rest_framework import serializers
from emails.models import EmailMessage


class EmailMessageSerializer(serializers.ModelSerializer):
    sender_display = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    deal_title = serializers.SerializerMethodField()

    class Meta:
        model = EmailMessage
        fields = [
            "id",
            "company",
            "sender",
            "sender_name",
            "sender_email",
            "sender_display",
            "recipient",
            "recipient_name",
            "cc",
            "bcc",
            "subject",
            "body",
            "folder",
            "status",
            "is_read",
            "is_starred",
            "customer",
            "customer_name",
            "lead",
            "lead_name",
            "deal",
            "deal_title",
            "sent_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "sender", "sender_display", "created_at", "updated_at"]

    def get_sender_display(self, obj):
        if obj.sender_name:
            return obj.sender_name
        if obj.sender:
            name = f"{obj.sender.first_name} {obj.sender.last_name}".strip()
            return name or obj.sender.username
        return obj.sender_email or "System"

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else None

    def get_lead_name(self, obj):
        if not obj.lead:
            return None
        return f"{obj.lead.first_name} {obj.lead.last_name}".strip() or obj.lead.lead_company

    def get_deal_title(self, obj):
        return obj.deal.title if obj.deal else None
