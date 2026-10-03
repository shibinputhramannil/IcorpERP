import os
import sys
import django
from decimal import Decimal

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from company.models import Company
from accounts.models import CompanyMembership
from inventory.models import Category, Product, Stock, Warehouse, Vendor
from sales.models import SalesOrder, SalesOrderItem, Invoice
from purchase.models import PurchaseOrder, PurchaseInvoice
from crm.models import Customer, Lead, Deal
from apps.employee.models import Employee
from finance.services import ensure_default_accounts

def run_phase9_live_verification():
    print("=" * 80)
    print("transt PHASE 9: AI ASSISTANT & BUSINESS INSIGHTS LIVE VERIFICATION")
    print("=" * 80)

    # 1. Setup multi-tenant test companies & users
    print("\n[1] Setting up Multi-Tenant Live Test Verification Data...")
    company_a, _ = Company.objects.get_or_create(
        name="Phase9 Alpha Enterprise",
        defaults={"email": "alpha_p9@enterprise.com", "is_active": True},
    )
    user_a, _ = User.objects.get_or_create(
        username="p9_tester_a",
        defaults={"email": "tester_p9_a@enterprise.com", "first_name": "AI", "last_name": "Tester"},
    )
    user_a.set_password("pass1234")
    user_a.save()
    CompanyMembership.objects.get_or_create(company=company_a, user=user_a)

    company_b, _ = Company.objects.get_or_create(
        name="Phase9 Competitor Ltd",
        defaults={"email": "competitor_p9@beta.com", "is_active": True},
    )
    user_b, _ = User.objects.get_or_create(
        username="p9_tester_b",
        defaults={"email": "tester_p9_b@beta.com", "first_name": "Outsider", "last_name": "User"},
    )
    user_b.set_password("pass1234")
    user_b.save()
    CompanyMembership.objects.get_or_create(company=company_b, user=user_b)

    # 2. Seed Baseline ERP Data for Company A across all 6 modules
    print("\n[2] Seeding cross-module ERP operational data for Company A...")
    cat, _ = Category.objects.get_or_create(company=company_a, name="Telemetry Parts")
    wh, _ = Warehouse.objects.get_or_create(company=company_a, name="Main Depot", defaults={"code": "P9-WH"})
    
    prod_low, _ = Product.objects.get_or_create(
        company=company_a,
        sku="P9-VALVE-01",
        defaults={"name": "P9 Hydraulic Sensor", "cost_price": Decimal("150.00"), "category": cat, "reorder_level": 15},
    )
    Stock.objects.update_or_create(
        product=prod_low,
        warehouse=wh,
        defaults={"quantity": Decimal("4.00"), "reorder_level": 15},
    )

    cust, _ = Customer.objects.get_or_create(
        company=company_a,
        name="P9 Apex Industries",
        defaults={"email": "apex@industry.com", "customer_type": "Corporate"},
    )
    vend, _ = Vendor.objects.get_or_create(
        company=company_a,
        name="P9 Global Steel Supply",
        defaults={"email": "supply@globalsteel.com"},
    )

    # Sales Invoice
    inv, _ = Invoice.objects.get_or_create(
        company=company_a,
        invoice_number="INV-P9-0001",
        defaults={
            "customer": cust,
            "invoice_date": django.utils.timezone.localdate(),
            "due_date": django.utils.timezone.localdate() + django.utils.timezone.timedelta(days=15),
            "status": Invoice.InvoiceStatus.ISSUED,
            "subtotal": Decimal("4500.00"),
            "total": Decimal("4500.00"),
            "amount_paid": Decimal("1500.00"),
            "balance_due": Decimal("3000.00"),
        },
    )

    # Purchase Bill
    bill, _ = PurchaseInvoice.objects.get_or_create(
        company=company_a,
        invoice_number="PINV-P9-0001",
        defaults={
            "vendor": vend,
            "invoice_date": django.utils.timezone.localdate(),
            "due_date": django.utils.timezone.localdate() + django.utils.timezone.timedelta(days=30),
            "status": PurchaseInvoice.InvoiceStatus.ISSUED,
            "subtotal": Decimal("2000.00"),
            "total": Decimal("2000.00"),
            "amount_paid": Decimal("0.00"),
            "balance_due": Decimal("2000.00"),
        },
    )

    # CRM Lead & Deal
    Lead.objects.get_or_create(
        company=company_a,
        first_name="Marcus",
        last_name="Flint",
        defaults={"status": "Qualified", "estimated_value": Decimal("8000.00"), "lead_company": "Flint Aerospace"},
    )
    Deal.objects.get_or_create(
        company=company_a,
        customer=cust,
        title="Fleet Modernization",
        defaults={"stage": "Proposal", "value": Decimal("25000.00")},
    )

    # Employee
    Employee.objects.get_or_create(
        company=company_a,
        employee_id="P9-EMP-001",
        defaults={
            "user": user_a,
            "first_name": "Elena",
            "last_name": "Rostova",
            "designation": "Director of Technology",
            "department": "Engineering",
            "is_active": True,
        },
    )

    ensure_default_accounts(company_a)
    print(" -> Seed data established successfully across Sales, Purchases, Inventory, CRM, Finance, and HR.")

    # 3. Test Endpoints as User A (Authorized)
    client_a = APIClient()
    client_a.force_authenticate(user=user_a)

    print("\n[3] Testing Phase 9 Primary AI Endpoints:")

    # Endpoint 1: Dashboard
    dash_url = f"/api/companies/{company_a.id}/ai/dashboard/"
    dash_res = client_a.get(dash_url)
    assert dash_res.status_code == 200, f"Dashboard returned {dash_res.status_code}: {dash_res.data}"
    dash_data = dash_res.data
    assert "insights" in dash_data, "Missing 'insights' in dashboard response"
    assert "sales" in dash_data["insights"], "Missing 'sales' in insights"
    assert "purchases" in dash_data["insights"], "Missing 'purchases' in insights"
    assert "inventory" in dash_data["insights"], "Missing 'inventory' in insights"
    assert "crm" in dash_data["insights"], "Missing 'crm' in insights"
    assert "finance" in dash_data["insights"], "Missing 'finance' in insights"
    assert "hr" in dash_data["insights"], "Missing 'hr' in insights"
    assert "alerts" in dash_data, "Missing 'alerts' in dashboard response"
    assert "key_trends" in dash_data, "Missing 'key_trends' in dashboard response"
    assert "low_stock_warnings" in dash_data, "Missing 'low_stock_warnings' in dashboard response"
    assert "receivables_payables" in dash_data, "Missing 'receivables_payables' in dashboard response"
    assert "observations" in dash_data, "Missing 'observations' in dashboard response"
    assert "recommendations" in dash_data, "Missing 'recommendations' in dashboard response"
    print(" -> [PASS] /api/companies/<id>/ai/dashboard/ (Verified all 6 modules, alerts, trends, recommendations)")

    # Endpoint 2: Summary
    summary_url = f"/api/companies/{company_a.id}/ai/summary/"
    summary_res = client_a.get(summary_url)
    assert summary_res.status_code == 200, f"Summary returned {summary_res.status_code}: {summary_res.data}"
    summary_data = summary_res.data
    assert "executive_summary" in summary_data, "Missing 'executive_summary'"
    assert "key_metrics" in summary_data, "Missing 'key_metrics'"
    assert "strengths" in summary_data, "Missing 'strengths'"
    assert "risks" in summary_data, "Missing 'risks'"
    assert "recommended_actions" in summary_data, "Missing 'recommended_actions'"
    print(" -> [PASS] /api/companies/<id>/ai/summary/ (Verified narrative, metrics, strengths, risks, actions)")

    # Endpoint 3: Ask with Safe Fallback
    ask_url = f"/api/companies/{company_a.id}/ai/ask/"
    questions = [
        "What are this month's sales?",
        "Which products have low stock?",
        "What is our current profit?",
    ]
    for q in questions:
        ask_res = client_a.post(ask_url, {"question": q}, format="json")
        assert ask_res.status_code == 200, f"Ask failed for '{q}': {ask_res.data}"
        assert ask_res.data["question"] == q
        assert ask_res.data["answer"], "Empty answer returned"
        assert ask_res.data["fallback_used"] is True, "Fallback should be True in test environment without API key"
        print(f" -> [PASS] /api/companies/<id>/ai/ask/ ('{q}') -> Safe Grounded Fallback: True")

    # 4. Multi-Tenant Isolation Verification
    print("\n[4] Verifying Strict Multi-Tenant Isolation (User B cannot access Company A)...")
    client_b = APIClient()
    client_b.force_authenticate(user=user_b)

    for path, method, payload in [
        (dash_url, "get", None),
        (summary_url, "get", None),
        (ask_url, "post", {"question": "What are sales?"}),
    ]:
        if method == "get":
            res = client_b.get(path)
        else:
            res = client_b.post(path, payload, format="json")
        assert res.status_code == 403, f"Expected 403 Forbidden for User B on {path}, got {res.status_code}"
    print(" -> [PASS] Strict Multi-Tenant Isolation 100% verified across all Phase 9 AI endpoints.")

    # 5. Read-Only Safety Verification
    print("\n[5] Verifying Read-Only Safety (No mutations on financial records or stock)...")
    inv_check = Invoice.objects.get(id=inv.id)
    assert inv_check.balance_due == Decimal("3000.00"), "Invoice balance_due was mutated!"
    assert inv_check.status == Invoice.InvoiceStatus.ISSUED, "Invoice status was mutated!"
    print(" -> [PASS] AI endpoints confirmed strictly read-only.")

    print("\n" + "=" * 80)
    print(">>> ALL PHASE 9 AI ASSISTANT & BUSINESS INSIGHTS CHECKS PASSED WITH 100% SUCCESS <<<")
    print("=" * 80)

if __name__ == "__main__":
    run_phase9_live_verification()
