from decimal import Decimal
from datetime import date
from django.db import models, transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
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


# ============================================================
# 1. DEFAULT ACCOUNTS INITIALIZATION
# ============================================================

DEFAULT_ACCOUNTS = [
    # Assets
    {
        "code": "1010",
        "name": "Cash on Hand",
        "category": Account.CategoryType.ASSET,
        "description": "Physical petty cash and register balances",
        "is_system": True,
    },
    {
        "code": "1020",
        "name": "Operating Bank Account",
        "category": Account.CategoryType.ASSET,
        "description": "Primary corporate operating checking account",
        "is_system": True,
    },
    {
        "code": "1100",
        "name": "Accounts Receivable (A/R)",
        "category": Account.CategoryType.ASSET,
        "description": "Monies owed by customers for invoiced goods and services",
        "is_system": True,
    },
    {
        "code": "1200",
        "name": "Inventory Asset",
        "category": Account.CategoryType.ASSET,
        "description": "Carrying value of raw materials and finished goods inventory",
        "is_system": True,
    },
    # Liabilities
    {
        "code": "2000",
        "name": "Accounts Payable (A/P)",
        "category": Account.CategoryType.LIABILITY,
        "description": "Short-term obligations owed to suppliers and vendors",
        "is_system": True,
    },
    {
        "code": "2100",
        "name": "Sales Tax Payable",
        "category": Account.CategoryType.LIABILITY,
        "description": "Sales taxes collected from customers awaiting remittance",
        "is_system": True,
    },
    # Equity
    {
        "code": "3000",
        "name": "Owner / Share Capital",
        "category": Account.CategoryType.EQUITY,
        "description": "Contributed capital invested in the enterprise",
        "is_system": True,
    },
    {
        "code": "3100",
        "name": "Retained Earnings",
        "category": Account.CategoryType.EQUITY,
        "description": "Accumulated net income retained within the company",
        "is_system": True,
    },
    # Revenue
    {
        "code": "4000",
        "name": "Sales Revenue",
        "category": Account.CategoryType.REVENUE,
        "description": "Gross earnings realized from the sale of goods and services",
        "is_system": True,
    },
    {
        "code": "4100",
        "name": "Other Operating Income",
        "category": Account.CategoryType.REVENUE,
        "description": "Incidental revenues such as shipping fees or commissions",
        "is_system": False,
    },
    # Expenses
    {
        "code": "5000",
        "name": "Cost of Goods Sold (COGS)",
        "category": Account.CategoryType.EXPENSE,
        "description": "Direct material and acquisition costs of fulfilled orders",
        "is_system": True,
    },
    {
        "code": "6000",
        "name": "Operating Expenses",
        "category": Account.CategoryType.EXPENSE,
        "description": "General and administrative operating expenditures",
        "is_system": True,
    },
    {
        "code": "6100",
        "name": "Salaries & Wages Expense",
        "category": Account.CategoryType.EXPENSE,
        "description": "Employee payroll compensation and related benefits",
        "is_system": False,
    },
    {
        "code": "6200",
        "name": "Rent & Utilities Expense",
        "category": Account.CategoryType.EXPENSE,
        "description": "Office and warehouse space leases, electricity, and water",
        "is_system": False,
    },
]


def ensure_default_accounts(company):
    """
    Safely seeds standard Chart of Accounts for a company if not already created.
    Guarantees idempotency and prevents duplicates.
    """
    created_accounts = []
    with transaction.atomic():
        for def_acc in DEFAULT_ACCOUNTS:
            acc, created = Account.objects.get_or_create(
                company=company,
                account_code=def_acc["code"],
                defaults={
                    "account_name": def_acc["name"],
                    "category": def_acc["category"],
                    "description": def_acc["description"],
                    "is_system": def_acc["is_system"],
                    "is_active": True,
                    "opening_balance": Decimal("0.00"),
                },
            )
            if created:
                created_accounts.append(acc)

        # Ensure default Cash Account is registered
        cash_acc = Account.objects.filter(company=company, account_code="1010").first()
        if cash_acc and not hasattr(cash_acc, "cash_detail"):
            CashAccount.objects.get_or_create(
                company=company,
                account=cash_acc,
                defaults={
                    "account_name": "Main Office Petty Cash",
                    "opening_balance": Decimal("0.00"),
                },
            )

        # Ensure default Bank Account is registered
        bank_acc = Account.objects.filter(company=company, account_code="1020").first()
        if bank_acc and not hasattr(bank_acc, "bank_detail"):
            BankAccount.objects.get_or_create(
                company=company,
                account=bank_acc,
                defaults={
                    "bank_name": "Standard Chartered Operating",
                    "account_name": "Primary Operating",
                    "account_number": "ACC-00102099",
                    "currency": "USD",
                    "opening_balance": Decimal("0.00"),
                },
            )

    return created_accounts


