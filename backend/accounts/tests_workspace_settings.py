from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership, WorkspaceActivity
from apps.employee.models import Employee


class WorkspaceAndSettingsTests(APITestCase):
    def setUp(self):
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        self.user_password = "SecurePassword123!"
        self.admin_user = User.objects.create_user(
            username="ws_admin",
            email="admin@alpha.com",
            password=self.user_password,
            first_name="Admin",
            last_name="Alpha",
        )
        self.emp_user = User.objects.create_user(
            username="ws_emp",
            email="emp@alpha.com",
            password=self.user_password,
            first_name="Worker",
            last_name="Bee",
        )
        self.outsider_user = User.objects.create_user(
            username="ws_outsider",
            email="outsider@beta.com",
            password=self.user_password,
        )

        self.company_alpha = Company.objects.create(
            name="Alpha Technologies",
            email="contact@alpha.com",
            phone="1112223333",
            address="1 Alpha Way",
            is_active=True,
        )
        self.company_beta = Company.objects.create(
            name="Beta Logistics",
            email="contact@beta.com",
            phone="4445556666",
            address="2 Beta Blvd",
            is_active=True,
        )

        self.membership_admin = CompanyMembership.objects.create(
            user=self.admin_user,
            company=self.company_alpha,
            role=self.admin_role,
            is_active=True,
        )
        self.membership_emp = CompanyMembership.objects.create(
            user=self.emp_user,
            company=self.company_alpha,
            role=self.employee_role,
            is_active=True,
        )
        self.membership_outsider = CompanyMembership.objects.create(
            user=self.outsider_user,
            company=self.company_beta,
            role=self.admin_role,
            is_active=True,
        )

    # ==========================================
    # Phase 9A: Workspace Tests
    # ==========================================
    def test_workspace_view_success(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("company_workspace", kwargs={"company_id": self.company_alpha.id})
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["company"]["name"], "Alpha Technologies")
        self.assertEqual(res.data["current_user_role"], "Company Admin")
        self.assertTrue(res.data["is_admin"])
        self.assertEqual(res.data["member_count"], 2)
        self.assertEqual(res.data["active_member_count"], 2)

    def test_workspace_view_tenant_isolation(self):
        # User in company beta cannot view company alpha workspace
        self.client.force_authenticate(user=self.outsider_user)
        url = reverse("company_workspace", kwargs={"company_id": self.company_alpha.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_employee_cannot_add_member(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("company_members", kwargs={"company_id": self.company_alpha.id})
        res = self.client.post(url, {"username": "ws_outsider", "role": "Employee"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_member_role_and_status(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse(
            "company_member_detail",
            kwargs={"company_id": self.company_alpha.id, "member_id": self.membership_emp.id},
        )
        res = self.client.patch(url, {"role": "Company Admin", "is_active": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.membership_emp.refresh_from_db()
        self.assertEqual(self.membership_emp.role.name, "Company Admin")
        self.assertTrue(WorkspaceActivity.objects.filter(company=self.company_alpha, action="role_changed").exists())

    def test_admin_can_deactivate_member(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse(
            "company_member_detail",
            kwargs={"company_id": self.company_alpha.id, "member_id": self.membership_emp.id},
        ) + "?deactivate=true"
        res = self.client.delete(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.membership_emp.refresh_from_db()
        self.assertFalse(self.membership_emp.is_active)
        self.assertTrue(WorkspaceActivity.objects.filter(company=self.company_alpha, action="member_deactivated").exists())

    # ==========================================
    # Phase 9C: Settings Tests
    # ==========================================
    def test_profile_settings_get_and_patch(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("settings_profile")
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.data["username"], "ws_admin")
        self.assertEqual(get_res.data["first_name"], "Admin")

        patch_res = self.client.patch(url, {
            "first_name": "UpdatedAdmin",
            "last_name": "Prime",
            "phone": "9998887777",
            "designation": "Director",
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data["profile"]["first_name"], "UpdatedAdmin")
        self.assertEqual(patch_res.data["profile"]["last_name"], "Prime")

        self.admin_user.refresh_from_db()
        self.assertEqual(self.admin_user.first_name, "UpdatedAdmin")

    def test_change_password_validation(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("settings_change_password")

        # Wrong old password
        res1 = self.client.post(url, {
            "current_password": "WrongPassword!",
            "new_password": "NewSecretPassword123!",
            "confirm_password": "NewSecretPassword123!",
        })
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Mismatched confirmation
        res2 = self.client.post(url, {
            "current_password": self.user_password,
            "new_password": "NewSecretPassword123!",
            "confirm_password": "DifferentPassword123!",
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Successful change
        res3 = self.client.post(url, {
            "current_password": self.user_password,
            "new_password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!",
        })
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password("BrandNewPassword123!"))

    def test_company_settings_admin_vs_employee(self):
        url = reverse("company_settings", kwargs={"company_id": self.company_alpha.id})

        # Employee can GET settings but cannot PATCH
        self.client.force_authenticate(user=self.emp_user)
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertFalse(get_res.data["can_edit"])

        patch_res = self.client.patch(url, {"name": "Hacked Name"})
        self.assertEqual(patch_res.status_code, status.HTTP_403_FORBIDDEN)

        # Admin can PATCH
        self.client.force_authenticate(user=self.admin_user)
        admin_patch_res = self.client.patch(url, {
            "name": "Alpha Corp New",
            "phone": "5551234567",
            "address": "456 Corporate Ave",
        })
        self.assertEqual(admin_patch_res.status_code, status.HTTP_200_OK)
        self.company_alpha.refresh_from_db()
        self.assertEqual(self.company_alpha.name, "Alpha Corp New")
        self.assertEqual(self.company_alpha.phone, "5551234567")
