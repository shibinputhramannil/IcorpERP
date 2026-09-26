from django.db.models import Q
from django.core.paginator import Paginator
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from accounts.models import CompanyMembership, WorkspaceActivity
from accounts.serializers import CompanyMembershipSerializer
from crm.models import Activity, Customer, Contact, Deal, Lead
from crm.services.gmail_service import GmailService
from documents.models import Document
from documents.serializers import DocumentSerializer


class WorkspaceCollabBaseView(APIView):
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

    def format_note_data(self, activity):
        author_name = "System"
        if activity.user:
            author_name = f"{activity.user.first_name} {activity.user.last_name}".strip() or activity.user.username

        related_info = None
        if activity.customer:
            related_info = {"type": "Customer", "id": activity.customer.id, "name": activity.customer.name}
        elif activity.lead:
            related_info = {"type": "Lead", "id": activity.lead.id, "name": f"{activity.lead.first_name} {activity.lead.last_name}".strip()}
        elif activity.deal:
            related_info = {"type": "Deal", "id": activity.deal.id, "name": activity.deal.title}
        elif activity.contact:
            related_info = {"type": "Contact", "id": activity.contact.id, "name": f"{activity.contact.first_name} {activity.contact.last_name}".strip()}

        return {
            "id": activity.id,
            "title": activity.title,
            "content": activity.description,
            "author_id": activity.user_id,
            "author_name": author_name,
            "customer_id": activity.customer_id,
            "contact_id": activity.contact_id,
            "deal_id": activity.deal_id,
            "lead_id": activity.lead_id,
            "related_entity": related_info,
            "status": activity.status,
            "created_at": activity.created_at,
            "updated_at": activity.updated_at,
        }

    def format_email_data(self, activity):
        sender_name = "System"
        if activity.user:
            sender_name = f"{activity.user.first_name} {activity.user.last_name}".strip() or activity.user.username

        # Extract recipient if present in description or entity
        recipient = ""
        if activity.contact and activity.contact.email:
            recipient = activity.contact.email
        elif activity.customer and activity.customer.email:
            recipient = activity.customer.email
        elif activity.lead and activity.lead.email:
            recipient = activity.lead.email

        # If stored as header in description e.g. "[To: xyz@example.com]"
        desc = activity.description or ""
        if not recipient and "[To: " in desc:
            try:
                recipient = desc.split("[To: ")[1].split("]")[0]
            except Exception:
                pass

        related_info = None
        if activity.customer:
            related_info = {"type": "Customer", "id": activity.customer.id, "name": activity.customer.name}
        elif activity.lead:
            related_info = {"type": "Lead", "id": activity.lead.id, "name": f"{activity.lead.first_name} {activity.lead.last_name}".strip()}
        elif activity.deal:
            related_info = {"type": "Deal", "id": activity.deal.id, "name": activity.deal.title}
        elif activity.contact:
            related_info = {"type": "Contact", "id": activity.contact.id, "name": f"{activity.contact.first_name} {activity.contact.last_name}".strip()}

        return {
            "id": activity.id,
            "subject": activity.title,
            "body": desc,
            "sender_name": sender_name,
            "sender_email": activity.user.email if activity.user else "",
            "recipient": recipient,
            "related_entity": related_info,
            "status": activity.status,
            "created_at": activity.created_at,
        }


# ============================================================
# 1. Workspace Notes API
# ============================================================
class WorkspaceNotesView(WorkspaceCollabBaseView):
    def get(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        queryset = Activity.objects.filter(
            company=company,
            activity_type="Note",
        ).select_related("user", "customer", "lead", "deal", "contact")

        search = request.query_params.get("search")
        if search:
            s = search.strip()
            queryset = queryset.filter(Q(title__icontains=s) | Q(description__icontains=s))

        customer_id = request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        lead_id = request.query_params.get("lead")
        if lead_id:
            queryset = queryset.filter(lead_id=lead_id)

        deal_id = request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)

        contact_id = request.query_params.get("contact")
        if contact_id:
            queryset = queryset.filter(contact_id=contact_id)

        page_number = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)

        notes_data = [self.format_note_data(act) for act in page.object_list]
        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page.number,
            "results": notes_data,
        }, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        title = request.data.get("title", "").strip()
        content = request.data.get("content") or request.data.get("description", "")
        content = str(content).strip()

        if not title:
            # Default title to first words of content
            title = content[:50] + ("..." if len(content) > 50 else "") if content else "Untitled Note"

        customer_id = request.data.get("customer_id") or request.data.get("customer")
        contact_id = request.data.get("contact_id") or request.data.get("contact")
        deal_id = request.data.get("deal_id") or request.data.get("deal")
        lead_id = request.data.get("lead_id") or request.data.get("lead")

        # Validate linkages belong to this company
        customer = Customer.objects.filter(id=customer_id, company=company).first() if customer_id else None
        contact = Contact.objects.filter(id=contact_id, company=company).first() if contact_id else None
        deal = Deal.objects.filter(id=deal_id, company=company).first() if deal_id else None
        lead = Lead.objects.filter(id=lead_id, company=company).first() if lead_id else None

        note_act = Activity.objects.create(
            company=company,
            user=request.user,
            activity_type="Note",
            title=title,
            description=content,
            customer=customer,
            contact=contact,
            deal=deal,
            lead=lead,
            status="Completed",
        )

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="note_created",
            details=f"Created note: '{title}'",
        )

        return Response(self.format_note_data(note_act), status=status.HTTP_201_CREATED)


