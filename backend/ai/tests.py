from decimal import Decimal
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from company.models import Company
from accounts.models import CompanyMembership
from crm.models import Customer
from inventory.models import Category, Product, Stock, Warehouse, Vendor
from sales.models import SalesOrder, SalesOrderItem, Invoice, Payment as SalesPayment
from purchase.models import PurchaseOrder, PurchaseOrderItem, PurchaseInvoice, PurchasePayment
from finance.services import ensure_default_accounts, post_journal_entry
from ai.services import (
    process_ai_query,
    get_sales_metrics,
    get_outstanding_invoices_data,
    get_collections_data,
    get_purchase_metrics,
    get_inventory_metrics,
    get_customers_owe_data,
    get_top_vendors_by_spend,
    get_finance_metrics,
    search_customer_intelligence,
    search_vendor_intelligence,
    ERPIntent,
)


class AIAssistantTests(APITestCase):
    """
    Test suite for Phase 7 AI ERP Assistant:
    - Multi-tenant company isolation
    - Strict read-only invariants
    - Natural language query intents (all 10 required questions)
    - Customer & Vendor intelligence lookup
    - Insights digest API endpoints
    - Input validation & error handling
    """

    def setUp(self):
        # 1. Company A & User A (Authorized)
        self.user_a = User.objects.create_user(
            username="ai_user_a",
            email="user_a@enterprise.com",
            password="SecurePassword123!",
        )
        self.company_a = Company.objects.create(
            name="Alpha Corp",
            email="contact@alphacorp.com",
        )
        self.membership_a = CompanyMembership.objects.create(
            company=self.company_a,
            user=self.user_a,
        )

        # 2. Company B & User B (Unauthorized to Company A)
        self.user_b = User.objects.create_user(
            username="ai_user_b",
            email="user_b@beta.com",
            password="SecurePassword123!",
        )
        self.company_b = Company.objects.create(
            name="Beta Ltd",
            email="contact@betaltd.com",
        )
        self.membership_b = CompanyMembership.objects.create(
            company=self.company_b,
            user=self.user_b,
        )

        # 3. Seed Seed ERP Data for Company A
        self.customer = Customer.objects.create(
            company=self.company_a,
            name="Acme Mega Corp",
            email="purchasing@acme.com",
            phone="111-222-3333",
        )
        self.vendor = Vendor.objects.create(
            company=self.company_a,
            name="Titan Raw Materials",
            email="orders@titan.com",
            phone="444-555-6666",
            tax_id="TAX-TITAN-001",
        )
        self.category = Category.objects.create(
            company=self.company_a,
            name="Industrial Parts",
        )
        self.warehouse = Warehouse.objects.create(
            company=self.company_a,
            name="Central Storage",
            code="WH-01",
        )
        self.product_low = Product.objects.create(
            company=self.company_a,
            sku="PART-001",
            name="Hydraulic Valve",
            category=self.category,
            cost_price=Decimal("150.00"),
            selling_price=Decimal("250.00"),
            reorder_level=20,
        )
        self.stock_low = Stock.objects.create(
            product=self.product_low,
            warehouse=self.warehouse,
            quantity=Decimal("5.00"),
            reorder_level=20,
        )

        self.product_healthy = Product.objects.create(
            company=self.company_a,
            sku="PART-002",
            name="Steel Bearing",
            category=self.category,
            cost_price=Decimal("20.00"),
            selling_price=Decimal("45.00"),
            reorder_level=10,
        )
        self.stock_healthy = Stock.objects.create(
            product=self.product_healthy,
            warehouse=self.warehouse,
            quantity=Decimal("100.00"),
            reorder_level=10,
        )

        # Sales Order
        self.sales_order = SalesOrder.objects.create(
            company=self.company_a,
            customer=self.customer,
            order_number="SO-2026-000001",
            order_date=timezone.localdate(),
            status=SalesOrder.SalesOrderStatus.CONFIRMED,
            subtotal=Decimal("2500.00"),
            total=Decimal("2500.00"),
        )
        SalesOrderItem.objects.create(
            sales_order=self.sales_order,
            product=self.product_low,
            quantity=Decimal("10.00"),
            unit_price=Decimal("250.00"),
            line_total=Decimal("2500.00"),
        )

        # Sales Invoice & Payment
        self.invoice = Invoice.objects.create(
            company=self.company_a,
            customer=self.customer,
            sales_order=self.sales_order,
            invoice_number="INV-2026-000001",
            invoice_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=15),
            status=Invoice.InvoiceStatus.PARTIALLY_PAID,
            subtotal=Decimal("2500.00"),
            total=Decimal("2500.00"),
            amount_paid=Decimal("1000.00"),
            balance_due=Decimal("1500.00"),
        )
        self.sales_payment = SalesPayment.objects.create(
            company=self.company_a,
            customer=self.customer,
            invoice=self.invoice,
            payment_number="PAY-2026-000001",
            payment_date=timezone.localdate(),
            amount=Decimal("1000.00"),
            payment_method=SalesPayment.PaymentMethod.BANK_TRANSFER,
        )

        # Purchase Order & Bill
        self.po = PurchaseOrder.objects.create(
            company=self.company_a,
            vendor=self.vendor,
            order_number="PO-2026-000001",
            order_date=timezone.localdate(),
            status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
            subtotal=Decimal("3000.00"),
            total=Decimal("3000.00"),
        )
        self.bill = PurchaseInvoice.objects.create(
            company=self.company_a,
            vendor=self.vendor,
            purchase_order=self.po,
            invoice_number="PINV-2026-000001",
            invoice_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=30),
            status=PurchaseInvoice.InvoiceStatus.ISSUED,
            subtotal=Decimal("3000.00"),
            total=Decimal("3000.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("3000.00"),
        )

        # Default accounts for Company A
        ensure_default_accounts(self.company_a)

    # ============================================================
    # 1. TENANT ISOLATION TESTS
    # ============================================================

    def test_tenant_isolation_chat_forbidden(self):
        """User B cannot access Company A's AI assistant."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "What are this month's sales?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_isolation_insights_forbidden(self):
        """User B cannot access Company A's AI insights."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/ai/insights/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_isolation_customer_lookup_forbidden(self):
        """User B cannot perform customer lookup on Company A."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/ai/customer-lookup/?q=Acme"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_isolation_vendor_lookup_forbidden(self):
        """User B cannot perform vendor lookup on Company A."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/ai/vendor-lookup/?q=Titan"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests are rejected with 401."""
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Hello"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # ============================================================
    # 2. READ-ONLY INVARIANT TESTS
    # ============================================================

    def test_ai_queries_are_strictly_read_only(self):
        """
        AI queries must never create, modify, or delete any records.
        """
        self.client.force_authenticate(user=self.user_a)
        inv_count_before = Invoice.objects.count()
        pay_count_before = SalesPayment.objects.count()
        stock_qty_before = Stock.objects.get(id=self.stock_low.id).quantity
        order_count_before = SalesOrder.objects.count()

        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        self.client.post(url, {"query": "What are this month's sales?"}, format="json")
        self.client.post(url, {"query": "Which products have low stock?"}, format="json")
        self.client.post(url, {"query": "Which customers owe money?"}, format="json")

        self.assertEqual(Invoice.objects.count(), inv_count_before)
        self.assertEqual(SalesPayment.objects.count(), pay_count_before)
        self.assertEqual(Stock.objects.get(id=self.stock_low.id).quantity, stock_qty_before)
        self.assertEqual(SalesOrder.objects.count(), order_count_before)

    # ============================================================
    # 3. NATURAL-LANGUAGE INTENT & QUESTION TESTS (10 REQUIRED QUESTIONS)
    # ============================================================

    def test_q1_month_sales(self):
        """Q1: What are this month's sales?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "What are this month's sales?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.MONTHLY_SALES)
        self.assertIn("2,500.00", resp.data["answer"])

    def test_q2_outstanding_invoices(self):
        """Q2: Which invoices are outstanding?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Which invoices are outstanding?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.OUTSTANDING_INVOICES)
        self.assertIn("INV-2026-000001", resp.data["answer"])
        self.assertIn("1,500.00", resp.data["answer"])

    def test_q3_how_much_collected(self):
        """Q3: How much did we collect?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "How much did we collect?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.COLLECTIONS)
        self.assertIn("1,000.00", resp.data["answer"])

    def test_q4_total_purchases(self):
        """Q4: What are our total purchases?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "What are our total purchases?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.TOTAL_PURCHASES)
        self.assertIn("3,000.00", resp.data["answer"])

    def test_q5_low_stock(self):
        """Q5: Which products have low stock?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Which products have low stock?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.LOW_STOCK)
        self.assertIn("PART-001", resp.data["answer"])
        self.assertIn("Hydraulic Valve", resp.data["answer"])

    def test_q6_customers_owe_money(self):
        """Q6: Which customers owe money?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Which customers owe money?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.CUSTOMERS_OWE)
        self.assertIn("Acme Mega Corp", resp.data["answer"])
        self.assertIn("1,500.00", resp.data["answer"])

    def test_q7_vendors_highest_purchase_value(self):
        """Q7: Which vendors have the highest purchase value?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Which vendors have the highest purchase value?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.TOP_VENDORS)
        self.assertIn("Titan Raw Materials", resp.data["answer"])

    def test_q8_current_profit(self):
        """Q8: What is the current profit?"""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "What is the current profit?"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.CURRENT_PROFIT)
        self.assertIn("Current Net Profit", resp.data["answer"])

    def test_q9_recent_sales_orders(self):
        """Q9: Show recent sales orders."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Show recent sales orders."}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.RECENT_SALES_ORDERS)
        self.assertIn("SO-2026-000001", resp.data["answer"])

    def test_q10_recent_purchase_orders(self):
        """Q10: Show recent purchase orders."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Show recent purchase orders."}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.RECENT_PURCHASE_ORDERS)
        self.assertIn("PO-2026-000001", resp.data["answer"])

    # ============================================================
    # 4. CUSTOMER & VENDOR INTELLIGENCE LOOKUP
    # ============================================================

    def test_customer_lookup_via_chat(self):
        """Customer lookup via natural language chat query."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Lookup customer Acme Mega Corp"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.CUSTOMER_LOOKUP)
        self.assertIn("Acme Mega Corp", resp.data["answer"])
        self.assertIn("1,500.00", resp.data["answer"])

    def test_customer_lookup_direct_api(self):
        """Direct customer lookup API endpoint."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/customer-lookup/?q=Acme"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data["results"]
        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0]["name"], "Acme Mega Corp")
        self.assertEqual(results[0]["balance_due"], "1500.00")

    def test_vendor_lookup_via_chat(self):
        """Vendor lookup via natural language chat query."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": "Lookup vendor Titan Raw Materials"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["intent"], ERPIntent.VENDOR_LOOKUP)
        self.assertIn("Titan Raw Materials", resp.data["answer"])
        self.assertIn("TAX-TITAN-001", resp.data["answer"])

    def test_vendor_lookup_direct_api(self):
        """Direct vendor lookup API endpoint."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/vendor-lookup/?q=Titan"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data["results"]
        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0]["name"], "Titan Raw Materials")
        self.assertEqual(results[0]["balance_due"], "3000.00")

    # ============================================================
    # 5. EXECUTIVE INSIGHTS API
    # ============================================================

    def test_insights_api_all_modules(self):
        """Executive insights API returns full operational digest."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/insights/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("sales", resp.data)
        self.assertIn("purchases", resp.data)
        self.assertIn("inventory", resp.data)
        self.assertIn("finance", resp.data)
        self.assertEqual(resp.data["inventory"]["low_stock_count"], 1)

    def test_insights_api_module_filter(self):
        """Executive insights API supports single module filtering."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/insights/?module=sales"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("sales", resp.data)
        self.assertNotIn("purchases", resp.data)

    # ============================================================
    # 6. ERROR HANDLING & VALIDATION
    # ============================================================

    def test_empty_query_validation(self):
        """Empty query returns HTTP 400 Bad Request."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/chat/"
        resp = self.client.post(url, {"query": ""}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_customer_lookup(self):
        """Searching for non-existent customer returns empty results gracefully."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/ai/customer-lookup/?q=NonExistentEnterprise999"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["results"], [])
