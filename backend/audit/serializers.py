from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = '__all__'
        read_only_fields = [
            'id', 'user', 'company', 'action', 'module', 'object_type',
            'object_id', 'description', 'ip_address', 'timestamp', 'metadata'
        ]

    def get_user_email(self, obj):
        if obj.user:
            return obj.user.email
        return None