# ============================================================
# 2. DOUBLE-ENTRY JOURNAL ENTRY POSTING
# ============================================================

def post_journal_entry(
    company,
    user,
    entry_date,
    description,
    lines_data,
    reference_type=JournalEntry.ReferenceType.MANUAL,
    reference_id="",
    status=JournalEntry.EntryStatus.POSTED,
):
    """
    Validates double-entry accounting rules and atomically posts a Journal Entry.
    Rules enforced:
    1. At least 2 lines required.
    2. debit >= 0 and credit >= 0 for all lines.
    3. Line cannot contain both debit > 0 and credit > 0.
    4. Line cannot have both debit == 0 and credit == 0.
    5. sum(debit) == sum(credit) (Balanced entry).
    6. Cannot post into a CLOSED fiscal period.
    7. All accounts must belong strictly to the company.
    8. Concurrency-safe sequential numbering.
    """
    if isinstance(entry_date, str):
        entry_date = date.fromisoformat(entry_date)

    if not lines_data or len(lines_data) < 2:
        raise ValidationError("A journal entry must contain at least two line items.")

    # 1. Closed Fiscal Period Protection
    closed_period = FiscalPeriod.objects.filter(
        company=company,
        start_date__lte=entry_date,
        end_date__gte=entry_date,
        status=FiscalPeriod.PeriodStatus.CLOSED,
    ).first()
    if closed_period:
        raise ValidationError(
            f"Cannot post journal entry: Fiscal period '{closed_period.period_name}' "
            f"({closed_period.start_date} to {closed_period.end_date}) is CLOSED."
        )

    # Find matching active fiscal period if one exists
    active_period = FiscalPeriod.objects.filter(
        company=company,
        start_date__lte=entry_date,
        end_date__gte=entry_date,
        status=FiscalPeriod.PeriodStatus.OPEN,
    ).first()

    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")
    validated_lines = []

    for idx, line in enumerate(lines_data):
        account_val = line.get("account") or line.get("account_id")
        if not account_val:
            raise ValidationError(f"Line {idx + 1}: Account is required.")

        if isinstance(account_val, Account):
            account = account_val
            if account.company_id != company.id:
                raise ValidationError(f"Line {idx + 1}: Account ID {account.id} does not exist in this company.")
        else:
            try:
                account = Account.objects.get(id=account_val, company=company)
            except Account.DoesNotExist:
                raise ValidationError(f"Line {idx + 1}: Account ID {account_val} does not exist in this company.")

        debit = Decimal(str(line.get("debit") or "0.00"))
        credit = Decimal(str(line.get("credit") or "0.00"))

        if debit < Decimal("0.00") or credit < Decimal("0.00"):
            raise ValidationError(f"Line {idx + 1}: Amounts cannot be negative.")

        if debit > Decimal("0.00") and credit > Decimal("0.00"):
            raise ValidationError(f"Line {idx + 1}: Line cannot specify both debit and credit amounts.")

        if debit == Decimal("0.00") and credit == Decimal("0.00"):
            raise ValidationError(f"Line {idx + 1}: Line must specify either a debit or credit amount.")

        total_debit += debit
        total_credit += credit
        validated_lines.append({
            "account": account,
            "debit": debit,
            "credit": credit,
            "description": line.get("description", "") or "",
        })

    # Balance Verification
    if total_debit != total_credit:
        raise ValidationError(
            f"Unbalanced journal entry rejected. Total debits (${total_debit:.2f}) "
            f"must strictly equal total credits (${total_credit:.2f}). Difference: ${abs(total_debit - total_credit):.2f}"
        )

    with transaction.atomic():
        entry_number = generate_journal_entry_number(company)
        entry = JournalEntry.objects.create(
            company=company,
            entry_number=entry_number,
            entry_date=entry_date,
            description=description,
            reference_type=reference_type,
            reference_id=str(reference_id or ""),
            status=status,
            fiscal_period=active_period,
            created_by=user if user and getattr(user, "is_authenticated", True) else None,
        )

        for line_item in validated_lines:
            JournalEntryLine.objects.create(
                journal_entry=entry,
                account=line_item["account"],
                debit=line_item["debit"],
                credit=line_item["credit"],
                description=line_item["description"],
            )

    return entry


