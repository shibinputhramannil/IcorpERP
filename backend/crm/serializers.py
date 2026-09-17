from rest_framework import serializers
from django.contrib.auth.models import User
from company.models import Company
from .models import Customer, Contact, Lead, Deal, Activity


class CustomerSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    contacts_count = serializers.IntegerField(source="contacts.count", read_only=True)
    deals_count = serializers.IntegerField(source="deals.count", read_only=True)
    is_active = serializers.BooleanField(default=True, required=False)

    class Meta:
        model = Customer
        fields = [
            "id",
            "company",
            "company_name",
            "owner",
            "owner_username",
            "name",
            "customer_type",
            "email",
            "phone",
            "website",
            "address",
            "city",
            "country",
            "industry",
            "is_active",
            "contacts_count",
            "deals_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "owner_username",
            "contacts_count",
            "deals_count",
            "created_at",
            "updated_at",
        ]


class ContactSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "company",
            "company_name",
            "customer",
            "customer_name",
            "owner",
            "owner_username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "designation",
            "department",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "customer_name",
            "owner_username",
            "created_at",
            "updated_at",
        ]


class LeadSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    converted_customer_name = serializers.CharField(source="converted_customer.name", read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "company",
            "company_name",
            "owner",
            "owner_username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "lead_company",
            "source",
            "status",
            "estimated_value",
            "notes",
            "converted_customer",
            "converted_customer_name",
            "converted_contact",
            "converted_at",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "owner_username",
            "converted_customer",
            "converted_customer_name",
            "converted_contact",
            "converted_at",
            "created_at",
            "updated_at",
        ]


class LeadConvertSerializer(serializers.Serializer):
    create_customer = serializers.BooleanField(default=True)
    customer_name = serializers.CharField(required=False, allow_blank=True)
    create_deal = serializers.BooleanField(default=False)
    deal_title = serializers.CharField(required=False, allow_blank=True)
    deal_value = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)


class DealSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    contact_name = serializers.SerializerMethodField()
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    is_active = serializers.BooleanField(default=True, required=False)

    class Meta:
        model = Deal
        fields = [
            "id",
            "company",
            "company_name",
            "customer",
            "customer_name",
            "contact",
            "contact_name",
            "owner",
            "owner_username",
            "title",
            "value",
            "currency",
            "stage",
            "probability",
            "expected_close_date",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "customer_name",
            "contact_name",
            "owner_username",
            "created_at",
            "updated_at",
        ]

    def get_contact_name(self, obj):
        if obj.contact:
            return f"{obj.contact.first_name} {obj.contact.last_name}".strip()
        return None


class ActivitySerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    contact_name = serializers.SerializerMethodField()
    deal_title = serializers.CharField(source="deal.title", read_only=True)
    lead_name = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = [
            "id",
            "company",
            "company_name",
            "user",
            "user_username",
            "activity_type",
            "title",
            "description",
            "customer",
            "customer_name",
            "contact",
            "contact_name",
            "deal",
            "deal_title",
            "lead",
            "lead_name",
            "due_date",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "user_username",
            "customer_name",
            "contact_name",
            "deal_title",
            "lead_name",
            "created_at",
            "updated_at",
        ]

    def get_contact_name(self, obj):
        if obj.contact:
            return f"{obj.contact.first_name} {obj.contact.last_name}".strip()
        return None

    def get_lead_name(self, obj):
        if obj.lead:
            return f"{obj.lead.first_name} {obj.lead.last_name}".strip()
        return None