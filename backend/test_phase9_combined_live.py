import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from company.models import Company
from accounts.models import CompanyMembership, WorkspaceActivity
from notifications.models import Notification, NotificationPreference
from notifications.services import create_notification, get_or_create_user_preferences


def run_live_verification():
    print("=== STARTING PHASE 9 LIVE VERIFICATION ===")

    company = Company.objects.first()
    if not company:
        print("[!] No company found in DB, creating demo company")
        company = Company.objects.create(name="Live Demo Corp", email="demo@icorp.com")

    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not user:
        print("[!] No user found, creating test user")
        user = User.objects.create_user(username="live_test_user", email="live@icorp.com", password="password123")

    membership = CompanyMembership.objects.filter(company=company, user=user).first()
    if not membership:
        membership = CompanyMembership.objects.create(company=company, user=user)

    print(f"[+] Tested Company: {company.name} (ID: {company.id})")
    print(f"[+] Tested User: {user.username} (ID: {user.id})")
    print(f"[+] Membership Active Status: {membership.is_active}")

    # 1. Test Notification Service
    notif = create_notification(
        company=company,
        recipient=user,
        notification_type="system",
        title="Live Test Notification",
        message="Verification notification for Phase 9",
        related_module="workspace",
    )
    assert notif is not None, "Notification creation failed!"
    print(f"[+] Notification created successfully: ID {notif.id}, title='{notif.title}'")

    # 2. Test Notification Preferences
    pref = get_or_create_user_preferences(user, company)
    assert pref is not None, "Preference retrieval/creation failed!"
    print(f"[+] Notification preferences verified for user {user.username}")

    # 3. Test Workspace Activity Logging
    act = WorkspaceActivity.objects.create(
        company=company,
        user=user,
        action="live_verification",
        details="Phase 9 live verification script executed successfully.",
    )
    assert act.id is not None, "Activity log creation failed!"
    print(f"[+] Workspace activity logged: ID {act.id}, action='{act.action}'")

    # Clean up test notification and activity if desired
    notif.delete()
    act.delete()
    print("[+] Cleaned up live test records.")

    print("=== PHASE 9 LIVE VERIFICATION SUCCESSFUL ===")


if __name__ == "__main__":
    run_live_verification()