# ============================================================
# 3. GENERAL LEDGER SERVICE
# ============================================================

def get_general_ledger(company, account_id=None, date_from=None, date_to=None, reference_type=None):
    """
    Computes company-scoped General Ledger with running balance line by line.
    """
    accounts = Account.objects.filter(company=company, is_active=True)
    if account_id:
        accounts = accounts.filter(id=account_id)

    ledger_reports = []

    for account in accounts:
        # 1. Opening balance calculation (before date_from)
        opening = account.opening_balance
        if date_from:
            prior_lines = JournalEntryLine.objects.filter(
                account=account,
                journal_entry__status="POSTED",
                journal_entry__entry_date__lt=date_from,
            ).aggregate(dr=models.Sum("debit"), cr=models.Sum("credit"))
            prior_dr = prior_lines["dr"] or Decimal("0.00")
            prior_cr = prior_lines["cr"] or Decimal("0.00")

            if account.normal_balance_type == "DEBIT":
                opening = opening + prior_dr - prior_cr
            else:
                opening = opening + prior_cr - prior_dr

        # 2. Filter lines in window
        lines_qs = JournalEntryLine.objects.filter(
            account=account,
            journal_entry__status="POSTED",
        ).select_related("journal_entry")

        if date_from:
            lines_qs = lines_qs.filter(journal_entry__entry_date__gte=date_from)
        if date_to:
            lines_qs = lines_qs.filter(journal_entry__entry_date__lte=date_to)
        if reference_type:
            lines_qs = lines_qs.filter(journal_entry__reference_type=reference_type)

        lines_qs = lines_qs.order_by("journal_entry__entry_date", "journal_entry__created_at", "id")

        # 3. Calculate running balances
        current_balance = opening
        transactions_data = []
        period_debit = Decimal("0.00")
        period_credit = Decimal("0.00")

        for line in lines_qs:
            dr = line.debit
            cr = line.credit
            period_debit += dr
            period_credit += cr

            if account.normal_balance_type == "DEBIT":
                current_balance = current_balance + dr - cr
            else:
                current_balance = current_balance + cr - dr

            transactions_data.append({
                "line_id": line.id,
                "entry_id": line.journal_entry.id,
                "entry_number": line.journal_entry.entry_number,
                "entry_date": line.journal_entry.entry_date,
                "description": line.description or line.journal_entry.description,
                "reference_type": line.journal_entry.reference_type,
                "reference_id": line.journal_entry.reference_id,
                "debit": dr,
                "credit": cr,
                "running_balance": current_balance,
            })

        ledger_reports.append({
            "account_id": account.id,
            "account_code": account.account_code,
            "account_name": account.account_name,
            "category": account.category,
            "normal_balance_type": account.normal_balance_type,
            "opening_balance": opening,
            "total_debit": period_debit,
            "total_credit": period_credit,
            "closing_balance": current_balance,
            "transactions": transactions_data,
        })

    return ledger_reports


# ============================================================
# 4. TRIAL BALANCE SERVICE
# ============================================================

def get_trial_balance(company, as_of_date=None):
    """
    Computes company-scoped Trial Balance. Proves Total Debits == Total Credits.
    """
    accounts = Account.objects.filter(company=company, is_active=True).order_by("account_code")
    lines_report = []
    total_debits = Decimal("0.00")
    total_credits = Decimal("0.00")

    for acc in accounts:
        lines_qs = JournalEntryLine.objects.filter(
            account=acc,
            journal_entry__status="POSTED",
        )
        if as_of_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__lte=as_of_date)

        agg = lines_qs.aggregate(dr=models.Sum("debit"), cr=models.Sum("credit"))
        dr = agg["dr"] or Decimal("0.00")
        cr = agg["cr"] or Decimal("0.00")

        # Account Net Balance
        if acc.normal_balance_type == "DEBIT":
            net = acc.opening_balance + dr - cr
            debit_balance = net if net >= Decimal("0.00") else Decimal("0.00")
            credit_balance = abs(net) if net < Decimal("0.00") else Decimal("0.00")
        else:
            net = acc.opening_balance + cr - dr
            credit_balance = net if net >= Decimal("0.00") else Decimal("0.00")
            debit_balance = abs(net) if net < Decimal("0.00") else Decimal("0.00")

        total_debits += debit_balance
        total_credits += credit_balance

        lines_report.append({
            "account_id": acc.id,
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "category": acc.category,
            "normal_balance_type": acc.normal_balance_type,
            "total_debit_activity": dr,
            "total_credit_activity": cr,
            "debit_balance": debit_balance,
            "credit_balance": credit_balance,
            "net_balance": net,
        })

    is_balanced = total_debits == total_credits
    difference = abs(total_debits - total_credits)

    return {
        "as_of_date": as_of_date or timezone.localdate(),
        "is_balanced": is_balanced,
        "difference": difference,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "accounts": lines_report,
    }


