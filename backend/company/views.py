from django.contrib.auth.models import Group
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CompanyMembership
from .models import Company
from .serializers import CompanySerializer


class CompanyListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_superuser:
            companies = Company.objects.all().order_by("-created_at")
        else:
            memberships = (
                request.user.company_memberships
                .select_related("company")
                .filter(company__is_active=True)
                .order_by("-company__created_at")
            )
            companies = [membership.company for membership in memberships]

        serializer = CompanySerializer(companies, many=True)
        return Response(serializer.data)


class CompanyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if request.user.is_superuser:
            company = Company.objects.filter(pk=pk).first()
            if not company:
                return Response({"detail": "Company not found."}, status=404)
        else:
            membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(company_id=pk, company__is_active=True)
                .first()
            )
            if not membership:
                return Response(
                    {"detail": "You do not have access to this company."},
                    status=403,
                )
            company = membership.company

        serializer = CompanySerializer(company)
        return Response(serializer.data)

    def patch(self, request, pk):
        if request.user.is_superuser:
            company = Company.objects.filter(pk=pk).first()
            if not company:
                return Response({"detail": "Company not found."}, status=404)
        else:
            membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(company_id=pk)
                .first()
            )
            if not membership:
                return Response(
                    {"detail": "You do not have access to this company."},
                    status=403,
                )
            if not membership.role or membership.role.name != "Company Admin":
                return Response(
                    {"detail": "Company Admin permission required."},
                    status=403,
                )
            company = membership.company

        serializer = CompanySerializer(
            company,
            data=request.data,
            partial=True,
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        if request.user.is_superuser:
            company = Company.objects.filter(pk=pk).first()
            if not company:
                return Response({"detail": "Company not found."}, status=404)
        else:
            membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(company_id=pk)
                .first()
            )
            if not membership:
                return Response(
                    {"detail": "You do not have access to this company."},
                    status=403,
                )
            if not membership.role or membership.role.name != "Company Admin":
                return Response(
                    {"detail": "Company Admin permission required."},
                    status=403,
                )
            company = membership.company

        # Soft delete: de-activate company
        company.is_active = False
        company.save(update_fields=["is_active"])
        return Response({"detail": "Company deactivated successfully."}, status=200)


class CompanyCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CompanySerializer(data=request.data)
        if serializer.is_valid():
            company = serializer.save()

            # Ensure Company Admin group exists and assign creator as Company Admin
            admin_group, _ = Group.objects.get_or_create(name="Company Admin")
            CompanyMembership.objects.get_or_create(
                user=request.user,
                company=company,
                defaults={"role": admin_group},
            )

            return Response(
                CompanySerializer(company).data,
                status=201,
            )

        return Response(serializer.errors, status=400)