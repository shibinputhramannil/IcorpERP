from django.urls import path
from reports.views import (
    ExecutiveReportView,
    SalesReportView,
    PurchaseReportView,
    InventoryReportView,
    CRMReportView,
    FinanceReportView,
    EmployeeReportView,
    MonthlyReportView,
    ExportCSVReportView,
)

urlpatterns = [
    path("executive/", ExecutiveReportView.as_view(), name="report_executive"),
    path("sales/", SalesReportView.as_view(), name="report_sales"),
    path("purchase/", PurchaseReportView.as_view(), name="report_purchase"),
    path("inventory/", InventoryReportView.as_view(), name="report_inventory"),
    path("crm/", CRMReportView.as_view(), name="report_crm"),
    path("finance/", FinanceReportView.as_view(), name="report_finance"),
    path("employees/", EmployeeReportView.as_view(), name="report_employees"),
    path("monthly/", MonthlyReportView.as_view(), name="report_monthly"),
    path("export/", ExportCSVReportView.as_view(), name="report_export_csv"),
]