# ============================================================
# 5. PROFIT & LOSS (P&L) STATEMENT
# ============================================================

def get_profit_and_loss(company, date_from=None, date_to=None):
    """
    Computes company-scoped P&L from posted double-entry journal items.
    Revenue - Cost of Goods Sold = Gross Profit
    Gross Profit - Operating Expenses = Net Profit
    """
    lines_qs = JournalEntryLine.objects.filter(
        account__company=company,
        journal_entry__status="POSTED",
    )
    if date_from:
        lines_qs = lines_qs.filter(journal_entry__entry_date__gte=date_from)
    if date_to:
        lines_qs = lines_qs.filter(journal_entry__entry_date__lte=date_to)

    # 1. Revenue accounts
    revenue_accounts = Account.objects.filter(
        company=company,
        category=Account.CategoryType.REVENUE,
        is_active=True,
    ).order_by("account_code")

    revenue_items = []
    total_revenue = Decimal("0.00")
    for acc in revenue_accounts:
        acc_lines = lines_qs.filter(account=acc).aggregate(dr=models.Sum("debit"), cr=models.Sum("credit"))
        dr = acc_lines["dr"] or Decimal("0.00")
        cr = acc_lines["cr"] or Decimal("0.00")
        net = acc.opening_balance + cr - dr
        total_revenue += net
        revenue_items.append({
            "account_id": acc.id,
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "amount": net,
        })

    # 2. Cost of Goods Sold (COGS)
    cogs_accounts = Account.objects.filter(
        company=company,
        category=Account.CategoryType.EXPENSE,
        account_code__startswith="5",
        is_active=True,
    ).order_by("account_code")

    cogs_items = []
    total_cogs = Decimal("0.00")
    for acc in cogs_accounts:
        acc_lines = lines_qs.filter(account=acc).aggregate(dr=models.Sum("debit"), cr=models.Sum("credit"))
        dr = acc_lines["dr"] or Decimal("0.00")
        cr = acc_lines["cr"] or Decimal("0.00")
        net = acc.opening_balance + dr - cr
        total_cogs += net
        cogs_items.append({
            "account_id": acc.id,
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "amount": net,
        })

    gross_profit = total_revenue - total_cogs

    # 3. Operating and other Expenses
    operating_accounts = Account.objects.filter(
        company=company,
        category=Account.CategoryType.EXPENSE,
        is_active=True,
    ).exclude(account_code__startswith="5").order_by("account_code")

    operating_items = []
    total_operating_expenses = Decimal("0.00")
    for acc in operating_accounts:
        acc_lines = lines_qs.filter(account=acc).aggregate(dr=models.Sum("debit"), cr=models.Sum("credit"))
        dr = acc_lines["dr"] or Decimal("0.00")
        cr = acc_lines["cr"] or Decimal("0.00")
        net = acc.opening_balance + dr - cr
        total_operating_expenses += net
        operating_items.append({
            "account_id": acc.id,
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "amount": net,
        })

    total_expenses = total_cogs + total_operating_expenses
    net_profit = gross_profit - total_operating_expenses

    return {
        "date_from": date_from,
        "date_to": date_to or timezone.localdate(),
        "revenue": {
            "items": revenue_items,
            "total": total_revenue,
        },
        "cost_of_goods_sold": {
            "items": cogs_items,
            "total": total_cogs,
        },
        "gross_profit": gross_profit,
        "operating_expenses": {
            "items": operating_items,
            "total": total_operating_expenses,
        },
        "total_expenses": total_expenses,
        "net_profit": net_profit,
    }


# ============================================================
# 6. BALANCE SHEET STATEMENT
# ============================================================

