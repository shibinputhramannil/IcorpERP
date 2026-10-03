from datetime import datetime
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from reports.services import (
    get_executive_summary,
    get_sales_summary,
    get_purchase_summary,
    get_inventory_summary,
    get_crm_summary,
    get_finance_summary,
    get_employee_hr_summary,
    get_monthly_business_summary,
    generate_csv_report,
)


class ReportsBaseView(APIView):
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

    def parse_date_range(self, request):
        date_from_str = request.query_params.get("date_from")
        date_to_str = request.query_params.get("date_to")

        date_from = None
        date_to = None

        if date_from_str:
            try:
                date_from = datetime.strptime(date_from_str, "%Y-%m-%d").date()
            except ValueError:
                date_from = None

        if date_to_str:
            try:
                date_to = datetime.strptime(date_to_str, "%Y-%m-%d").date()
            except ValueError:
                date_to = None

        return date_from, date_to


class ExecutiveReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/executive/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        date_from, date_to = self.parse_date_range(request)
        data = get_executive_summary(company, date_from, date_to)
        return Response(data, status=status.HTTP_200_OK)


class SalesReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/sales/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        date_from, date_to = self.parse_date_range(request)
        data = get_sales_summary(company, date_from, date_to)
        return Response(data, status=status.HTTP_200_OK)


class PurchaseReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/purchase/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        date_from, date_to = self.parse_date_range(request)
        data = get_purchase_summary(company, date_from, date_to)
        return Response(data, status=status.HTTP_200_OK)


class InventoryReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/inventory/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        data = get_inventory_summary(company)
        return Response(data, status=status.HTTP_200_OK)


class CRMReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/crm/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        date_from, date_to = self.parse_date_range(request)
        data = get_crm_summary(company, date_from, date_to)
        return Response(data, status=status.HTTP_200_OK)


class FinanceReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/finance/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        date_from, date_to = self.parse_date_range(request)
        data = get_finance_summary(company, date_from, date_to)
        return Response(data, status=status.HTTP_200_OK)


class EmployeeReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/employees/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        data = get_employee_hr_summary(company)
        return Response(data, status=status.HTTP_200_OK)


class MonthlyReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/monthly/
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        months_param = request.query_params.get("months", "6")
        try:
            num_months = int(months_param)
        except ValueError:
            num_months = 6

        data = get_monthly_business_summary(company, num_months=num_months)
        return Response(data, status=status.HTTP_200_OK)


class ExportCSVReportView(ReportsBaseView):
    """
    GET /api/companies/<company_id>/reports/export/?report=<report_type>&date_from=...&date_to=...
    Streams CSV download for any report.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have permission to access reports for this company."}, status=status.HTTP_403_FORBIDDEN)

        report_type = request.query_params.get("report", "executive").lower().strip()
        date_from, date_to = self.parse_date_range(request)

        csv_content = generate_csv_report(report_type, company, date_from, date_to)
        filename = f"transt_{report_type}_report_{datetime.now().strftime('%Y%m%d')}.csv"

        response = HttpResponse(csv_content, content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