class WorkspaceNoteDetailView(WorkspaceCollabBaseView):
    def get(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        note_act = Activity.objects.filter(
            id=pk,
            company=company,
            activity_type="Note",
        ).select_related("user", "customer", "lead", "deal", "contact").first()

        if not note_act:
            return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(self.format_note_data(note_act), status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        note_act = Activity.objects.filter(
            id=pk,
            company=company,
            activity_type="Note",
        ).select_related("user", "customer", "lead", "deal", "contact").first()

        if not note_act:
            return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if "title" in data:
            note_act.title = str(data["title"]).strip()
        if "content" in data or "description" in data:
            note_act.description = str(data.get("content", data.get("description", ""))).strip()

        if "customer" in data or "customer_id" in data:
            cid = data.get("customer") or data.get("customer_id")
            note_act.customer = Customer.objects.filter(id=cid, company=company).first() if cid else None
        if "lead" in data or "lead_id" in data:
            lid = data.get("lead") or data.get("lead_id")
            note_act.lead = Lead.objects.filter(id=lid, company=company).first() if lid else None
        if "deal" in data or "deal_id" in data:
            did = data.get("deal") or data.get("deal_id")
            note_act.deal = Deal.objects.filter(id=did, company=company).first() if did else None
        if "contact" in data or "contact_id" in data:
            coid = data.get("contact") or data.get("contact_id")
            note_act.contact = Contact.objects.filter(id=coid, company=company).first() if coid else None

        note_act.save()

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="note_updated",
            details=f"Updated note: '{note_act.title}'",
        )

        return Response(self.format_note_data(note_act), status=status.HTTP_200_OK)

    def delete(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        note_act = Activity.objects.filter(
            id=pk,
            company=company,
            activity_type="Note",
        ).first()

        if not note_act:
            return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)

        title = note_act.title
        note_act.delete()

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="note_deleted",
            details=f"Deleted note: '{title}'",
        )

        return Response({"detail": "Note deleted successfully."}, status=status.HTTP_200_OK)


# ============================================================
# 2. Workspace Mail API
# ============================================================
class WorkspaceMailView(WorkspaceCollabBaseView):
    def get(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        queryset = Activity.objects.filter(
            company=company,
            activity_type="Email",
        ).select_related("user", "customer", "lead", "deal", "contact").order_by("-created_at")

        search = request.query_params.get("search")
        if search:
            s = search.strip()
            queryset = queryset.filter(Q(title__icontains=s) | Q(description__icontains=s))

        page_number = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)

        emails_data = [self.format_email_data(act) for act in page.object_list]
        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page.number,
            "results": emails_data,
        }, status=status.HTTP_200_OK)


