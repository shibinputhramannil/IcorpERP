from decimal import Decimal
from rest_framework import serializers
from finance.models import (
    Account,
    AccountCategory,
    FiscalPeriod,
    JournalEntry,
    JournalEntryLine,
    BankAccount,
    CashAccount,
)
from finance.services import post_journal_entry


class AccountCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountCategory
        fields = [
            "id",
            "company",
            "name",
            "category_type",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at"]


class AccountSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    normal_balance_type = serializers.CharField(read_only=True)
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id",
            "company",
            "account_code",
            "account_name",
            "category",
            "category_display",
            "parent_account",
            "account_category",
            "description",
            "is_active",
            "is_system",
            "opening_balance",
            "normal_balance_type",
            "current_balance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at"]

    def get_current_balance(self, obj):
        return obj.calculate_balance()

    def validate_account_code(self, value):
        company = self.context.get("company")
        if not company:
            return value

        qs = Account.objects.filter(company=company, account_code=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f"Account with code '{value}' already exists in this company."
            )
        return value


class FiscalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalPeriod
        fields = [
            "id",
            "company",
            "period_name",
            "start_date",
            "end_date",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at"]

    def validate(self, attrs):
        start_date = attrs.get("start_date") or (self.instance.start_date if self.instance else None)
        end_date = attrs.get("end_date") or (self.instance.end_date if self.instance else None)
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})

        company = self.context.get("company")
        period_name = attrs.get("period_name")
        if company and period_name:
            qs = FiscalPeriod.objects.filter(company=company, period_name=period_name)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"period_name": f"Fiscal period '{period_name}' already exists in this company."}
                )
        return attrs


class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.account_code", read_only=True)
    account_name = serializers.CharField(source="account.account_name", read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = [
            "id",
            "account",
            "account_code",
            "account_name",
            "debit",
            "credit",
            "description",
        ]


class JournalEntryLineInputSerializer(serializers.Serializer):
    account = serializers.IntegerField(required=True)
    debit = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    credit = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    description = serializers.CharField(required=False, allow_blank=True, default="")


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    total_debit = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_credit = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    is_balanced = serializers.BooleanField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "company",
            "entry_number",
            "entry_date",
            "description",
            "reference_type",
            "reference_id",
            "status",
            "fiscal_period",
            "created_by",
            "created_by_name",
            "lines",
            "total_debit",
            "total_credit",
            "is_balanced",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "entry_number",
            "total_debit",
            "total_credit",
            "is_balanced",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "System"


class JournalEntryCreateSerializer(serializers.Serializer):
    entry_date = serializers.DateField(required=True)
    description = serializers.CharField(required=True)
    reference_type = serializers.CharField(required=False, default="MANUAL")
    reference_id = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(
        choices=JournalEntry.EntryStatus.choices,
        default=JournalEntry.EntryStatus.POSTED,
    )
    lines = JournalEntryLineInputSerializer(many=True, required=True)

    def validate_lines(self, value):
        if not value or len(value) < 2:
            raise serializers.ValidationError("A journal entry must contain at least two line items.")
        return value

    def create(self, validated_data):
        company = self.context["company"]
        user = self.context.get("request").user if self.context.get("request") else None
        lines_data = validated_data.pop("lines")

        return post_journal_entry(
            company=company,
            user=user,
            entry_date=validated_data["entry_date"],
            description=validated_data["description"],
            lines_data=lines_data,
            reference_type=validated_data.get("reference_type", "MANUAL"),
            reference_id=validated_data.get("reference_id", ""),
            status=validated_data.get("status", JournalEntry.EntryStatus.POSTED),
        )


class BankAccountSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.account_code", read_only=True)
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            "id",
            "company",
            "account",
            "account_code",
            "bank_name",
            "account_name",
            "account_number",
            "branch_name",
            "swift_or_ifsc",
            "currency",
            "opening_balance",
            "current_balance",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at"]

    def get_current_balance(self, obj):
        return obj.current_balance


class CashAccountSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.account_code", read_only=True)
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = CashAccount
        fields = [
            "id",
            "company",
            "account",
            "account_code",
            "account_name",
            "opening_balance",
            "current_balance",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at"]

    def get_current_balance(self, obj):
        return obj.current_balance
