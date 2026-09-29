import logging
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from ai.serializers import (
    AIChatRequestSerializer,
    AIChatResponseSerializer,
    AIAskRequestSerializer,
    AIAskResponseSerializer,
)
from ai.services import (
    process_ai_query,
    ask_ai,
    get_ai_business_dashboard,
    get_ai_business_summary,
    get_all_executive_insights,
    search_customer_intelligence,
    search_vendor_intelligence,
    get_sales_metrics,
    get_purchase_metrics,
    get_inventory_metrics,
    get_finance_metrics,
    get_crm_metrics,
    get_hr_metrics,
    get_global_ai_business_dashboard,
    get_global_ai_business_summary,
    process_global_ai_query,
    ask_global_ai,
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


# ============================================================
# PHASE 9 PRIMARY AI ENDPOINTS
# ============================================================

class AIDashboardView(AIBaseView):
    """
    GET /api/companies/<company_id>/ai/dashboard/
    Provides comprehensive structured business insights across Sales, Purchases,
    Inventory, CRM, Finance, and HR, including alerts, trends, and recommendations.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to access AI features for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            data = get_ai_business_dashboard(company)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in AI Dashboard for company {company_id}: {e}")
            return Response(
                {"detail": "An error occurred while generating the AI dashboard.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AISummaryView(AIBaseView):
    """
    GET /api/companies/<company_id>/ai/summary/
    Provides an executive business summary, key metrics, strengths, risks, and action items.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to access AI features for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            data = get_ai_business_summary(company)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in AI Summary for company {company_id}: {e}")
            return Response(
                {"detail": "An error occurred while generating the AI business summary.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIAskView(AIBaseView):
    """
    POST /api/companies/<company_id>/ai/ask/
    Answers business questions using external AI API (via AI_API_KEY/GEMINI_API_KEY/OPENAI_API_KEY)
    or safe deterministic fallback based on live ERP data. Strictly read-only.
    """
    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to access AI features for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AIAskRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        question = serializer.validated_data["question"]
        history = serializer.validated_data.get("conversation_history", [])

        try:
            result = ask_ai(company, question, conversation_history=history)
            response_serializer = AIAskResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in AI Ask endpoint for company {company_id}: {e}")
            return Response(
                {"detail": "An error occurred while processing your question.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ============================================================
# PHASE 7 PRESERVED COMPATIBILITY ENDPOINTS
# ============================================================

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
            elif module == "crm":
                data = {"crm": get_crm_metrics(company)}
            elif module == "hr":
                data = {"hr": get_hr_metrics(company)}
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


# ============================================================
# GLOBAL AI ERP ASSISTANT ENDPOINTS (MULTI-COMPANY CAPABLE)
# ============================================================

class GlobalAIDashboardView(APIView):
    """
    GET /api/ai/dashboard/?company_id=<optional>
    Retrieves real-time AI dashboard insights across all authorized companies
    or filtered to a specific company if company_id is provided.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        if company_id:
            try:
                company_id = int(company_id)
            except (ValueError, TypeError):
                company_id = None

        try:
            data = get_global_ai_business_dashboard(request.user, company_id=company_id)
            if data is None:
                return Response(
                    {"detail": "Specified company was not found or you lack authorized access."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in Global AI Dashboard: {e}")
            return Response(
                {"detail": "An error occurred while generating the global AI dashboard.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GlobalAISummaryView(APIView):
    """
    GET /api/ai/summary/?company_id=<optional>
    Returns executive summary across all authorized companies or for a specific company.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        if company_id:
            try:
                company_id = int(company_id)
            except (ValueError, TypeError):
                company_id = None

        try:
            data = get_global_ai_business_summary(request.user, company_id=company_id)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in Global AI Summary: {e}")
            return Response(
                {"detail": "An error occurred while generating the global AI summary.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GlobalAIAskView(APIView):
    """
    POST /api/ai/ask/
    Answers business questions across all authorized companies or for a specified company.
    Accepts { "question": "...", "company_id": null, "conversation_history": [...] }
    Strictly read-only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AIAskRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        question = serializer.validated_data["question"]
        company_id = serializer.validated_data.get("company_id")
        history = serializer.validated_data.get("conversation_history", [])

        try:
            result = ask_global_ai(
                user=request.user,
                question=question,
                company_id=company_id,
                conversation_history=history,
            )
            response_serializer = AIAskResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in Global AI Ask: {e}")
            return Response(
                {"detail": "An error occurred while processing your question.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GlobalAIChatView(APIView):
    """
    POST /api/ai/chat/
    Accepts natural-language queries across all authorized companies.
    Accepts { "query": "...", "company_id": null, "conversation_history": [...] }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AIChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data["query"]
        company_id = serializer.validated_data.get("company_id")
        history = serializer.validated_data.get("conversation_history", [])

        try:
            result = process_global_ai_query(
                user=request.user,
                query=query,
                company_id=company_id,
                conversation_history=history,
            )
            response_serializer = AIChatResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in Global AI Chat: {e}")
            return Response(
                {"detail": "An error occurred while processing your question.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


from ai.providers.registry import AIProviderRegistry
from ai.tools import AVAILABLE_TOOLS, TOOLS_REGISTRY

class AICopilotChatView(APIView):
    """
    POST /api/ai/copilot/chat/
    Advanced AI Chat using new provider architecture and local tool execution.
    Requires company_id in payload, enforces strict multi-tenant access.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company_id = request.data.get("company_id")
        messages = request.data.get("messages", [])
        
        if not company_id:
            return Response({"detail": "company_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Security: Verify company_id is in user's authorized companies
        if not request.user.is_superuser:
            membership = request.user.company_memberships.filter(
                company_id=company_id, company__is_active=True
            ).exists()
            if not membership:
                return Response({"detail": "Forbidden access to this company."}, status=status.HTTP_403_FORBIDDEN)
        
        # Instantiate provider
        # Defaults to openai, ideally from company settings or env
        provider_name = request.data.get("provider", "openai")
        try:
            provider = AIProviderRegistry.get_provider(provider_name)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            response = provider.chat(messages, tools=AVAILABLE_TOOLS)
            
            # Execute tool calls locally
            if response.get("tool_calls"):
                for tool_call in response["tool_calls"]:
                    tool_name = tool_call["name"]
                    tool_args = tool_call.get("arguments", {})
                    
                    # Force inject company_id for security
                    tool_args["company_id"] = company_id
                    
                    if tool_name in TOOLS_REGISTRY:
                        # Execute tool
                        try:
                            result = TOOLS_REGISTRY[tool_name](**tool_args)
                            # Append tool response
                            messages.append({
                                "role": "assistant", 
                                "content": None, 
                                "tool_calls": [tool_call]
                            })
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "name": tool_name,
                                "content": str(result)
                            })
                        except Exception as e:
                            logger.exception(f"Error executing tool {tool_name}")
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "name": tool_name,
                                "content": f"Error: {str(e)}"
                            })
                            
                # Get final response from AI with tool results
                final_response = provider.chat(messages, tools=AVAILABLE_TOOLS)
                return Response(final_response, status=status.HTTP_200_OK)
                
            return Response(response, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Unexpected error in Copilot Chat: {e}")
            return Response(
                {"detail": "An error occurred during AI Copilot interaction.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

