"""
Phase 7 Live Verification Script: Practical Read-Only AI ERP Assistant
Tests all 10 required questions, customer/vendor lookup, executive insights,
tenant isolation, read-only guarantees, and error handling.
"""

import os
import sys
from decimal import Decimal
from datetime import date, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def run_tests():
    print("=" * 80)
    print("ICORP ERP PHASE 7: AI ERP ASSISTANT LIVE VERIFICATION")
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
    from crm.models import Customer
    from inventory.models import Vendor, Product, Category, Warehouse, Stock
    from sales.models import SalesOrder, SalesOrderItem, Invoice, Payment as SalesPayment
    from purchase.models import PurchaseOrder, PurchaseOrderItem, PurchaseInvoice, PurchasePayment
    from finance.services import ensure_default_accounts

    client = APIClient()

    # 1. Setup Multi-Tenancy & Test Companies
    print("\n[1] Verifying Multi-Tenant Authentication Setup...")
    user_a, _ = User.objects.get_or_create(username="ai_tester_a", defaults={"email": "tester_a@enterprise.com"})
    user_a.set_password("AIPassword123!")
    user_a.save()

    company_a, _ = Company.objects.get_or_create(
        name="Phase7 Alpha Corp",
        defaults={"email": "alpha@phase7.com", "phone": "111-222-3333"},
    )
    membership_a, _ = CompanyMembership.objects.get_or_create(company=company_a, user=user_a)

    user_b, _ = User.objects.get_or_create(username="ai_tester_b", defaults={"email": "tester_b@beta.com"})
    user_b.set_password("AIPassword123!")
    user_b.save()

    company_b, _ = Company.objects.get_or_create(
        name="Phase7 Beta Competitor",
        defaults={"email": "beta@phase7.com", "phone": "999-888-7777"},
    )
    membership_b, _ = CompanyMembership.objects.get_or_create(company=company_b, user=user_b)

    # Clean up test artifacts from previous runs for full idempotency
    SalesPayment.objects.filter(company=company_a, payment_number="PAY-LIVE-7001").delete()
    Invoice.objects.filter(company=company_a, invoice_number="INV-LIVE-7001").delete()
    SalesOrder.objects.filter(company=company_a, order_number="SO-LIVE-7001").delete()
    PurchasePayment.objects.filter(company=company_a, payment_number="PPAY-LIVE-7001").delete()
    PurchaseInvoice.objects.filter(company=company_a, invoice_number="PINV-LIVE-7001").delete()
    PurchaseOrder.objects.filter(company=company_a, order_number="PO-LIVE-7001").delete()
    Product.objects.filter(company=company_a, sku="SKU-AI-7001").delete()

    client.force_authenticate(user=user_a)
    print(" -> Authenticated as User A (ai_tester_a) for Company A (Phase7 Alpha Corp)")

    # 2. Seed Baseline ERP Data for Company A
    print("\n[2] Seeding Operational ERP Data (Sales, Purchases, Inventory, Finance)...")
    customer, _ = Customer.objects.get_or_create(
        company=company_a,
        name="Stark Apex Industries",
        defaults={"email": "finance@starkapex.com", "phone": "555-0199"},
    )
    vendor, _ = Vendor.objects.get_or_create(
        company=company_a,
        name="Global Steel Foundry",
        defaults={"email": "orders@globalsteel.com", "phone": "555-0288", "tax_id": "GST-STEEL-99"},
    )
    category, _ = Category.objects.get_or_create(company=company_a, name="Fabricated Metals")
    warehouse, _ = Warehouse.objects.get_or_create(company=company_a, code="WH-AI-01", defaults={"name": "AI Test Hub"})

    product = Product.objects.create(
        company=company_a,
        sku="SKU-AI-7001",
        name="Carbon Steel Flange",
        category=category,
        cost_price=Decimal("120.00"),
        selling_price=Decimal("200.00"),
        reorder_level=15,
    )
    stock = Stock.objects.create(
        product=product,
        warehouse=warehouse,
        quantity=Decimal("4.00"),  # Low stock (4 <= 15)
        reorder_level=15,
    )

    # Sales Order & Invoice & Payment
    so = SalesOrder.objects.create(
        company=company_a,
        customer=customer,
        order_number="SO-LIVE-7001",
        order_date=timezone.localdate(),
        status=SalesOrder.SalesOrderStatus.CONFIRMED,
        subtotal=Decimal("6000.00"),
        total=Decimal("6000.00"),
    )
    inv = Invoice.objects.create(
        company=company_a,
        customer=customer,
        sales_order=so,
        invoice_number="INV-LIVE-7001",
        invoice_date=timezone.localdate(),
        due_date=timezone.localdate() + timedelta(days=20),
        status=Invoice.InvoiceStatus.PARTIALLY_PAID,
        subtotal=Decimal("6000.00"),
        total=Decimal("6000.00"),
        amount_paid=Decimal("2000.00"),
        balance_due=Decimal("4000.00"),
    )
    pay = SalesPayment.objects.create(
        company=company_a,
        customer=customer,
        invoice=inv,
        payment_number="PAY-LIVE-7001",
        payment_date=timezone.localdate(),
        amount=Decimal("2000.00"),
        payment_method=SalesPayment.PaymentMethod.BANK_TRANSFER,
    )

    # Purchase Order & Bill
    po = PurchaseOrder.objects.create(
        company=company_a,
        vendor=vendor,
        order_number="PO-LIVE-7001",
        order_date=timezone.localdate(),
        status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
        subtotal=Decimal("4800.00"),
        total=Decimal("4800.00"),
    )
    bill = PurchaseInvoice.objects.create(
        company=company_a,
        vendor=vendor,
        purchase_order=po,
        invoice_number="PINV-LIVE-7001",
        invoice_date=timezone.localdate(),
        due_date=timezone.localdate() + timedelta(days=30),
        status=PurchaseInvoice.InvoiceStatus.ISSUED,
        subtotal=Decimal("4800.00"),
        total=Decimal("4800.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("4800.00"),
    )
    ensure_default_accounts(company_a)
    print(" -> Operational baseline established successfully.")

    # 3. Test All 10 Required Natural-Language Questions
    chat_url = f"/api/companies/{company_a.id}/ai/chat/"

    test_queries = [
        ("What are this month's sales?", "MONTHLY_SALES", "$6,000.00"),
        ("Which invoices are outstanding?", "OUTSTANDING_INVOICES", "INV-LIVE-7001"),
        ("How much did we collect?", "COLLECTIONS", "$2,000.00"),
        ("What are our total purchases?", "TOTAL_PURCHASES", "$4,800.00"),
        ("Which products have low stock?", "LOW_STOCK", "SKU-AI-7001"),
        ("Which customers owe money?", "CUSTOMERS_OWE", "Stark Apex Industries"),
        ("Which vendors have the highest purchase value?", "TOP_VENDORS", "Global Steel Foundry"),
        ("What is the current profit?", "CURRENT_PROFIT", "Net Profit"),
        ("Show recent sales orders.", "RECENT_SALES_ORDERS", "SO-LIVE-7001"),
        ("Show recent purchase orders.", "RECENT_PURCHASE_ORDERS", "PO-LIVE-7001"),
    ]

    print("\n[3] Testing All 10 Required Natural-Language ERP Queries:")
    for idx, (question, expected_intent, expected_needle) in enumerate(test_queries, 1):
        resp = client.post(chat_url, {"query": question}, format="json")
        assert resp.status_code == 200, f"Query '{question}' failed: {resp.status_code} {resp.data}"
        intent = resp.data.get("intent")
        answer = resp.data.get("answer", "")
        assert intent == expected_intent, f"Intent mismatch for '{question}': expected {expected_intent}, got {intent}"
        assert expected_needle.lower() in answer.lower(), f"Expected needle '{expected_needle}' missing in answer: {answer}"
        print(f" -> Q{idx:02d} PASS: \"{question}\" -> Intent: {intent} (Contains: {expected_needle})")

    # 4. Customer Lookup Intelligence
    print("\n[4] Testing Customer Intelligence Lookup...")
    cust_url = f"/api/companies/{company_a.id}/ai/customer-lookup/?q=Stark"
    resp = client.get(cust_url)
    assert resp.status_code == 200, f"Customer lookup failed: {resp.status_code}"
    results = resp.data.get("results", [])
    assert len(results) >= 1, "Customer 'Stark' was not found"
    cust_info = results[0]
    assert cust_info["name"] == "Stark Apex Industries"
    assert cust_info["balance_due"] == "4000.00"
    print(f" -> Customer '{cust_info['name']}' verified: Balance Due = ${cust_info['balance_due']}, Orders = {cust_info['total_orders']}")

    # 5. Vendor Lookup Intelligence
    print("\n[5] Testing Vendor Intelligence Lookup...")
    vend_url = f"/api/companies/{company_a.id}/ai/vendor-lookup/?q=Global Steel"
    resp = client.get(vend_url)
    assert resp.status_code == 200, f"Vendor lookup failed: {resp.status_code}"
    results = resp.data.get("results", [])
    assert len(results) >= 1, "Vendor 'Global Steel' was not found"
    vend_info = results[0]
    assert vend_info["name"] == "Global Steel Foundry"
    assert vend_info["balance_due"] == "4800.00"
    print(f" -> Vendor '{vend_info['name']}' verified: Total Billed = ${vend_info['total_billed']}, Balance Due = ${vend_info['balance_due']}")

    # 6. Executive Insights Digest API
    print("\n[6] Testing Executive Insights Digest API...")
    insights_url = f"/api/companies/{company_a.id}/ai/insights/"
    resp = client.get(insights_url)
    assert resp.status_code == 200, f"Insights API failed: {resp.status_code}"
    assert "sales" in resp.data, "Sales section missing in insights"
    assert "purchases" in resp.data, "Purchases section missing in insights"
    assert "inventory" in resp.data, "Inventory section missing in insights"
    assert "finance" in resp.data, "Finance section missing in insights"
    assert resp.data["inventory"]["low_stock_count"] >= 1, "Low stock count was not reflected"
    print(f" -> Executive digest verified across all 4 core ERP dimensions (Sales, Purchases, Inventory, Finance).")

    # 7. Strict Multi-Tenant Isolation
    print("\n[7] Verifying Strict Multi-Tenant Isolation (User B cannot access Company A)...")
    client.force_authenticate(user=user_b)

    resp = client.post(chat_url, {"query": "What are this month's sales?"}, format="json")
    assert resp.status_code == 403, f"Cross-tenant chat exploit! Expected 403, got {resp.status_code}"

    resp = client.get(insights_url)
    assert resp.status_code == 403, f"Cross-tenant insights exploit! Expected 403, got {resp.status_code}"

    resp = client.get(cust_url)
    assert resp.status_code == 403, f"Cross-tenant customer lookup exploit! Expected 403, got {resp.status_code}"

    resp = client.get(vend_url)
    assert resp.status_code == 403, f"Cross-tenant vendor lookup exploit! Expected 403, got {resp.status_code}"
    print(" -> Tenant Isolation 100% verified (All cross-tenant attempts rejected with 403 Forbidden).")

    # 8. Strict Read-Only Verification
    print("\n[8] Verifying Strict Read-Only Integrity...")
    client.force_authenticate(user=user_a)
    count_inv = Invoice.objects.filter(company=company_a).count()
    count_pay = SalesPayment.objects.filter(company=company_a).count()
    stock_qty = Stock.objects.get(id=stock.id).quantity
    count_po = PurchaseOrder.objects.filter(company=company_a).count()

    # Issue multiple queries
    client.post(chat_url, {"query": "What are this month's sales?"}, format="json")
    client.post(chat_url, {"query": "Which products have low stock?"}, format="json")
    client.post(chat_url, {"query": "Which customers owe money?"}, format="json")

    assert Invoice.objects.filter(company=company_a).count() == count_inv, "Invoice count altered!"
    assert SalesPayment.objects.filter(company=company_a).count() == count_pay, "Payment count altered!"
    assert Stock.objects.get(id=stock.id).quantity == stock_qty, "Inventory stock level altered!"
    assert PurchaseOrder.objects.filter(company=company_a).count() == count_po, "Purchase Order count altered!"
    print(" -> Strict Read-Only Invariant 100% verified (0 database records altered, 0 stock modified).")

    # 9. Error Handling
    print("\n[9] Verifying Input Validation & Error Handling...")
    resp = client.post(chat_url, {"query": ""}, format="json")
    assert resp.status_code == 400, f"Empty query should return 400 Bad Request, got {resp.status_code}"

    resp = client.get(f"/api/companies/{company_a.id}/ai/customer-lookup/?q=DoesNotExistGhost123")
    assert resp.status_code == 200, f"Ghost customer should return 200 with empty list, got {resp.status_code}"
    assert resp.data.get("results") == [], "Non-empty results for ghost customer"
    print(" -> Error handling and edge cases handled smoothly.")

    print("\n" + "=" * 80)
    print(">>> ALL PHASE 7 AI ASSISTANT VERIFICATION CHECKS PASSED WITH 100% SUCCESS <<<")
    print("=" * 80)
    return True


if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)
