from django.contrib.auth.models import Group, User
from rest_framework import serializers

from .models import CompanyMembership, WorkspaceActivity


class CompanyMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )
    user_name = serializers.CharField(
        source="user.username",
        read_only=True,
    )
    first_name = serializers.CharField(
        source="user.first_name",
        read_only=True,
    )
    last_name = serializers.CharField(
        source="user.last_name",
        read_only=True,
    )
    email = serializers.CharField(
        source="user.email",
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
    active_status = serializers.BooleanField(
        source="is_active",
        read_only=True,
    )
    joined_date = serializers.DateTimeField(
        source="created_at",
        read_only=True,
    )

    class Meta:
        model = CompanyMembership
        fields = [
            "id",
            "user",
            "username",
            "user_name",
            "first_name",
            "last_name",
            "email",
            "company",
            "company_name",
            "role",
            "role_name",
            "is_active",
            "active_status",
            "created_at",
            "joined_date",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "username",
            "user_name",
            "first_name",
            "last_name",
            "email",
            "company_name",
            "role_name",
            "active_status",
            "joined_date",
        ]


class CompanyMembershipCreateSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )
    username = serializers.CharField(required=False, write_only=True)
    email = serializers.EmailField(required=False, write_only=True)
    role = serializers.CharField()
    is_active = serializers.BooleanField(default=True, required=False)

    class Meta:
        model = CompanyMembership
        fields = [
            "user",
            "username",
            "email",
            "role",
            "is_active",
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
    role = serializers.CharField(required=False)
    is_active = serializers.BooleanField(required=False)
    active_status = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = CompanyMembership
        fields = [
            "role",
            "is_active",
            "active_status",
        ]

    def validate_role(self, value):
        try:
            return Group.objects.get(name=value)
        except Group.DoesNotExist:
            raise serializers.ValidationError(
                f"Role '{value}' does not exist."
            )


class WorkspaceActivitySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceActivity
        fields = [
            "id",
            "company",
            "user",
            "username",
            "user_name",
            "action",
            "details",
            "created_at",
        ]

    def get_user_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name or obj.user.username
        return "System"