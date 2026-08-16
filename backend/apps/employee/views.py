from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company

from .models import Employee
from .serializers import EmployeeSerializer


class EmployeeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        # Super Admin can view employees in any active company.
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

        # Company Admin can view employees only in their own company.
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

        employees = (
            Employee.objects
            .filter(
                company=company,
                is_active=True,
            )
            .select_related(
                "user",
                "company",
            )
        )

        serializer = EmployeeSerializer(
            employees,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request, company_id):
        # Super Admin can create employees in any active company.
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

        # Company Admin can create employees only in their own company.
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

        serializer = EmployeeSerializer(
            data=request.data,
        )

        if serializer.is_valid():
            employee = serializer.save(
                company=company,
            )

            return Response(
                EmployeeSerializer(employee).data,
                status=201,
            )

        return Response(
            serializer.errors,
            status=400,
        )


class EmployeeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id, employee_id):
        # Super Admin can view employees in any active company.
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

        # Company Admin can view employees only in their own company.
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

        employee = (
            Employee.objects
            .select_related(
                "user",
                "company",
            )
            .filter(
                id=employee_id,
                company=company,
            )
            .first()
        )

        if not employee:
            return Response(
                {
                    "detail": "Employee not found."
                },
                status=404,
            )

        serializer = EmployeeSerializer(employee)

        return Response(serializer.data)

    def patch(self, request, company_id, employee_id):
        # Super Admin can update employees in any active company.
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

        # Company Admin can update employees only in their own company.
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

        employee = (
            Employee.objects
            .select_related(
                "user",
                "company",
            )
            .filter(
                id=employee_id,
                company=company,
            )
            .first()
        )

        if not employee:
            return Response(
                {
                    "detail": "Employee not found."
                },
                status=404,
            )

        serializer = EmployeeSerializer(
            employee,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            employee = serializer.save()

            return Response(
                EmployeeSerializer(employee).data,
                status=200,
            )

        return Response(
            serializer.errors,
            status=400,
        )