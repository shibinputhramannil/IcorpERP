from django.contrib.auth.models import Group, User
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
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )
    username = serializers.CharField(required=False, write_only=True)
    email = serializers.EmailField(required=False, write_only=True)
    role = serializers.CharField()

    class Meta:
        model = CompanyMembership
        fields = [
            "user",
            "username",
            "email",
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
        user = attrs.get("user")
        username = attrs.pop("username", None)
        email = attrs.pop("email", None)

        if not user:
            if username:
                user = User.objects.filter(username=username).first()
                if not user:
                    raise serializers.ValidationError({"username": f"User with username '{username}' not found."})
            elif email:
                user = User.objects.filter(email__iexact=email).first()
                if not user:
                    raise serializers.ValidationError({"email": f"User with email '{email}' not found."})
            else:
                raise serializers.ValidationError("Either 'user', 'username', or 'email' must be provided.")

        attrs["user"] = user
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