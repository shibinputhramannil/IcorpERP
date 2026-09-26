from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from company.models import Company
from accounts.models import CompanyMembership
from emails.models import EmailMessage


class EmailMessageTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="emailuser",
            email="sender@icorp.local",
            password="testpassword123",
        )
        self.company = Company.objects.create(
            name="Email Corp",
            email="emailcorp@example.com",
            is_active=True,
        )
        self.membership = CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            is_active=True,
        )

        self.client.force_authenticate(user=self.user)

    def test_send_and_list_emails(self):
        url = f"/api/companies/{self.company.id}/emails/"
        post_data = {
            "recipient": "client@example.com",
            "subject": "Proposal Discussion",
            "body": "Hi, please review our proposal.",
        }
        res = self.client.post(url, post_data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["recipient"], "client@example.com")
        self.assertEqual(res.data["folder"], "sent")

        # List sent folder
        list_res = self.client.get(f"{url}?folder=sent")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data["count"], 1)

    def test_save_draft_and_folder_counts(self):
        url = f"/api/companies/{self.company.id}/emails/"
        draft_data = {
            "recipient": "draft_recipient@example.com",
            "subject": "Unfinished Pitch",
            "body": "Draft contents...",
            "is_draft": True,
        }
        res = self.client.post(url, draft_data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["folder"], "drafts")

        # Counts
        counts_res = self.client.get(f"/api/companies/{self.company.id}/emails/counts/")
        self.assertEqual(counts_res.status_code, status.HTTP_200_OK)
        self.assertEqual(counts_res.data["drafts"], 1)

    def test_detail_and_trash_email(self):
        email_obj = EmailMessage.objects.create(
            company=self.company,
            sender=self.user,
            recipient="test@example.com",
            subject="Welcome",
            body="Hello!",
            folder="inbox",
            is_read=False,
        )

        detail_url = f"/api/companies/{self.company.id}/emails/{email_obj.id}/"
        get_res = self.client.get(detail_url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(get_res.data["is_read"])

        # Delete (moves to trash)
        del_res = self.client.delete(detail_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        email_obj.refresh_from_db()
        self.assertEqual(email_obj.folder, "trash")

        # Delete again (permanent)
        del_again = self.client.delete(detail_url)
        self.assertEqual(del_again.status_code, status.HTTP_200_OK)
        self.assertFalse(EmailMessage.objects.filter(id=email_obj.id).exists())