class WorkspaceMailSendView(WorkspaceCollabBaseView):
    def post(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        recipient = str(request.data.get("recipient", "")).strip()
        subject = str(request.data.get("subject", "")).strip()
        body = str(request.data.get("body", "")).strip()

        if not recipient:
            return Response({"recipient": ["Recipient email is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not subject:
            return Response({"subject": ["Subject is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not body:
            return Response({"body": ["Email body is required."]}, status=status.HTTP_400_BAD_REQUEST)

        customer_id = request.data.get("customer_id") or request.data.get("customer")
        contact_id = request.data.get("contact_id") or request.data.get("contact")
        deal_id = request.data.get("deal_id") or request.data.get("deal")
        lead_id = request.data.get("lead_id") or request.data.get("lead")

        customer = Customer.objects.filter(id=customer_id, company=company).first() if customer_id else None
        contact = Contact.objects.filter(id=contact_id, company=company).first() if contact_id else None
        deal = Deal.objects.filter(id=deal_id, company=company).first() if deal_id else None
        lead = Lead.objects.filter(id=lead_id, company=company).first() if lead_id else None

        # Dispatch via GmailService
        sender = request.user.email if request.user.email else f"workspace@{company.name.lower().replace(' ', '')}.com"
        dispatch_result = GmailService.send_email(
            subject=subject,
            body=body,
            recipient=recipient,
            sender=sender,
        )

        full_description = f"[To: {recipient}]\n\n{body}"
        if not dispatch_result["sent_externally"]:
            full_description += f"\n\n[Status: {dispatch_result['message']}]"

        email_act = Activity.objects.create(
            company=company,
            user=request.user,
            activity_type="Email",
            title=subject,
            description=full_description,
            customer=customer,
            contact=contact,
            deal=deal,
            lead=lead,
            status="Completed" if dispatch_result.get("success") else "Pending",
        )

        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="email_sent",
            details=f"Sent email to {recipient}: '{subject}' ({dispatch_result.get('provider', 'local')})",
        )

        email_data = self.format_email_data(email_act)
        email_data["dispatch_result"] = dispatch_result

        return Response(email_data, status=status.HTTP_201_CREATED)


class WorkspaceMailStatusView(WorkspaceCollabBaseView):
    def get(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        status_info = GmailService.get_status()
        return Response(status_info, status=status.HTTP_200_OK)


# ============================================================
# 3. Unified Workspace Activity Feed API
# ============================================================
class WorkspaceActivitiesView(WorkspaceCollabBaseView):
    def get(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        # 1. Fetch WorkspaceActivity records
        ws_activities = (
            WorkspaceActivity.objects
            .filter(company=company)
            .select_related("user")
            .order_by("-created_at")[:30]
        )

        # 2. Fetch CRM Activity records
        crm_activities = (
            Activity.objects
            .filter(company=company)
            .select_related("user", "customer", "lead", "deal", "contact")
            .order_by("-created_at")[:30]
        )

        # Merge and sort
        combined = []
        for w in ws_activities:
            u_name = "System"
            if w.user:
                u_name = f"{w.user.first_name} {w.user.last_name}".strip() or w.user.username
            combined.append({
                "id": f"ws-{w.id}",
                "type": w.action,
                "title": w.action.replace("_", " ").title(),
                "description": w.details,
                "user_name": u_name,
                "module": "workspace",
                "timestamp": w.created_at,
                "created_at": w.created_at,
            })

        for c in crm_activities:
            u_name = "System"
            if c.user:
                u_name = f"{c.user.first_name} {c.user.last_name}".strip() or c.user.username
            combined.append({
                "id": f"crm-{c.id}",
                "type": c.activity_type.lower(),
                "title": f"[{c.activity_type}] {c.title}",
                "description": c.description[:120] + ("..." if len(c.description) > 120 else ""),
                "user_name": u_name,
                "module": "crm",
                "timestamp": c.created_at,
                "created_at": c.created_at,
            })

        combined.sort(key=lambda x: x["timestamp"], reverse=True)
        return Response(combined[:40], status=status.HTTP_200_OK)


# ============================================================
# 4. Workspace Collaboration Overview API
# ============================================================
class WorkspaceCollaborationOverviewView(WorkspaceCollabBaseView):
    """
    GET /api/companies/<company_id>/workspace/collaboration/
    Returns aggregated summary across Notes, Emails, Documents, Activities, and Members.
    """
    def get(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        # 1. Notes (top 5)
        recent_notes_qs = Activity.objects.filter(
            company=company, activity_type="Note"
        ).select_related("user", "customer", "lead", "deal", "contact").order_by("-created_at")[:5]
        notes_data = [self.format_note_data(n) for n in recent_notes_qs]
        total_notes = Activity.objects.filter(company=company, activity_type="Note").count()

        # 2. Emails (top 5)
        recent_emails_qs = Activity.objects.filter(
            company=company, activity_type="Email"
        ).select_related("user", "customer", "lead", "deal", "contact").order_by("-created_at")[:5]
        emails_data = [self.format_email_data(e) for e in recent_emails_qs]
        total_emails = Activity.objects.filter(company=company, activity_type="Email").count()

        # 3. Documents (top 5)
        recent_docs_qs = Document.objects.filter(
            company=company
        ).select_related("uploaded_by").order_by("-created_at")[:5]
        documents_data = DocumentSerializer(recent_docs_qs, many=True).data
        total_documents = Document.objects.filter(company=company).count()

        # 4. Activities (top 10)
        recent_ws_acts = WorkspaceActivity.objects.filter(
            company=company
        ).select_related("user").order_by("-created_at")[:10]
        activities_data = [
            {
                "id": act.id,
                "type": act.action,
                "title": act.action.replace("_", " ").title(),
                "details": act.details,
                "user_name": act.user.username if act.user else "System",
                "created_at": act.created_at,
            }
            for act in recent_ws_acts
        ]

        # 5. Members
        members_qs = CompanyMembership.objects.filter(
            company=company
        ).select_related("user", "role").order_by("-created_at")
        total_members = members_qs.count()
        active_members = members_qs.filter(is_active=True).count()
        members_data = CompanyMembershipSerializer(members_qs[:10], many=True).data

        return Response({
            "notes": notes_data,
            "emails": emails_data,
            "documents": documents_data,
            "activities": activities_data,
            "members": members_data,
            "stats": {
                "total_notes": total_notes,
                "total_emails": total_emails,
                "total_documents": total_documents,
                "total_members": total_members,
                "active_members": active_members,
            },
            "company": {
                "id": company.id,
                "name": company.name,
                "email": company.email,
                "phone": company.phone,
                "address": company.address,
                "is_active": company.is_active,
            }
        }, status=status.HTTP_200_OK)
