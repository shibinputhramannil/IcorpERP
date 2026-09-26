from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    Immutable audit log record capturing every meaningful action in the ERP system.
    Records are never updated or deleted — append-only by design.
    """

    # ------------------------------------------------------------------ choices
    ACTION_LOGIN = 'LOGIN'
    ACTION_LOGOUT = 'LOGOUT'
    ACTION_CREATE = 'CREATE'
    ACTION_UPDATE = 'UPDATE'
    ACTION_DELETE = 'DELETE'
    ACTION_VIEW = 'VIEW'
    ACTION_EXPORT = 'EXPORT'
    ACTION_PERMISSION_CHANGE = 'PERMISSION_CHANGE'
    ACTION_SYSTEM = 'SYSTEM'

    ACTION_CHOICES = [
        (ACTION_LOGIN, 'Login'),
        (ACTION_LOGOUT, 'Logout'),
        (ACTION_CREATE, 'Create'),
        (ACTION_UPDATE, 'Update'),
        (ACTION_DELETE, 'Delete'),
        (ACTION_VIEW, 'View'),
        (ACTION_EXPORT, 'Export'),
        (ACTION_PERMISSION_CHANGE, 'Permission Change'),
        (ACTION_SYSTEM, 'System'),
    ]

    MODULE_CHOICES = [
        ('sales', 'Sales'),
        ('purchase', 'Purchase'),
        ('inventory', 'Inventory'),
        ('finance', 'Finance'),
        ('crm', 'CRM'),
        ('employees', 'Employees'),
        ('documents', 'Documents'),
        ('calendar', 'Calendar'),
        ('notes', 'Notes'),
        ('ai', 'AI'),
        ('auth', 'Auth'),
        ('company', 'Company'),
        ('system', 'System'),
    ]

    # ------------------------------------------------------------------ fields
    id = models.BigAutoField(primary_key=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs',
    )

    company = models.ForeignKey(
        'company.Company',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs',
    )

    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)

    object_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=50, blank=True)

    description = models.TextField()

    ip_address = models.GenericIPAddressField(null=True, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    metadata = models.JSONField(null=True, blank=True)

    # ------------------------------------------------------------------ meta
    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    # ------------------------------------------------------------------ dunder
    def __str__(self):
        ts = self.timestamp.strftime('%Y-%m-%d %H:%M') if self.timestamp else '?'
        return (
            f'[{ts}] {self.user} - {self.action} {self.module}: '
            f'{self.description[:60]}'
        )

    # ------------------------------------------------------------------ class method
    @classmethod
    def log(
        cls,
        user,
        action,
        module,
        description,
        company=None,
        object_type='',
        object_id='',
        ip_address=None,
        metadata=None,
    ):
        """
        Convenience factory that creates and returns an AuditLog record.

        Usage:
            AuditLog.log(
                user=request.user,
                action=AuditLog.ACTION_CREATE,
                module='sales',
                description='Invoice #123 created',
                company=request.user.company,
            )
        """
        return cls.objects.create(
            user=user,
            action=action,
            module=module,
            description=description,
            company=company,
            object_type=object_type,
            object_id=str(object_id) if object_id else '',
            ip_address=ip_address,
            metadata=metadata,
        )
