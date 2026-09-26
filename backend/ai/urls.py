from django.urls import path
from ai.views import (
    AIDashboardView,
    AISummaryView,
    AIAskView,
    AIChatView,
    AIInsightsView,
    AICustomerLookupView,
    AIVendorLookupView,
)

urlpatterns = [
    # Phase 9 Primary Endpoints
    path("dashboard/", AIDashboardView.as_view(), name="ai_dashboard"),
    path("summary/", AISummaryView.as_view(), name="ai_summary"),
    path("ask/", AIAskView.as_view(), name="ai_ask"),

    # Preserved Endpoints
    path("chat/", AIChatView.as_view(), name="ai_chat"),
    path("insights/", AIInsightsView.as_view(), name="ai_insights"),
    path("customer-lookup/", AICustomerLookupView.as_view(), name="ai_customer_lookup"),
    path("vendor-lookup/", AIVendorLookupView.as_view(), name="ai_vendor_lookup"),
]
