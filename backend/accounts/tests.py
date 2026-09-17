from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership


class AuthenticationAndMembershipTests(APITestCase):
    def setUp(self):
        # Create default roles
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        # Create test users
        self.user_password = "SecurePassword123!"
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@icorp.com",
            password=self.user_password,
            first_name="Test",
            last_name="User",
        )

        self.other_user = User.objects.create_user(
            username="otheruser",
            email="otheruser@icorp.com",
            password=self.user_password,
            first_name="Other",
            last_name="User",
        )

        self.superuser = User.objects.create_superuser(
            username="superadmin",
            email="superadmin@icorp.com",
            password=self.user_password,
        )

        # Create company and membership
        self.company = Company.objects.create(
            name="Acme Corp",
            email="contact@acmecorp.com",
            phone="1234567890",
            address="123 Business Way",
            is_active=True,
        )

        self.membership = CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=self.admin_role,
        )

    def test_login_with_username(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "testuser",
            "password": self.user_password,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["username"], "testuser")

    def test_login_with_email(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "testuser@icorp.com",
            "password": self.user_password,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "testuser@icorp.com")

    def test_login_invalid_password(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "testuser",
            "password": "WrongPassword!",
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        login_url = reverse("token_obtain_pair")
        login_res = self.client.post(login_url, {
            "username": "testuser",
            "password": self.user_password,
        })
        refresh_token = login_res.data["refresh"]

        refresh_url = reverse("token_refresh")
        refresh_res = self.client.post(refresh_url, {"refresh": refresh_token})
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_res.data)

    def test_me_endpoint(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("auth_me")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertEqual(len(response.data["companies"]), 1)
        self.assertEqual(response.data["companies"][0]["id"], self.company.id)
        self.assertEqual(response.data["companies"][0]["role"], "Company Admin")

    def test_company_member_list(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("company_members", kwargs={"company_id": self.company.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["username"], "testuser")

    def test_add_company_member(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("company_member_create", kwargs={"company_id": self.company.id})
        response = self.client.post(url, {
            "username": "otheruser",
            "role": "Employee",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            CompanyMembership.objects.filter(
                user=self.other_user,
                company=self.company,
            ).exists()
        )

    def test_update_member_role(self):
        other_membership = CompanyMembership.objects.create(
            user=self.other_user,
            company=self.company,
            role=self.employee_role,
        )

        self.client.force_authenticate(user=self.user)
        url = reverse(
            "company-member-update",
            kwargs={"company_id": self.company.id, "membership_id": other_membership.id},
        )
        response = self.client.patch(url, {"role": "Company Admin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        other_membership.refresh_from_db()
        self.assertEqual(other_membership.role.name, "Company Admin")

    def test_remove_member(self):
        other_membership = CompanyMembership.objects.create(
            user=self.other_user,
            company=self.company,
            role=self.employee_role,
        )

        self.client.force_authenticate(user=self.user)
        url = reverse(
            "company-member-update",
            kwargs={"company_id": self.company.id, "membership_id": other_membership.id},
        )
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(CompanyMembership.objects.filter(id=other_membership.id).exists())
