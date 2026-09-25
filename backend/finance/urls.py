from django.urls import path
from finance.views import (
    FinanceDashboardView,
    AccountListCreateView,
    AccountDetailView,
    DefaultAccountsCreateView,
    FiscalPeriodListCreateView,
    FiscalPeriodDetailView,
    JournalEntryListCreateView,
    JournalEntryDetailView,
    GeneralLedgerView,
    TrialBalanceView,
    ProfitLossView,
    BalanceSheetView,
    AccountsReceivableView,
    AccountsPayableView,
    BankAccountListCreateView,
    BankAccountDetailView,
    CashAccountListCreateView,
    CashAccountDetailView,
    FinancialSyncView,
)

app_name = "finance"

urlpatterns = [
    # Dashboard
    path("dashboard/", FinanceDashboardView.as_view(), name="finance_dashboard"),

    # Chart of Accounts
    path("accounts/", AccountListCreateView.as_view(), name="account_list_create"),
    path("accounts/<int:pk>/", AccountDetailView.as_view(), name="account_detail"),
    path("default-accounts/", DefaultAccountsCreateView.as_view(), name="default_accounts_create"),

    # Fiscal Periods
    path("fiscal-periods/", FiscalPeriodListCreateView.as_view(), name="fiscal_period_list_create"),
    path("fiscal-periods/<int:pk>/", FiscalPeriodDetailView.as_view(), name="fiscal_period_detail"),

    # Journal Entries
    path("journal-entries/", JournalEntryListCreateView.as_view(), name="journal_entry_list_create"),
    path("journal-entries/<int:pk>/", JournalEntryDetailView.as_view(), name="journal_entry_detail"),

    # Financial Statements & Ledgers
    path("general-ledger/", GeneralLedgerView.as_view(), name="general_ledger"),
    path("trial-balance/", TrialBalanceView.as_view(), name="trial_balance"),
    path("profit-loss/", ProfitLossView.as_view(), name="profit_loss"),
    path("balance-sheet/", BalanceSheetView.as_view(), name="balance_sheet"),

    # Receivables & Payables
    path("accounts-receivable/", AccountsReceivableView.as_view(), name="accounts_receivable"),
    path("accounts-payable/", AccountsPayableView.as_view(), name="accounts_payable"),

    # Cash & Bank
    path("bank/", BankAccountListCreateView.as_view(), name="bank_account_list_create"),
    path("bank/<int:pk>/", BankAccountDetailView.as_view(), name="bank_account_detail"),
    path("cash/", CashAccountListCreateView.as_view(), name="cash_account_list_create"),
    path("cash/<int:pk>/", CashAccountDetailView.as_view(), name="cash_account_detail"),

    # Data Synchronization
    path("sync-records/", FinancialSyncView.as_view(), name="financial_sync"),
]
