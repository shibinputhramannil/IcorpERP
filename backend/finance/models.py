from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from company.models import Company


def generate_journal_entry_number(company):
    """
    Safely generates a concurrency-safe sequential journal entry number for a company.
    Format: JE-YYYY-XXXXXX (e.g. JE-2026-000001)
    """
    year = timezone.now().year
    prefix = f"JE-{year}-"
    
    # Use database locking if in transaction
    last_entry = (
        JournalEntry.objects.select_for_update()
        .filter(company=company, entry_number__startswith=prefix)
        .order_by("-entry_number")
        .first()
    )
    if last_entry:
        try:
            last_seq = int(last_entry.entry_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = JournalEntry.objects.filter(company=company).count() + 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:06d}"
    while JournalEntry.objects.filter(company=company, entry_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:06d}"

    return candidate


class AccountCategory(models.Model):
    """
    Optional categorization grouping for Chart of Accounts.
    """
    class CategoryType(models.TextChoices):
        ASSET = "ASSET", "Asset"
        LIABILITY = "LIABILITY", "Liability"
        EQUITY = "EQUITY", "Equity"
        REVENUE = "REVENUE", "Revenue"
        EXPENSE = "EXPENSE", "Expense"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="account_categories",
    )
    name = models.CharField(max_length=120)
    category_type = models.CharField(
        max_length=20,
        choices=CategoryType.choices,
    )
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category_type", "name"]
        unique_together = [("company", "name")]
        verbose_name_plural = "Account Categories"

    def __str__(self):
        return f"{self.name} ({self.get_category_type_display()})"


class Account(models.Model):
    """
    Company-scoped Chart of Accounts entity.
    Maintains code, name, category, and running balance properties.
    """
    class CategoryType(models.TextChoices):
        ASSET = "ASSET", "Asset"
        LIABILITY = "LIABILITY", "Liability"
        EQUITY = "EQUITY", "Equity"
        REVENUE = "REVENUE", "Revenue"
        EXPENSE = "EXPENSE", "Expense"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="finance_accounts",
    )
    account_code = models.CharField(max_length=50)
    account_name = models.CharField(max_length=200)
    category = models.CharField(
        max_length=20,
        choices=CategoryType.choices,
    )
    parent_account = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sub_accounts",
    )
    account_category = models.ForeignKey(
        AccountCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="accounts",
    )
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)
    opening_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["account_code"]
        unique_together = [("company", "account_code")]
        verbose_name = "Account"
        verbose_name_plural = "Accounts"

    def __str__(self):
        return f"{self.account_code} - {self.account_name} ({self.category})"

    @property
    def normal_balance_type(self):
        """
        Normal balance is DEBIT for Assets and Expenses; CREDIT for Liabilities, Equity, and Revenue.
        """
        if self.category in [self.CategoryType.ASSET, self.CategoryType.EXPENSE]:
            return "DEBIT"
        return "CREDIT"

    def calculate_balance(self, as_of_date=None):
        """
        Computes the current net balance of this account based on posted journal lines.
        """
        lines = self.journal_lines.filter(journal_entry__status="POSTED")
        if as_of_date:
            lines = lines.filter(journal_entry__entry_date__lte=as_of_date)

        agg = lines.aggregate(
            total_debit=models.Sum("debit"),
            total_credit=models.Sum("credit"),
        )
        total_debit = agg["total_debit"] or Decimal("0.00")
        total_credit = agg["total_credit"] or Decimal("0.00")

        if self.normal_balance_type == "DEBIT":
            return self.opening_balance + total_debit - total_credit
        else:
            return self.opening_balance + total_credit - total_debit


