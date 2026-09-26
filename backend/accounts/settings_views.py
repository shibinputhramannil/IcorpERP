from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User

from company.models import Company
from apps.employee.models import Employee
from accounts.views import get_user_avatar_url
from notifications.models import NotificationPreference
from notifications.serializers import NotificationPreferenceSerializer
from notifications.services import get_or_create_user_preferences


class SettingsProfileView(APIView):
    """
    GET  /api/settings/profile/
         Fetch current authenticated user's profile details.
    PATCH /api/settings/profile/
         Update safe profile fields (first_name, last_name, email, phone, designation).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = Employee.objects.filter(user=user).first()

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": emp.phone if emp else "",
            "designation": emp.designation if emp else "",
            "department": emp.department if emp else "",
            "avatar": get_user_avatar_url(user.id),
        }, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        # Safe user fields
        if "first_name" in data:
            user.first_name = str(data["first_name"]).strip()
        if "last_name" in data:
            user.last_name = str(data["last_name"]).strip()
        if "email" in data:
            new_email = str(data["email"]).strip()
            if new_email and new_email.lower() != user.email.lower():
                if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
                    return Response({"email": ["A user with this email already exists."]}, status=status.HTTP_400_BAD_REQUEST)
                user.email = new_email
        user.save()

        # Update associated Employee record if exists
        emp = Employee.objects.filter(user=user).first()
        if emp:
            if "phone" in data:
                emp.phone = str(data["phone"]).strip()
            if "designation" in data:
                emp.designation = str(data["designation"]).strip()
            if "department" in data:
                emp.department = str(data["department"]).strip()
            emp.save()

        return Response({
            "message": "Profile updated successfully.",
            "profile": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": emp.phone if emp else "",
                "designation": emp.designation if emp else "",
                "department": emp.department if emp else "",
                "avatar": get_user_avatar_url(user.id),
            }
        }, status=status.HTTP_200_OK)


class SettingsChangePasswordView(APIView):
    """
    POST /api/settings/change-password/
    Validates current password, checks confirmation, and safely updates user password.
    Never returns passwords or secrets.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        if not current_password:
            return Response({"current_password": ["Current password is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({"new_password": ["New password is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not confirm_password:
            return Response({"confirm_password": ["Password confirmation is required."]}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"current_password": ["Current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({"confirm_password": ["New passwords do not match."]}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 4:
            return Response({"new_password": ["Password must be at least 4 characters."]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)


class CompanySettingsView(APIView):
    """
    GET  /api/companies/<company_id>/settings/
         Retrieve company settings. Must be a member.
    PATCH /api/companies/<company_id>/settings/
         Update safe company settings. Must be Company Admin or Super Admin.
    """
    permission_classes = [IsAuthenticated]

    def get_company(self, request, company_id):
        if request.user.is_superuser:
            return Company.objects.filter(id=company_id, is_active=True).first(), True

        membership = (
            request.user.company_memberships
            .select_related("company", "role")
            .filter(
                company_id=company_id,
                company__is_active=True,
                is_active=True,
            )
            .first()
        )
        if not membership:
            return None, False

        is_admin = bool(membership.role and membership.role.name == "Company Admin")
        return membership.company, is_admin

    def get(self, request, company_id):
        company, is_admin = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        return Response({
            "id": company.id,
            "name": company.name,
            "email": company.email,
            "phone": company.phone,
            "address": company.address,
            "is_active": company.is_active,
            "created_at": company.created_at,
            "can_edit": is_admin or request.user.is_superuser,
        }, status=status.HTTP_200_OK)

    def patch(self, request, company_id):
        company, is_admin = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        if not (is_admin or request.user.is_superuser):
            return Response({"detail": "Company Admin permission required to edit company settings."}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        if "name" in data and str(data["name"]).strip():
            company.name = str(data["name"]).strip()
        if "email" in data and str(data["email"]).strip():
            new_email = str(data["email"]).strip()
            if Company.objects.filter(email__iexact=new_email).exclude(id=company.id).exists():
                return Response({"email": ["Another company with this email already exists."]}, status=status.HTTP_400_BAD_REQUEST)
            company.email = new_email
        if "phone" in data:
            company.phone = str(data["phone"]).strip()
        if "address" in data:
            company.address = str(data["address"]).strip()
        if "is_active" in data and request.user.is_superuser:
            company.is_active = bool(data["is_active"])

        company.save()

        return Response({
            "message": "Company settings updated successfully.",
            "company": {
                "id": company.id,
                "name": company.name,
                "email": company.email,
                "phone": company.phone,
                "address": company.address,
                "is_active": company.is_active,
            }
        }, status=status.HTTP_200_OK)


class SettingsNotificationPreferencesView(APIView):
    """
    GET  /api/settings/notifications/
         Retrieve user notification preferences.
    PATCH /api/settings/notifications/
         Update notification preferences.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        company = None
        if company_id:
            company = Company.objects.filter(id=company_id).first()

        pref = get_or_create_user_preferences(request.user, company=company)
        serializer = NotificationPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        company_id = request.data.get("company_id") or request.query_params.get("company_id")
        company = None
        if company_id:
            company = Company.objects.filter(id=company_id).first()

        pref = get_or_create_user_preferences(request.user, company=company)
        serializer = NotificationPreferenceSerializer(pref, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_pref = serializer.save()
        return Response({
            "message": "Notification preferences updated successfully.",
            "preferences": NotificationPreferenceSerializer(updated_pref).data,
        }, status=status.HTTP_200_OK)
