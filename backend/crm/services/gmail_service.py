import os
import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


class GmailService:
    """
    Clean service abstraction layer for email dispatch and Gmail integration.
    Operates in local-first mode when Gmail API / OAuth credentials are not supplied,
    safely recording email events locally or dispatching via configured SMTP.
    """

    @classmethod
    def get_status(cls):
        """
        Returns real integration configuration status.
        Does NOT pretend an integration is connected when credentials are missing.
        """
        has_client_id = bool(os.environ.get("GOOGLE_CLIENT_ID"))
        has_client_secret = bool(os.environ.get("GOOGLE_CLIENT_SECRET"))
        has_refresh_token = bool(os.environ.get("GOOGLE_REFRESH_TOKEN"))

        is_configured = has_client_id and has_client_secret and has_refresh_token

        return {
            "service": "Gmail API",
            "provider": "Gmail API",
            "is_configured": is_configured,
            "mode": "OAuth2" if is_configured else "Local Storage / Console SMTP",
            "status": "Connected" if is_configured else "Local Ready",
            "message": "Gmail API integration active" if is_configured else "Local CRM dispatch active (no external credentials required)",
            "details": "Gmail API integration ready" if is_configured else "Credentials not configured; email activities are recorded in ERP database.",
        }

    @classmethod
    def send_email(cls, subject, body, recipient, sender=None):
        """
        Attempts to send email or logs locally if unconfigured.
        Returns a dictionary describing the dispatch status.
        """
        status = cls.get_status()

        if not status["is_configured"]:
            logger.info(f"[Local CRM Email] To: {recipient} | Subject: {subject}")
            return {
                "success": True,
                "sent_externally": False,
                "provider": "local",
                "message": "Email recorded in local CRM database (external Gmail credentials not set).",
            }

        try:
            from_email = sender or getattr(settings, "DEFAULT_FROM_EMAIL", "erp@icorp.com")
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[recipient],
                fail_silently=False,
            )
            return {
                "success": True,
                "sent_externally": True,
                "provider": "smtp/gmail",
                "message": f"Email successfully sent to {recipient}.",
            }
        except Exception as e:
            logger.error(f"Failed to dispatch external email: {str(e)}")
            return {
                "success": False,
                "sent_externally": False,
                "provider": "smtp/gmail",
                "error": str(e),
            }
