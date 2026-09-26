from datetime import datetime
from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from accounts.models import WorkspaceActivity
from calendar_events.models import CalendarEvent
from calendar_events.serializers import CalendarEventSerializer


class CalendarBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def get_company_and_membership(self, request, company_id):
        if request.user.is_superuser:
            company = Company.objects.filter(id=company_id, is_active=True).first()
            return company, True

        membership = (
            request.user.company_memberships
            .select_related("company", "role")
            .filter(company_id=company_id, company__is_active=True, is_active=True)
            .first()
        )
        if not membership:
            return None, False

        is_admin = bool(membership.role and membership.role.name == "Company Admin")
        return membership.company, is_admin


class CalendarEventListCreateView(CalendarBaseView):
    def get(self, request, company_id):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        queryset = CalendarEvent.objects.filter(company=company).select_related(
            "created_by", "customer", "lead", "deal"
        )

        event_type = request.query_params.get("event_type")
        if event_type and event_type != "all":
            queryset = queryset.filter(event_type=event_type)

        event_status = request.query_params.get("status")
        if event_status:
            queryset = queryset.filter(status=event_status)

        start_date = request.query_params.get("start")
        if start_date:
            try:
                queryset = queryset.filter(start_time__gte=start_date)
            except Exception:
                pass

        end_date = request.query_params.get("end")
        if end_date:
            try:
                queryset = queryset.filter(end_time__lte=end_date)
            except Exception:
                pass

        search = request.query_params.get("search")
        if search:
            s = search.strip()
            queryset = queryset.filter(
                Q(title__icontains=s) | Q(description__icontains=s) | Q(location__icontains=s)
            )

        serializer = CalendarEventSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CalendarEventSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        event = serializer.save(company=company, created_by=request.user)

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="calendar_event_created",
            details=f"Created event: {event.title} ({event.get_event_type_display()})",
        )

        return Response(CalendarEventSerializer(event).data, status=status.HTTP_201_CREATED)


class CalendarEventDetailView(CalendarBaseView):
    def get(self, request, company_id, pk):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        event = CalendarEvent.objects.filter(id=pk, company=company).select_related(
            "created_by", "customer", "lead", "deal"
        ).first()
        if not event:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(CalendarEventSerializer(event).data, status=status.HTTP_200_OK)

    def put(self, request, company_id, pk):
        return self.patch(request, company_id, pk)

    def patch(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        event = CalendarEvent.objects.filter(id=pk, company=company).first()
        if not event:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CalendarEventSerializer(event, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_event = serializer.save()

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="calendar_event_updated",
            details=f"Updated event: {updated_event.title}",
        )

        return Response(CalendarEventSerializer(updated_event).data, status=status.HTTP_200_OK)

    def delete(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        event = CalendarEvent.objects.filter(id=pk, company=company).first()
        if not event:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        can_delete = is_admin or request.user.is_superuser or (event.created_by_id == request.user.id)
        if not can_delete:
            return Response(
                {"detail": "You do not have permission to delete this event."},
                status=status.HTTP_403_FORBIDDEN,
            )

        title = event.title
        event.delete()

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="calendar_event_deleted",
            details=f"Deleted event: {title}",
        )

        return Response({"detail": "Event deleted successfully."}, status=status.HTTP_200_OK)


class CalendarEventUpcomingView(CalendarBaseView):
    def get(self, request, company_id):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        events = CalendarEvent.objects.filter(
            company=company,
            end_time__gte=now,
            status="scheduled",
        ).select_related("created_by", "customer", "lead", "deal")[:10]

        serializer = CalendarEventSerializer(events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
