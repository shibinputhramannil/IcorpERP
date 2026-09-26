import logging
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from ai.serializers import AIChatRequestSerializer, AIChatResponseSerializer
from ai.services import (
    process_ai_query,
    get_all_executive_insights,
    search_customer_intelligence,
    search_vendor_intelligence,
    get_sales_metrics,
    get_purchase_metrics,
    get_inventory_metrics,
    get_finance_metrics,
)

logger = logging.getLogger(__name__)


class AIBaseView(APIView):
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


class AIChatView(AIBaseView):
    """
    POST /api/companies/<company_id>/ai/chat/
    Accepts natural-language queries, runs intent classification and ERP data retrieval,
    and returns a structured, grounded response.
    """
    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to access AI features for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AIChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data["query"]
        history = serializer.validated_data.get("conversation_history", [])

        try:
            result = process_ai_query(company, query, conversation_history=history)
            response_serializer = AIChatResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in AI Assistant query: {e}")
            return Response(
                {
                    "detail": "An error occurred while processing your question.",
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIInsightsView(AIBaseView):
    """
    GET /api/companies/<company_id>/ai/insights/
    Returns full executive digest spanning Sales, Purchases, Inventory, and Finance.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to access AI features for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            module = request.query_params.get("module")
            if module == "sales":
                data = {"sales": get_sales_metrics(company)}
            elif module == "purchases":
                data = {"purchases": get_purchase_metrics(company)}
            elif module == "inventory":
                data = {"inventory": get_inventory_metrics(company)}
            elif module == "finance":
                data = {"finance": get_finance_metrics(company)}
            else:
                data = get_all_executive_insights(company)

            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error fetching AI insights: {e}")
            return Response(
                {"detail": "An error occurred while generating ERP insights.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AICustomerLookupView(AIBaseView):
    """
    GET /api/companies/<company_id>/ai/customer-lookup/?q=<query>
    Instant AI intelligence lookup for customer profile, orders, invoices, and debt status.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to access AI features for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        q = request.query_params.get("q", "").strip()
        if not q:
            return Response(
                {"detail": "Query parameter 'q' is required for customer lookup."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = search_customer_intelligence(company, q)
        if results is None:
            return Response(
                {"detail": f"No customer found matching '{q}'.", "results": []},
                status=status.HTTP_200_OK,
            )

        return Response({"results": results}, status=status.HTTP_200_OK)


class AIVendorLookupView(AIBaseView):
    """
    GET /api/companies/<company_id>/ai/vendor-lookup/?q=<query>
    Instant AI intelligence lookup for vendor profile, purchase orders, bills, and spend history.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to access AI features for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        q = request.query_params.get("q", "").strip()
        if not q:
            return Response(
                {"detail": "Query parameter 'q' is required for vendor lookup."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = search_vendor_intelligence(company, q)
        if results is None:
            return Response(
                {"detail": f"No vendor found matching '{q}'.", "results": []},
                status=status.HTTP_200_OK,
            )

        return Response({"results": results}, status=status.HTTP_200_OK)
