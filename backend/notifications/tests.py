from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from notifications.models import Notification, NotificationPreference
from notifications.services import create_notification, notify_company_admins


class NotificationTests(APITestCase):
    def setUp(self):
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        self.user_password = "SecurePassword123!"
        self.admin_user = User.objects.create_user(
            username="adminuser",
            email="admin@company1.com",
            password=self.user_password,
        )
        self.emp_user = User.objects.create_user(
            username="empuser",
            email="emp@company1.com",
            password=self.user_password,
        )
        self.other_company_user = User.objects.create_user(
            username="othercompuser",
            email="user@company2.com",
            password=self.user_password,
        )

        self.company1 = Company.objects.create(name="Company One", email="c1@transt.com")
        self.company2 = Company.objects.create(name="Company Two", email="c2@transt.com")

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
            user=self.other_company_user,
            company=self.company2,
            role=self.admin_role,
        )

    def test_create_notification_service(self):
        notif = create_notification(
            company=self.company1,
            recipient=self.emp_user,
            notification_type="task",
            title="Assigned Task",
            message="You have a new task assigned.",
            related_module="workspace",
        )
        self.assertIsNotNone(notif)
        self.assertEqual(notif.recipient, self.emp_user)
        self.assertEqual(notif.company, self.company1)
        self.assertFalse(notif.is_read)

    def test_notify_company_admins(self):
        notifications = notify_company_admins(
            company=self.company1,
            title="System Alert",
            message="Urgent admin action needed.",
            notification_type="alert",
        )
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].recipient, self.admin_user)

    def test_list_notifications_tenant_isolated(self):
        # Create notif for company 1 emp
        create_notification(
            company=self.company1,
            recipient=self.emp_user,
            title="Test 1",
            message="Msg 1",
        )
        # Create notif for company 2 user
        create_notification(
            company=self.company2,
            recipient=self.other_company_user,
            title="Test 2",
            message="Msg 2",
        )

        self.client.force_authenticate(user=self.emp_user)
        url = reverse("notification_list", kwargs={"company_id": self.company1.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Test 1")

        # Other company user cannot see company 1 notifications (returns 403)
        self.client.force_authenticate(user=self.other_company_user)
        res_denied = self.client.get(url)
        self.assertEqual(res_denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_unread_count_endpoint(self):
        create_notification(
            company=self.company1,
            recipient=self.emp_user,
            title="N1",
            message="M1",
        )
        create_notification(
            company=self.company1,
            recipient=self.emp_user,
            title="N2",
            message="M2",
        )

        self.client.force_authenticate(user=self.emp_user)
        url = reverse("notification_unread_count", kwargs={"company_id": self.company1.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 2)

    def test_mark_as_read_endpoint(self):
        notif = create_notification(
            company=self.company1,
            recipient=self.emp_user,
            title="Task",
            message="Details",
        )

        self.client.force_authenticate(user=self.emp_user)
        url = reverse("notification_read", kwargs={"company_id": self.company1.id, "pk": notif.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_mark_all_read_endpoint(self):
        create_notification(company=self.company1, recipient=self.emp_user, title="A", message="A")
        create_notification(company=self.company1, recipient=self.emp_user, title="B", message="B")

        self.client.force_authenticate(user=self.emp_user)
        url = reverse("notification_read_all", kwargs={"company_id": self.company1.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["marked_read_count"], 2)
        unread_count = Notification.objects.filter(recipient=self.emp_user, company=self.company1, is_read=False).count()
        self.assertEqual(unread_count, 0)

    def test_notification_preferences_get_and_patch(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("settings_notifications")
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(get_res.data["system_notifications"])
        self.assertTrue(get_res.data["email_notifications"])

        # Patch preference
        patch_res = self.client.patch(url, {"low_stock_alerts": False, "sales_alerts": False})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertFalse(patch_res.data["preferences"]["low_stock_alerts"])
        self.assertFalse(patch_res.data["preferences"]["sales_alerts"])
