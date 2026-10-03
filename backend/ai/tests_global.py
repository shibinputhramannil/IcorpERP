from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from company.models import Company
from accounts.models import CompanyMembership
from inventory.models import Product
from crm.models import Customer


class GlobalAITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="globalaiuser",
            email="global@transt.local",
            password="testpassword123",
        )
        self.company1 = Company.objects.create(
            name="Alpha Holdings",
            email="alpha@holdings.com",
            is_active=True,
        )
        self.company2 = Company.objects.create(
            name="Beta Logistics",
            email="beta@logistics.com",
            is_active=True,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company1, is_active=True)
        CompanyMembership.objects.create(user=self.user, company=self.company2, is_active=True)

        # Create products and customers
        Product.objects.create(
            company=self.company1,
            name="Alpha Industrial Widget",
            sku="ALPH-001",
            cost_price=50.0,
            selling_price=100.0,
        )
        Customer.objects.create(
            company=self.company2,
            name="Global Partner Corp",
            email="partner@global.com",
            customer_type="Corporate",
        )

        self.client.force_authenticate(user=self.user)

    def test_global_ai_dashboard(self):
        url = "/api/ai/dashboard/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_global"])
        self.assertEqual(res.data["company_count"], 2)
        self.assertIn("Alpha Holdings", str(res.data["company_breakdown"]))
        self.assertIn("Beta Logistics", str(res.data["company_breakdown"]))

    def test_global_ai_ask(self):
        url = "/api/ai/ask/"
        req_data = {
            "question": "What is our group sales and financial position?",
        }
        res = self.client.post(url, req_data, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("answer", res.data)
        self.assertTrue(len(res.data["answer"]) > 10)

    def test_global_ai_chat(self):
        url = "/api/ai/chat/"
        req_data = {
            "query": "Show inventory alerts across all companies",
        }
        res = self.client.post(url, req_data, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("answer", res.data)

    def test_global_search(self):
        url = "/api/search/?q=Alpha"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data["total_results"], 1)

        # Search for customer in company2
        cust_res = self.client.get("/api/search/?q=Partner")
        self.assertEqual(cust_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(cust_res.data["total_results"], 1)
        self.assertIn("customers", cust_res.data["results"])
