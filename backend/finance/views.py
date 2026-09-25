from decimal import Decimal
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from finance.models import (
    Account,
    AccountCategory,
    FiscalPeriod,
    JournalEntry,
    JournalEntryLine,
    BankAccount,
    CashAccount,
)
from finance.serializers import (
    AccountSerializer,
    AccountCategorySerializer,
    FiscalPeriodSerializer,
    JournalEntrySerializer,
    JournalEntryCreateSerializer,
    BankAccountSerializer,
    CashAccountSerializer,
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
    sync_all_financial_records,
)


class FinanceBaseView(APIView):
    """
    Base view providing strict multi-tenant isolation and company verification.
    """
    permission_classes = [IsAuthenticated]

    def get_company(self, request, company_id):
        if request.user.is_superuser:
            return Company.objects.filter(id=company_id, is_active=True).first()

        membership = (
            request.user.company_memberships
            .select_related("company")
            .filter(
                user=request.user,
                company_id=company_id,
                company__is_active=True,
            )
            .first()
        )
        if not membership:
            return None
        return membership.company


# ============================================================
# 1. FINANCE DASHBOARD
# ============================================================

class FinanceDashboardView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = get_finance_dashboard(company)
        return Response(data, status=status.HTTP_200_OK)


# ============================================================
# 2. CHART OF ACCOUNTS
# ============================================================

