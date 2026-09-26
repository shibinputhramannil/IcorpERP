import os
import django
from django.core.files.uploadedfile import SimpleUploadedFile

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from company.models import Company
from accounts.models import CompanyMembership, WorkspaceActivity
from crm.models import Activity
from crm.services.gmail_service import GmailService
from documents.models import Document


def run_live_verification():
    print("=== STARTING PHASE 9A EXTENSION LIVE VERIFICATION ===")

    company = Company.objects.first()
    if not company:
        company = Company.objects.create(name="Live Test Company", email="test@icorp.com")

    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not user:
        user = User.objects.create_user(username="live_collab_user", email="collab@icorp.com", password="password123")

    membership = CompanyMembership.objects.filter(company=company, user=user).first()
    if not membership:
        membership = CompanyMembership.objects.create(company=company, user=user)

    print(f"[+] Active Company: {company.name} (ID: {company.id})")
    print(f"[+] Active User: {user.username} (ID: {user.id})")

    # 1. Test Notes (using CRM Activity model)
    note = Activity.objects.create(
        company=company,
        user=user,
        activity_type="Note",
        title="Live Test Strategy Note",
        description="Discussing Phase 9A extension live test execution.",
    )
    assert note.id is not None, "Note creation failed!"
    print(f"[+] Note created successfully: ID {note.id}, title='{note.title}'")

    # 2. Test Mail (using GmailService & Activity)
    mail_status = GmailService.get_status()
    print(f"[+] Mail Service Status: Mode='{mail_status['mode']}', Configured={mail_status['is_configured']}")

    dispatch_res = GmailService.send_email(
        subject="Live Test Email",
        body="Verification of workspace mail infrastructure.",
        recipient="partner@example.com",
    )
    assert dispatch_res["success"] is True, "Mail dispatch failed!"

    email_act = Activity.objects.create(
        company=company,
        user=user,
        activity_type="Email",
        title="Live Test Email",
        description="[To: partner@example.com]\n\nVerification of workspace mail infrastructure.",
    )
    assert email_act.id is not None, "Email activity creation failed!"
    print(f"[+] Email activity recorded: ID {email_act.id}, provider='{dispatch_res.get('provider')}'")

    # 3. Test Documents
    test_file = SimpleUploadedFile("live_test_sheet.xlsx", b"Excel dummy data for live verification")
    doc = Document.objects.create(
        company=company,
        uploaded_by=user,
        name="Q3 Live Financials.xlsx",
        file=test_file,
        file_type="XLSX",
        file_size=len(test_file),
        related_module="workspace",
    )
    assert doc.id is not None, "Document creation failed!"
    assert doc.file is not None, "Document file attachment failed!"
    print(f"[+] Document uploaded successfully: ID {doc.id}, name='{doc.name}', type={doc.file_type}")

    # 4. Clean up test records
    note.delete()
    email_act.delete()
    if doc.file:
        doc.file.delete(save=False)
    doc.delete()
    print("[+] Cleaned up live test records safely.")

    print("=== PHASE 9A EXTENSION LIVE VERIFICATION SUCCESSFUL ===")


if __name__ == "__main__":
    run_live_verification()
