from django.urls import path
from ai.views import (
    AIChatView,
    AIInsightsView,
    AICustomerLookupView,
    AIVendorLookupView,
)

urlpatterns = [
    path("chat/", AIChatView.as_view(), name="ai_chat"),
    path("insights/", AIInsightsView.as_view(), name="ai_insights"),
    path("customer-lookup/", AICustomerLookupView.as_view(), name="ai_customer_lookup"),
    path("vendor-lookup/", AIVendorLookupView.as_view(), name="ai_vendor_lookup"),
]