class AccountListCreateView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = Account.objects.filter(company=company)
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category.upper())

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")

        serializer = AccountSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AccountSerializer(
            data=request.data,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            account = serializer.save(company=company)
            return Response(AccountSerializer(account).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AccountDetailView(FinanceBaseView):
    def get_object(self, company, pk):
        return Account.objects.filter(company=company, pk=pk).first()

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        account = self.get_object(company, pk)
        if not account:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(AccountSerializer(account).data, status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        account = self.get_object(company, pk)
        if not account:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AccountSerializer(
            account,
            data=request.data,
            partial=True,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            updated = serializer.save()
            return Response(AccountSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, company_id, pk):
        return self.patch(request, company_id, pk)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        account = self.get_object(company, pk)
        if not account:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

        if account.is_system:
            return Response(
                {"detail": "System accounts cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if account.journal_lines.exists():
            account.is_active = False
            account.save(update_fields=["is_active", "updated_at"])
            return Response(
                {"detail": "Account has existing journal transactions; deactivated instead of deleted."},
                status=status.HTTP_200_OK,
            )

        account.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DefaultAccountsCreateView(FinanceBaseView):
    """
    Endpoint to seed or idempotently verify default standard accounts for a company.
    """
    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        created = ensure_default_accounts(company)
        total_accounts = Account.objects.filter(company=company).count()
        return Response(
            {
                "message": f"Successfully initialized Chart of Accounts for {company.name}.",
                "created_count": len(created),
                "total_accounts": total_accounts,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# 3. FISCAL PERIODS
# ============================================================

class FiscalPeriodListCreateView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        periods = FiscalPeriod.objects.filter(company=company)
        return Response(FiscalPeriodSerializer(periods, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = FiscalPeriodSerializer(
            data=request.data,
            context={"company": company},
        )
        if serializer.is_valid():
            period = serializer.save(company=company)
            return Response(FiscalPeriodSerializer(period).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FiscalPeriodDetailView(FinanceBaseView):
    def get_object(self, company, pk):
        return FiscalPeriod.objects.filter(company=company, pk=pk).first()

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = self.get_object(company, pk)
        if not period:
            return Response({"detail": "Fiscal period not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(FiscalPeriodSerializer(period).data, status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = self.get_object(company, pk)
        if not period:
            return Response({"detail": "Fiscal period not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = FiscalPeriodSerializer(
            period,
            data=request.data,
            partial=True,
            context={"company": company},
        )
        if serializer.is_valid():
            updated = serializer.save()
            return Response(FiscalPeriodSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = self.get_object(company, pk)
        if not period:
            return Response({"detail": "Fiscal period not found."}, status=status.HTTP_404_NOT_FOUND)

        if period.journal_entries.exists():
            return Response(
                {"detail": "Cannot delete fiscal period with associated journal entries."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        period.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# 4. JOURNAL ENTRIES
# ============================================================

class JournalEntryListCreateView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = JournalEntry.objects.filter(company=company).select_related(
            "created_by", "fiscal_period"
        ).prefetch_related("lines__account")

        ref_type = request.query_params.get("reference_type")
        if ref_type:
            qs = qs.filter(reference_type=ref_type)

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())

        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(entry_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(entry_date__lte=date_to)

        serializer = JournalEntrySerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = JournalEntryCreateSerializer(
            data=request.data,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            try:
                entry = serializer.save()
                return Response(
                    JournalEntrySerializer(entry).data,
                    status=status.HTTP_201_CREATED,
                )
            except (DjangoValidationError, Exception) as e:
                msg = str(e)
                if hasattr(e, "messages"):
                    msg = " ".join(e.messages)
                return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class JournalEntryDetailView(FinanceBaseView):
    def get_object(self, company, pk):
        return (
            JournalEntry.objects.filter(company=company, pk=pk)
            .select_related("created_by", "fiscal_period")
            .prefetch_related("lines__account")
            .first()
        )

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entry = self.get_object(company, pk)
        if not entry:
            return Response({"detail": "Journal entry not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(JournalEntrySerializer(entry).data, status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entry = self.get_object(company, pk)
        if not entry:
            return Response({"detail": "Journal entry not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status and new_status == JournalEntry.EntryStatus.CANCELLED:
            entry.status = JournalEntry.EntryStatus.CANCELLED
            entry.save(update_fields=["status", "updated_at"])
            return Response(JournalEntrySerializer(entry).data, status=status.HTTP_200_OK)

        if entry.status == JournalEntry.EntryStatus.POSTED:
            return Response(
                {"detail": "Posted journal entries cannot be silently modified. Cancel or reverse instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"detail": "Only cancellation is permitted on journal entries."}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entry = self.get_object(company, pk)
        if not entry:
            return Response({"detail": "Journal entry not found."}, status=status.HTTP_404_NOT_FOUND)

        if entry.status == JournalEntry.EntryStatus.POSTED:
            return Response(
                {"detail": "Posted journal entries cannot be deleted. Mark as cancelled instead to preserve audit history."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# 5. FINANCIAL STATEMENTS & LEDGERS
# ============================================================

class GeneralLedgerView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        account_id = request.query_params.get("account")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        ref_type = request.query_params.get("reference_type")

        data = get_general_ledger(
            company=company,
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
            reference_type=ref_type,
        )
        return Response(data, status=status.HTTP_200_OK)


class TrialBalanceView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        as_of_date = request.query_params.get("as_of_date")
        data = get_trial_balance(company=company, as_of_date=as_of_date)
        return Response(data, status=status.HTTP_200_OK)


class ProfitLossView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        data = get_profit_and_loss(company=company, date_from=date_from, date_to=date_to)
        return Response(data, status=status.HTTP_200_OK)


class BalanceSheetView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        as_of_date = request.query_params.get("as_of_date")
        data = get_balance_sheet(company=company, as_of_date=as_of_date)
        return Response(data, status=status.HTTP_200_OK)


# ============================================================
# 6. ACCOUNTS RECEIVABLE & PAYABLE
# ============================================================

class AccountsReceivableView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = get_accounts_receivable_summary(company)
        return Response(data, status=status.HTTP_200_OK)


class AccountsPayableView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = get_accounts_payable_summary(company)
        return Response(data, status=status.HTTP_200_OK)


# ============================================================
# 7. CASH & BANK ACCOUNTS
# ============================================================

class BankAccountListCreateView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = BankAccount.objects.filter(company=company).select_related("account")
        return Response(BankAccountSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = BankAccountSerializer(
            data=request.data,
            context={"company": company},
        )
        if serializer.is_valid():
            bank = serializer.save(company=company)
            return Response(BankAccountSerializer(bank).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BankAccountDetailView(FinanceBaseView):
    def get_object(self, company, pk):
        return BankAccount.objects.filter(company=company, pk=pk).first()

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        bank = self.get_object(company, pk)
        if not bank:
            return Response({"detail": "Bank account not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(BankAccountSerializer(bank).data, status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        bank = self.get_object(company, pk)
        if not bank:
            return Response({"detail": "Bank account not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = BankAccountSerializer(bank, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(BankAccountSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        bank = self.get_object(company, pk)
        if not bank:
            return Response({"detail": "Bank account not found."}, status=status.HTTP_404_NOT_FOUND)

        bank.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CashAccountListCreateView(FinanceBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = CashAccount.objects.filter(company=company).select_related("account")
        return Response(CashAccountSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CashAccountSerializer(
            data=request.data,
            context={"company": company},
        )
        if serializer.is_valid():
            cash = serializer.save(company=company)
            return Response(CashAccountSerializer(cash).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CashAccountDetailView(FinanceBaseView):
    def get_object(self, company, pk):
        return CashAccount.objects.filter(company=company, pk=pk).first()

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        cash = self.get_object(company, pk)
        if not cash:
            return Response({"detail": "Cash account not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(CashAccountSerializer(cash).data, status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        cash = self.get_object(company, pk)
        if not cash:
            return Response({"detail": "Cash account not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CashAccountSerializer(cash, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(CashAccountSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        cash = self.get_object(company, pk)
        if not cash:
            return Response({"detail": "Cash account not found."}, status=status.HTTP_404_NOT_FOUND)

        cash.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# 8. INTEGRATION / RECORD SYNC VIEW
# ============================================================

class FinancialSyncView(FinanceBaseView):
    """
    Backfills and synchronizes existing Sales and Purchase transactions into journal entries.
    """
    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        counts = sync_all_financial_records(company, user=request.user)
        return Response(
            {
                "message": f"Successfully synchronized financial records for {company.name}.",
                "synced": counts,
            },
            status=status.HTTP_200_OK,
        )
