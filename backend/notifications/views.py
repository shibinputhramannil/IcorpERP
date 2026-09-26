from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.paginator import Paginator

from company.models import Company
from notifications.models import Notification
from notifications.serializers import NotificationSerializer


class NotificationBaseView(APIView):
    """
    Base view enforcing multi-tenant company isolation for notifications.
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


class NotificationListView(NotificationBaseView):
    """
    GET /api/companies/<company_id>/notifications/
    Returns paginated notifications for the current user in this company, ordered latest first.
    Query params:
      - unread_only (bool): If true, returns only unread notifications.
      - module (str): Filter by related_module or notification_type.
      - page (int): 1-indexed page.
      - page_size (int): items per page (default: 20).
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have permission to view notifications for this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = Notification.objects.filter(
            company=company,
            recipient=request.user,
        ).order_by("-created_at")

        unread_only = request.query_params.get("unread_only") or request.query_params.get("is_read")
        if unread_only in ["true", "True", "1", "false", "0"]:
            if unread_only in ["true", "True", "1"]:
                queryset = queryset.filter(is_read=False)
            elif unread_only in ["false", "0"]:
                queryset = queryset.filter(is_read=True)

        module_filter = request.query_params.get("module")
        if module_filter:
            queryset = queryset.filter(notification_type=module_filter)

        page_number = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)

        serializer = NotificationSerializer(page.object_list, many=True)
        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page.number,
            "has_next": page.has_next(),
            "has_previous": page.has_previous(),
            "results": serializer.data,
        }, status=status.HTTP_200_OK)


class NotificationReadView(NotificationBaseView):
    """
    PATCH /api/companies/<company_id>/notifications/<id>/read/
    POST  /api/companies/<company_id>/notifications/<id>/read/
    Marks a single notification as read for the authenticated recipient.
    """
    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company's notifications."},
                status=status.HTTP_403_FORBIDDEN,
            )

        notification = Notification.objects.filter(
            id=pk,
            company=company,
            recipient=request.user,
        ).first()

        if not notification:
            return Response(
                {"detail": "Notification not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)

    def post(self, request, company_id, pk):
        return self.patch(request, company_id, pk)


class NotificationReadAllView(NotificationBaseView):
    """
    POST /api/companies/<company_id>/notifications/read-all/
    Marks all notifications for the current user in this company as read.
    """
    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company's notifications."},
                status=status.HTTP_403_FORBIDDEN,
            )

        updated_count = Notification.objects.filter(
            company=company,
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response({
            "message": f"All {updated_count} unread notification(s) marked as read.",
            "updated_count": updated_count,
            "marked_read_count": updated_count,
        }, status=status.HTTP_200_OK)


class NotificationUnreadCountView(NotificationBaseView):
    """
    GET /api/companies/<company_id>/notifications/unread-count/
    Returns the total number of unread notifications for the current user in this company.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company's notifications."},
                status=status.HTTP_403_FORBIDDEN,
            )

        unread_count = Notification.objects.filter(
            company=company,
            recipient=request.user,
            is_read=False,
        ).count()

        return Response({"unread_count": unread_count}, status=status.HTTP_200_OK)
