from rest_framework import serializers

from .models import Company


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "address",
            "is_active",
            "created_at",
        ]