from rest_framework import serializers
from calendar_events.models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    deal_title = serializers.SerializerMethodField()

    class Meta:
        model = CalendarEvent
        fields = [
            "id",
            "company",
            "title",
            "description",
            "event_type",
            "status",
            "start_time",
            "end_time",
            "all_day",
            "location",
            "customer",
            "customer_name",
            "lead",
            "lead_name",
            "deal",
            "deal_title",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_by", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return "System"
        name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return name or obj.created_by.username

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else None

    def get_lead_name(self, obj):
        if not obj.lead:
            return None
        return f"{obj.lead.first_name} {obj.lead.last_name}".strip() or obj.lead.lead_company

    def get_deal_title(self, obj):
        return obj.deal.title if obj.deal else None

    def validate(self, attrs):
        start = attrs.get("start_time") or (self.instance.start_time if self.instance else None)
        end = attrs.get("end_time") or (self.instance.end_time if self.instance else None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_time": "End time cannot be earlier than start time."})
        return attrs
