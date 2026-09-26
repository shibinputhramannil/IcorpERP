from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.apps import apps

@receiver(post_save, sender='company.Company')
def log_company_save(sender, instance, created, **kwargs):
    try:
        AuditLog = apps.get_model('audit', 'AuditLog')
        action = AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE
        AuditLog.log(
            user=None,
            action=action,
            module='company',
            description=f"Company {instance.name} was {'created' if created else 'updated'}",
            company=instance,
            object_type='Company',
            object_id=instance.id
        )
    except Exception:
        pass

@receiver(post_save, sender='sales.Invoice')
def log_sales_invoice_save(sender, instance, created, **kwargs):
    try:
        AuditLog = apps.get_model('audit', 'AuditLog')
        action = AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE
        AuditLog.log(
            user=None,
            action=action,
            module='sales',
            description=f"Sales Invoice {instance.invoice_number} {'created' if created else 'updated'}",
            company=instance.company,
            object_type='Invoice',
            object_id=instance.id
        )
    except Exception:
        pass

@receiver(post_save, sender='purchase.PurchaseInvoice')
def log_purchase_invoice_save(sender, instance, created, **kwargs):
    try:
        AuditLog = apps.get_model('audit', 'AuditLog')
        action = AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE
        AuditLog.log(
            user=None,
            action=action,
            module='purchase',
            description=f"Purchase Invoice {instance.invoice_number} {'created' if created else 'updated'}",
            company=instance.company,
            object_type='PurchaseInvoice',
            object_id=instance.id
        )
    except Exception:
        pass

@receiver(post_save, sender='documents.Document')
def log_document_save(sender, instance, created, **kwargs):
    try:
        AuditLog = apps.get_model('audit', 'AuditLog')
        action = AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE
        AuditLog.log(
            user=instance.uploaded_by,
            action=action,
            module='documents',
            description=f"Document {instance.name} {'uploaded' if created else 'updated'}",
            company=instance.company,
            object_type='Document',
            object_id=instance.id
        )
    except Exception:
        pass

@receiver(pre_delete, sender='documents.Document')
def log_document_delete(sender, instance, **kwargs):
    try:
        AuditLog = apps.get_model('audit', 'AuditLog')
        AuditLog.log(
            user=None,
            action=AuditLog.ACTION_DELETE,
            module='documents',
            description=f"Document {instance.name} deleted",
            company=instance.company,
            object_type='Document',
            object_id=instance.id
        )
    except Exception:
        pass
