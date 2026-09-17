from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from .models import Customer, Contact, Lead, Deal, Activity
from .serializers import (
    CustomerSerializer,
    ContactSerializer,
    LeadSerializer,
    LeadConvertSerializer,
    DealSerializer,
    ActivitySerializer,
)
from .services.gmail_service import GmailService


class CRMBaseView(APIView):
    """
    Base view providing strict multi-tenant resolution and permission checking.
    """
    permission_classes = [IsAuthenticated]

    def get_company(self, request, company_id):
        if request.user.is_superuser:
            return Company.objects.filter(id=company_id, is_active=True).first()

        membership = (
            request.user.company_memberships
            .select_related("company", "role")
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
# 1. LEADS APIs
# ============================================================

class LeadListCreateView(CRMBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Lead.objects.filter(company=company)

        # Status filter
        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            queryset = queryset.filter(status__iexact=status_param)

        # Search filter
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(lead_company__icontains=search)
            )

        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        leads = queryset.select_related("company", "owner", "converted_customer").order_by("-created_at")
        serializer = LeadSerializer(leads, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        serializer = LeadSerializer(data=request.data)
        if serializer.is_valid():
            owner = request.user if not serializer.validated_data.get("owner") else serializer.validated_data["owner"]
            lead = serializer.save(company=company, owner=owner)
            return Response(LeadSerializer(lead).data, status=201)

        return Response(serializer.errors, status=400)


class LeadDetailView(CRMBaseView):
    def get(self, request, company_id, lead_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        lead = Lead.objects.filter(id=lead_id, company=company).select_related("company", "owner", "converted_customer").first()
        if not lead:
            return Response({"detail": "Lead not found."}, status=404)

        return Response(LeadSerializer(lead).data)

    def patch(self, request, company_id, lead_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        lead = Lead.objects.filter(id=lead_id, company=company).first()
        if not lead:
            return Response({"detail": "Lead not found."}, status=404)

        serializer = LeadSerializer(lead, data=request.data, partial=True)
        if serializer.is_valid():
            lead = serializer.save()
            return Response(LeadSerializer(lead).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, lead_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        lead = Lead.objects.filter(id=lead_id, company=company).first()
        if not lead:
            return Response({"detail": "Lead not found."}, status=404)

        lead.is_active = False
        lead.save(update_fields=["is_active"])
        return Response({"detail": "Lead deactivated successfully."}, status=200)


class LeadConvertView(CRMBaseView):
    """
    Converts a Lead into a Customer and Contact, with optional Deal creation.
    """
    def post(self, request, company_id, lead_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        lead = Lead.objects.filter(id=lead_id, company=company, is_active=True).first()
        if not lead:
            return Response({"detail": "Lead not found or inactive."}, status=404)

        if lead.status == "Converted":
            return Response({"detail": "This lead has already been converted."}, status=400)

        serializer = LeadConvertSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        customer_name = data.get("customer_name") or lead.lead_company or f"{lead.first_name} {lead.last_name}".strip()

        with transaction.atomic():
            # 1. Create or link Customer
            customer = Customer.objects.create(
                company=company,
                owner=lead.owner or request.user,
                name=customer_name,
                customer_type="Corporate" if lead.lead_company else "Individual",
                email=lead.email,
                phone=lead.phone,
            )

            # 2. Create Contact under the Customer
            contact = Contact.objects.create(
                company=company,
                customer=customer,
                owner=lead.owner or request.user,
                first_name=lead.first_name,
                last_name=lead.last_name,
                email=lead.email,
                phone=lead.phone,
            )

            # 3. Optional Deal creation
            deal = None
            if data.get("create_deal"):
                deal_title = data.get("deal_title") or f"Opportunity - {customer.name}"
                deal_value = data.get("deal_value") or lead.estimated_value
                deal = Deal.objects.create(
                    company=company,
                    customer=customer,
                    contact=contact,
                    owner=lead.owner or request.user,
                    title=deal_title,
                    value=deal_value,
                    stage="Discovery",
                    probability=25,
                )

            # 4. Mark Lead as Converted
            lead.status = "Converted"
            lead.converted_customer = customer
            lead.converted_contact = contact
            lead.converted_at = timezone.now()
            lead.save()

            # 5. Log conversion activity
            Activity.objects.create(
                company=company,
                user=request.user,
                activity_type="Note",
                title=f"Lead Converted: {lead.first_name} {lead.last_name}",
                description=f"Lead converted to Customer '{customer.name}' and Contact.",
                customer=customer,
                contact=contact,
                deal=deal,
                lead=lead,
                status="Completed",
            )

        return Response({
            "message": "Lead converted successfully.",
            "customer": CustomerSerializer(customer).data,
            "contact": ContactSerializer(contact).data,
            "deal": DealSerializer(deal).data if deal else None,
            "lead": LeadSerializer(lead).data,
        }, status=200)


# ============================================================
# 2. CUSTOMERS APIs
# ============================================================

class CustomerListCreateView(CRMBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Customer.objects.filter(company=company)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(industry__icontains=search)
            )

        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        customers = queryset.select_related("company", "owner").prefetch_related("contacts", "deals").order_by("-created_at")
        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            owner = request.user if not serializer.validated_data.get("owner") else serializer.validated_data["owner"]
            customer = serializer.save(company=company, owner=owner)
            return Response(CustomerSerializer(customer).data, status=201)

        return Response(serializer.errors, status=400)


class CustomerDetailView(CRMBaseView):
    def get(self, request, company_id, customer_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        customer = Customer.objects.filter(id=customer_id, company=company).select_related("company", "owner").first()
        if not customer:
            return Response({"detail": "Customer not found."}, status=404)

        return Response(CustomerSerializer(customer).data)

    def patch(self, request, company_id, customer_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        customer = Customer.objects.filter(id=customer_id, company=company).first()
        if not customer:
            return Response({"detail": "Customer not found."}, status=404)

        serializer = CustomerSerializer(customer, data=request.data, partial=True)
        if serializer.is_valid():
            customer = serializer.save()
            return Response(CustomerSerializer(customer).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, customer_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        customer = Customer.objects.filter(id=customer_id, company=company).first()
        if not customer:
            return Response({"detail": "Customer not found."}, status=404)

        customer.is_active = False
        customer.save(update_fields=["is_active"])
        return Response({"detail": "Customer deactivated successfully."}, status=200)


# ============================================================
# 3. CONTACTS APIs
# ============================================================

class ContactListCreateView(CRMBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Contact.objects.filter(company=company)

        customer_id = request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search)
            )

        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        contacts = queryset.select_related("company", "customer", "owner").order_by("-created_at")
        serializer = ContactSerializer(contacts, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        serializer = ContactSerializer(data=request.data)
        if serializer.is_valid():
            owner = request.user if not serializer.validated_data.get("owner") else serializer.validated_data["owner"]
            contact = serializer.save(company=company, owner=owner)
            return Response(ContactSerializer(contact).data, status=201)

        return Response(serializer.errors, status=400)


class ContactDetailView(CRMBaseView):
    def get(self, request, company_id, contact_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        contact = Contact.objects.filter(id=contact_id, company=company).select_related("company", "customer", "owner").first()
        if not contact:
            return Response({"detail": "Contact not found."}, status=404)

        return Response(ContactSerializer(contact).data)

    def patch(self, request, company_id, contact_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        contact = Contact.objects.filter(id=contact_id, company=company).first()
        if not contact:
            return Response({"detail": "Contact not found."}, status=404)

        serializer = ContactSerializer(contact, data=request.data, partial=True)
        if serializer.is_valid():
            contact = serializer.save()
            return Response(ContactSerializer(contact).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, contact_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        contact = Contact.objects.filter(id=contact_id, company=company).first()
        if not contact:
            return Response({"detail": "Contact not found."}, status=404)

        contact.is_active = False
        contact.save(update_fields=["is_active"])
        return Response({"detail": "Contact deactivated successfully."}, status=200)


# ============================================================
# 4. DEALS APIs
# ============================================================

class DealListCreateView(CRMBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Deal.objects.filter(company=company)

        stage = request.query_params.get("stage")
        if stage and stage != "ALL":
            queryset = queryset.filter(stage=stage)

        customer_id = request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(customer__name__icontains=search)
            )

        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        deals = queryset.select_related("company", "customer", "contact", "owner").order_by("-created_at")
        serializer = DealSerializer(deals, many=True)

        # Compute pipeline summary metrics
        total_value = deals.aggregate(total=Sum("value"))["total"] or 0.00
        won_value = deals.filter(stage="Won").aggregate(total=Sum("value"))["total"] or 0.00

        return Response({
            "metrics": {
                "total_deals": deals.count(),
                "total_pipeline_value": float(total_value),
                "won_value": float(won_value),
            },
            "deals": serializer.data,
        })

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        serializer = DealSerializer(data=request.data)
        if serializer.is_valid():
            owner = request.user if not serializer.validated_data.get("owner") else serializer.validated_data["owner"]
            deal = serializer.save(company=company, owner=owner)
            return Response(DealSerializer(deal).data, status=201)

        return Response(serializer.errors, status=400)


class DealDetailView(CRMBaseView):
    def get(self, request, company_id, deal_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        deal = Deal.objects.filter(id=deal_id, company=company).select_related("company", "customer", "contact", "owner").first()
        if not deal:
            return Response({"detail": "Deal not found."}, status=404)

        return Response(DealSerializer(deal).data)

    def patch(self, request, company_id, deal_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        deal = Deal.objects.filter(id=deal_id, company=company).first()
        if not deal:
            return Response({"detail": "Deal not found."}, status=404)

        serializer = DealSerializer(deal, data=request.data, partial=True)
        if serializer.is_valid():
            deal = serializer.save()
            return Response(DealSerializer(deal).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, deal_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        deal = Deal.objects.filter(id=deal_id, company=company).first()
        if not deal:
            return Response({"detail": "Deal not found."}, status=404)

        deal.is_active = False
        deal.save(update_fields=["is_active"])
        return Response({"detail": "Deal deactivated successfully."}, status=200)


# ============================================================
# 5. ACTIVITIES & NOTES APIs
# ============================================================

class ActivityListCreateView(CRMBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Activity.objects.filter(company=company)

        # Filters
        act_type = request.query_params.get("type")
        if act_type and act_type != "ALL":
            queryset = queryset.filter(activity_type__iexact=act_type)

        customer_id = request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        deal_id = request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)

        lead_id = request.query_params.get("lead")
        if lead_id:
            queryset = queryset.filter(lead_id=lead_id)

        contact_id = request.query_params.get("contact")
        if contact_id:
            queryset = queryset.filter(contact_id=contact_id)

        activities = queryset.select_related(
            "company", "user", "customer", "contact", "deal", "lead"
        ).order_by("-created_at")

        serializer = ActivitySerializer(activities, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        serializer = ActivitySerializer(data=request.data)
        if serializer.is_valid():
            activity = serializer.save(company=company, user=request.user)

            # If this is an Email activity, attempt dispatch or local recording via GmailService
            if activity.activity_type == "Email":
                recipient = None
                if activity.contact and activity.contact.email:
                    recipient = activity.contact.email
                elif activity.customer and activity.customer.email:
                    recipient = activity.customer.email
                elif activity.lead and activity.lead.email:
                    recipient = activity.lead.email

                if recipient:
                    dispatch_result = GmailService.send_email(
                        subject=activity.title,
                        body=activity.description,
                        recipient=recipient,
                    )
                    # Note dispatch result in description if external dispatch was logged
                    if not dispatch_result["sent_externally"]:
                        activity.description += f"\n\n[Local Log: {dispatch_result['message']}]"
                        activity.save(update_fields=["description"])

            return Response(ActivitySerializer(activity).data, status=201)

        return Response(serializer.errors, status=400)


class ActivityDetailView(CRMBaseView):
    def get(self, request, company_id, activity_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        activity = Activity.objects.filter(id=activity_id, company=company).select_related(
            "company", "user", "customer", "contact", "deal", "lead"
        ).first()
        if not activity:
            return Response({"detail": "Activity not found."}, status=404)

        return Response(ActivitySerializer(activity).data)

    def patch(self, request, company_id, activity_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        activity = Activity.objects.filter(id=activity_id, company=company).first()
        if not activity:
            return Response({"detail": "Activity not found."}, status=404)

        serializer = ActivitySerializer(activity, data=request.data, partial=True)
        if serializer.is_valid():
            activity = serializer.save()
            return Response(ActivitySerializer(activity).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, activity_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        activity = Activity.objects.filter(id=activity_id, company=company).first()
        if not activity:
            return Response({"detail": "Activity not found."}, status=404)

        activity.delete()
        return Response({"detail": "Activity removed successfully."}, status=200)


# ============================================================
# 6. GMAIL STATUS API
# ============================================================

class GmailStatusView(CRMBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        return Response(GmailService.get_status())