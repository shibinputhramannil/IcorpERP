from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from crm.models import Customer, Contact, Lead, Deal, Activity


class CRMAPITests(APITestCase):
    def setUp(self):
        self.admin_role, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_role, _ = Group.objects.get_or_create(name="Employee")

        self.password = "SecurePass123!"
        self.user_a = User.objects.create_user(
            username="admin_a",
            email="admin@alpha.com",
            password=self.password,
        )
        self.user_b = User.objects.create_user(
            username="admin_b",
            email="admin@beta.com",
            password=self.password,
        )

        # Companies
        self.company_a = Company.objects.create(name="Alpha Corp", email="contact@alpha.com", is_active=True)
        self.company_b = Company.objects.create(name="Beta Corp", email="contact@beta.com", is_active=True)

        # Memberships
        CompanyMembership.objects.create(user=self.user_a, company=self.company_a, role=self.admin_role)
        CompanyMembership.objects.create(user=self.user_b, company=self.company_b, role=self.admin_role)

    # ========================================================
    # LEADS TESTS
    # ========================================================

    def test_lead_crud_and_tenant_isolation(self):
        self.client.force_authenticate(user=self.user_a)

        # 1. Create Lead in Company A
        url = reverse("lead_list_create", kwargs={"company_id": self.company_a.id})
        payload = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@prospect.com",
            "phone": "+1-555-1001",
            "lead_company": "Prospect Enterprises",
            "source": "Website",
            "status": "New",
            "estimated_value": "15000.00",
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        lead_id = res.data["id"]
        self.assertEqual(res.data["lead_company"], "Prospect Enterprises")

        # 2. Company B user CANNOT view Company A leads (Tenant Isolation)
        self.client.force_authenticate(user=self.user_b)
        res_b = self.client.get(url)
        self.assertEqual(res_b.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Update Lead Status
        self.client.force_authenticate(user=self.user_a)
        detail_url = reverse("lead_detail", kwargs={"company_id": self.company_a.id, "lead_id": lead_id})
        res_patch = self.client.patch(detail_url, {"status": "Qualified"})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["status"], "Qualified")

        # 4. Soft-delete Lead
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        lead = Lead.objects.get(id=lead_id)
        self.assertFalse(lead.is_active)

    def test_lead_conversion_workflow(self):
        self.client.force_authenticate(user=self.user_a)

        # Create Lead
        lead = Lead.objects.create(
            company=self.company_a,
            owner=self.user_a,
            first_name="Samantha",
            last_name="Ray",
            email="samantha@zenith.com",
            phone="+1-555-2002",
            lead_company="Zenith Dynamics",
            status="Qualified",
            estimated_value=50000.00,
        )

        convert_url = reverse("lead_convert", kwargs={"company_id": self.company_a.id, "lead_id": lead.id})
        payload = {
            "create_customer": True,
            "customer_name": "Zenith Dynamics LLC",
            "create_deal": True,
            "deal_title": "Enterprise Cloud Migration",
            "deal_value": 50000.00,
        }
        res = self.client.post(convert_url, payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify Customer was created
        self.assertTrue(Customer.objects.filter(company=self.company_a, name="Zenith Dynamics LLC").exists())
        customer = Customer.objects.get(company=self.company_a, name="Zenith Dynamics LLC")

        # Verify Contact was created and linked
        self.assertTrue(Contact.objects.filter(company=self.company_a, customer=customer, first_name="Samantha").exists())

        # Verify Deal was created and linked
        self.assertTrue(Deal.objects.filter(company=self.company_a, customer=customer, title="Enterprise Cloud Migration").exists())

        # Verify Lead is marked as Converted
        lead.refresh_from_db()
        self.assertEqual(lead.status, "Converted")
        self.assertIsNotNone(lead.converted_customer)
        self.assertIsNotNone(lead.converted_contact)
        self.assertIsNotNone(lead.converted_at)

        # Verify attempting to convert again returns 400
        res_again = self.client.post(convert_url, payload)
        self.assertEqual(res_again.status_code, status.HTTP_400_BAD_REQUEST)

    # ========================================================
    # CUSTOMERS TESTS
    # ========================================================

    def test_customer_crud(self):
        self.client.force_authenticate(user=self.user_a)

        url = reverse("customer_list_create", kwargs={"company_id": self.company_a.id})
        payload = {
            "name": "Global Horizon Corp",
            "customer_type": "Corporate",
            "email": "info@globalhorizon.com",
            "phone": "+1-800-555-1234",
            "industry": "Aerospace",
            "city": "Seattle",
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        cust_id = res.data["id"]

        # List
        res_list = self.client.get(url)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data), 1)

        # Patch
        detail_url = reverse("customer_detail", kwargs={"company_id": self.company_a.id, "customer_id": cust_id})
        res_patch = self.client.patch(detail_url, {"industry": "Defense & Aerospace"})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["industry"], "Defense & Aerospace")

        # Delete
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        cust = Customer.objects.get(id=cust_id)
        self.assertFalse(cust.is_active)

    # ========================================================
    # CONTACTS TESTS
    # ========================================================

    def test_contact_crud_with_customer(self):
        self.client.force_authenticate(user=self.user_a)

        customer = Customer.objects.create(company=self.company_a, name="Innovatech")

        url = reverse("contact_list_create", kwargs={"company_id": self.company_a.id})
        payload = {
            "customer": customer.id,
            "first_name": "Daniel",
            "last_name": "Craig",
            "email": "daniel@innovatech.com",
            "phone": "+1-555-3003",
            "designation": "CTO",
            "department": "Engineering",
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        contact_id = res.data["id"]
        self.assertEqual(res.data["customer_name"], "Innovatech")

        # Detail
        detail_url = reverse("contact_detail", kwargs={"company_id": self.company_a.id, "contact_id": contact_id})
        res_get = self.client.get(detail_url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data["first_name"], "Daniel")

    # ========================================================
    # DEALS TESTS
    # ========================================================

    def test_deal_crud_and_pipeline_metrics(self):
        self.client.force_authenticate(user=self.user_a)

        customer = Customer.objects.create(company=self.company_a, name="Hyperion Industries")

        url = reverse("deal_list_create", kwargs={"company_id": self.company_a.id})
        payload = {
            "customer": customer.id,
            "title": "Hyperion ERP Rollout",
            "value": "75000.00",
            "stage": "Proposal",
            "probability": 60,
            "expected_close_date": "2025-06-30",
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        deal_id = res.data["id"]

        # List and metrics
        res_list = self.client.get(url)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(res_list.data["metrics"]["total_deals"], 1)
        self.assertEqual(res_list.data["metrics"]["total_pipeline_value"], 75000.00)

        # Progress stage to Won
        detail_url = reverse("deal_detail", kwargs={"company_id": self.company_a.id, "deal_id": deal_id})
        res_patch = self.client.patch(detail_url, {"stage": "Won", "probability": 100})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["stage"], "Won")

        # Re-check metrics
        res_list_won = self.client.get(url)
        self.assertEqual(res_list_won.data["metrics"]["won_value"], 75000.00)

    # ========================================================
    # ACTIVITIES & NOTES TESTS
    # ========================================================

    def test_activity_crud_and_email_logging(self):
        self.client.force_authenticate(user=self.user_a)

        customer = Customer.objects.create(company=self.company_a, name="Apex Systems", email="apex@systems.com")

        # 1. Log a Meeting
        url = reverse("activity_list_create", kwargs={"company_id": self.company_a.id})
        payload = {
            "activity_type": "Meeting",
            "title": "Quarterly Business Review",
            "description": "Discussed roadmap and expansion.",
            "customer": customer.id,
            "status": "Completed",
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        activity_id = res.data["id"]

        # 2. Log an Email (tests local fallback of GmailService)
        email_payload = {
            "activity_type": "Email",
            "title": "Contract Proposal Follow-up",
            "description": "Attached the updated SOW.",
            "customer": customer.id,
            "status": "Completed",
        }
        res_email = self.client.post(url, email_payload)
        self.assertEqual(res_email.status_code, status.HTTP_201_CREATED)
        self.assertIn("Local Log", res_email.data["description"])

        # 3. List activities
        res_list = self.client.get(url)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data), 2)

        # 4. Delete activity
        detail_url = reverse("activity_detail", kwargs={"company_id": self.company_a.id, "activity_id": activity_id})
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(Activity.objects.filter(id=activity_id).exists())

    # ========================================================
    # GMAIL STATUS TEST
    # ========================================================

    def test_gmail_status_endpoint(self):
        self.client.force_authenticate(user=self.user_a)
        url = reverse("gmail_status", kwargs={"company_id": self.company_a.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("provider", res.data)
        self.assertIn("is_configured", res.data)
