from django.contrib.auth.models import Group
from rest_framework import serializers

from .models import CompanyMembership


class CompanyMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    company_name = serializers.CharField(
        source="company.name",
        read_only=True,
    )

    role_name = serializers.CharField(
        source="role.name",
        read_only=True,
    )

    class Meta:
        model = CompanyMembership
        fields = [
            "id",
            "user",
            "username",
            "company",
            "company_name",
            "role",
            "role_name",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "username",
            "company_name",
            "role_name",
        ]


class CompanyMembershipCreateSerializer(serializers.ModelSerializer):
    role = serializers.CharField()

    class Meta:
        model = CompanyMembership
        fields = [
            "user",
            "role",
        ]

    def validate_role(self, value):
        try:
            return Group.objects.get(name=value)
        except Group.DoesNotExist:
            raise serializers.ValidationError(
                f"Role '{value}' does not exist."
            )

    def validate(self, attrs):
        user = attrs["user"]
        company = self.context["company"]

        if CompanyMembership.objects.filter(
            user=user,
            company=company,
        ).exists():
            raise serializers.ValidationError(
                "This user is already a member of this company."
            )

        return attrs

    def create(self, validated_data):
        company = self.context["company"]

        return CompanyMembership.objects.create(
            company=company,
            **validated_data,
        )


class CompanyMembershipRoleUpdateSerializer(serializers.ModelSerializer):
    role = serializers.CharField()

    class Meta:
        model = CompanyMembership
        fields = [
            "role",
        ]

    def validate_role(self, value):
        try:
            return Group.objects.get(name=value)
        except Group.DoesNotExist:
            raise serializers.ValidationError(
                f"Role '{value}' does not exist."
            )