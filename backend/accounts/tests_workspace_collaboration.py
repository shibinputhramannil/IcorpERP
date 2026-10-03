from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership, WorkspaceActivity
from crm.models import Activity, Customer, Contact, Deal, Lead
from documents.models import Document
from django.core.files.uploadedfile import SimpleUploadedFile


class WorkspaceCollaborationTests(APITestCase):
    def setUp(self):
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        self.user_password = "SecurePassword123!"
        self.admin_user = User.objects.create_user(
            username="collab_admin",
            email="admin@collabcorp.com",
            password=self.user_password,
            first_name="Admin",
            last_name="Leader",
        )
        self.emp_user = User.objects.create_user(
            username="collab_emp",
            email="emp@collabcorp.com",
            password=self.user_password,
            first_name="Employee",
            last_name="One",
        )
        self.outsider_user = User.objects.create_user(
            username="collab_outsider",
            email="outsider@othercorp.com",
            password=self.user_password,
        )

        self.company1 = Company.objects.create(name="Collab Corp", email="c1@collab.com")
        self.company2 = Company.objects.create(name="Rival Corp", email="c2@rival.com")

        CompanyMembership.objects.create(
            user=self.admin_user,
            company=self.company1,
            role=self.admin_role,
        )
        CompanyMembership.objects.create(
            user=self.emp_user,
            company=self.company1,
            role=self.employee_role,
        )
        CompanyMembership.objects.create(
            user=self.outsider_user,
            company=self.company2,
            role=self.admin_role,
        )

        # Create sample customer in company 1
        self.customer = Customer.objects.create(
            company=self.company1,
            name="Apex Enterprises",
            email="info@apex.com",
        )

    # ============================================================
    # 1. Notes Tests
    # ============================================================
    def test_create_and_list_notes(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("workspace_notes", kwargs={"company_id": self.company1.id})

        # Create note
        res_post = self.client.post(url, {
            "title": "Meeting with Apex CEO",
            "content": "Discussed contract renewal and volume discounts.",
            "customer_id": self.customer.id,
        })
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_post.data["title"], "Meeting with Apex CEO")
        self.assertEqual(res_post.data["related_entity"]["type"], "Customer")
        self.assertEqual(res_post.data["related_entity"]["name"], "Apex Enterprises")

        # List notes
        res_get = self.client.get(url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_get.data["results"]), 1)
        self.assertEqual(res_get.data["results"][0]["title"], "Meeting with Apex CEO")

    def test_update_and_delete_note(self):
        note = Activity.objects.create(
            company=self.company1,
            user=self.emp_user,
            activity_type="Note",
            title="Initial Proposal Idea",
            description="Offer 10% discount on initial batch.",
        )

        self.client.force_authenticate(user=self.emp_user)
        detail_url = reverse("workspace_note_detail", kwargs={"company_id": self.company1.id, "pk": note.id})

        # Update note
        res_patch = self.client.patch(detail_url, {
            "title": "Revised Proposal Idea",
            "content": "Offer 12% discount on bulk purchase.",
        })
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["title"], "Revised Proposal Idea")

        # Delete note
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(Activity.objects.filter(id=note.id).exists())

    def test_notes_tenant_isolation(self):
        # Company 1 note
        note = Activity.objects.create(
            company=self.company1,
            user=self.emp_user,
            activity_type="Note",
            title="Private Company 1 Strategy",
            description="Confidential strategy details",
        )

        detail_url = reverse("workspace_note_detail", kwargs={"company_id": self.company1.id, "pk": note.id})

        # Outsider user gets 403 Forbidden
        self.client.force_authenticate(user=self.outsider_user)
        res_denied = self.client.get(detail_url)
        self.assertEqual(res_denied.status_code, status.HTTP_403_FORBIDDEN)

        res_patch_denied = self.client.patch(detail_url, {"title": "Hacked"})
        self.assertEqual(res_patch_denied.status_code, status.HTTP_403_FORBIDDEN)

    # ============================================================
    # 2. Mail Tests
    # ============================================================
    def test_send_and_list_emails(self):
        self.client.force_authenticate(user=self.emp_user)
        send_url = reverse("workspace_mail_send", kwargs={"company_id": self.company1.id})

        res_send = self.client.post(send_url, {
            "recipient": "client@example.com",
            "subject": "Invoice Follow-up #1042",
            "body": "Please find attached the latest settlement confirmation.",
        })
        self.assertEqual(res_send.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_send.data["subject"], "Invoice Follow-up #1042")
        self.assertEqual(res_send.data["recipient"], "client@example.com")
        self.assertIn("dispatch_result", res_send.data)

        # List emails
        list_url = reverse("workspace_mail", kwargs={"company_id": self.company1.id})
        res_list = self.client.get(list_url)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data["results"]), 1)
        self.assertEqual(res_list.data["results"][0]["subject"], "Invoice Follow-up #1042")

    def test_mail_status_endpoint(self):
        self.client.force_authenticate(user=self.emp_user)
        status_url = reverse("workspace_mail_status", kwargs={"company_id": self.company1.id})
        res = self.client.get(status_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("is_configured", res.data)
        self.assertIn("mode", res.data)

    def test_mail_tenant_isolation(self):
        Activity.objects.create(
            company=self.company1,
            user=self.emp_user,
            activity_type="Email",
            title="Internal Email",
            description="[To: c1@transt.com]\n\nInternal info",
        )

        list_url = reverse("workspace_mail", kwargs={"company_id": self.company1.id})
        self.client.force_authenticate(user=self.outsider_user)
        res = self.client.get(list_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ============================================================
    # 3. Collaboration Overview & Activities Tests
    # ============================================================
    def test_workspace_collaboration_overview(self):
        # Create a note, email, document, activity
        Activity.objects.create(
            company=self.company1,
            user=self.emp_user,
            activity_type="Note",
            title="Test Note",
            description="Content",
        )
        Activity.objects.create(
            company=self.company1,
            user=self.emp_user,
            activity_type="Email",
            title="Test Email",
            description="[To: test@test.com]\n\nBody",
        )
        Document.objects.create(
            company=self.company1,
            uploaded_by=self.emp_user,
            name="Plan.pdf",
            file=SimpleUploadedFile("plan.pdf", b"test pdf"),
            file_type="PDF",
            file_size=100,
        )
        WorkspaceActivity.objects.create(
            company=self.company1,
            user=self.emp_user,
            action="milestone_reached",
            details="Milestone achieved",
        )

        self.client.force_authenticate(user=self.emp_user)
        collab_url = reverse("workspace_collaboration_overview", kwargs={"company_id": self.company1.id})
        res = self.client.get(collab_url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("notes", res.data)
        self.assertIn("emails", res.data)
        self.assertIn("documents", res.data)
        self.assertIn("activities", res.data)
        self.assertIn("members", res.data)
        self.assertEqual(res.data["stats"]["total_notes"], 1)
        self.assertEqual(res.data["stats"]["total_emails"], 1)
        self.assertEqual(res.data["stats"]["total_documents"], 1)
        self.assertEqual(res.data["stats"]["total_members"], 2)

    def test_workspace_unified_activity_feed(self):
        self.client.force_authenticate(user=self.emp_user)
        feed_url = reverse("workspace_activities", kwargs={"company_id": self.company1.id})
        res = self.client.get(feed_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
