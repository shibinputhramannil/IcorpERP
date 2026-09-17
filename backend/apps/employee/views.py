from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from .models import Employee
from .serializers import EmployeeSerializer


class EmployeeListView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_company_and_check_permission(self, request, company_id, require_admin=False):
        if request.user.is_superuser:
            company = Company.objects.filter(id=company_id, is_active=True).first()
            if not company:
                return None, Response({"detail": "Company not found or inactive."}, status=404)
            return company, None

        membership = (
            request.user.company_memberships
            .select_related("company", "role")
            .filter(company_id=company_id, company__is_active=True)
            .first()
        )
        if not membership:
            return None, Response({"detail": "You do not have access to this company."}, status=403)

        if require_admin:
            if not membership.role or membership.role.name != "Company Admin":
                return None, Response({"detail": "Company Admin permission required."}, status=403)

        return membership.company, None

    def get(self, request, company_id):
        company, err_response = self._get_company_and_check_permission(request, company_id, require_admin=False)
        if err_response:
            return err_response

        show_all = request.query_params.get("all") == "true"
        queryset = Employee.objects.filter(company=company)
        if not show_all:
            queryset = queryset.filter(is_active=True)

        employees = queryset.select_related("user", "company").order_by("-created_at")
        serializer = EmployeeSerializer(employees, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company, err_response = self._get_company_and_check_permission(request, company_id, require_admin=True)
        if err_response:
            return err_response

        serializer = EmployeeSerializer(data=request.data)
        if serializer.is_valid():
            employee = serializer.save(company=company)
            return Response(EmployeeSerializer(employee).data, status=201)

        return Response(serializer.errors, status=400)


class EmployeeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_company_and_check_permission(self, request, company_id, require_admin=False):
        if request.user.is_superuser:
            company = Company.objects.filter(id=company_id, is_active=True).first()
            if not company:
                return None, Response({"detail": "Company not found or inactive."}, status=404)
            return company, None

        membership = (
            request.user.company_memberships
            .select_related("company", "role")
            .filter(company_id=company_id, company__is_active=True)
            .first()
        )
        if not membership:
            return None, Response({"detail": "You do not have access to this company."}, status=403)

        if require_admin:
            if not membership.role or membership.role.name != "Company Admin":
                return None, Response({"detail": "Company Admin permission required."}, status=403)

        return membership.company, None

    def get(self, request, company_id, employee_id):
        company, err_response = self._get_company_and_check_permission(request, company_id, require_admin=False)
        if err_response:
            return err_response

        employee = (
            Employee.objects
            .select_related("user", "company")
            .filter(id=employee_id, company=company)
            .first()
        )
        if not employee:
            return Response({"detail": "Employee not found."}, status=404)

        serializer = EmployeeSerializer(employee)
        return Response(serializer.data)

    def patch(self, request, company_id, employee_id):
        company, err_response = self._get_company_and_check_permission(request, company_id, require_admin=True)
        if err_response:
            return err_response

        employee = (
            Employee.objects
            .select_related("user", "company")
            .filter(id=employee_id, company=company)
            .first()
        )
        if not employee:
            return Response({"detail": "Employee not found."}, status=404)

        serializer = EmployeeSerializer(employee, data=request.data, partial=True)
        if serializer.is_valid():
            employee = serializer.save()
            return Response(EmployeeSerializer(employee).data, status=200)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, employee_id):
        company, err_response = self._get_company_and_check_permission(request, company_id, require_admin=True)
        if err_response:
            return err_response

        employee = Employee.objects.filter(id=employee_id, company=company).first()
        if not employee:
            return Response({"detail": "Employee not found."}, status=404)

        # Soft delete: mark as inactive
        employee.is_active = False
        employee.save(update_fields=["is_active"])
        return Response({"detail": "Employee deactivated successfully."}, status=200)