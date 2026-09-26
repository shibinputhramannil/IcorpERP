from datetime import datetime, timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from company.models import Company
from accounts.models import CompanyMembership
from calendar_events.models import CalendarEvent


class CalendarEventTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="calendaruser",
            email="cal@icorp.local",
            password="testpassword123",
        )
        self.other_user = User.objects.create_user(
            username="otheruser",
            email="other@icorp.local",
            password="testpassword123",
        )
        self.company = Company.objects.create(
            name="Test Corp",
            email="testcorp@example.com",
            is_active=True,
        )
        self.membership = CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            is_active=True,
        )

        self.client.force_authenticate(user=self.user)

    def test_create_and_list_calendar_event(self):
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=1)

        create_data = {
            "title": "Quarterly Business Review",
            "description": "Discuss Q3 performance metrics",
            "event_type": "meeting",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "location": "Boardroom A",
        }

        url = f"/api/companies/{self.company.id}/calendar/events/"
        response = self.client.post(url, create_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Quarterly Business Review")
        self.assertEqual(response.data["company"], self.company.id)

        # List
        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

    def test_update_and_delete_calendar_event(self):
        start = timezone.now() + timedelta(hours=2)
        end = start + timedelta(hours=1)
        event = CalendarEvent.objects.create(
            company=self.company,
            created_by=self.user,
            title="Follow-up Call",
            event_type="call",
            start_time=start,
            end_time=end,
        )

        detail_url = f"/api/companies/{self.company.id}/calendar/events/{event.id}/"
        patch_res = self.client.patch(detail_url, {"title": "Rescheduled Call"}, format="json")
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data["title"], "Rescheduled Call")

        delete_res = self.client.delete(detail_url)
        self.assertEqual(delete_res.status_code, status.HTTP_200_OK)
        self.assertFalse(CalendarEvent.objects.filter(id=event.id).exists())

    def test_upcoming_calendar_events(self):
        start = timezone.now() + timedelta(hours=5)
        end = start + timedelta(hours=1)
        CalendarEvent.objects.create(
            company=self.company,
            created_by=self.user,
            title="Upcoming Meeting",
            event_type="meeting",
            start_time=start,
            end_time=end,
            status="scheduled",
        )

        upcoming_url = f"/api/companies/{self.company.id}/calendar/upcoming/"
        response = self.client.get(upcoming_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_unauthorized_company_isolation(self):
        other_company = Company.objects.create(
            name="Rival Corp",
            email="rivalcorp@example.com",
            is_active=True,
        )
        url = f"/api/companies/{other_company.id}/calendar/events/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
