import logging
from django.utils import timezone
from django.db.models import Q, Count
from django.core.paginator import Paginator
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from accounts.models import WorkspaceActivity
from crm.models import Activity, Customer, Lead, Deal, Contact
from crm.services.gmail_service import GmailService
from emails.models import EmailMessage
from emails.serializers import EmailMessageSerializer

logger = logging.getLogger(__name__)


class EmailBaseView(APIView):
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


class EmailListCreateView(EmailBaseView):
    def get(self, request, company_id):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        queryset = EmailMessage.objects.filter(company=company).select_related(
            "sender", "customer", "lead", "deal"
        )

        folder = request.query_params.get("folder", "inbox")
        if folder in ["inbox", "sent", "drafts", "trash"]:
            queryset = queryset.filter(folder=folder)

        search = request.query_params.get("search")
        if search:
            s = search.strip()
            queryset = queryset.filter(
                Q(subject__icontains=s)
                | Q(body__icontains=s)
                | Q(recipient__icontains=s)
                | Q(sender_email__icontains=s)
                | Q(sender_name__icontains=s)
            )

        customer_id = request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        lead_id = request.query_params.get("lead")
        if lead_id:
            queryset = queryset.filter(lead_id=lead_id)

        deal_id = request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)

        page_number = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)

        serializer = EmailMessageSerializer(page.object_list, many=True)
        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page.number,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        is_draft = data.get("is_draft", False) or data.get("folder") == "drafts"

        recipient = data.get("recipient", "").strip()
        subject = data.get("subject", "").strip()
        body = data.get("body", "").strip()

        if not is_draft and not recipient:
            return Response({"recipient": ["Recipient email is required."]}, status=status.HTTP_400_BAD_REQUEST)

        if not subject and not is_draft:
            subject = "(No Subject)"

        folder = "drafts" if is_draft else "sent"
        msg_status = "draft" if is_draft else "sent"

        # Sender details
        sender_user = request.user
        sender_email = sender_user.email or "noreply@transt.local"
        sender_name = f"{sender_user.first_name} {sender_user.last_name}".strip() or sender_user.username

        # CRM linkage resolution
        customer_id = data.get("customer") or data.get("customer_id")
        lead_id = data.get("lead") or data.get("lead_id")
        deal_id = data.get("deal") or data.get("deal_id")

        customer = Customer.objects.filter(id=customer_id, company=company).first() if customer_id else None
        lead = Lead.objects.filter(id=lead_id, company=company).first() if lead_id else None
        deal = Deal.objects.filter(id=deal_id, company=company).first() if deal_id else None

        sent_at = timezone.now() if not is_draft else None

        # Dispatch via Gmail / SMTP if not draft
        delivery_status = "sent"
        if not is_draft and recipient:
            try:
                delivery_result = GmailService.send_email(
                    subject=subject,
                    body=body,
                    recipient=recipient,
                    sender=sender_email,
                )
                if delivery_result and delivery_result.get("status") == "simulated":
                    delivery_status = "sent"
                elif delivery_result and delivery_result.get("status") == "sent":
                    delivery_status = "delivered"
            except Exception as e:
                logger.warning(f"Email delivery notice: {e}")
                delivery_status = "sent"

        email_obj = EmailMessage.objects.create(
            company=company,
            sender=sender_user,
            sender_name=sender_name,
            sender_email=sender_email,
            recipient=recipient,
            recipient_name=data.get("recipient_name", ""),
            cc=data.get("cc", ""),
            bcc=data.get("bcc", ""),
            subject=subject or "(Draft)",
            body=body,
            folder=folder,
            status=delivery_status if not is_draft else "draft",
            is_read=True,
            customer=customer,
            lead=lead,
            deal=deal,
            sent_at=sent_at,
        )

        if not is_draft:
            # Sync with CRM activity log
            Activity.objects.create(
                company=company,
                user=sender_user,
                activity_type="Email",
                title=f"Email: {subject}",
                description=f"[To: {recipient}]\n\n{body}",
                customer=customer,
                lead=lead,
                deal=deal,
                status="Completed",
            )

            WorkspaceActivity.objects.create(
                company=company,
                user=sender_user,
                action="email_sent",
                details=f"Sent email '{subject}' to {recipient}",
            )
        else:
            WorkspaceActivity.objects.create(
                company=company,
                user=sender_user,
                action="email_draft_saved",
                details=f"Saved draft email '{subject}'",
            )

        return Response(EmailMessageSerializer(email_obj).data, status=status.HTTP_201_CREATED)


class EmailDetailView(EmailBaseView):
    def get(self, request, company_id, pk):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        email_obj = EmailMessage.objects.filter(id=pk, company=company).select_related(
            "sender", "customer", "lead", "deal"
        ).first()
        if not email_obj:
            return Response({"detail": "Email not found."}, status=status.HTTP_404_NOT_FOUND)

        if not email_obj.is_read:
            email_obj.is_read = True
            email_obj.save(update_fields=["is_read", "updated_at"])

        return Response(EmailMessageSerializer(email_obj).data, status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        email_obj = EmailMessage.objects.filter(id=pk, company=company).first()
        if not email_obj:
            return Response({"detail": "Email not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmailMessageSerializer(email_obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_email = serializer.save()
        return Response(EmailMessageSerializer(updated_email).data, status=status.HTTP_200_OK)

    def delete(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        email_obj = EmailMessage.objects.filter(id=pk, company=company).first()
        if not email_obj:
            return Response({"detail": "Email not found."}, status=status.HTTP_404_NOT_FOUND)

        if email_obj.folder == "trash":
            email_obj.delete()
            return Response({"detail": "Email permanently deleted."}, status=status.HTTP_200_OK)
        else:
            email_obj.folder = "trash"
            email_obj.save(update_fields=["folder", "updated_at"])
            return Response({"detail": "Email moved to trash."}, status=status.HTTP_200_OK)


class EmailFolderCountsView(EmailBaseView):
    def get(self, request, company_id):
        company, _ = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        qs = EmailMessage.objects.filter(company=company)
        counts = {
            "inbox": qs.filter(folder="inbox").count(),
            "sent": qs.filter(folder="sent").count(),
            "drafts": qs.filter(folder="drafts").count(),
            "trash": qs.filter(folder="trash").count(),
            "unread": qs.filter(folder="inbox", is_read=False).count(),
        }
        return Response(counts, status=status.HTTP_200_OK)
