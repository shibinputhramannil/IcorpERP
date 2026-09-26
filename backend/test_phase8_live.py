"""
Phase 8 Live Verification Script: Centralized Reporting & Admin Consolidation
Tests all 8 consolidated report dimensions, date-range filtering,
CSV exports, and multi-tenant isolation.
"""

import os
import sys
from decimal import Decimal
from datetime import date, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def run_tests():
    print("=" * 80)
    print("ICORP ERP PHASE 8: REPORTING & ADMIN CONSOLIDATION LIVE VERIFICATION")
    print("=" * 80)
    return run_django_client_tests()


def run_django_client_tests():
    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

    from django.contrib.auth.models import User
    from django.utils import timezone
    from rest_framework.test import APIClient
    from company.models import Company
    from accounts.models import CompanyMembership
    from apps.employee.models import Employee
    from crm.models import Customer, Lead, Deal
    from inventory.models import Vendor, Product, Category, Warehouse, Stock
    from sales.models import SalesOrder, SalesOrderItem, Invoice, Payment as SalesPayment
    from purchase.models import PurchaseOrder, PurchaseOrderItem, PurchaseInvoice, PurchasePayment
    from finance.services import ensure_default_accounts

    client = APIClient()

    # 1. Setup Multi-Tenancy & Test Companies
    print("\n[1] Verifying Multi-Tenant Authentication Setup...")
    user_a, _ = User.objects.get_or_create(username="rpt_tester_a", defaults={"email": "tester_a@enterprise.com"})
    user_a.set_password("ReportPass123!")
    user_a.save()

    company_a, _ = Company.objects.get_or_create(
        name="Phase8 Report Enterprise",
        defaults={"email": "enterprise@phase8.com", "phone": "111-222-3333"},
    )
    membership_a, _ = CompanyMembership.objects.get_or_create(company=company_a, user=user_a)

    user_b, _ = User.objects.get_or_create(username="rpt_tester_b", defaults={"email": "tester_b@competitor.com"})
    user_b.set_password("ReportPass123!")
    user_b.save()

    company_b, _ = Company.objects.get_or_create(
        name="Phase8 Competitor Ltd",
        defaults={"email": "competitor@phase8.com", "phone": "999-888-7777"},
    )
    membership_b, _ = CompanyMembership.objects.get_or_create(company=company_b, user=user_b)

    # Clean up test artifacts from previous runs for full idempotency
    SalesPayment.objects.filter(company=company_a, payment_number="PAY-RPT-8001").delete()
    Invoice.objects.filter(company=company_a, invoice_number="INV-RPT-8001").delete()
    SalesOrder.objects.filter(company=company_a, order_number="SO-RPT-8001").delete()
    PurchasePayment.objects.filter(company=company_a, payment_number="PPAY-RPT-8001").delete()
    PurchaseInvoice.objects.filter(company=company_a, invoice_number="PINV-RPT-8001").delete()
    PurchaseOrder.objects.filter(company=company_a, order_number="PO-RPT-8001").delete()
    Product.objects.filter(company=company_a, sku="SKU-RPT-8001").delete()
    Employee.objects.filter(company=company_a, employee_id="EMP-RPT-8001").delete()

    client.force_authenticate(user=user_a)
    print(" -> Authenticated as User A (rpt_tester_a) for Company A (Phase8 Report Enterprise)")

    # 2. Seed Baseline ERP Data Across All Modules
    print("\n[2] Seeding Multi-Module Baseline Data...")
    emp = Employee.objects.create(
        employee_id="EMP-RPT-8001",
        user=user_a,
        company=company_a,
        first_name="Alexander",
        last_name="Hamilton",
        phone="555-1789",
        department="Finance & Treasury",
        designation="Chief Financial Officer",
        joining_date=date(2026, 1, 1),
        is_active=True,
    )

    cust, _ = Customer.objects.get_or_create(
        company=company_a,
        name="Apex Horizon Group",
        defaults={"customer_type": "Corporate", "email": "contact@apexhorizon.com"},
    )
    lead, _ = Lead.objects.create(
        company=company_a,
        first_name="Eleanor",
        last_name="Vance",
        lead_company="Vance Dynamics",
        status="Contacted",
        estimated_value=Decimal("18000.00"),
    ), None
    deal, _ = Deal.objects.create(
        company=company_a,
        customer=cust,
        title="Apex Strategic Cloud Deployment",
        stage="Proposal",
        value=Decimal("35000.00"),
    ), None

    vend, _ = Vendor.objects.get_or_create(
        company=company_a,
        name="Allied Silicon Supplies",
        defaults={"email": "sales@alliedsilicon.com"},
    )
    cat, _ = Category.objects.get_or_create(company=company_a, name="Semiconductor Substrates")
    wh, _ = Warehouse.objects.get_or_create(company=company_a, code="WH-RPT-8001", defaults={"name": "Regional Distribution Hub"})

    prod = Product.objects.create(
        company=company_a,
        sku="SKU-RPT-8001",
        name="Silicon Wafer 300mm",
        category=cat,
        cost_price=Decimal("250.00"),
        selling_price=Decimal("450.00"),
        reorder_level=20,
    )
    stock = Stock.objects.create(
        product=prod,
        warehouse=wh,
        quantity=Decimal("6.00"),  # Low stock (6 <= 20)
        reorder_level=20,
    )

    so = SalesOrder.objects.create(
        company=company_a,
        customer=cust,
        order_number="SO-RPT-8001",
        order_date=timezone.localdate(),
        status=SalesOrder.SalesOrderStatus.CONFIRMED,
        subtotal=Decimal("9000.00"),
        total=Decimal("9000.00"),
    )
    inv = Invoice.objects.create(
        company=company_a,
        customer=cust,
        sales_order=so,
        invoice_number="INV-RPT-8001",
        invoice_date=timezone.localdate(),
        due_date=timezone.localdate() + timedelta(days=30),
        status=Invoice.InvoiceStatus.PARTIALLY_PAID,
        subtotal=Decimal("9000.00"),
        total=Decimal("9000.00"),
        amount_paid=Decimal("4000.00"),
        balance_due=Decimal("5000.00"),
    )
    pay = SalesPayment.objects.create(
        company=company_a,
        customer=cust,
        invoice=inv,
        payment_number="PAY-RPT-8001",
        payment_date=timezone.localdate(),
        amount=Decimal("4000.00"),
        payment_method=SalesPayment.PaymentMethod.BANK_TRANSFER,
    )

    po = PurchaseOrder.objects.create(
        company=company_a,
        vendor=vend,
        order_number="PO-RPT-8001",
        order_date=timezone.localdate(),
        status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
        subtotal=Decimal("5000.00"),
        total=Decimal("5000.00"),
    )
    bill = PurchaseInvoice.objects.create(
        company=company_a,
        vendor=vend,
        purchase_order=po,
        invoice_number="PINV-RPT-8001",
        invoice_date=timezone.localdate(),
        due_date=timezone.localdate() + timedelta(days=30),
        status=PurchaseInvoice.InvoiceStatus.ISSUED,
        subtotal=Decimal("5000.00"),
        total=Decimal("5000.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("5000.00"),
    )

    ensure_default_accounts(company_a)
    print(" -> Operational baseline established across all 8 modules.")

    # 3. Test All 8 Consolidated Report Endpoints
    reports_to_test = [
        ("executive", "/api/companies/{id}/reports/executive/", lambda d: "sales_total" in d.get("kpis", {})),
        ("sales", "/api/companies/{id}/reports/sales/", lambda d: d.get("summary", {}).get("total_invoiced") == "9000.00"),
        ("purchase", "/api/companies/{id}/reports/purchase/", lambda d: d.get("summary", {}).get("total_billed") == "5000.00"),
        ("inventory", "/api/companies/{id}/reports/inventory/", lambda d: d.get("summary", {}).get("low_stock_count") >= 1),
        ("crm", "/api/companies/{id}/reports/crm/", lambda d: d.get("summary", {}).get("total_customers") >= 1),
        ("finance", "/api/companies/{id}/reports/finance/", lambda d: "pnl" in d and "liquidity" in d),
        ("employees", "/api/companies/{id}/reports/employees/", lambda d: d.get("summary", {}).get("total_employees") >= 1),
        ("monthly", "/api/companies/{id}/reports/monthly/?months=6", lambda d: len(d.get("monthly_history", [])) == 6),
    ]

    print("\n[3] Testing All 8 Consolidated Reporting APIs:")
    for name, path_template, validator in reports_to_test:
        url = path_template.format(id=company_a.id)
        resp = client.get(url)
        assert resp.status_code == 200, f"Report '{name}' failed with status {resp.status_code}: {resp.data}"
        assert validator(resp.data), f"Data validation failed for report '{name}': {resp.data}"
        print(f" -> Report PASS: {name.upper()} endpoint (/reports/{name}/)")

    # 4. Test Date-Range Filtering
    print("\n[4] Testing Date-Range Filtering...")
    today_str = timezone.localdate().strftime("%Y-%m-%d")
    url = f"/api/companies/{company_a.id}/reports/sales/?date_from={today_str}&date_to={today_str}"
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.data["summary"]["total_invoiced"] == "9000.00"

    past_date = (timezone.localdate() - timedelta(days=90)).strftime("%Y-%m-%d")
    url_past = f"/api/companies/{company_a.id}/reports/sales/?date_from={past_date}&date_to={past_date}"
    resp_past = client.get(url_past)
    assert resp_past.status_code == 200
    assert resp_past.data["summary"]["total_invoiced"] == "0.00"
    print(" -> Date-range filtering verified (active date matches $9,000.00; past date correctly returns $0.00).")

    # 5. Test CSV Exports
    print("\n[5] Testing CSV Export Capabilities...")
    csv_reports = ["executive", "sales", "purchase", "inventory", "employees", "monthly"]
    for rpt in csv_reports:
        url = f"/api/companies/{company_a.id}/reports/export/?report={rpt}"
        resp = client.get(url)
        assert resp.status_code == 200, f"CSV export for '{rpt}' failed: {resp.status_code}"
        assert resp.headers["Content-Type"] == "text/csv", f"Unexpected content-type for '{rpt}'"
        assert "attachment; filename=" in resp.headers["Content-Disposition"]
        body = resp.content.decode("utf-8")
        assert len(body) > 50, f"CSV body empty for '{rpt}'"
        print(f" -> CSV Export PASS: {rpt.upper()} (Bytes: {len(body)})")

    # 6. Test Multi-Tenant Company Isolation
    print("\n[6] Verifying Multi-Tenant Isolation (User B cannot access Company A)...")
    client.force_authenticate(user=user_b)
    for name, path_template, _ in reports_to_test:
        url = path_template.format(id=company_a.id)
        resp = client.get(url)
        assert resp.status_code == 403, f"Cross-tenant exploit! Expected 403 for '{name}', got {resp.status_code}"

    # Also test CSV export cross-tenant
    resp_csv = client.get(f"/api/companies/{company_a.id}/reports/export/?report=sales")
    assert resp_csv.status_code == 403, f"Cross-tenant CSV exploit! Expected 403, got {resp_csv.status_code}"
    print(" -> Strict Multi-Tenant Isolation 100% verified across all reporting endpoints.")

    print("\n" + "=" * 80)
    print(">>> ALL PHASE 8 REPORTING & ADMIN CONSOLIDATION CHECKS PASSED WITH 100% SUCCESS <<<")
    print("=" * 80)
    return True


if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)
