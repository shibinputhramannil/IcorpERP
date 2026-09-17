from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from apps.employee.models import Employee


class EmployeeAPITests(APITestCase):
    def setUp(self):
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        self.password = "Pass12345!"
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@corp.com",
            password=self.password,
        )

        self.regular_user = User.objects.create_user(
            username="emp_user",
            email="emp@corp.com",
            password=self.password,
        )

        self.outsider_user = User.objects.create_user(
            username="outsider",
            email="outsider@other.com",
            password=self.password,
        )

        # Company 1
        self.company = Company.objects.create(
            name="Main Corp",
            email="info@maincorp.com",
            is_active=True,
        )
        CompanyMembership.objects.create(
            user=self.admin_user,
            company=self.company,
            role=self.admin_role,
        )
        CompanyMembership.objects.create(
            user=self.regular_user,
            company=self.company,
            role=self.employee_role,
        )

        # Create initial employee profile
        self.employee = Employee.objects.create(
            employee_id="EMP-001",
            user=self.regular_user,
            company=self.company,
            first_name="Regular",
            last_name="Staff",
            phone="555-1234",
            department="Operations",
            designation="Operations Associate",
            is_active=True,
        )

    def test_list_employees_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("employee_list", kwargs={"company_id": self.company.id})
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["employee_id"], "EMP-001")

    def test_list_employees_as_employee(self):
        self.client.force_authenticate(user=self.regular_user)
        url = reverse("employee_list", kwargs={"company_id": self.company.id})
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_outsider_cannot_view_employees(self):
        self.client.force_authenticate(user=self.outsider_user)
        url = reverse("employee_list", kwargs={"company_id": self.company.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_employee_with_new_email(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("employee_list", kwargs={"company_id": self.company.id})
        payload = {
            "employee_id": "EMP-002",
            "first_name": "Alice",
            "last_name": "Smith",
            "email": "alice@corp.com",
            "phone": "555-9876",
            "department": "Sales",
            "designation": "Sales Executive",
            "joining_date": "2025-02-01",
        }
        res = self.client.post(url, payload)

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["employee_id"], "EMP-002")
        self.assertTrue(User.objects.filter(email="alice@corp.com").exists())
        self.assertTrue(
            CompanyMembership.objects.filter(
                user__email="alice@corp.com",
                company=self.company,
            ).exists()
        )

    def test_regular_employee_cannot_create_employee(self):
        self.client.force_authenticate(user=self.regular_user)
        url = reverse("employee_list", kwargs={"company_id": self.company.id})
        payload = {
            "employee_id": "EMP-003",
            "first_name": "Bob",
            "last_name": "Jones",
            "email": "bob@corp.com",
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_employee(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse(
            "employee_detail",
            kwargs={"company_id": self.company.id, "employee_id": self.employee.id},
        )
        res = self.client.patch(url, {"designation": "Senior Operations Manager"})

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.designation, "Senior Operations Manager")

    def test_deactivate_employee(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse(
            "employee_detail",
            kwargs={"company_id": self.company.id, "employee_id": self.employee.id},
        )
        res = self.client.delete(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.is_active)
