from rest_framework import serializers

from .models import Company


class CompanySerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(source="memberships.count", read_only=True)
    employee_count = serializers.IntegerField(source="employees.count", read_only=True)

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "address",
            "is_active",
            "member_count",
            "employee_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "member_count", "employee_count"]