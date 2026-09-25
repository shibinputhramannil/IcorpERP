from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from crm.models import Customer
from inventory.models import Vendor, Product, Category, Warehouse
from sales.models import Invoice, InvoiceItem, Payment as SalesPayment
from purchase.models import PurchaseInvoice, PurchaseInvoiceItem, PurchasePayment
from finance.models import (
    Account,
    AccountCategory,
    FiscalPeriod,
    JournalEntry,
    JournalEntryLine,
    BankAccount,
    CashAccount,
    generate_journal_entry_number,
)
from finance.services import (
    ensure_default_accounts,
    post_journal_entry,
    get_general_ledger,
    get_trial_balance,
    get_profit_and_loss,
    get_balance_sheet,
    get_accounts_receivable_summary,
    get_accounts_payable_summary,
    get_finance_dashboard,
    sync_sales_invoice_to_journal,
    sync_sales_payment_to_journal,
    sync_purchase_invoice_to_journal,
    sync_purchase_payment_to_journal,
)


class FinanceComprehensiveTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Company A Setup
        self.company_a = Company.objects.create(
            name="Acme Corp",
            email="acme@corp.com",
            phone="111-222-3333",
        )
        self.user_a = User.objects.create_user(
            username="alice",
            email="alice@acme.com",
            password="Password123!",
        )
        self.membership_a = CompanyMembership.objects.create(
            company=self.company_a,
            user=self.user_a,
        )

        # Company B Setup (for strict tenant isolation verification)
        self.company_b = Company.objects.create(
            name="Beta Ltd",
            email="beta@ltd.com",
            phone="444-555-6666",
        )
        self.user_b = User.objects.create_user(
            username="bob",
            email="bob@beta.com",
            password="Password123!",
        )
        self.membership_b = CompanyMembership.objects.create(
            company=self.company_b,
            user=self.user_b,
        )

        # Seed default accounts for Company A
        ensure_default_accounts(self.company_a)
        self.cash_acc_a = Account.objects.get(company=self.company_a, account_code="1010")
        self.bank_acc_a = Account.objects.get(company=self.company_a, account_code="1020")
        self.ar_acc_a = Account.objects.get(company=self.company_a, account_code="1100")
        self.inv_acc_a = Account.objects.get(company=self.company_a, account_code="1200")
        self.ap_acc_a = Account.objects.get(company=self.company_a, account_code="2000")
        self.tax_acc_a = Account.objects.get(company=self.company_a, account_code="2100")
        self.capital_acc_a = Account.objects.get(company=self.company_a, account_code="3000")
        self.sales_acc_a = Account.objects.get(company=self.company_a, account_code="4000")
        self.cogs_acc_a = Account.objects.get(company=self.company_a, account_code="5000")
        self.exp_acc_a = Account.objects.get(company=self.company_a, account_code="6000")

    # ========================================================
    # 1. CHART OF ACCOUNTS TESTS
    # ========================================================

    def test_01_account_creation_success(self):
        """Verify custom account creation within company scope."""
        acc = Account.objects.create(
            company=self.company_a,
            account_code="6300",
            account_name="Marketing & Advertising",
            category=Account.CategoryType.EXPENSE,
            description="Brand awareness campaigns",
        )
        self.assertEqual(acc.account_code, "6300")
        self.assertEqual(acc.category, "EXPENSE")
        self.assertEqual(acc.normal_balance_type, "DEBIT")
        self.assertTrue(acc.is_active)

    def test_02_account_code_uniqueness_per_company(self):
        """Verify duplicate account codes are rejected within same company."""
        with self.assertRaises(Exception):
            Account.objects.create(
                company=self.company_a,
                account_code="1010",  # Already exists in Company A
                account_name="Duplicate Cash",
                category=Account.CategoryType.ASSET,
            )

    def test_03_account_code_same_code_different_company(self):
        """Verify identical account codes are allowed in different companies."""
        acc_b = Account.objects.create(
            company=self.company_b,
            account_code="1010",
            account_name="Company B Cash",
            category=Account.CategoryType.ASSET,
        )
        self.assertIsNotNone(acc_b.id)
        self.assertEqual(acc_b.company, self.company_b)

    def test_04_default_accounts_idempotency(self):
        """Verify ensure_default_accounts does not duplicate existing accounts."""
        initial_count = Account.objects.filter(company=self.company_a).count()
        # Call again
        created = ensure_default_accounts(self.company_a)
        final_count = Account.objects.filter(company=self.company_a).count()
        self.assertEqual(len(created), 0)
        self.assertEqual(initial_count, final_count)

    def test_05_system_account_protection(self):
        """Verify system accounts cannot be deleted via API."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/finance/accounts/{self.cash_acc_a.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("System accounts cannot be deleted", response.data["detail"])

    # ========================================================
    # 2. DOUBLE-ENTRY JOURNAL TESTS
    # ========================================================

    def test_06_balanced_journal_entry_posting(self):
        """Verify posting a valid balanced journal entry succeeds."""
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("1000.00"), "credit": Decimal("0.00")},
            {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("1000.00")},
        ]
        entry = post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Initial owner capital contribution",
            lines_data=lines,
        )
        self.assertIsNotNone(entry.id)
        self.assertEqual(entry.total_debit, Decimal("1000.00"))
        self.assertEqual(entry.total_credit, Decimal("1000.00"))
        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.status, JournalEntry.EntryStatus.POSTED)
        self.assertTrue(entry.entry_number.startswith("JE-"))

    def test_07_unbalanced_journal_entry_rejected(self):
        """Verify unbalanced journal entry is rejected with ValidationError."""
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("1000.00"), "credit": Decimal("0.00")},
            {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("900.00")},  # $100 off
        ]
        with self.assertRaises(ValidationError) as ctx:
            post_journal_entry(
                company=self.company_a,
                user=self.user_a,
                entry_date=date.today(),
                description="Unbalanced capital injection",
                lines_data=lines,
            )
        self.assertIn("Unbalanced journal entry rejected", str(ctx.exception))

    def test_08_single_line_journal_entry_rejected(self):
        """Verify journal entry with fewer than 2 lines is rejected."""
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("500.00"), "credit": Decimal("0.00")},
        ]
        with self.assertRaises(ValidationError):
            post_journal_entry(
                company=self.company_a,
                user=self.user_a,
                entry_date=date.today(),
                description="Single line entry",
                lines_data=lines,
            )

    def test_09_negative_amount_rejected(self):
        """Verify negative debit or credit amount is rejected."""
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("-500.00"), "credit": Decimal("0.00")},
            {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("-500.00")},
        ]
        with self.assertRaises(ValidationError):
            post_journal_entry(
                company=self.company_a,
                user=self.user_a,
                entry_date=date.today(),
                description="Negative amounts",
                lines_data=lines,
            )

    def test_10_both_debit_and_credit_on_same_line_rejected(self):
        """Verify line cannot have both debit > 0 and credit > 0."""
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("500.00"), "credit": Decimal("100.00")},
            {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("400.00")},
        ]
        with self.assertRaises(ValidationError):
            post_journal_entry(
                company=self.company_a,
                user=self.user_a,
                entry_date=date.today(),
                description="Dual line amounts",
                lines_data=lines,
            )

    def test_11_zero_amount_line_rejected(self):
        """Verify line cannot have both debit == 0 and credit == 0."""
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("0.00")},
            {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("0.00")},
        ]
        with self.assertRaises(ValidationError):
            post_journal_entry(
                company=self.company_a,
                user=self.user_a,
                entry_date=date.today(),
                description="Zero amount lines",
                lines_data=lines,
            )

    def test_12_sequential_journal_numbering(self):
        """Verify sequential, concurrency-safe numbering format JE-YYYY-XXXXXX."""
        num1 = generate_journal_entry_number(self.company_a)
        # Create entry with num1
        JournalEntry.objects.create(
            company=self.company_a,
            entry_number=num1,
            description="Entry 1",
            entry_date=date.today(),
        )
        num2 = generate_journal_entry_number(self.company_a)
        self.assertNotEqual(num1, num2)
        seq1 = int(num1.split("-")[-1])
        seq2 = int(num2.split("-")[-1])
        self.assertEqual(seq2, seq1 + 1)

    # ========================================================
    # 3. FISCAL PERIOD TESTS
    # ========================================================

    def test_13_fiscal_period_date_validation(self):
        """Verify fiscal period start_date cannot be after end_date."""
        period = FiscalPeriod(
            company=self.company_a,
            period_name="Invalid FY",
            start_date=date(2026, 12, 31),
            end_date=date(2026, 1, 1),
            status=FiscalPeriod.PeriodStatus.OPEN,
        )
        with self.assertRaises(ValidationError):
            period.clean()

    def test_14_closed_fiscal_period_prevents_posting(self):
        """Verify posting entries into a CLOSED fiscal period is strictly prohibited."""
        FiscalPeriod.objects.create(
            company=self.company_a,
            period_name="FY 2025 Closed",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            status=FiscalPeriod.PeriodStatus.CLOSED,
        )
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("100.00"), "credit": Decimal("0.00")},
            {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("100.00")},
        ]
        with self.assertRaises(ValidationError) as ctx:
            post_journal_entry(
                company=self.company_a,
                user=self.user_a,
                entry_date=date(2025, 6, 15),
                description="Posting into closed period",
                lines_data=lines,
            )
        self.assertIn("is CLOSED", str(ctx.exception))

    def test_15_open_fiscal_period_allows_posting(self):
        """Verify posting entries into an OPEN fiscal period succeeds."""
        FiscalPeriod.objects.create(
            company=self.company_a,
            period_name="FY 2026 Open",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status=FiscalPeriod.PeriodStatus.OPEN,
        )
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("250.00"), "credit": Decimal("0.00")},
            {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("250.00")},
        ]
        entry = post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date(2026, 3, 1),
            description="Posting into open period",
            lines_data=lines,
        )
        self.assertIsNotNone(entry.id)
        self.assertEqual(entry.fiscal_period.period_name, "FY 2026 Open")

    # ========================================================
    # 4. GENERAL LEDGER & TRIAL BALANCE TESTS
    # ========================================================

    def test_16_general_ledger_running_balances(self):
        """Verify General Ledger line-by-line running balance calculation."""
        # 1. Capital contribution: DR Bank $5000, CR Capital $5000
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date(2026, 1, 1),
            description="Capital injection",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": Decimal("5000.00"), "credit": Decimal("0.00")},
                {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("5000.00")},
            ],
        )
        # 2. Operating Expense: DR Expense $800, CR Bank $800
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date(2026, 1, 15),
            description="Office rent",
            lines_data=[
                {"account": self.exp_acc_a.id, "debit": Decimal("800.00"), "credit": Decimal("0.00")},
                {"account": self.bank_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("800.00")},
            ],
        )

        gl = get_general_ledger(self.company_a, account_id=self.bank_acc_a.id)
        self.assertEqual(len(gl), 1)
        bank_report = gl[0]
        self.assertEqual(bank_report["total_debit"], Decimal("5000.00"))
        self.assertEqual(bank_report["total_credit"], Decimal("800.00"))
        self.assertEqual(bank_report["closing_balance"], Decimal("4200.00"))
        self.assertEqual(len(bank_report["transactions"]), 2)
        self.assertEqual(bank_report["transactions"][0]["running_balance"], Decimal("5000.00"))
        self.assertEqual(bank_report["transactions"][1]["running_balance"], Decimal("4200.00"))

    def test_17_trial_balance_mathematical_equality(self):
        """Verify Trial Balance proves Total Debits == Total Credits."""
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Multi-account transaction",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": Decimal("1500.00"), "credit": Decimal("0.00")},
                {"account": self.ar_acc_a.id, "debit": Decimal("500.00"), "credit": Decimal("0.00")},
                {"account": self.sales_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("2000.00")},
            ],
        )
        tb = get_trial_balance(self.company_a)
        self.assertTrue(tb["is_balanced"])
        self.assertEqual(tb["total_debits"], tb["total_credits"])
        self.assertEqual(tb["difference"], Decimal("0.00"))

    # ========================================================
    # 5. PROFIT & LOSS & BALANCE SHEET TESTS
    # ========================================================

    def test_18_profit_and_loss_calculation(self):
        """Verify Revenue - COGS - Expenses = Net Profit calculation."""
        # Revenue $3,000, COGS $1,200, Operating Expense $500
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Sales transaction",
            lines_data=[
                {"account": self.ar_acc_a.id, "debit": Decimal("3000.00"), "credit": Decimal("0.00")},
                {"account": self.sales_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("3000.00")},
            ],
        )
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="COGS and expenses",
            lines_data=[
                {"account": self.cogs_acc_a.id, "debit": Decimal("1200.00"), "credit": Decimal("0.00")},
                {"account": self.exp_acc_a.id, "debit": Decimal("500.00"), "credit": Decimal("0.00")},
                {"account": self.bank_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("1700.00")},
            ],
        )
        pnl = get_profit_and_loss(self.company_a)
        self.assertEqual(pnl["revenue"]["total"], Decimal("3000.00"))
        self.assertEqual(pnl["cost_of_goods_sold"]["total"], Decimal("1200.00"))
        self.assertEqual(pnl["gross_profit"], Decimal("1800.00"))
        self.assertEqual(pnl["operating_expenses"]["total"], Decimal("500.00"))
        self.assertEqual(pnl["net_profit"], Decimal("1300.00"))

    def test_19_balance_sheet_accounting_equation(self):
        """Verify Balance Sheet satisfies Assets == Liabilities + Equity."""
        # 1. Invest Capital $10,000 in Bank
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Capital funding",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": Decimal("10000.00"), "credit": Decimal("0.00")},
                {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("10000.00")},
            ],
        )
        # 2. Buy Inventory on Account $2,000 (A/P)
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Inventory on credit",
            lines_data=[
                {"account": self.inv_acc_a.id, "debit": Decimal("2000.00"), "credit": Decimal("0.00")},
                {"account": self.ap_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("2000.00")},
            ],
        )
        # 3. Sell $3,000 goods for cash (Cost $1,000)
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Cash sale",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": Decimal("3000.00"), "credit": Decimal("0.00")},
                {"account": self.sales_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("3000.00")},
            ],
        )
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Inventory reduction",
            lines_data=[
                {"account": self.cogs_acc_a.id, "debit": Decimal("1000.00"), "credit": Decimal("0.00")},
                {"account": self.inv_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("1000.00")},
            ],
        )

        bs = get_balance_sheet(self.company_a)
        self.assertTrue(bs["is_balanced"])
        self.assertEqual(bs["difference"], Decimal("0.00"))
        # Assets ($13,000 bank + $1,000 inventory = $14,000)
        self.assertEqual(bs["assets"]["total"], Decimal("14000.00"))
        # Liabilities ($2,000 AP) + Equity ($10,000 capital + $2,000 net profit = $12,000) = $14,000
        self.assertEqual(bs["total_liabilities_and_equity"], Decimal("14000.00"))

    # ========================================================
    # 6. CASH & BANK MANAGEMENT TESTS
    # ========================================================

    def test_20_cash_account_creation_and_balance(self):
        """Verify CashAccount computes balance dynamically from linked chart account."""
        petty_acc = Account.objects.create(
            company=self.company_a,
            account_code="1015",
            account_name="Warehouse Petty Cash",
            category=Account.CategoryType.ASSET,
            opening_balance=Decimal("200.00"),
        )
        cash_record = CashAccount.objects.create(
            company=self.company_a,
            account=petty_acc,
            account_name="Warehouse Cash Box",
            opening_balance=Decimal("200.00"),
        )
        self.assertEqual(cash_record.current_balance, Decimal("200.00"))

        # Add transaction
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Replenish cash",
            lines_data=[
                {"account": petty_acc.id, "debit": Decimal("300.00"), "credit": Decimal("0.00")},
                {"account": self.bank_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("300.00")},
            ],
        )
        self.assertEqual(cash_record.current_balance, Decimal("500.00"))

    def test_21_bank_account_creation_and_balance(self):
        """Verify BankAccount computes balance from chart of accounts."""
        bank = BankAccount.objects.get(company=self.company_a, account=self.bank_acc_a)
        post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Deposit",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": Decimal("4500.00"), "credit": Decimal("0.00")},
                {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("4500.00")},
            ],
        )
        self.assertEqual(bank.current_balance, Decimal("4500.00"))

    # ========================================================
    # 7. SALES & PURCHASE INTEGRATION TESTS
    # ========================================================

    def test_22_sales_invoice_integration_posts_journal(self):
        """Verify sync_sales_invoice_to_journal writes A/R and Sales Revenue."""
        customer = Customer.objects.create(
            company=self.company_a,
            name="Apex Technologies",
            email="apex@tech.com",
        )
        inv = Invoice.objects.create(
            company=self.company_a,
            customer=customer,
            invoice_number="INV-2026-TEST01",
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            status=Invoice.InvoiceStatus.ISSUED,
            subtotal=Decimal("1000.00"),
            discount=Decimal("0.00"),
            tax=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("1100.00"),
        )
        entry = sync_sales_invoice_to_journal(inv, user=self.user_a)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.reference_type, JournalEntry.ReferenceType.SALES_INVOICE)
        self.assertEqual(entry.reference_id, "INV-2026-TEST01")
        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.total_debit, Decimal("1100.00"))

        # Verify A/R balance increased
        self.assertEqual(self.ar_acc_a.calculate_balance(), Decimal("1100.00"))

    def test_23_sales_payment_integration_posts_journal(self):
        """Verify sync_sales_payment_to_journal clears A/R into Bank/Cash."""
        customer = Customer.objects.create(
            company=self.company_a,
            name="Apex Technologies",
            email="apex@tech.com",
        )
        inv = Invoice.objects.create(
            company=self.company_a,
            customer=customer,
            invoice_number="INV-2026-TEST02",
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            status=Invoice.InvoiceStatus.ISSUED,
            total=Decimal("600.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("600.00"),
        )
        sync_sales_invoice_to_journal(inv, user=self.user_a)

        payment = SalesPayment.objects.create(
            company=self.company_a,
            invoice=inv,
            customer=customer,
            payment_number="PAY-2026-TEST02",
            payment_date=date.today(),
            amount=Decimal("600.00"),
            payment_method=SalesPayment.PaymentMethod.BANK_TRANSFER,
        )
        pay_entry = sync_sales_payment_to_journal(payment, user=self.user_a)
        self.assertIsNotNone(pay_entry)
        self.assertEqual(pay_entry.reference_type, JournalEntry.ReferenceType.SALES_PAYMENT)
        self.assertTrue(pay_entry.is_balanced)

        # A/R should now be 0, Bank should have 600
        self.assertEqual(self.ar_acc_a.calculate_balance(), Decimal("0.00"))
        self.assertEqual(self.bank_acc_a.calculate_balance(), Decimal("600.00"))

    def test_24_purchase_invoice_integration_posts_journal(self):
        """Verify sync_purchase_invoice_to_journal writes COGS/Expense and A/P."""
        vendor = Vendor.objects.create(
            company=self.company_a,
            name="Global Chip Supplier",
            email="sales@chips.com",
        )
        bill = PurchaseInvoice.objects.create(
            company=self.company_a,
            vendor=vendor,
            invoice_number="PINV-2026-TEST01",
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            status=PurchaseInvoice.InvoiceStatus.ISSUED,
            total=Decimal("2500.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("2500.00"),
        )
        entry = sync_purchase_invoice_to_journal(bill, user=self.user_a)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.reference_type, JournalEntry.ReferenceType.PURCHASE_BILL)
        self.assertTrue(entry.is_balanced)
        self.assertEqual(self.ap_acc_a.calculate_balance(), Decimal("2500.00"))

    def test_25_purchase_payment_integration_posts_journal(self):
        """Verify sync_purchase_payment_to_journal reduces A/P and credits Bank."""
        vendor = Vendor.objects.create(
            company=self.company_a,
            name="Global Chip Supplier",
            email="sales@chips.com",
        )
        bill = PurchaseInvoice.objects.create(
            company=self.company_a,
            vendor=vendor,
            invoice_number="PINV-2026-TEST02",
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            status=PurchaseInvoice.InvoiceStatus.ISSUED,
            total=Decimal("1500.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("1500.00"),
        )
        sync_purchase_invoice_to_journal(bill, user=self.user_a)

        ppay = PurchasePayment.objects.create(
            company=self.company_a,
            vendor=vendor,
            invoice=bill,
            payment_number="PPAY-2026-TEST02",
            payment_date=date.today(),
            amount=Decimal("1500.00"),
            payment_method=PurchasePayment.PaymentMethod.BANK_TRANSFER,
        )
        entry = sync_purchase_payment_to_journal(ppay, user=self.user_a)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.reference_type, JournalEntry.ReferenceType.PURCHASE_PAYMENT)
        self.assertTrue(entry.is_balanced)
        self.assertEqual(self.ap_acc_a.calculate_balance(), Decimal("0.00"))

    # ========================================================
    # 8. ACCOUNTS RECEIVABLE & PAYABLE SUMMARY TESTS
    # ========================================================

    def test_26_accounts_receivable_summary_metrics(self):
        """Verify AR summary returns accurate overdue and outstanding amounts."""
        customer = Customer.objects.create(
            company=self.company_a,
            name="Summit Corp",
            email="summit@corp.com",
        )
        Invoice.objects.create(
            company=self.company_a,
            customer=customer,
            invoice_number="INV-AR-01",
            invoice_date=date.today() - timedelta(days=45),
            due_date=date.today() - timedelta(days=15),  # Overdue
            status=Invoice.InvoiceStatus.ISSUED,
            total=Decimal("800.00"),
            amount_paid=Decimal("200.00"),
            balance_due=Decimal("600.00"),
        )
        ar = get_accounts_receivable_summary(self.company_a)
        self.assertEqual(ar["total_receivables"], Decimal("800.00"))
        self.assertEqual(ar["total_paid"], Decimal("200.00"))
        self.assertEqual(ar["total_outstanding"], Decimal("600.00"))
        self.assertEqual(ar["total_overdue"], Decimal("600.00"))
        self.assertEqual(len(ar["customer_breakdown"]), 1)
        self.assertEqual(ar["customer_breakdown"][0]["customer_name"], "Summit Corp")

    def test_27_accounts_payable_summary_metrics(self):
        """Verify AP summary returns accurate overdue and outstanding amounts."""
        vendor = Vendor.objects.create(
            company=self.company_a,
            name="Industrial Parts LLC",
            email="orders@industrial.com",
        )
        PurchaseInvoice.objects.create(
            company=self.company_a,
            vendor=vendor,
            invoice_number="PINV-AP-01",
            invoice_date=date.today() - timedelta(days=40),
            due_date=date.today() - timedelta(days=10),  # Overdue
            status=PurchaseInvoice.InvoiceStatus.ISSUED,
            total=Decimal("1200.00"),
            amount_paid=Decimal("400.00"),
            balance_due=Decimal("800.00"),
        )
        ap = get_accounts_payable_summary(self.company_a)
        self.assertEqual(ap["total_payables"], Decimal("1200.00"))
        self.assertEqual(ap["total_paid"], Decimal("400.00"))
        self.assertEqual(ap["total_outstanding"], Decimal("800.00"))
        self.assertEqual(ap["total_overdue"], Decimal("800.00"))
        self.assertEqual(len(ap["vendor_breakdown"]), 1)
        self.assertEqual(ap["vendor_breakdown"][0]["vendor_name"], "Industrial Parts LLC")

    # ========================================================
    # 9. FINANCE DASHBOARD TESTS
    # ========================================================

    def test_28_finance_dashboard_metrics(self):
        """Verify dashboard returns real database-backed KPIs and monthly trends."""
        dashboard = get_finance_dashboard(self.company_a)
        self.assertIn("kpis", dashboard)
        self.assertIn("monthly_trends", dashboard)
        self.assertEqual(len(dashboard["monthly_trends"]), 6)
        self.assertIn("total_revenue", dashboard["kpis"])
        self.assertIn("total_liquid_funds", dashboard["kpis"])

    # ========================================================
    # 10. TENANT ISOLATION TESTS (MANDATORY)
    # ========================================================

    def test_29_tenant_isolation_account_list(self):
        """Verify User B cannot see Company A accounts."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/finance/accounts/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_30_tenant_isolation_journal_entry_list(self):
        """Verify User B cannot see Company A journal entries."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/finance/journal-entries/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_31_tenant_isolation_general_ledger(self):
        """Verify User B cannot see Company A General Ledger."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/finance/general-ledger/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_32_tenant_isolation_trial_balance(self):
        """Verify User B cannot see Company A Trial Balance."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/finance/trial-balance/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_33_tenant_isolation_profit_loss(self):
        """Verify User B cannot see Company A P&L."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/finance/profit-loss/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_34_tenant_isolation_balance_sheet(self):
        """Verify User B cannot see Company A Balance Sheet."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/finance/balance-sheet/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_35_tenant_isolation_dashboard(self):
        """Verify User B cannot see Company A Finance Dashboard."""
        self.client.force_authenticate(user=self.user_b)
        url = f"/api/companies/{self.company_a.id}/finance/dashboard/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_36_cross_company_account_in_journal_rejected(self):
        """Verify posting a journal entry in Company A referencing Company B account is rejected."""
        acc_b = Account.objects.create(
            company=self.company_b,
            account_code="9999",
            account_name="Foreign Account",
            category=Account.CategoryType.EXPENSE,
        )
        lines = [
            {"account": self.bank_acc_a.id, "debit": Decimal("100.00"), "credit": Decimal("0.00")},
            {"account": acc_b.id, "debit": Decimal("0.00"), "credit": Decimal("100.00")},
        ]
        with self.assertRaises(ValidationError) as ctx:
            post_journal_entry(
                company=self.company_a,
                user=self.user_a,
                entry_date=date.today(),
                description="Cross company posting",
                lines_data=lines,
            )
        self.assertIn("does not exist in this company", str(ctx.exception))

    # ========================================================
    # 11. PERMISSIONS & REST API ENDPOINTS
    # ========================================================

    def test_37_unauthenticated_request_rejected(self):
        """Verify unauthenticated requests receive 401 Unauthorized."""
        url = f"/api/companies/{self.company_a.id}/finance/dashboard/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_38_api_create_journal_entry(self):
        """Verify creating journal entry via POST API."""
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/finance/journal-entries/"
        payload = {
            "entry_date": str(date.today()),
            "description": "API Capital injection",
            "lines": [
                {"account": self.bank_acc_a.id, "debit": "750.00", "credit": "0.00", "description": "Bank dr"},
                {"account": self.capital_acc_a.id, "debit": "0.00", "credit": "750.00", "description": "Capital cr"},
            ],
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total_debit"], "750.00")
        self.assertEqual(response.data["total_credit"], "750.00")
        self.assertTrue(response.data["is_balanced"])

    def test_39_api_cancel_journal_entry(self):
        """Verify journal entry cancellation via PATCH API."""
        entry = post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Entry to cancel",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": Decimal("200.00"), "credit": Decimal("0.00")},
                {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("200.00")},
            ],
        )
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/finance/journal-entries/{entry.id}/"
        response = self.client.patch(url, data={"status": "CANCELLED"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "CANCELLED")

    def test_40_posted_journal_deletion_prevented(self):
        """Verify posted journal entry cannot be deleted via DELETE API."""
        entry = post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Immutable posted entry",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": Decimal("300.00"), "credit": Decimal("0.00")},
                {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": Decimal("300.00")},
            ],
        )
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/companies/{self.company_a.id}/finance/journal-entries/{entry.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Posted journal entries cannot be deleted", response.data["detail"])

    # ========================================================
    # 12. DECIMAL ACCURACY & REGRESSION TESTS
    # ========================================================

    def test_41_decimal_precision_preservation(self):
        """Verify high decimal precision without floating point errors."""
        d1 = Decimal("12345.67")
        d2 = Decimal("98765.43")
        total = d1 + d2
        entry = post_journal_entry(
            company=self.company_a,
            user=self.user_a,
            entry_date=date.today(),
            description="Precision test",
            lines_data=[
                {"account": self.bank_acc_a.id, "debit": total, "credit": Decimal("0.00")},
                {"account": self.capital_acc_a.id, "debit": Decimal("0.00"), "credit": d1},
                {"account": self.sales_acc_a.id, "debit": Decimal("0.00"), "credit": d2},
            ],
        )
        self.assertEqual(entry.total_debit, Decimal("111111.10"))
        self.assertEqual(entry.total_credit, Decimal("111111.10"))
        self.assertTrue(entry.is_balanced)

    def test_42_regression_existing_sales_order_flow(self):
        """Verify existing Sales orders, invoices, and payments work with finance hooks."""
        customer = Customer.objects.create(
            company=self.company_a,
            name="Regression Customer",
            email="reg@customer.com",
        )
        inv = Invoice.objects.create(
            company=self.company_a,
            customer=customer,
            invoice_number="INV-REG-01",
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            status=Invoice.InvoiceStatus.ISSUED,
            subtotal=Decimal("400.00"),
            discount=Decimal("0.00"),
            tax=Decimal("0.00"),
            total=Decimal("400.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("400.00"),
        )
        inv.recalculate_totals()
        self.assertEqual(inv.balance_due, Decimal("400.00"))
        self.assertFalse(inv.is_overdue)
