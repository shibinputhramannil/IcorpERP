import logging
from notifications.models import Notification, NotificationPreference

logger = logging.getLogger(__name__)


def get_or_create_user_preferences(user, company=None):
    """
    Returns user notification preferences for the given company or creates defaults.
    """
    pref, _ = NotificationPreference.objects.get_or_create(
        user=user,
        company=company,
        defaults={
            "email_notifications": True,
            "system_notifications": True,
            "low_stock_alerts": True,
            "sales_alerts": True,
            "purchase_alerts": True,
            "finance_alerts": True,
            "hr_alerts": True,
        },
    )
    return pref


def create_notification(
    company,
    recipient,
    notification_type="system",
    title="",
    message="",
    related_module=None,
    related_object_id=None,
):
    """
    Reusable notification service function with preference filtering and company isolation.
    Never transmits credentials, tokens, or private secrets.
    """
    if not company or not recipient:
        return None

    # Check recipient preferences
    try:
        pref = NotificationPreference.objects.filter(user=recipient, company=company).first()
        if not pref:
            pref = NotificationPreference.objects.filter(user=recipient, company=None).first()

        if pref:
            if not pref.system_notifications:
                return None
            if notification_type == "inventory" and not pref.low_stock_alerts:
                return None
            if notification_type == "sales" and not pref.sales_alerts:
                return None
            if notification_type == "purchase" and not pref.purchase_alerts:
                return None
            if notification_type == "finance" and not pref.finance_alerts:
                return None
            if notification_type == "hr" and not pref.hr_alerts:
                return None
    except Exception as e:
        logger.warning(f"Error checking notification preferences: {e}")

    try:
        notification = Notification.objects.create(
            company=company,
            recipient=recipient,
            notification_type=notification_type,
            title=str(title)[:255],
            message=str(message),
            related_module=related_module,
            related_object_id=related_object_id,
        )
        return notification
    except Exception as e:
        logger.exception(f"Failed to create notification: {e}")
        return None


def notify_company_admins(company, notification_type, title, message, related_module=None, related_object_id=None, exclude_user=None):
    """
    Broadcasts a notification to all active Company Admins of the specified company.
    """
    from accounts.models import CompanyMembership
    memberships = CompanyMembership.objects.filter(
        company=company,
        role__name="Company Admin",
        is_active=True,
    ).select_related("user")

    created = []
    for m in memberships:
        if exclude_user and m.user_id == exclude_user.id:
            continue
        notif = create_notification(
            company=company,
            recipient=m.user,
            notification_type=notification_type,
            title=title,
            message=message,
            related_module=related_module,
            related_object_id=related_object_id,
        )
        if notif:
            created.append(notif)
    return created