def get_balance_sheet(company, as_of_date=None):
    """
    Computes company-scoped Balance Sheet.
    Assets = Liabilities + Equity
    Net profit up to as_of_date dynamically flows into Equity (Current Period Retained Earnings).
    """
    if as_of_date is None:
        as_of_date = timezone.localdate()

    accounts = Account.objects.filter(company=company, is_active=True).order_by("account_code")

    asset_items = []
    total_assets = Decimal("0.00")

    liability_items = []
    total_liabilities = Decimal("0.00")

    equity_items = []
    total_equity_direct = Decimal("0.00")

    for acc in accounts:
        balance = acc.calculate_balance(as_of_date=as_of_date)
        if acc.category == Account.CategoryType.ASSET:
            total_assets += balance
            asset_items.append({
                "account_id": acc.id,
                "account_code": acc.account_code,
                "account_name": acc.account_name,
                "balance": balance,
            })
        elif acc.category == Account.CategoryType.LIABILITY:
            total_liabilities += balance
            liability_items.append({
                "account_id": acc.id,
                "account_code": acc.account_code,
                "account_name": acc.account_name,
                "balance": balance,
            })
        elif acc.category == Account.CategoryType.EQUITY:
            total_equity_direct += balance
            equity_items.append({
                "account_id": acc.id,
                "account_code": acc.account_code,
                "account_name": acc.account_name,
                "balance": balance,
            })

    # Net Income up to as_of_date flows into Equity
    pnl = get_profit_and_loss(company, date_from=None, date_to=as_of_date)
    current_net_income = pnl["net_profit"]

    total_equity = total_equity_direct + current_net_income
    total_liabilities_and_equity = total_liabilities + total_equity
    difference = total_assets - total_liabilities_and_equity
    is_balanced = difference == Decimal("0.00")

    return {
        "as_of_date": as_of_date,
        "is_balanced": is_balanced,
        "difference": difference,
        "assets": {
            "items": asset_items,
            "total": total_assets,
        },
        "liabilities": {
            "items": liability_items,
            "total": total_liabilities,
        },
        "equity": {
            "items": equity_items,
            "current_period_earnings": current_net_income,
            "total": total_equity,
        },
        "total_liabilities_and_equity": total_liabilities_and_equity,
    }


# ============================================================
# 7. ACCOUNTS RECEIVABLE & PAYABLE SUMMARIES
# ============================================================

def get_accounts_receivable_summary(company):
    """
    Integrates existing Sales Invoices and Payments for company-scoped AR metrics.
    """
    from sales.models import Invoice

    invoices = Invoice.objects.filter(
        company=company,
    ).exclude(status__in=[Invoice.InvoiceStatus.DRAFT, Invoice.InvoiceStatus.CANCELLED])

    total_invoiced = invoices.aggregate(t=models.Sum("total"))["t"] or Decimal("0.00")
    total_paid = invoices.aggregate(t=models.Sum("amount_paid"))["t"] or Decimal("0.00")
    total_outstanding = invoices.aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")

    today = timezone.localdate()
    overdue_invoices = invoices.filter(due_date__lt=today, balance_due__gt=Decimal("0.00"))
    total_overdue = overdue_invoices.aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")

    # Customer breakdown
    from crm.models import Customer
    customers = Customer.objects.filter(company=company, is_active=True).order_by("name")
    customer_breakdown = []

    for cust in customers:
        cust_invs = invoices.filter(customer=cust)
        if cust_invs.exists():
            c_invoiced = cust_invs.aggregate(t=models.Sum("total"))["t"] or Decimal("0.00")
            c_paid = cust_invs.aggregate(t=models.Sum("amount_paid"))["t"] or Decimal("0.00")
            c_due = cust_invs.aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")
            c_overdue = cust_invs.filter(due_date__lt=today).aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")

            customer_breakdown.append({
                "customer_id": cust.id,
                "customer_name": cust.name,
                "email": cust.email,
                "phone": cust.phone,
                "invoice_count": cust_invs.count(),
                "total_invoiced": c_invoiced,
                "total_paid": c_paid,
                "balance_due": c_due,
                "overdue_amount": c_overdue,
            })

    return {
        "total_receivables": total_invoiced,
        "total_paid": total_paid,
        "total_outstanding": total_outstanding,
        "total_overdue": total_overdue,
        "invoices_count": invoices.count(),
        "customer_breakdown": customer_breakdown,
    }


