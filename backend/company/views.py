from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Company
from .permissions import IsCompanyAdmin
from .serializers import CompanySerializer


class CompanyListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = request.user.company_memberships.select_related("company").filter(
    company__is_active=True
)
        companies = [
            membership.company
            for membership in memberships
        ]

        serializer = CompanySerializer(companies, many=True)

        return Response(serializer.data)


class CompanyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
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

        serializer = CompanySerializer(membership.company)

        return Response(serializer.data)

    def patch(self, request, pk):
        if request.user.is_superuser:
            try:
                company = Company.objects.get(pk=pk)
            except Company.DoesNotExist:
                return Response(
                    {"detail": "Company not found."},
                    status=404,
                )
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

            if membership.role.name != "Company Admin":
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

        return Response(
            serializer.errors,
            status=400,
        )


class CompanyCreateView(APIView):
    permission_classes = [IsCompanyAdmin]

    def post(self, request):
        serializer = CompanySerializer(data=request.data)

        if serializer.is_valid():
            company = serializer.save()

            return Response(
                CompanySerializer(company).data,
                status=201,
            )

        return Response(
            serializer.errors,
            status=400,
        )