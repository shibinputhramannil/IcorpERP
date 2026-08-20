# Django REST Framework imports
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# Company model
from company.models import Company

# CRM models
from .models import Contact, Lead

# CRM serializers
from .serializers import ContactSerializer, LeadSerializer


# ============================================================
# CONTACT APIs
# ============================================================


class ContactListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    # Check whether the logged-in user belongs to the company
    def get_company(self, request, company_id):

        # Superuser can access any active company
        if request.user.is_superuser:
            return Company.objects.filter(
                id=company_id,
                is_active=True,
            ).first()

        # Normal users can access ONLY companies
        # where they have an actual membership
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

        # No membership means no access
        if membership is None:
            return None

        # Return the company the user belongs to
        return membership.company

    # GET: List all active contacts
    def get(self, request, company_id):

        # Check company access
        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Get contacts belonging only to this company
        contacts = (
            Contact.objects
            .filter(
                company=company,
                is_active=True,
            )
            .select_related(
                "company",
                "owner",
            )
        )

        serializer = ContactSerializer(
            contacts,
            many=True,
        )

        return Response(serializer.data)

    # POST: Create a new contact
    def post(self, request, company_id):

        # Check company access
        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Only Company Admin or Superuser can create contacts
        if not request.user.is_superuser:

            membership = (
                request.user.company_memberships
                .select_related("role")
                .filter(
                    user=request.user,
                    company_id=company.id,
                    company__is_active=True,
                )
                .first()
            )

            if (
                not membership
                or not membership.role
                or membership.role.name != "Company Admin"
            ):
                return Response(
                    {"detail": "Company Admin permission required."},
                    status=403,
                )

        # Copy request data
        data = request.data.copy()

        # Company always comes from the URL
        data["company"] = company.id

        # Validate contact data
        serializer = ContactSerializer(data=data)

        if serializer.is_valid():

            # Save the contact
            contact = serializer.save()

            return Response(
                ContactSerializer(contact).data,
                status=201,
            )

        return Response(
            serializer.errors,
            status=400,
        )


class ContactDetailView(APIView):
    permission_classes = [IsAuthenticated]

    # Check whether the logged-in user belongs to the company
    def get_company(self, request, company_id):

        # Superuser can access any active company
        if request.user.is_superuser:
            return Company.objects.filter(
                id=company_id,
                is_active=True,
            ).first()

        # Normal users need an explicit membership
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

        if membership is None:
            return None

        return membership.company

    # GET: Get one contact
    def get(self, request, company_id, contact_id):

        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Find contact only inside this company
        contact = (
            Contact.objects
            .select_related(
                "company",
                "owner",
            )
            .filter(
                id=contact_id,
                company=company,
            )
            .first()
        )

        if not contact:
            return Response(
                {"detail": "Contact not found."},
                status=404,
            )

        serializer = ContactSerializer(contact)

        return Response(serializer.data)

    # PATCH: Update one contact
    def patch(self, request, company_id, contact_id):

        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Only Company Admin or Superuser can update contacts
        if not request.user.is_superuser:

            membership = (
                request.user.company_memberships
                .select_related("role")
                .filter(
                    user=request.user,
                    company_id=company.id,
                    company__is_active=True,
                )
                .first()
            )

            if (
                not membership
                or not membership.role
                or membership.role.name != "Company Admin"
            ):
                return Response(
                    {"detail": "Company Admin permission required."},
                    status=403,
                )

        # Find contact only inside this company
        contact = (
            Contact.objects
            .select_related(
                "company",
                "owner",
            )
            .filter(
                id=contact_id,
                company=company,
            )
            .first()
        )

        if not contact:
            return Response(
                {"detail": "Contact not found."},
                status=404,
            )

        # Copy request data
        data = request.data.copy()

        # Prevent changing the company
        data.pop("company", None)

        serializer = ContactSerializer(
            contact,
            data=data,
            partial=True,
        )

        if serializer.is_valid():

            # Save updated contact
            contact = serializer.save()

            return Response(
                ContactSerializer(contact).data,
                status=200,
            )

        return Response(
            serializer.errors,
            status=400,
        )


# ============================================================
# LEAD APIs
# ============================================================


class LeadListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    # Check whether the logged-in user belongs to the company
    def get_company(self, request, company_id):

        # Superuser can access any active company
        if request.user.is_superuser:
            return Company.objects.filter(
                id=company_id,
                is_active=True,
            ).first()

        # Normal users can access ONLY companies
        # where they have an explicit membership
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

        # No membership means access is denied
        if membership is None:
            return None

        return membership.company

    # GET: List all active leads
    def get(self, request, company_id):

        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Only return active leads belonging to this company
        leads = (
            Lead.objects
            .filter(
                company=company,
                is_active=True,
            )
            .select_related(
                "company",
                "owner",
            )
        )

        serializer = LeadSerializer(
            leads,
            many=True,
        )

        return Response(serializer.data)

    # POST: Create a new lead
    def post(self, request, company_id):

        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Only Company Admin or Superuser can create leads
        if not request.user.is_superuser:

            membership = (
                request.user.company_memberships
                .select_related("role")
                .filter(
                    user=request.user,
                    company_id=company.id,
                    company__is_active=True,
                )
                .first()
            )

            if (
                not membership
                or not membership.role
                or membership.role.name != "Company Admin"
            ):
                return Response(
                    {"detail": "Company Admin permission required."},
                    status=403,
                )

        # Copy request data
        data = request.data.copy()

        # Company is always taken from the URL
        data["company"] = company.id

        serializer = LeadSerializer(data=data)

        if serializer.is_valid():

            # Save the new lead
            lead = serializer.save()

            return Response(
                LeadSerializer(lead).data,
                status=201,
            )

        return Response(
            serializer.errors,
            status=400,
        )


class LeadDetailView(APIView):
    permission_classes = [IsAuthenticated]

    # Check whether the logged-in user belongs to the company
    def get_company(self, request, company_id):

        # Superuser can access any active company
        if request.user.is_superuser:
            return Company.objects.filter(
                id=company_id,
                is_active=True,
            ).first()

        # Normal users can access ONLY companies
        # where they have an explicit membership
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

        # No membership means access is denied
        if membership is None:
            return None

        return membership.company

    # GET: Get one lead
    def get(self, request, company_id, lead_id):

        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Find the lead only inside this company
        lead = (
            Lead.objects
            .select_related(
                "company",
                "owner",
            )
            .filter(
                id=lead_id,
                company=company,
            )
            .first()
        )

        if not lead:
            return Response(
                {"detail": "Lead not found."},
                status=404,
            )

        serializer = LeadSerializer(lead)

        return Response(serializer.data)

    # PATCH: Update one lead
    def patch(self, request, company_id, lead_id):

        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Only Company Admin or Superuser can update leads
        if not request.user.is_superuser:

            membership = (
                request.user.company_memberships
                .select_related("role")
                .filter(
                    user=request.user,
                    company_id=company.id,
                    company__is_active=True,
                )
                .first()
            )

            if (
                not membership
                or not membership.role
                or membership.role.name != "Company Admin"
            ):
                return Response(
                    {"detail": "Company Admin permission required."},
                    status=403,
                )

        # Find the lead only inside this company
        lead = (
            Lead.objects
            .select_related(
                "company",
                "owner",
            )
            .filter(
                id=lead_id,
                company=company,
            )
            .first()
        )

        if not lead:
            return Response(
                {"detail": "Lead not found."},
                status=404,
            )

        # Copy request data
        data = request.data.copy()

        # Prevent moving the lead to another company
        data.pop("company", None)

        serializer = LeadSerializer(
            lead,
            data=data,
            partial=True,
        )

        if serializer.is_valid():

            # Save updated lead
            lead = serializer.save()

            return Response(
                LeadSerializer(lead).data,
                status=200,
            )

        return Response(
            serializer.errors,
            status=400,
        )

    # DELETE: Soft-delete one lead
    def delete(self, request, company_id, lead_id):

        company = self.get_company(request, company_id)

        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=403,
            )

        # Only Company Admin or Superuser can delete leads
        if not request.user.is_superuser:

            membership = (
                request.user.company_memberships
                .select_related("role")
                .filter(
                    user=request.user,
                    company_id=company.id,
                    company__is_active=True,
                )
                .first()
            )

            if (
                not membership
                or not membership.role
                or membership.role.name != "Company Admin"
            ):
                return Response(
                    {"detail": "Company Admin permission required."},
                    status=403,
                )

        # Find the lead only inside this company
        lead = (
            Lead.objects
            .filter(
                id=lead_id,
                company=company,
            )
            .first()
        )

        if not lead:
            return Response(
                {"detail": "Lead not found."},
                status=404,
            )

        # Soft delete:
        # Keep the record in the database but mark it inactive.
        lead.is_active = False
        lead.save(update_fields=["is_active"])

        return Response(
            {"detail": "Lead deleted successfully."},
            status=200,
        )