def get_accounts_payable_summary(company):
    """
    Integrates existing Purchase Invoices and Payments for company-scoped AP metrics.
    """
    from purchase.models import PurchaseInvoice

    bills = PurchaseInvoice.objects.filter(
        company=company,
    ).exclude(status__in=[PurchaseInvoice.InvoiceStatus.DRAFT, PurchaseInvoice.InvoiceStatus.CANCELLED])

    total_billed = bills.aggregate(t=models.Sum("total"))["t"] or Decimal("0.00")
    total_paid = bills.aggregate(t=models.Sum("amount_paid"))["t"] or Decimal("0.00")
    total_outstanding = bills.aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")

    today = timezone.localdate()
    overdue_bills = bills.filter(due_date__lt=today, balance_due__gt=Decimal("0.00"))
    total_overdue = overdue_bills.aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")

    # Vendor breakdown
    from inventory.models import Vendor
    vendors = Vendor.objects.filter(company=company, is_active=True).order_by("name")
    vendor_breakdown = []

    for vend in vendors:
        v_bills = bills.filter(vendor=vend)
        if v_bills.exists():
            v_billed = v_bills.aggregate(t=models.Sum("total"))["t"] or Decimal("0.00")
            v_paid = v_bills.aggregate(t=models.Sum("amount_paid"))["t"] or Decimal("0.00")
            v_due = v_bills.aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")
            v_overdue = v_bills.filter(due_date__lt=today).aggregate(t=models.Sum("balance_due"))["t"] or Decimal("0.00")

            vendor_breakdown.append({
                "vendor_id": vend.id,
                "vendor_name": vend.name,
                "email": vend.email,
                "phone": vend.phone,
                "bills_count": v_bills.count(),
                "total_billed": v_billed,
                "total_paid": v_paid,
                "balance_due": v_due,
                "overdue_amount": v_overdue,
            })

    return {
        "total_payables": total_billed,
        "total_paid": total_paid,
        "total_outstanding": total_outstanding,
        "total_overdue": total_overdue,
        "bills_count": bills.count(),
        "vendor_breakdown": vendor_breakdown,
    }


# ============================================================
# 8. FINANCE DASHBOARD AGGREGATOR
# ============================================================

def get_finance_dashboard(company):
    """
    Returns real database-backed KPIs for the company Finance Dashboard.
    """
    # 1. P&L Metrics
    pnl = get_profit_and_loss(company)
    total_revenue = pnl["revenue"]["total"]
    total_expenses = pnl["total_expenses"]
    net_profit = pnl["net_profit"]

    # 2. Receivables & Payables
    ar = get_accounts_receivable_summary(company)
    ap = get_accounts_payable_summary(company)

    # 3. Cash & Bank Balances
    cash_accounts = CashAccount.objects.filter(company=company, is_active=True)
    total_cash = sum((c.current_balance for c in cash_accounts), Decimal("0.00"))

    bank_accounts = BankAccount.objects.filter(company=company, is_active=True)
    total_bank = sum((b.current_balance for b in bank_accounts), Decimal("0.00"))

    # 4. Inventory Valuation
    from inventory.models import Stock
    stocks = Stock.objects.filter(product__company=company).select_related("product")
    total_inventory_value = sum((s.quantity * s.product.cost_price for s in stocks), Decimal("0.00"))

    # 5. Monthly Revenue vs Expense (past 6 months)
    monthly_trends = []
    current_year = timezone.now().year
    current_month = timezone.now().month

    for offset in range(5, -1, -1):
        m = current_month - offset
        y = current_year
        while m <= 0:
            m += 12
            y -= 1

        import calendar
        _, last_day = calendar.monthrange(y, m)
        m_start = date(y, m, 1)
        m_end = date(y, m, last_day)

        m_pnl = get_profit_and_loss(company, date_from=m_start, date_to=m_end)
        monthly_trends.append({
            "month": m_start.strftime("%b %Y"),
            "revenue": float(m_pnl["revenue"]["total"]),
            "expenses": float(m_pnl["total_expenses"]),
            "net_profit": float(m_pnl["net_profit"]),
        })

    return {
        "kpis": {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
            "accounts_receivable": ar["total_outstanding"],
            "accounts_payable": ap["total_outstanding"],
            "cash_balance": total_cash,
            "bank_balance": total_bank,
            "total_liquid_funds": total_cash + total_bank,
            "inventory_valuation": total_inventory_value,
        },
        "monthly_trends": monthly_trends,
        "receivables_summary": {
            "total": ar["total_receivables"],
            "paid": ar["total_paid"],
            "outstanding": ar["total_outstanding"],
            "overdue": ar["total_overdue"],
        },
        "payables_summary": {
            "total": ap["total_payables"],
            "paid": ap["total_paid"],
            "outstanding": ap["total_outstanding"],
            "overdue": ap["total_overdue"],
        },
    }


