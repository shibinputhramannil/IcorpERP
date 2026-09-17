"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.auth_serializers import EmailOrUsernameTokenObtainPairView
from accounts.views import MeView,CompanyMemberListView,CompanyMemberCreateView,CompanyMemberUpdateView
from company.views import CompanyListView, CompanyDetailView,CompanyCreateView
from apps.employee.views import EmployeeListView,EmployeeDetailView
from crm.views import (
    ContactListCreateView,
    ContactDetailView,
    LeadListCreateView,
    LeadDetailView,
    LeadConvertView,
    CustomerListCreateView,
    CustomerDetailView,
    DealListCreateView,
    DealDetailView,
    ActivityListCreateView,
    ActivityDetailView,
    GmailStatusView,
)
from inventory.views import (
    CategoryListCreateView,
    CategoryDetailView,
    ProductListCreateView,
    ProductDetailView,
    WarehouseListCreateView,
    WarehouseDetailView,
    StockListView,
    StockDetailView,
    StockTransactionListView,
    VendorListCreateView,
    VendorDetailView,
    InventoryDashboardView,
)
from sales.views import (
    QuotationListCreateView,
    QuotationDetailView,
    QuotationConvertView,
    SalesOrderListCreateView,
    SalesOrderDetailView,
    SalesOrderReserveView,
    SalesOrderReleaseReservationView,
    SalesOrderFulfillView,
    SalesOrderReservationListView,
    SalesDashboardView,
    InvoiceListCreateView,
    InvoiceDetailView,
    SalesOrderInvoiceCreateView,
    InvoicePaymentListCreateView,
    InvoiceReceiptListView,
    ReceiptListView,
    SalesFinancialSummaryView,
    PaymentListView,
    SalesAnalyticsView,
    SalesReportsView,
    CustomerSalesHistoryView,
    SalesOrderReturnView,
    SalesOrderReturnListView,
    SalesReturnListView,
)



urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/auth/login/", EmailOrUsernameTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", MeView.as_view(), name="auth_me"),

    # Company
    path("api/companies/", CompanyListView.as_view(), name="company_list"),
    path("api/companies/<int:pk>/", CompanyDetailView.as_view(), name="company_detail"),
    path("api/companies/create/", CompanyCreateView.as_view(), name="company_create"),
    path("api/companies/<int:company_id>/members/", CompanyMemberListView.as_view(), name="company_members"),
    path("api/companies/<int:company_id>/members/add/", CompanyMemberCreateView.as_view(), name="company_member_create"),
    path("api/companies/<int:company_id>/members/<int:membership_id>/", CompanyMemberUpdateView.as_view(), name="company-member-update"),

    # Employee
    path("api/companies/<int:company_id>/employees/", EmployeeListView.as_view(), name="employee_list"),
    path("api/companies/<int:company_id>/employees/<int:employee_id>/", EmployeeDetailView.as_view(), name="employee_detail"),

    # CRM - Leads
    path("api/companies/<int:company_id>/leads/", LeadListCreateView.as_view(), name="lead_list_create"),
    path("api/companies/<int:company_id>/leads/<int:lead_id>/", LeadDetailView.as_view(), name="lead_detail"),
    path("api/companies/<int:company_id>/leads/<int:lead_id>/convert/", LeadConvertView.as_view(), name="lead_convert"),

    # CRM - Customers
    path("api/companies/<int:company_id>/customers/", CustomerListCreateView.as_view(), name="customer_list_create"),
    path("api/companies/<int:company_id>/customers/<int:customer_id>/", CustomerDetailView.as_view(), name="customer_detail"),

    # CRM - Contacts
    path("api/companies/<int:company_id>/contacts/", ContactListCreateView.as_view(), name="contact_list_create"),
    path("api/companies/<int:company_id>/contacts/<int:contact_id>/", ContactDetailView.as_view(), name="contact_detail"),

    # CRM - Deals
    path("api/companies/<int:company_id>/deals/", DealListCreateView.as_view(), name="deal_list_create"),
    path("api/companies/<int:company_id>/deals/<int:deal_id>/", DealDetailView.as_view(), name="deal_detail"),

    # CRM - Activities & Notes
    path("api/companies/<int:company_id>/activities/", ActivityListCreateView.as_view(), name="activity_list_create"),
    path("api/companies/<int:company_id>/activities/<int:activity_id>/", ActivityDetailView.as_view(), name="activity_detail"),

    # CRM - Gmail Integration Status
    path("api/companies/<int:company_id>/gmail/status/", GmailStatusView.as_view(), name="gmail_status"),

    # Inventory - Categories
    path("api/companies/<int:company_id>/inventory/categories/", CategoryListCreateView.as_view(), name="inventory_category_list_create"),
    path("api/companies/<int:company_id>/inventory/categories/<int:pk>/", CategoryDetailView.as_view(), name="inventory_category_detail"),

    # Inventory - Products
    path("api/companies/<int:company_id>/inventory/products/", ProductListCreateView.as_view(), name="inventory_product_list_create"),
    path("api/companies/<int:company_id>/inventory/products/<int:pk>/", ProductDetailView.as_view(), name="inventory_product_detail"),

    # Inventory - Warehouses
    path("api/companies/<int:company_id>/inventory/warehouses/", WarehouseListCreateView.as_view(), name="inventory_warehouse_list_create"),
    path("api/companies/<int:company_id>/inventory/warehouses/<int:pk>/", WarehouseDetailView.as_view(), name="inventory_warehouse_detail"),

    # Inventory - Stock
    path("api/companies/<int:company_id>/inventory/stock/", StockListView.as_view(), name="inventory_stock_list"),
    path("api/companies/<int:company_id>/inventory/stock/<int:pk>/", StockDetailView.as_view(), name="inventory_stock_detail"),

    # Inventory - Transactions
    path("api/companies/<int:company_id>/inventory/transactions/", StockTransactionListView.as_view(), name="inventory_transaction_list_create"),

    # Inventory - Vendors
    path("api/companies/<int:company_id>/inventory/vendors/", VendorListCreateView.as_view(), name="inventory_vendor_list_create"),
    path("api/companies/<int:company_id>/inventory/vendors/<int:pk>/", VendorDetailView.as_view(), name="inventory_vendor_detail"),

    # Inventory - Dashboard
    path("api/companies/<int:company_id>/inventory/dashboard/", InventoryDashboardView.as_view(), name="inventory_dashboard"),

    # Sales - Quotations
    path("api/companies/<int:company_id>/sales/quotations/", QuotationListCreateView.as_view(), name="sales_quotation_list_create"),
    path("api/companies/<int:company_id>/sales/quotations/<int:pk>/", QuotationDetailView.as_view(), name="sales_quotation_detail"),
    path("api/companies/<int:company_id>/sales/quotations/<int:pk>/convert/", QuotationConvertView.as_view(), name="sales_quotation_convert"),

    # Sales - Orders
    path("api/companies/<int:company_id>/sales/orders/", SalesOrderListCreateView.as_view(), name="sales_order_list_create"),
    path("api/companies/<int:company_id>/sales/orders/<int:pk>/", SalesOrderDetailView.as_view(), name="sales_order_detail"),
    path("api/companies/<int:company_id>/sales/orders/<int:pk>/reserve/", SalesOrderReserveView.as_view(), name="sales_order_reserve"),
    path("api/companies/<int:company_id>/sales/orders/<int:pk>/release-reservation/", SalesOrderReleaseReservationView.as_view(), name="sales_order_release_reservation"),
    path("api/companies/<int:company_id>/sales/orders/<int:pk>/fulfill/", SalesOrderFulfillView.as_view(), name="sales_order_fulfill"),
    path("api/companies/<int:company_id>/sales/orders/<int:pk>/reservations/", SalesOrderReservationListView.as_view(), name="sales_order_reservations"),

    # Sales - Dashboard
    path("api/companies/<int:company_id>/sales/dashboard/", SalesDashboardView.as_view(), name="sales_dashboard"),

    # Sales - Invoices
    path("api/companies/<int:company_id>/sales/invoices/", InvoiceListCreateView.as_view(), name="sales_invoice_list_create"),
    path("api/companies/<int:company_id>/sales/invoices/<int:pk>/", InvoiceDetailView.as_view(), name="sales_invoice_detail"),
    path("api/companies/<int:company_id>/sales/orders/<int:order_id>/invoice/", SalesOrderInvoiceCreateView.as_view(), name="sales_order_invoice_create"),

    # Sales - Payments
    path("api/companies/<int:company_id>/sales/invoices/<int:invoice_id>/payments/", InvoicePaymentListCreateView.as_view(), name="sales_invoice_payment_list_create"),

    # Sales - Receipts
    path("api/companies/<int:company_id>/sales/invoices/<int:invoice_id>/receipts/", InvoiceReceiptListView.as_view(), name="sales_invoice_receipt_list"),
    path("api/companies/<int:company_id>/sales/receipts/", ReceiptListView.as_view(), name="sales_receipt_list"),

    # Sales - Financial Summary
    path("api/companies/<int:company_id>/sales/financial-summary/", SalesFinancialSummaryView.as_view(), name="sales_financial_summary"),

    # Sales - Analytics & Reports (Phase 4D)
    path("api/companies/<int:company_id>/sales/analytics/", SalesAnalyticsView.as_view(), name="sales_analytics"),
    path("api/companies/<int:company_id>/sales/reports/", SalesReportsView.as_view(), name="sales_reports"),
    path("api/companies/<int:company_id>/sales/customers/<int:customer_id>/history/", CustomerSalesHistoryView.as_view(), name="sales_customer_history"),

    # Sales - Company-wide Payments (Phase 4D)
    path("api/companies/<int:company_id>/sales/payments/", PaymentListView.as_view(), name="sales_payment_list"),

    # Sales - Returns (Phase 4D)
    path("api/companies/<int:company_id>/sales/orders/<int:order_id>/return/", SalesOrderReturnView.as_view(), name="sales_order_return"),
    path("api/companies/<int:company_id>/sales/orders/<int:order_id>/returns/", SalesOrderReturnListView.as_view(), name="sales_order_returns"),
    path("api/companies/<int:company_id>/sales/returns/", SalesReturnListView.as_view(), name="sales_return_list"),
]
