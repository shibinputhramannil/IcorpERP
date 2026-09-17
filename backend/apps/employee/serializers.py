from django.contrib.auth.models import Group, User
from rest_framework import serializers

from accounts.models import CompanyMembership
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
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["email"] = instance.user.email if (instance.user and instance.user.email) else ""
        return data

    def validate_user(self, value):
        queryset = Employee.objects.filter(user=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "This user already has an employee profile."
            )
        return value

    def validate(self, attrs):
        if not self.instance:
            user = attrs.get("user")
            email = self.initial_data.get("email")
            if not user and not email:
                raise serializers.ValidationError(
                    {"email": "Email or existing User must be specified to create an employee."}
                )
        return attrs

    def create(self, validated_data):
        user = validated_data.pop("user", None)
        email = self.initial_data.get("email", "").strip()
        first_name = validated_data.get("first_name", "").strip()
        last_name = validated_data.get("last_name", "").strip()
        company = validated_data.get("company")

        if not user:
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                base_username = email.split("@")[0] if email else first_name.lower()
                username = base_username
                count = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{count}"
                    count += 1

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                )
                user.set_unusable_password()
                user.save()

        if Employee.objects.filter(user=user).exists():
            raise serializers.ValidationError(
                {"user": "This user already has an employee profile."}
            )

        employee = Employee.objects.create(
            user=user,
            **validated_data,
        )

        if company:
            emp_group, _ = Group.objects.get_or_create(name="Employee")
            CompanyMembership.objects.get_or_create(
                user=user,
                company=company,
                defaults={"role": emp_group},
            )

        return employee

    def update(self, instance, validated_data):
        validated_data.pop("user", None)
        validated_data.pop("company", None)
        email = self.initial_data.get("email")
        if email and instance.user and instance.user.email != email:
            instance.user.email = email
            instance.user.save(update_fields=["email"])

        return super().update(instance, validated_data)