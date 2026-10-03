import io
from django.contrib.auth.models import Group, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership, WorkspaceActivity
from documents.models import Document


class DocumentManagementTests(APITestCase):
    def setUp(self):
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        self.user_password = "SecurePassword123!"
        self.admin_user = User.objects.create_user(
            username="doc_admin",
            email="admin@doccompany.com",
            password=self.user_password,
        )
        self.emp_user = User.objects.create_user(
            username="doc_emp",
            email="emp@doccompany.com",
            password=self.user_password,
        )
        self.outsider_user = User.objects.create_user(
            username="doc_outsider",
            email="outsider@otherdoccompany.com",
            password=self.user_password,
        )

        self.company1 = Company.objects.create(name="DocTech Corp", email="c1@doctech.com")
        self.company2 = Company.objects.create(name="Other Corp", email="c2@other.com")

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

    def test_upload_valid_document(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("document_list_create", kwargs={"company_id": self.company1.id})

        file_content = b"PDF dummy content for transt enterprise testing"
        uploaded_file = SimpleUploadedFile("contract.pdf", file_content, content_type="application/pdf")

        response = self.client.post(url, {
            "name": "Service Level Agreement",
            "file": uploaded_file,
            "related_module": "crm",
        }, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Service Level Agreement")
        self.assertEqual(response.data["file_type"], "PDF")
        self.assertEqual(response.data["related_module"], "crm")
        self.assertTrue(
            WorkspaceActivity.objects.filter(
                company=self.company1,
                action="document_uploaded",
            ).exists()
        )

    def test_reject_executable_file(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("document_list_create", kwargs={"company_id": self.company1.id})

        dangerous_file = SimpleUploadedFile("malware.exe", b"binary content", content_type="application/octet-stream")
        response = self.client.post(url, {
            "name": "Malware file",
            "file": dangerous_file,
        }, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertFalse(Document.objects.filter(company=self.company1, name="Malware file").exists())

    def test_reject_file_exceeding_size_limit(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("document_list_create", kwargs={"company_id": self.company1.id})

        # Exceed 25 MB
        large_content = b"0" * (26 * 1024 * 1024)
        large_file = SimpleUploadedFile("huge.pdf", large_content, content_type="application/pdf")

        response = self.client.post(url, {
            "name": "Huge File",
            "file": large_file,
        }, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_list_and_search_documents(self):
        # Create documents directly
        doc1 = Document.objects.create(
            company=self.company1,
            uploaded_by=self.emp_user,
            name="Q1 Financial Report.xlsx",
            file=SimpleUploadedFile("report.xlsx", b"report content"),
            file_type="XLSX",
            file_size=1024,
            related_module="finance",
        )
        doc2 = Document.objects.create(
            company=self.company1,
            uploaded_by=self.admin_user,
            name="Employee Handbook.pdf",
            file=SimpleUploadedFile("handbook.pdf", b"handbook content"),
            file_type="PDF",
            file_size=2048,
            related_module="hr",
        )

        self.client.force_authenticate(user=self.emp_user)
        url = reverse("document_list_create", kwargs={"company_id": self.company1.id})

        # Search by keyword
        res_search = self.client.get(f"{url}?search=Financial")
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_search.data["results"]), 1)
        self.assertEqual(res_search.data["results"][0]["name"], "Q1 Financial Report.xlsx")

        # Filter by file type
        res_type = self.client.get(f"{url}?file_type=PDF")
        self.assertEqual(res_type.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_type.data["results"]), 1)
        self.assertEqual(res_type.data["results"][0]["name"], "Employee Handbook.pdf")

    def test_document_download_and_tenant_isolation(self):
        doc = Document.objects.create(
            company=self.company1,
            uploaded_by=self.emp_user,
            name="Confidential Notes.txt",
            file=SimpleUploadedFile("notes.txt", b"Secret company information"),
            file_type="TXT",
            file_size=25,
            related_module="workspace",
        )

        download_url = reverse("document_download", kwargs={"company_id": self.company1.id, "pk": doc.id})

        # Company 1 member can download
        self.client.force_authenticate(user=self.emp_user)
        response = self.client.get(download_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Secret company information", response.getvalue().decode())

        # Company 2 member gets 403 Forbidden
        self.client.force_authenticate(user=self.outsider_user)
        res_forbidden = self.client.get(download_url)
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_document_permissions(self):
        doc = Document.objects.create(
            company=self.company1,
            uploaded_by=self.emp_user,
            name="Obsolete Policy.docx",
            file=SimpleUploadedFile("policy.docx", b"policy"),
            file_type="DOCX",
            file_size=10,
        )

        url = reverse("document_detail", kwargs={"company_id": self.company1.id, "pk": doc.id})

        # Other company member cannot delete (403)
        self.client.force_authenticate(user=self.outsider_user)
        res_outsider = self.client.delete(url)
        self.assertEqual(res_outsider.status_code, status.HTTP_403_FORBIDDEN)

        # Uploader can delete
        self.client.force_authenticate(user=self.emp_user)
        res_del = self.client.delete(url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(Document.objects.filter(id=doc.id).exists())
        self.assertTrue(
            WorkspaceActivity.objects.filter(
                company=self.company1,
                action="document_deleted",
            ).exists()
        )