class FiscalPeriod(models.Model):
    """
    Company-scoped Fiscal Period entity.
    Controls financial posting windows (OPEN/CLOSED).
    """
    class PeriodStatus(models.TextChoices):
        OPEN = "OPEN", "Open"
        CLOSED = "CLOSED", "Closed"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="fiscal_periods",
    )
    period_name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=PeriodStatus.choices,
        default=PeriodStatus.OPEN,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        unique_together = [("company", "period_name")]
        verbose_name = "Fiscal Period"
        verbose_name_plural = "Fiscal Periods"

    def __str__(self):
        return f"{self.period_name} ({self.start_date} to {self.end_date}) [{self.status}]"

    def clean(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError("start_date cannot be after end_date.")


class JournalEntry(models.Model):
    """
    Double-entry accounting journal transaction header.
    Must have balanced lines (Total Debits == Total Credits).
    """
    class EntryStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        POSTED = "POSTED", "Posted"
        CANCELLED = "CANCELLED", "Cancelled"

    class ReferenceType(models.TextChoices):
        SALES_INVOICE = "SALES_INVOICE", "Sales Invoice"
        SALES_PAYMENT = "SALES_PAYMENT", "Sales Payment"
        PURCHASE_BILL = "PURCHASE_BILL", "Purchase Bill"
        PURCHASE_PAYMENT = "PURCHASE_PAYMENT", "Purchase Payment"
        CASH_TRANSFER = "CASH_TRANSFER", "Cash / Bank Transfer"
        MANUAL = "MANUAL", "Manual Entry"
        OPENING_BALANCE = "OPENING_BALANCE", "Opening Balance"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="journal_entries",
    )
    entry_number = models.CharField(max_length=64)
    entry_date = models.DateField(default=timezone.localdate)
    description = models.TextField()
    reference_type = models.CharField(
        max_length=50,
        choices=ReferenceType.choices,
        default=ReferenceType.MANUAL,
    )
    reference_id = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=EntryStatus.choices,
        default=EntryStatus.POSTED,
    )
    fiscal_period = models.ForeignKey(
        FiscalPeriod,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="journal_entries",
    )
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_journal_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-entry_date", "-created_at"]
        unique_together = [("company", "entry_number")]
        verbose_name = "Journal Entry"
        verbose_name_plural = "Journal Entries"

    def __str__(self):
        return f"{self.entry_number} [{self.entry_date}] - {self.description[:40]} ({self.status})"

    @property
    def total_debit(self):
        result = self.lines.aggregate(total=models.Sum("debit"))["total"]
        return result or Decimal("0.00")

    @property
    def total_credit(self):
        result = self.lines.aggregate(total=models.Sum("credit"))["total"]
        return result or Decimal("0.00")

    @property
    def is_balanced(self):
        return self.total_debit == self.total_credit


class JournalEntryLine(models.Model):
    """
    Individual debit/credit posting line belonging to a JournalEntry.
    """
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="journal_lines",
    )
    debit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    credit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    description = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["id"]
        verbose_name = "Journal Entry Line"
        verbose_name_plural = "Journal Entry Lines"

    def __str__(self):
        return f"{self.journal_entry.entry_number} - {self.account.account_code}: DR {self.debit} | CR {self.credit}"

    def clean(self):
        if self.debit < Decimal("0.00"):
            raise ValidationError("Debit amount cannot be negative.")
        if self.credit < Decimal("0.00"):
            raise ValidationError("Credit amount cannot be negative.")
        if self.debit > Decimal("0.00") and self.credit > Decimal("0.00"):
            raise ValidationError("A journal line cannot contain both a debit and a credit amount.")
        if self.debit == Decimal("0.00") and self.credit == Decimal("0.00"):
            raise ValidationError("A journal line must specify either a debit or a credit amount.")


class BankAccount(models.Model):
    """
    Company Bank Account linked to a Chart of Accounts asset account.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="bank_accounts",
    )
    account = models.OneToOneField(
        Account,
        on_delete=models.PROTECT,
        related_name="bank_detail",
    )
    bank_name = models.CharField(max_length=150)
    account_name = models.CharField(max_length=150, blank=True, default="")
    account_number = models.CharField(max_length=100)
    branch_name = models.CharField(max_length=150, blank=True, default="")
    swift_or_ifsc = models.CharField(max_length=50, blank=True, default="")
    currency = models.CharField(max_length=10, default="USD")
    opening_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["bank_name", "account_number"]
        unique_together = [("company", "account_number")]
        verbose_name = "Bank Account"
        verbose_name_plural = "Bank Accounts"

    def __str__(self):
        return f"{self.bank_name} - {self.account_number} ({self.company.name})"

    @property
    def current_balance(self):
        return self.account.calculate_balance()


class CashAccount(models.Model):
    """
    Company Cash register / Petty cash account linked to a Chart of Accounts asset account.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="cash_accounts",
    )
    account = models.OneToOneField(
        Account,
        on_delete=models.PROTECT,
        related_name="cash_detail",
    )
    account_name = models.CharField(max_length=150)
    opening_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["account_name"]
        unique_together = [("company", "account_name")]
        verbose_name = "Cash Account"
        verbose_name_plural = "Cash Accounts"

    def __str__(self):
        return f"{self.account_name} ({self.company.name})"

    @property
    def current_balance(self):
        return self.account.calculate_balance()