# ============================================================
# 9. SALES & PURCHASE AUTOMATED JOURNAL SYNC
# ============================================================

def sync_sales_invoice_to_journal(invoice, user=None):
    """
    Creates double-entry journal entry for a Sales Invoice:
    DR: Accounts Receivable (1100) = invoice.total
    CR: Sales Revenue (4000) = invoice.total - invoice.tax
    CR: Tax Payable (2100) = invoice.tax (if > 0)
    """
    if invoice.status in ["DRAFT", "CANCELLED"]:
        return None

    company = invoice.company
    ensure_default_accounts(company)

    # Check if already synced
    existing = JournalEntry.objects.filter(
        company=company,
        reference_type=JournalEntry.ReferenceType.SALES_INVOICE,
        reference_id=invoice.invoice_number,
    ).first()
    if existing:
        return existing

    ar_account = Account.objects.filter(company=company, account_code="1100").first()
    sales_account = Account.objects.filter(company=company, account_code="4000").first()
    tax_account = Account.objects.filter(company=company, account_code="2100").first()

    if not ar_account or not sales_account:
        return None

    revenue_amount = invoice.total - invoice.tax
    lines = [
        {
            "account": ar_account,
            "debit": invoice.total,
            "credit": Decimal("0.00"),
            "description": f"Invoice {invoice.invoice_number} - {invoice.customer.name}",
        },
        {
            "account": sales_account,
            "debit": Decimal("0.00"),
            "credit": revenue_amount,
            "description": f"Revenue from {invoice.invoice_number}",
        },
    ]

    if invoice.tax > Decimal("0.00") and tax_account:
        lines.append({
            "account": tax_account,
            "debit": Decimal("0.00"),
            "credit": invoice.tax,
            "description": f"Sales Tax on {invoice.invoice_number}",
        })

    return post_journal_entry(
        company=company,
        user=user,
        entry_date=invoice.invoice_date,
        description=f"Sales Invoice {invoice.invoice_number} ({invoice.customer.name})",
        lines_data=lines,
        reference_type=JournalEntry.ReferenceType.SALES_INVOICE,
        reference_id=invoice.invoice_number,
    )


def sync_sales_payment_to_journal(payment, user=None):
    """
    Creates double-entry journal entry for a Customer Payment:
    DR: Cash on Hand (1010) or Bank Account (1020) = payment.amount
    CR: Accounts Receivable (1100) = payment.amount
    """
    company = payment.company
    ensure_default_accounts(company)

    existing = JournalEntry.objects.filter(
        company=company,
        reference_type=JournalEntry.ReferenceType.SALES_PAYMENT,
        reference_id=payment.payment_number,
    ).first()
    if existing:
        return existing

    ar_account = Account.objects.filter(company=company, account_code="1100").first()
    if payment.payment_method == "CASH":
        receipt_account = Account.objects.filter(company=company, account_code="1010").first()
    else:
        receipt_account = Account.objects.filter(company=company, account_code="1020").first()

    if not ar_account or not receipt_account:
        return None

    lines = [
        {
            "account": receipt_account,
            "debit": payment.amount,
            "credit": Decimal("0.00"),
            "description": f"Payment {payment.payment_number} for {payment.invoice.invoice_number}",
        },
        {
            "account": ar_account,
            "debit": Decimal("0.00"),
            "credit": payment.amount,
            "description": f"Clear A/R for {payment.customer.name}",
        },
    ]

    return post_journal_entry(
        company=company,
        user=user,
        entry_date=payment.payment_date,
        description=f"Sales Payment {payment.payment_number} ({payment.customer.name})",
        lines_data=lines,
        reference_type=JournalEntry.ReferenceType.SALES_PAYMENT,
        reference_id=payment.payment_number,
    )


