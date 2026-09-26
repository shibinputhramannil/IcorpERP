from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q

from company.models import Company
from accounts.models import CompanyMembership, WorkspaceActivity
from accounts.serializers import (
    CompanyMembershipSerializer,
    CompanyMembershipCreateSerializer,
    CompanyMembershipRoleUpdateSerializer,
    WorkspaceActivitySerializer,
)
from notifications.services import create_notification, notify_company_admins


class WorkspaceBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def get_company_and_membership(self, request, company_id):
        """
        Returns (company, membership, is_admin).
        """
        if request.user.is_superuser:
            company = Company.objects.filter(id=company_id, is_active=True).first()
            if not company:
                return None, None, False
            return company, None, True

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
            return None, None, False

        is_admin = bool(membership.role and membership.role.name == "Company Admin")
        return membership.company, membership, is_admin


class WorkspaceView(WorkspaceBaseView):
    """
    GET /api/companies/<company_id>/workspace/
    Returns:
      - company information
      - current user
      - current user's role
      - member count
      - active member count
      - workspace status
      - recent activity
    """
    def get(self, request, company_id):
        company, membership, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Role resolution
        if request.user.is_superuser:
            role_name = "Super Admin"
        elif membership and membership.role:
            role_name = membership.role.name
        else:
            role_name = "Employee"

        # Member counts
        memberships_qs = CompanyMembership.objects.filter(company=company)
        member_count = memberships_qs.count()
        active_member_count = memberships_qs.filter(is_active=True).count()

        # Recent activities
        recent_activities = WorkspaceActivity.objects.filter(company=company).select_related("user")[:10]
        activity_data = WorkspaceActivitySerializer(recent_activities, many=True).data

        return Response({
            "company": {
                "id": company.id,
                "name": company.name,
                "email": company.email,
                "phone": company.phone,
                "address": company.address,
                "is_active": company.is_active,
                "created_at": company.created_at,
            },
            "current_user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
            },
            "current_user_role": role_name,
            "is_admin": is_admin or request.user.is_superuser,
            "member_count": member_count,
            "active_member_count": active_member_count,
            "workspace_status": "Active" if company.is_active else "Inactive",
            "recent_activities": activity_data,
        }, status=status.HTTP_200_OK)


class WorkspaceMembersView(WorkspaceBaseView):
    """
    GET  /api/companies/<company_id>/members/
         List members with search and role filter.
    POST /api/companies/<company_id>/members/
         Add/invite an existing user to company. Admin only.
    """
    def get(self, request, company_id):
        company, membership, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = (
            CompanyMembership.objects
            .filter(company=company)
            .select_related("user", "company", "role")
            .order_by("-created_at")
        )

        search = request.query_params.get("search") or request.query_params.get("q")
        if search:
            s = search.strip()
            queryset = queryset.filter(
                Q(user__username__icontains=s)
                | Q(user__email__icontains=s)
                | Q(user__first_name__icontains=s)
                | Q(user__last_name__icontains=s)
            )

        role_filter = request.query_params.get("role")
        if role_filter:
            queryset = queryset.filter(role__name=role_filter)

        serializer = CompanyMembershipSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company, membership, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not (is_admin or request.user.is_superuser):
            return Response(
                {"detail": "Company Admin permission required to manage members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CompanyMembershipCreateSerializer(
            data=request.data,
            context={"company": company},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_membership = serializer.save()

        # Log Activity
        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="member_added",
            details=f"Added {new_membership.user.username} with role {new_membership.role.name if new_membership.role else 'None'}.",
        )

        # Notify added user
        create_notification(
            company=company,
            recipient=new_membership.user,
            notification_type="member",
            title="Added to Workspace",
            message=f"You have been added to {company.name} as a {new_membership.role.name if new_membership.role else 'member'}.",
            related_module="workspace",
            related_object_id=new_membership.id,
        )

        return Response(
            CompanyMembershipSerializer(new_membership).data,
            status=status.HTTP_201_CREATED,
        )


class WorkspaceMemberDetailView(WorkspaceBaseView):
    """
    PATCH  /api/companies/<company_id>/members/<member_id>/
           Update member role or active status. Admin only.
    DELETE /api/companies/<company_id>/members/<member_id>/
           Deactivate or safely remove membership. Admin only.
    """
    def patch(self, request, company_id, member_id=None, membership_id=None, **kwargs):
        member_id = member_id or membership_id
        company, membership, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not (is_admin or request.user.is_superuser):
            return Response(
                {"detail": "Company Admin permission required to manage members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_membership = CompanyMembership.objects.filter(
            id=member_id,
            company=company,
        ).select_related("user", "company", "role").first()

        if not target_membership:
            return Response(
                {"detail": "Membership not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        old_role = target_membership.role.name if target_membership.role else "None"
        serializer = CompanyMembershipRoleUpdateSerializer(
            target_membership,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_membership = serializer.save()
        new_role = updated_membership.role.name if updated_membership.role else "None"

        # Log Activity
        action_desc = f"Updated membership for {updated_membership.user.username}"
        if old_role != new_role:
            action_desc += f": role changed from {old_role} to {new_role}."
        if "is_active" in request.data:
            action_desc += f": status set to {'active' if updated_membership.is_active else 'inactive'}."

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="role_changed" if old_role != new_role else "member_updated",
            details=action_desc,
        )

        # Notify user
        create_notification(
            company=company,
            recipient=updated_membership.user,
            notification_type="member",
            title="Membership Updated",
            message=f"Your membership in {company.name} was updated: role is now {new_role}.",
            related_module="workspace",
            related_object_id=updated_membership.id,
        )

        return Response(CompanyMembershipSerializer(updated_membership).data, status=status.HTTP_200_OK)

    def delete(self, request, company_id, member_id=None, membership_id=None, **kwargs):
        member_id = member_id or membership_id
        company, membership, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not (is_admin or request.user.is_superuser):
            return Response(
                {"detail": "Company Admin permission required to manage members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_membership = CompanyMembership.objects.filter(
            id=member_id,
            company=company,
        ).select_related("user").first()

        if not target_membership:
            return Response(
                {"detail": "Membership not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        target_user = target_membership.user

        # Support safe deactivation vs full delete
        deactivate_only = request.query_params.get("deactivate") in ["true", "1", "True"]
        if deactivate_only:
            target_membership.is_active = False
            target_membership.save(update_fields=["is_active"])
            action_type = "member_deactivated"
            details = f"Deactivated {target_user.username} from workspace."
            msg = f"Your membership in {company.name} has been deactivated."
        else:
            target_membership.delete()
            action_type = "member_removed"
            details = f"Removed {target_user.username} from company workspace."
            msg = f"You have been removed from {company.name}."

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action=action_type,
            details=details,
        )

        create_notification(
            company=company,
            recipient=target_user,
            notification_type="member",
            title="Workspace Membership Removed",
            message=msg,
            related_module="workspace",
        )

        return Response({"detail": "Member removed safely."}, status=status.HTTP_200_OK)
