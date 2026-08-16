from rest_framework import serializers

from .models import Employee


class EmployeeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    company_name = serializers.CharField(
        source="company.name",
        read_only=True,
    )

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "user",
            "username",
            "company",
            "company_name",
            "first_name",
            "last_name",
            "phone",
            "designation",
            "department",
            "joining_date",
            "is_active",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "username",
            "company_name",
            "company",
        ]

    def validate_user(self, value):
        queryset = Employee.objects.filter(user=value)

        # During PATCH, exclude the current employee.
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "This user already has an employee profile."
            )

        return value

    def update(self, instance, validated_data):
        # Never allow changing the employee's user/company
        # through PATCH.
        validated_data.pop("user", None)
        validated_data.pop("company", None)

        return super().update(
            instance,
            validated_data,
        )