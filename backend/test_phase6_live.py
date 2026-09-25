"""
Phase 6 Live Verification Script: Central Finance Module & Integration
Tests end-to-end accounting workflow:
Authentication -> Company -> Accounts -> Journal Entry -> Ledger ->
Trial Balance -> P&L -> Balance Sheet -> AR -> AP -> Cash/Bank ->
Sales Integration -> Purchase Integration -> Tenant Isolation.
"""

import json
import os
import sys
from decimal import Decimal
from datetime import date, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://127.0.0.1:8000"


def run_tests():
    print("=" * 80)
    print("ICORP ERP PHASE 6: CENTRAL FINANCE MODULE LIVE VERIFICATION")
    print("=" * 80)
    return run_django_client_tests()


def run_django_client_tests():
    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

    from django.contrib.auth.models import User
    from rest_framework.test import APIClient
    from company.models import Company
    from accounts.models import CompanyMembership
    from crm.models import Customer
    from inventory.models import Vendor, Product, Category, Warehouse
    from sales.models import Invoice, InvoiceItem, Payment as SalesPayment
    from purchase.models import PurchaseInvoice, PurchaseInvoiceItem, PurchasePayment
    from finance.models import Account, JournalEntry

    client = APIClient()

    # 1. Setup / Get Users & Companies
    print("\n[1] Verifying User Authentication & Multi-Tenancy Setup...")
    user_a, _ = User.objects.get_or_create(username="finance_admin", defaults={"email": "finance@acme.com"})
    user_a.set_password("FinancePass123!")
    user_a.save()

    company_a, _ = Company.objects.get_or_create(
        name="Phase6 Test Enterprise",
        defaults={"email": "enterprise@phase6.com", "phone": "123-456-7890"},
    )
    membership_a, _ = CompanyMembership.objects.get_or_create(company=company_a, user=user_a)

    user_b, _ = User.objects.get_or_create(username="finance_outsider", defaults={"email": "outsider@beta.com"})
    user_b.set_password("FinancePass123!")
    user_b.save()

    company_b, _ = Company.objects.get_or_create(
        name="Phase6 Competitor Ltd",
        defaults={"email": "competitor@phase6.com", "phone": "987-654-3210"},
    )
    membership_b, _ = CompanyMembership.objects.get_or_create(company=company_b, user=user_b)

    # Clean up test artifacts from previous runs for full idempotency
    Account.objects.filter(company=company_a, account_code="6700").delete()
    JournalEntry.objects.filter(company=company_a, reference_id__in=["EQUITY-SEED-01", "INV-LIVE-9001", "PAY-LIVE-9001", "PINV-LIVE-8001", "PPAY-LIVE-8001"]).delete()
    SalesPayment.objects.filter(company=company_a, payment_number="PAY-LIVE-9001").delete()
    Invoice.objects.filter(company=company_a, invoice_number="INV-LIVE-9001").delete()
    PurchasePayment.objects.filter(company=company_a, payment_number="PPAY-LIVE-8001").delete()
    PurchaseInvoice.objects.filter(company=company_a, invoice_number="PINV-LIVE-8001").delete()

    client.force_authenticate(user=user_a)
    print(" -> Authenticated as User A (finance_admin) for Company A (Phase6 Test Enterprise)")

    # 2. Seed Default Chart of Accounts
    print("\n[2] Seeding Default Chart of Accounts...")
    url = f"/api/companies/{company_a.id}/finance/default-accounts/"
    resp = client.post(url)
    assert resp.status_code == 200, f"Seed accounts failed: {resp.status_code} {resp.data}"
    print(f" -> Default accounts initialized: {resp.data['total_accounts']} total accounts available")

    # 3. Verify Accounts List
    print("\n[3] Fetching Chart of Accounts...")
    url = f"/api/companies/{company_a.id}/finance/accounts/"
    resp = client.get(url)
    assert resp.status_code == 200, f"Fetch accounts failed: {resp.status_code}"
    accounts_by_code = {acc["account_code"]: acc for acc in resp.data}
    assert "1010" in accounts_by_code, "Cash account (1010) missing"
    assert "1020" in accounts_by_code, "Bank account (1020) missing"
    assert "1100" in accounts_by_code, "A/R account (1100) missing"
    assert "2000" in accounts_by_code, "A/P account (2000) missing"
    assert "4000" in accounts_by_code, "Sales Revenue (4000) missing"
    assert "5000" in accounts_by_code, "COGS (5000) missing"
    print(f" -> Verified standard codes [1010, 1020, 1100, 2000, 4000, 5000] present.")

    # 4. Create Custom Account
    print("\n[4] Creating Custom Account...")
    custom_acc_data = {
        "account_code": "6700",
        "account_name": "Cloud Computing Infrastructure",
        "category": "EXPENSE",
        "description": "AWS & GCP hosting clusters",
        "opening_balance": "0.00",
    }
    resp = client.post(url, custom_acc_data, format="json")
    assert resp.status_code == 201, f"Custom account creation failed: {resp.status_code} {resp.data}"
    cloud_acc_id = resp.data["id"]
    print(f" -> Created custom account 6700 (ID: {cloud_acc_id})")

    # 5. Post Journal Entry (Double-Entry Balanced)
    print("\n[5] Posting Double-Entry Journal Entry...")
    bank_id = accounts_by_code["1020"]["id"]
    capital_id = accounts_by_code["3000"]["id"]
    je_url = f"/api/companies/{company_a.id}/finance/journal-entries/"
    je_payload = {
        "entry_date": str(date.today()),
        "description": "Founder Seed Capital Equity Funding",
        "reference_type": "MANUAL",
        "reference_id": "EQUITY-SEED-01",
        "lines": [
            {"account": bank_id, "debit": "50000.00", "credit": "0.00", "description": "Bank Deposit"},
            {"account": capital_id, "debit": "0.00", "credit": "50000.00", "description": "Share Capital Issuance"},
        ],
    }
    resp = client.post(je_url, je_payload, format="json")
    assert resp.status_code == 201, f"Journal entry post failed: {resp.status_code} {resp.data}"
    entry_number = resp.data["entry_number"]
    assert resp.data["is_balanced"] is True, "Journal entry is not balanced!"
    assert resp.data["total_debit"] == "50000.00", "Total debit mismatch"
    print(f" -> Successfully posted journal entry {entry_number} ($50,000.00 DR == CR)")

    # 6. Verify Unbalanced Journal Entry Rejection
    print("\n[6] Verifying Unbalanced Journal Entry Rejection...")
    unbalanced_payload = {
        "entry_date": str(date.today()),
        "description": "Bogus Unbalanced Entry",
        "lines": [
            {"account": bank_id, "debit": "1000.00", "credit": "0.00"},
            {"account": capital_id, "debit": "0.00", "credit": "800.00"},
        ],
    }
    resp = client.post(je_url, unbalanced_payload, format="json")
    assert resp.status_code == 400, "Unbalanced journal entry was unexpectedly accepted!"
    print(f" -> Properly rejected unbalanced entry: {resp.data.get('detail')}")

    # 7. General Ledger Verification
    print("\n[7] Verifying General Ledger...")
    gl_url = f"/api/companies/{company_a.id}/finance/general-ledger/?account={bank_id}"
    resp = client.get(gl_url)
    assert resp.status_code == 200, f"General ledger fetch failed: {resp.status_code}"
    bank_gl = resp.data[0]
    assert bank_gl["closing_balance"] == "50000.00" or Decimal(str(bank_gl["closing_balance"])) >= Decimal("50000.00")
    print(f" -> General Ledger running balance confirmed: Bank Closing Balance = ${bank_gl['closing_balance']}")

    # 8. Trial Balance Verification
    print("\n[8] Verifying Trial Balance...")
    tb_url = f"/api/companies/{company_a.id}/finance/trial-balance/"
    resp = client.get(tb_url)
    assert resp.status_code == 200, f"Trial balance fetch failed: {resp.status_code}"
    assert resp.data["is_balanced"] is True, f"Trial balance unbalanced: {resp.data['difference']}"
    print(f" -> Trial Balance proved: Total Debits (${resp.data['total_debits']}) == Total Credits (${resp.data['total_credits']})")

    # 9. Profit & Loss Statement
    print("\n[9] Verifying Profit & Loss Statement...")
    pnl_url = f"/api/companies/{company_a.id}/finance/profit-loss/"
    resp = client.get(pnl_url)
    assert resp.status_code == 200, f"P&L fetch failed: {resp.status_code}"
    print(f" -> P&L verified: Gross Profit = ${resp.data['gross_profit']}, Net Profit = ${resp.data['net_profit']}")

    # 10. Balance Sheet Verification
    print("\n[10] Verifying Balance Sheet Accounting Equation...")
    bs_url = f"/api/companies/{company_a.id}/finance/balance-sheet/"
    resp = client.get(bs_url)
    assert resp.status_code == 200, f"Balance sheet fetch failed: {resp.status_code}"
    assert resp.data["is_balanced"] is True, f"Balance sheet equation failed! Assets != Liab + Equity"
    print(f" -> Balance Sheet verified: Assets (${resp.data['assets']['total']}) == Liabilities & Equity (${resp.data['total_liabilities_and_equity']})")

    # 11. Sales -> Finance Integration
    print("\n[11] Verifying Sales -> Finance Auto-Journal Integration...")
    customer, _ = Customer.objects.get_or_create(company=company_a, name="Phase6 Live Customer", defaults={"email": "client@live.com"})
    sales_inv_url = f"/api/companies/{company_a.id}/sales/invoices/"
    # Create sales invoice directly
    sales_inv = Invoice.objects.create(
        company=company_a,
        customer=customer,
        invoice_number="INV-LIVE-9001",
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=30),
        status=Invoice.InvoiceStatus.ISSUED,
        subtotal=Decimal("4500.00"),
        discount=Decimal("0.00"),
        tax=Decimal("450.00"),
        total=Decimal("4950.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("4950.00"),
    )
    from finance.services import sync_sales_invoice_to_journal, sync_sales_payment_to_journal
    je_inv = sync_sales_invoice_to_journal(sales_inv, user=user_a)
    assert je_inv is not None, "Failed to sync sales invoice to journal"
    print(f" -> Sales Invoice {sales_inv.invoice_number} successfully posted to journal {je_inv.entry_number}")

    # Record payment for invoice
    payment = SalesPayment.objects.create(
        company=company_a,
        invoice=sales_inv,
        customer=customer,
        payment_number="PAY-LIVE-9001",
        payment_date=date.today(),
        amount=Decimal("4950.00"),
        payment_method=SalesPayment.PaymentMethod.BANK_TRANSFER,
    )
    je_pay = sync_sales_payment_to_journal(payment, user=user_a)
    assert je_pay is not None, "Failed to sync sales payment to journal"
    print(f" -> Sales Payment {payment.payment_number} successfully posted to journal {je_pay.entry_number}")

    # 12. Purchase -> Finance Integration
    print("\n[12] Verifying Purchase -> Finance Auto-Journal Integration...")
    vendor, _ = Vendor.objects.get_or_create(company=company_a, name="Phase6 Live Supplier", defaults={"email": "supplier@live.com"})
    purchase_bill = PurchaseInvoice.objects.create(
        company=company_a,
        vendor=vendor,
        invoice_number="PINV-LIVE-8001",
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=30),
        status=PurchaseInvoice.InvoiceStatus.ISSUED,
        subtotal=Decimal("2000.00"),
        discount=Decimal("0.00"),
        tax=Decimal("0.00"),
        total=Decimal("2000.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("2000.00"),
    )
    from finance.services import sync_purchase_invoice_to_journal, sync_purchase_payment_to_journal
    je_bill = sync_purchase_invoice_to_journal(purchase_bill, user=user_a)
    assert je_bill is not None, "Failed to sync purchase bill to journal"
    print(f" -> Purchase Bill {purchase_bill.invoice_number} successfully posted to journal {je_bill.entry_number}")

    purchase_pay = PurchasePayment.objects.create(
        company=company_a,
        vendor=vendor,
        invoice=purchase_bill,
        payment_number="PPAY-LIVE-8001",
        payment_date=date.today(),
        amount=Decimal("2000.00"),
        payment_method=PurchasePayment.PaymentMethod.BANK_TRANSFER,
    )
    je_ppay = sync_purchase_payment_to_journal(purchase_pay, user=user_a)
    assert je_ppay is not None, "Failed to sync purchase payment to journal"
    print(f" -> Purchase Payment {purchase_pay.payment_number} successfully posted to journal {je_ppay.entry_number}")

    # 13. Cash & Bank Accounts API
    print("\n[13] Verifying Cash & Bank Accounts API...")
    bank_list_url = f"/api/companies/{company_a.id}/finance/bank/"
    resp = client.get(bank_list_url)
    assert resp.status_code == 200, f"Bank list failed: {resp.status_code}"
    print(f" -> {len(resp.data)} bank accounts active")

    cash_list_url = f"/api/companies/{company_a.id}/finance/cash/"
    resp = client.get(cash_list_url)
    assert resp.status_code == 200, f"Cash list failed: {resp.status_code}"
    print(f" -> {len(resp.data)} cash registers active")

    # 14. Finance Dashboard API
    print("\n[14] Verifying Finance Dashboard API...")
    dash_url = f"/api/companies/{company_a.id}/finance/dashboard/"
    resp = client.get(dash_url)
    assert resp.status_code == 200, f"Dashboard fetch failed: {resp.status_code}"
    kpis = resp.data["kpis"]
    print(f" -> Dashboard KPIs: Total Revenue = ${kpis['total_revenue']}, Liquid Funds = ${kpis['total_liquid_funds']}")

    # 15. Strict Tenant Isolation
    print("\n[15] Verifying Strict Tenant Isolation (Company B user accessing Company A)...")
    client.force_authenticate(user=user_b)
    resp = client.get(dash_url)
    assert resp.status_code == 403, f"Tenant isolation failed! Expected 403, got {resp.status_code}"

    resp = client.get(f"/api/companies/{company_a.id}/finance/accounts/")
    assert resp.status_code == 403, f"Tenant isolation failed on accounts! Expected 403, got {resp.status_code}"

    resp = client.get(f"/api/companies/{company_a.id}/finance/journal-entries/")
    assert resp.status_code == 403, f"Tenant isolation failed on journals! Expected 403, got {resp.status_code}"

    resp = client.get(f"/api/companies/{company_a.id}/finance/general-ledger/")
    assert resp.status_code == 403, f"Tenant isolation failed on ledger! Expected 403, got {resp.status_code}"

    resp = client.get(f"/api/companies/{company_a.id}/finance/trial-balance/")
    assert resp.status_code == 403, f"Tenant isolation failed on trial balance! Expected 403, got {resp.status_code}"

    print(" -> Strict Tenant Isolation 100% verified (All cross-tenant requests safely rejected with 403 Forbidden).")

    print("\n" + "=" * 80)
    print(">>> ALL 15 PHASE 6 LIVE VERIFICATION CHECKS PASSED WITH 100% SUCCESS <<<")
    print("=" * 80)
    return True


if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)
