from decimal import Decimal
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from company.models import Company
from accounts.models import CompanyMembership
from apps.employee.models import Employee
from crm.models import Customer, Lead, Deal
from inventory.models import Category, Product, Stock, Warehouse, Vendor
from sales.models import SalesOrder, SalesOrderItem, Invoice, Payment as SalesPayment
from purchase.models import PurchaseOrder, PurchaseOrderItem, PurchaseInvoice, PurchasePayment
from finance.services import ensure_default_accounts


class ReportsModuleTests(APITestCase):
    """
    Test suite for Phase 8 Reporting & Admin Consolidation:
    - Multi-tenant company isolation on all report endpoints
    - Unauthenticated request rejection
    - Executive, Sales, Purchase, Inventory, CRM, Finance, Employee, and Monthly reports
    - Date-range filtering
    - CSV export endpoint and formatting
    """

    def setUp(self):
        # 1. Company A & User A (Authorized)
        self.user_a = User.objects.create_user(
            username="report_user_a",
            email="user_a@enterprise.com",
            password="SecurePassword123!",
        )
        self.company_a = Company.objects.create(
            name="Report Alpha Corp",
            email="contact@alphacorp.com",
        )
        self.membership_a = CompanyMembership.objects.create(
            company=self.company_a,
            user=self.user_a,
        )

        # 2. Company B & User B (Unauthorized to Company A)
        self.user_b = User.objects.create_user(
            username="report_user_b",
            email="user_b@beta.com",
            password="SecurePassword123!",
        )
        self.company_b = Company.objects.create(
            name="Report Beta Ltd",
            email="contact@betaltd.com",
        )
        self.membership_b = CompanyMembership.objects.create(
            company=self.company_b,
            user=self.user_b,
        )

        # 3. Seed Comprehensive ERP Baseline for Company A
        # Employee
        self.employee = Employee.objects.create(
            employee_id="EMP-RPT-001",
            user=self.user_a,
            company=self.company_a,
            first_name="Jane",
            last_name="Doe",
            phone="123-456-7890",
            department="Engineering",
            designation="Principal Architect",
            joining_date=date(2025, 1, 15),
            is_active=True,
        )

        # CRM
        self.customer = Customer.objects.create(
            company=self.company_a,
            name="Apex Dynamics",
            customer_type="Corporate",
            email="billing@apexdynamics.com",
        )
        self.lead = Lead.objects.create(
            company=self.company_a,
            first_name="Arthur",
            last_name="Dent",
            lead_company="Dent Logistics",
            status="Qualified",
            estimated_value=Decimal("15000.00"),
        )
        self.deal = Deal.objects.create(
            company=self.company_a,
            customer=self.customer,
            title="Apex Global ERP Deal",
            stage="Proposal",
            value=Decimal("25000.00"),
            expected_close_date=timezone.localdate() + timedelta(days=60),
        )

        # Inventory
        self.vendor = Vendor.objects.create(
            company=self.company_a,
            name="Prime Foundry Co",
            email="orders@primefoundry.com",
        )
        self.category = Category.objects.create(
            company=self.company_a,
            name="Precision Castings",
        )
        self.warehouse = Warehouse.objects.create(
            company=self.company_a,
            name="Apex Main Warehouse",
            code="WH-APEX-01",
        )
        self.product = Product.objects.create(
            company=self.company_a,
            sku="SKU-RPT-01",
            name="High Pressure Flange",
            category=self.category,
            cost_price=Decimal("100.00"),
            selling_price=Decimal("180.00"),
            reorder_level=10,
        )
        self.stock = Stock.objects.create(
            product=self.product,
            warehouse=self.warehouse,
            quantity=Decimal("3.00"),  # Low stock
            reorder_level=10,
        )

        # Sales
        self.sales_order = SalesOrder.objects.create(
            company=self.company_a,
            customer=self.customer,
            order_number="SO-RPT-001",
            order_date=timezone.localdate(),
            status=SalesOrder.SalesOrderStatus.CONFIRMED,
            subtotal=Decimal("5400.00"),
            total=Decimal("5400.00"),
        )
        self.invoice = Invoice.objects.create(
            company=self.company_a,
            customer=self.customer,
            sales_order=self.sales_order,
            invoice_number="INV-RPT-001",
            invoice_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=30),
            status=Invoice.InvoiceStatus.PARTIALLY_PAID,
            subtotal=Decimal("5400.00"),
            total=Decimal("5400.00"),
            amount_paid=Decimal("2000.00"),
            balance_due=Decimal("3400.00"),
        )
        self.sales_payment = SalesPayment.objects.create(
            company=self.company_a,
            customer=self.customer,
            invoice=self.invoice,
            payment_number="PAY-RPT-001",
            payment_date=timezone.localdate(),
            amount=Decimal("2000.00"),
            payment_method=SalesPayment.PaymentMethod.BANK_TRANSFER,
        )

        # Purchase
        self.po = PurchaseOrder.objects.create(
            company=self.company_a,
            vendor=self.vendor,
            order_number="PO-RPT-001",
            order_date=timezone.localdate(),
            status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
            subtotal=Decimal("3000.00"),
            total=Decimal("3000.00"),
        )
        self.bill = PurchaseInvoice.objects.create(
            company=self.company_a,
            vendor=self.vendor,
            purchase_order=self.po,
            invoice_number="PINV-RPT-001",
            invoice_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=30),
            status=PurchaseInvoice.InvoiceStatus.ISSUED,
            subtotal=Decimal("3000.00"),
            total=Decimal("3000.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("3000.00"),
        )

        # Finance
        ensure_default_accounts(self.company_a)

    # ============================================================
    # 1. TENANT ISOLATION TESTS
    # ============================================================

    def test_tenant_isolation_executive_forbidden(self):
        """User B cannot access Company A's executive report."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/reports/executive/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_isolation_sales_forbidden(self):
        """User B cannot access Company A's sales report."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/reports/sales/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_isolation_purchase_forbidden(self):
        """User B cannot access Company A's purchase report."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/reports/purchase/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_isolation_export_forbidden(self):
        """User B cannot export Company A's reports to CSV."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/reports/export/?report=sales"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests are rejected with 401."""
        url = f"/api/companies/{self.company_a.id}/reports/executive/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # ============================================================
    # 2. REPORT ENDPOINT TESTS
    # ============================================================

    def test_executive_report_success(self):
        """Executive summary returns consolidated KPIs across all modules."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/executive/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        kpis = resp.data["kpis"]
        self.assertEqual(kpis["sales_total"], "5400.00")
        self.assertEqual(kpis["purchase_total"], "3000.00")
        self.assertEqual(kpis["total_customers"], 1)
        self.assertEqual(kpis["total_employees"], 1)
        self.assertEqual(kpis["low_stock_count"], 1)

    def test_sales_report_success(self):
        """Sales report returns invoices summary, status breakdown, and top customers."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/sales/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        summary = resp.data["summary"]
        self.assertEqual(summary["total_invoiced"], "5400.00")
        self.assertEqual(summary["total_paid"], "2000.00")
        self.assertEqual(summary["total_balance_due"], "3400.00")
        self.assertTrue(len(resp.data["top_customers"]) >= 1)
        self.assertEqual(resp.data["top_customers"][0]["customer_name"], "Apex Dynamics")

    def test_purchase_report_success(self):
        """Purchase report returns bills summary, status breakdown, and top vendors."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/purchase/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        summary = resp.data["summary"]
        self.assertEqual(summary["total_billed"], "3000.00")
        self.assertTrue(len(resp.data["top_vendors"]) >= 1)
        self.assertEqual(resp.data["top_vendors"][0]["vendor_name"], "Prime Foundry Co")

    def test_inventory_report_success(self):
        """Inventory report returns stock quantities, valuation, and low stock lists."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/inventory/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        summary = resp.data["summary"]
        self.assertEqual(summary["total_skus"], 1)
        self.assertEqual(summary["total_quantity"], "3.00")
        self.assertEqual(summary["total_valuation"], "300.00")  # 3 * 100
        self.assertEqual(summary["low_stock_count"], 1)

    def test_crm_report_success(self):
        """CRM report returns customer counts, lead conversion funnel, and deals pipeline."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/crm/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        summary = resp.data["summary"]
        self.assertEqual(summary["total_customers"], 1)
        self.assertEqual(summary["total_leads"], 1)
        self.assertEqual(summary["total_deals"], 1)
        self.assertEqual(summary["total_deal_pipeline_value"], "25000.00")

    def test_finance_report_success(self):
        """Finance report returns P&L, liquidity, and receivables/payables."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/finance/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("pnl", resp.data)
        self.assertIn("liquidity", resp.data)
        self.assertIn("receivables", resp.data)
        self.assertIn("payables", resp.data)

    def test_employee_report_success(self):
        """Employee report returns headcount, department allocations, and roster."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/employees/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        summary = resp.data["summary"]
        self.assertEqual(summary["total_employees"], 1)
        self.assertEqual(summary["active_employees"], 1)
        self.assertEqual(len(resp.data["roster"]), 1)
        self.assertEqual(resp.data["roster"][0]["department"], "Engineering")

    def test_monthly_report_success(self):
        """Monthly business report returns historical multi-month comparison."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/monthly/?months=3"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["num_months"], 3)
        self.assertEqual(len(resp.data["monthly_history"]), 3)

    # ============================================================
    # 3. DATE-RANGE FILTERING TESTS
    # ============================================================

    def test_date_range_filtering(self):
        """Date-range filtering correctly scopes reports."""
        self.client.force_authenticate(user=self.user_a)
        # Query past date range where no invoices exist
        past_from = (timezone.localdate() - timedelta(days=60)).strftime("%Y-%m-%d")
        past_to = (timezone.localdate() - timedelta(days=30)).strftime("%Y-%m-%d")
        url = f"/api/companies/{self.company_a.id}/reports/sales/?date_from={past_from}&date_to={past_to}"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["summary"]["total_invoiced"], "0.00")

    # ============================================================
    # 4. CSV EXPORT TESTS
    # ============================================================

    def test_csv_export_sales(self):
        """CSV export returns downloadable text/csv content."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/export/?report=sales"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.headers["Content-Type"], "text/csv")
        self.assertIn("attachment; filename=", resp.headers["Content-Disposition"])
        content = resp.content.decode("utf-8")
        self.assertIn("SALES SUMMARY REPORT", content)
        self.assertIn("INV-RPT-001", content)
        self.assertIn("Apex Dynamics", content)

    def test_csv_export_executive(self):
        """CSV export returns downloadable executive report."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/reports/export/?report=executive"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.headers["Content-Type"], "text/csv")
        content = resp.content.decode("utf-8")
        self.assertIn("EXECUTIVE CONSOLIDATED REPORT", content)
        self.assertIn("Total Sales", content)
