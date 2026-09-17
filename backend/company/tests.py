from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership


class CompanyAPITests(APITestCase):
    def setUp(self):
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        self.password = "Pass12345!"
        self.admin_user = User.objects.create_user(
            username="adminuser",
            email="admin@alpha.com",
            password=self.password,
        )

        self.other_user = User.objects.create_user(
            username="betadmin",
            email="admin@beta.com",
            password=self.password,
        )

        self.superuser = User.objects.create_superuser(
            username="rootuser",
            email="root@erp.com",
            password=self.password,
        )

        # Company 1
        self.company_a = Company.objects.create(
            name="Alpha Corp",
            email="info@alpha.com",
            phone="111-222-3333",
            address="1 Alpha Way",
            is_active=True,
        )
        CompanyMembership.objects.create(
            user=self.admin_user,
            company=self.company_a,
            role=self.admin_role,
        )

        # Company 2
        self.company_b = Company.objects.create(
            name="Beta Ltd",
            email="info@beta.com",
            phone="444-555-6666",
            address="2 Beta Blvd",
            is_active=True,
        )
        CompanyMembership.objects.create(
            user=self.other_user,
            company=self.company_b,
            role=self.admin_role,
        )

    def test_company_list_tenant_isolation(self):
        # Admin A should ONLY see Company A
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("company_list")
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["name"], "Alpha Corp")

    def test_company_list_superuser(self):
        # Superuser should see ALL companies
        self.client.force_authenticate(user=self.superuser)
        url = reverse("company_list")
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 2)

    def test_create_company_assigns_admin(self):
        new_user = User.objects.create_user(
            username="founder",
            email="founder@gamma.com",
            password=self.password,
        )
        self.client.force_authenticate(user=new_user)
        url = reverse("company_create")
        payload = {
            "name": "Gamma Solutions",
            "email": "contact@gammasolutions.com",
            "phone": "999-888-7777",
            "address": "777 Gamma St",
        }
        res = self.client.post(url, payload)

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_company_id = res.data["id"]
        # Verify founder is Company Admin of new company
        membership = CompanyMembership.objects.filter(
            user=new_user,
            company_id=new_company_id,
        ).first()
        self.assertIsNotNone(membership)
        self.assertEqual(membership.role.name, "Company Admin")

    def test_company_detail_isolation(self):
        # Admin A cannot view Company B detail
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("company_detail", kwargs={"pk": self.company_b.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Admin A CAN view Company A detail
        url = reverse("company_detail", kwargs={"pk": self.company_a.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Alpha Corp")

    def test_update_company(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("company_detail", kwargs={"pk": self.company_a.id})
        res = self.client.patch(url, {"phone": "123-999-0000"})

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.company_a.refresh_from_db()
        self.assertEqual(self.company_a.phone, "123-999-0000")

    def test_deactivate_company(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("company_detail", kwargs={"pk": self.company_a.id})
        res = self.client.delete(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.company_a.refresh_from_db()
        self.assertFalse(self.company_a.is_active)
