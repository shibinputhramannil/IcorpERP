from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company

from .models import CompanyMembership
from .serializers import (
    CompanyMembershipSerializer,
    CompanyMembershipCreateSerializer,
    CompanyMembershipRoleUpdateSerializer
)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = request.user.company_memberships.select_related(
            "company",
            "role",
        )

        companies = []

        for membership in memberships:
            companies.append({
                "name": membership.company.name,
                "role": membership.role.name if membership.role else None,
            })

        return Response({
            "username": request.user.username,
            "email": request.user.email,
            "is_staff": request.user.is_staff,
            "companies": companies,
        })


class CompanyMemberListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        if request.user.is_superuser:
            memberships = (
                CompanyMembership.objects
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .select_related(
                    "user",
                    "company",
                    "role",
                )
            )

        else:
            admin_membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            if not admin_membership:
                return Response(
                    {
                        "detail": (
                            "You do not have access to this company."
                        )
                    },
                    status=403,
                )

            if (
                not admin_membership.role
                or admin_membership.role.name != "Company Admin"
            ):
                return Response(
                    {
                        "detail": (
                            "Company Admin permission required."
                        )
                    },
                    status=403,
                )

            memberships = (
                CompanyMembership.objects
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .select_related(
                    "user",
                    "company",
                    "role",
                )
            )

        serializer = CompanyMembershipSerializer(
            memberships,
            many=True,
        )

        return Response(serializer.data)


class CompanyMemberCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id):
        # Super Admin can add members to any active company.
        if request.user.is_superuser:
            company = (
                Company.objects
                .filter(
                    id=company_id,
                    is_active=True,
                )
                .first()
            )

            if not company:
                return Response(
                    {
                        "detail": (
                            "Company not found or inactive."
                        )
                    },
                    status=404,
                )

        # Company Admin can add members only to their own company.
        else:
            admin_membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            if not admin_membership:
                return Response(
                    {
                        "detail": (
                            "You do not have access to this company."
                        )
                    },
                    status=403,
                )

            if (
                not admin_membership.role
                or admin_membership.role.name != "Company Admin"
            ):
                return Response(
                    {
                        "detail": (
                            "Company Admin permission required."
                        )
                    },
                    status=403,
                )

            company = admin_membership.company

        serializer = CompanyMembershipCreateSerializer(
            data=request.data,
            context={
                "company": company,
            },
        )

        if serializer.is_valid():
            membership = serializer.save()

            return Response(
                CompanyMembershipSerializer(membership).data,
                status=201,
            )

        return Response(
            serializer.errors,
            status=400,
        )


class CompanyMemberUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, company_id, membership_id):
        # Super Admin can update members in any active company.
        if request.user.is_superuser:
            membership = (
                CompanyMembership.objects
                .select_related(
                    "user",
                    "company",
                    "role",
                )
                .filter(
                    id=membership_id,
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            if not membership:
                return Response(
                    {
                        "detail": (
                            "Membership not found or company inactive."
                        )
                    },
                    status=404,
                )

        # Company Admin can update members only in their own company.
        else:
            admin_membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            if not admin_membership:
                return Response(
                    {
                        "detail": (
                            "You do not have access to this company."
                        )
                    },
                    status=403,
                )

            if (
                not admin_membership.role
                or admin_membership.role.name != "Company Admin"
            ):
                return Response(
                    {
                        "detail": (
                            "Company Admin permission required."
                        )
                    },
                    status=403,
                )

            membership = (
                CompanyMembership.objects
                .select_related(
                    "user",
                    "company",
                    "role",
                )
                .filter(
                    id=membership_id,
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            if not membership:
                return Response(
                    {
                        "detail": (
                            "Membership not found."
                        )
                    },
                    status=404,
                )

        # Only role should be updated.
        if "role" not in request.data:
            return Response(
                {
                    "role": [
                        "This field is required."
                    ]
                },
                status=400,
            )

        # Use the dedicated role-update serializer.
        serializer = CompanyMembershipRoleUpdateSerializer(
            membership,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            membership = serializer.save()

            return Response(
                CompanyMembershipSerializer(membership).data,
                status=200,
            )

        return Response(
            serializer.errors,
            status=400,
        )