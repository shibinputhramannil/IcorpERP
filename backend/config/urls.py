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
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.auth_serializers import EmailOrUsernameTokenObtainPairView
from accounts.views import (
    MeView,
    AvatarUploadView,
    CompanyMemberListView,
    CompanyMemberCreateView,
    CompanyMemberUpdateView,
)
from accounts.workspace_views import (
    WorkspaceView,
    WorkspaceMembersView,
    WorkspaceMemberDetailView,
)
from accounts.settings_views import (
    SettingsProfileView,
    SettingsChangePasswordView,
    CompanySettingsView,
    SettingsNotificationPreferencesView,
)
from accounts.workspace_collaboration_views import (
    WorkspaceNotesView,
    WorkspaceNoteDetailView,
    WorkspaceMailView,
    WorkspaceMailSendView,
    WorkspaceMailStatusView,
    WorkspaceActivitiesView,
    WorkspaceCollaborationOverviewView,
)
from accounts.search_views import GlobalSearchView
from ai.views import (
    GlobalAIDashboardView,
    GlobalAISummaryView,
    GlobalAIAskView,
    GlobalAIChatView,
)
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
from purchase.views import (
    PurchaseQuotationListCreateView,
    PurchaseQuotationDetailView,
    PurchaseQuotationConvertToOrderView,
    PurchaseOrderListCreateView,
    PurchaseOrderDetailView,
    PurchaseOrderReceiveView,
    PurchaseOrderReceiptListView,
    PurchaseReceiptListCreateView,
    PurchaseReceiptDetailView,
    PurchaseInvoiceListCreateView,
    PurchaseInvoiceDetailView,
    PurchaseOrderInvoiceCreateView,
    PurchaseInvoicePaymentListCreateView,
    PurchasePaymentListView,
    PurchaseDashboardView,
    VendorPurchaseHistoryView,
    PurchaseAnalyticsView,
    PurchaseReportsView,
    PurchaseReportSummaryView,
    PurchaseReportOrdersView,
    PurchaseReportVendorsView,
    PurchaseReportReceivingView,
    PurchaseReportFinancialView,
)



urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/auth/login/", EmailOrUsernameTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", MeView.as_view(), name="auth_me"),
    path("api/auth/profile/avatar/", AvatarUploadView.as_view(), name="user_avatar_upload"),

    # User Settings (Phase 9C)
    path("api/settings/profile/", SettingsProfileView.as_view(), name="settings_profile"),
    path("api/settings/change-password/", SettingsChangePasswordView.as_view(), name="settings_change_password"),
    path("api/settings/notifications/", SettingsNotificationPreferencesView.as_view(), name="settings_notifications"),

    # Company & Workspace (Phase 9A & 9C)
    path("api/companies/", CompanyListView.as_view(), name="company_list"),
    path("api/companies/<int:pk>/", CompanyDetailView.as_view(), name="company_detail"),
    path("api/companies/create/", CompanyCreateView.as_view(), name="company_create"),
    path("api/companies/<int:company_id>/workspace/", WorkspaceView.as_view(), name="company_workspace"),
    path("api/companies/<int:company_id>/settings/", CompanySettingsView.as_view(), name="company_settings"),
    path("api/companies/<int:company_id>/members/", WorkspaceMembersView.as_view(), name="company_members"),
    path("api/companies/<int:company_id>/members/add/", WorkspaceMembersView.as_view(), name="company_member_create"),
    path("api/companies/<int:company_id>/members/<int:member_id>/", WorkspaceMemberDetailView.as_view(), name="company_member_detail"),
    path("api/companies/<int:company_id>/members/<int:membership_id>/", WorkspaceMemberDetailView.as_view(), name="company-member-update"),

    # Workspace Collaboration (Phase 9A Extension)
    path("api/companies/<int:company_id>/workspace/collaboration/", WorkspaceCollaborationOverviewView.as_view(), name="workspace_collaboration_overview"),
    path("api/companies/<int:company_id>/workspace/notes/", WorkspaceNotesView.as_view(), name="workspace_notes"),
    path("api/companies/<int:company_id>/workspace/notes/<int:pk>/", WorkspaceNoteDetailView.as_view(), name="workspace_note_detail"),
    path("api/companies/<int:company_id>/workspace/mail/", WorkspaceMailView.as_view(), name="workspace_mail"),
    path("api/companies/<int:company_id>/workspace/mail/send/", WorkspaceMailSendView.as_view(), name="workspace_mail_send"),
    path("api/companies/<int:company_id>/workspace/mail/status/", WorkspaceMailStatusView.as_view(), name="workspace_mail_status"),
    path("api/companies/<int:company_id>/workspace/activities/", WorkspaceActivitiesView.as_view(), name="workspace_activities"),

    # Documents Management (Phase 9A Extension)
    path("api/companies/<int:company_id>/documents/", include("documents.urls")),

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

    # ============================================================
    # Purchase - Phase 5A
    # ============================================================
    # Purchase - Quotations
    path("api/companies/<int:company_id>/purchases/quotations/", PurchaseQuotationListCreateView.as_view(), name="purchase_quotation_list_create"),
    path("api/companies/<int:company_id>/purchases/quotations/<int:pk>/", PurchaseQuotationDetailView.as_view(), name="purchase_quotation_detail"),
    path("api/companies/<int:company_id>/purchases/quotations/<int:pk>/convert-to-order/", PurchaseQuotationConvertToOrderView.as_view(), name="purchase_quotation_convert_to_order"),
    path("api/companies/<int:company_id>/purchases/quotations/<int:pk>/convert/", PurchaseQuotationConvertToOrderView.as_view(), name="purchase_quotation_convert"),

    # Purchase - Orders
    path("api/companies/<int:company_id>/purchases/orders/", PurchaseOrderListCreateView.as_view(), name="purchase_order_list_create"),
    path("api/companies/<int:company_id>/purchases/orders/<int:pk>/", PurchaseOrderDetailView.as_view(), name="purchase_order_detail"),
    path("api/companies/<int:company_id>/purchases/orders/<int:pk>/receive/", PurchaseOrderReceiveView.as_view(), name="purchase_order_receive"),
    path("api/companies/<int:company_id>/purchases/orders/<int:pk>/receipts/", PurchaseOrderReceiptListView.as_view(), name="purchase_order_receipts"),

    # Purchase - Goods Receipts (Phase 5B)
    path("api/companies/<int:company_id>/purchases/receipts/", PurchaseReceiptListCreateView.as_view(), name="purchase_receipt_list_create"),
    path("api/companies/<int:company_id>/purchases/receipts/<int:pk>/", PurchaseReceiptDetailView.as_view(), name="purchase_receipt_detail"),

    # Purchase - Dashboard
    path("api/companies/<int:company_id>/purchases/dashboard/", PurchaseDashboardView.as_view(), name="purchase_dashboard"),

    # Purchase - Vendor History
    path("api/companies/<int:company_id>/purchases/vendors/<int:vendor_id>/history/", VendorPurchaseHistoryView.as_view(), name="vendor_purchase_history"),

    # Purchase - Invoices (Phase 5C/5D)
    path("api/companies/<int:company_id>/purchases/invoices/", PurchaseInvoiceListCreateView.as_view(), name="purchase_invoice_list_create"),
    path("api/companies/<int:company_id>/purchases/invoices/<int:pk>/", PurchaseInvoiceDetailView.as_view(), name="purchase_invoice_detail"),
    path("api/companies/<int:company_id>/purchases/orders/<int:order_id>/invoice/", PurchaseOrderInvoiceCreateView.as_view(), name="purchase_order_invoice_create"),
    path("api/companies/<int:company_id>/purchases/invoices/<int:invoice_id>/payments/", PurchaseInvoicePaymentListCreateView.as_view(), name="purchase_invoice_payment_list_create"),
    path("api/companies/<int:company_id>/purchases/payments/", PurchasePaymentListView.as_view(), name="purchase_payment_list"),

    # Purchase - Analytics (Phase 5D)
    path("api/companies/<int:company_id>/purchases/analytics/", PurchaseAnalyticsView.as_view(), name="purchase_analytics"),

    # Purchase - Reports (Phase 5D)
    path("api/companies/<int:company_id>/purchases/reports/", PurchaseReportsView.as_view(), name="purchase_reports"),
    path("api/companies/<int:company_id>/purchases/reports/summary/", PurchaseReportSummaryView.as_view(), name="purchase_report_summary"),
    path("api/companies/<int:company_id>/purchases/reports/orders/", PurchaseReportOrdersView.as_view(), name="purchase_report_orders"),
    path("api/companies/<int:company_id>/purchases/reports/vendors/", PurchaseReportVendorsView.as_view(), name="purchase_report_vendors"),
    path("api/companies/<int:company_id>/purchases/reports/receiving/", PurchaseReportReceivingView.as_view(), name="purchase_report_receiving"),
    path("api/companies/<int:company_id>/purchases/reports/financial/", PurchaseReportFinancialView.as_view(), name="purchase_report_financial"),

    # ============================================================
    # Finance & Accounting - Phase 6
    # ============================================================
    path("api/companies/<int:company_id>/finance/", include("finance.urls")),

    # ============================================================
    # AI ERP Assistant - Phase 7
    # ============================================================
    path("api/companies/<int:company_id>/ai/", include("ai.urls")),

    # ============================================================
    # Reporting & Admin Consolidation - Phase 8
    # ============================================================
    path("api/companies/<int:company_id>/reports/", include("reports.urls")),

    # ============================================================
    # Notifications - Phase 9B
    # ============================================================
    path("api/companies/<int:company_id>/notifications/", include("notifications.urls")),

    # ============================================================
    # Calendar & Scheduling - Phase 9 Final
    # ============================================================
    path("api/companies/<int:company_id>/calendar/", include("calendar_events.urls")),

    # ============================================================
    # Email Hub - Phase 9 Final
    # ============================================================
    path("api/companies/<int:company_id>/emails/", include("emails.urls")),

    # ============================================================
    # Global Search & Global AI Assistant - Phase 9 Final
    # ============================================================
    path("api/search/", GlobalSearchView.as_view(), name="global_search"),
    path("api/ai/dashboard/", GlobalAIDashboardView.as_view(), name="global_ai_dashboard"),
    path("api/ai/summary/", GlobalAISummaryView.as_view(), name="global_ai_summary"),
    path("api/ai/ask/", GlobalAIAskView.as_view(), name="global_ai_ask"),
    path("api/ai/chat/", GlobalAIChatView.as_view(), name="global_ai_chat"),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