def sync_purchase_invoice_to_journal(purchase_invoice, user=None):
    """
    Creates double-entry journal entry for a Purchase Vendor Bill:
    DR: Cost of Goods Sold (5000) or Inventory = purchase_invoice.total
    CR: Accounts Payable (2000) = purchase_invoice.total
    """
    if purchase_invoice.status in ["DRAFT", "CANCELLED"]:
        return None

    company = purchase_invoice.company
    ensure_default_accounts(company)

    existing = JournalEntry.objects.filter(
        company=company,
        reference_type=JournalEntry.ReferenceType.PURCHASE_BILL,
        reference_id=purchase_invoice.invoice_number,
    ).first()
    if existing:
        return existing

    ap_account = Account.objects.filter(company=company, account_code="2000").first()
    cogs_account = Account.objects.filter(company=company, account_code="5000").first()

    if not ap_account or not cogs_account:
        return None

    lines = [
        {
            "account": cogs_account,
            "debit": purchase_invoice.total,
            "credit": Decimal("0.00"),
            "description": f"Goods purchase on Bill {purchase_invoice.invoice_number}",
        },
        {
            "account": ap_account,
            "debit": Decimal("0.00"),
            "credit": purchase_invoice.total,
            "description": f"A/P for Vendor {purchase_invoice.vendor.name}",
        },
    ]

    return post_journal_entry(
        company=company,
        user=user,
        entry_date=purchase_invoice.invoice_date,
        description=f"Purchase Bill {purchase_invoice.invoice_number} ({purchase_invoice.vendor.name})",
        lines_data=lines,
        reference_type=JournalEntry.ReferenceType.PURCHASE_BILL,
        reference_id=purchase_invoice.invoice_number,
    )


def sync_purchase_payment_to_journal(purchase_payment, user=None):
    """
    Creates double-entry journal entry for a Vendor Payment:
    DR: Accounts Payable (2000) = purchase_payment.amount
    CR: Bank (1020) or Cash (1010) = purchase_payment.amount
    """
    company = purchase_payment.company
    ensure_default_accounts(company)

    existing = JournalEntry.objects.filter(
        company=company,
        reference_type=JournalEntry.ReferenceType.PURCHASE_PAYMENT,
        reference_id=purchase_payment.payment_number,
    ).first()
    if existing:
        return existing

    ap_account = Account.objects.filter(company=company, account_code="2000").first()
    if purchase_payment.payment_method == "CASH":
        disburse_account = Account.objects.filter(company=company, account_code="1010").first()
    else:
        disburse_account = Account.objects.filter(company=company, account_code="1020").first()

    if not ap_account or not disburse_account:
        return None

    lines = [
        {
            "account": ap_account,
            "debit": purchase_payment.amount,
            "credit": Decimal("0.00"),
            "description": f"Clear A/P for {purchase_payment.vendor.name}",
        },
        {
            "account": disburse_account,
            "debit": Decimal("0.00"),
            "credit": purchase_payment.amount,
            "description": f"Disburse payment {purchase_payment.payment_number}",
        },
    ]

    return post_journal_entry(
        company=company,
        user=user,
        entry_date=purchase_payment.payment_date,
        description=f"Vendor Payment {purchase_payment.payment_number} ({purchase_payment.vendor.name})",
        lines_data=lines,
        reference_type=JournalEntry.ReferenceType.PURCHASE_PAYMENT,
        reference_id=purchase_payment.payment_number,
    )


def sync_all_financial_records(company, user=None):
    """
    Backfills and synchronizes all existing Sales and Purchase invoices and payments
    into double-entry journal entries for the specified company.
    """
    ensure_default_accounts(company)
    synced_counts = {"sales_invoices": 0, "sales_payments": 0, "purchase_bills": 0, "purchase_payments": 0}

    # 1. Sales Invoices
    from sales.models import Invoice, Payment
    for inv in Invoice.objects.filter(company=company).exclude(status__in=["DRAFT", "CANCELLED"]):
        if sync_sales_invoice_to_journal(inv, user=user):
            synced_counts["sales_invoices"] += 1

    # 2. Sales Payments
    for pay in Payment.objects.filter(company=company):
        if sync_sales_payment_to_journal(pay, user=user):
            synced_counts["sales_payments"] += 1

    # 3. Purchase Invoices
    from purchase.models import PurchaseInvoice, PurchasePayment
    for bill in PurchaseInvoice.objects.filter(company=company).exclude(status__in=["DRAFT", "CANCELLED"]):
        if sync_purchase_invoice_to_journal(bill, user=user):
            synced_counts["purchase_bills"] += 1

    # 4. Purchase Payments
    for ppay in PurchasePayment.objects.filter(company=company):
        if sync_purchase_payment_to_journal(ppay, user=user):
            synced_counts["purchase_payments"] += 1

    return synced_counts
