from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from apps.employee.models import Employee
from crm.models import Customer, Lead, Deal, Contact, Activity
from inventory.models import Product
from sales.models import Invoice as SalesInvoice, SalesOrder
from purchase.models import PurchaseInvoice, PurchaseOrder
from documents.models import Document
from calendar_events.models import CalendarEvent


class GlobalSearchView(APIView):
    """
    GET /api/search/?q=<query>&company_id=<optional>
    Global cross-module and multi-company search for authenticated users.
    Searches across authorized Companies, Employees, CRM (Customers, Leads, Deals, Contacts),
    Inventory (Products), Sales (Invoices, Orders), Purchases (Invoices, Orders),
    Documents, Notes, and Calendar Events.
    """
    permission_classes = [IsAuthenticated]

    def get_authorized_companies(self, user, company_id=None):
        if user.is_superuser:
            qs = Company.objects.filter(is_active=True)
        else:
            qs = Company.objects.filter(
                memberships__user=user,
                memberships__is_active=True,
                is_active=True,
            ).distinct()

        if company_id:
            qs = qs.filter(id=company_id)
        return qs

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query or len(query) < 2:
            return Response({
                "query": query,
                "total_results": 0,
                "results": {},
            }, status=status.HTTP_200_OK)

        company_id = request.query_params.get("company_id")
        if company_id:
            try:
                company_id = int(company_id)
            except (ValueError, TypeError):
                company_id = None

        companies_qs = self.get_authorized_companies(request.user, company_id)
        company_ids = list(companies_qs.values_list("id", flat=True))

        if not company_ids:
            return Response({
                "query": query,
                "total_results": 0,
                "results": {},
            }, status=status.HTTP_200_OK)

        results = {}
        total_count = 0

        # 1. Companies
        comp_matches = companies_qs.filter(
            Q(name__icontains=query) | Q(email__icontains=query) | Q(phone__icontains=query)
        )[:5]
        if comp_matches.exists():
            results["companies"] = [
                {
                    "id": c.id,
                    "title": c.name,
                    "subtitle": c.email or c.phone or "Company Workspace",
                    "type": "Company",
                    "company_id": c.id,
                    "company_name": c.name,
                    "url": "/companies",
                }
                for c in comp_matches
            ]
            total_count += len(results["companies"])

        # 2. Employees
        emp_matches = Employee.objects.filter(
            company_id__in=company_ids,
            is_active=True,
        ).filter(
            Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(user__email__icontains=query)
            | Q(phone__icontains=query)
            | Q(designation__icontains=query)
            | Q(department__icontains=query)
        ).select_related("company")[:5]
        if emp_matches.exists():
            results["employees"] = [
                {
                    "id": e.id,
                    "title": f"{e.first_name} {e.last_name}".strip(),
                    "subtitle": f"{e.designation or 'Staff'} - {e.department or 'General'} ({e.company.name})",
                    "type": "Employee",
                    "company_id": e.company_id,
                    "company_name": e.company.name,
                    "url": "/employees",
                }
                for e in emp_matches
            ]
            total_count += len(results["employees"])

        # 3. CRM Customers
        cust_matches = Customer.objects.filter(
            company_id__in=company_ids,
        ).filter(
            Q(name__icontains=query) | Q(email__icontains=query) | Q(phone__icontains=query)
        ).select_related("company")[:5]
        if cust_matches.exists():
            results["customers"] = [
                {
                    "id": c.id,
                    "title": c.name,
                    "subtitle": f"{c.customer_type} Customer - {c.email or c.phone or ''} ({c.company.name})",
                    "type": "Customer",
                    "company_id": c.company_id,
                    "company_name": c.company.name,
                    "url": "/crm",
                }
                for c in cust_matches
            ]
            total_count += len(results["customers"])

        # 4. CRM Leads
        lead_matches = Lead.objects.filter(
            company_id__in=company_ids,
        ).filter(
            Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(email__icontains=query)
            | Q(lead_company__icontains=query)
        ).select_related("company")[:5]
        if lead_matches.exists():
            results["leads"] = [
                {
                    "id": l.id,
                    "title": f"{l.first_name} {l.last_name}".strip(),
                    "subtitle": f"Lead ({l.status}) - {l.lead_company or l.email} ({l.company.name})",
                    "type": "Lead",
                    "company_id": l.company_id,
                    "company_name": l.company.name,
                    "url": "/crm",
                }
                for l in lead_matches
            ]
            total_count += len(results["leads"])

        # 5. CRM Deals
        deal_matches = Deal.objects.filter(
            company_id__in=company_ids,
        ).filter(
            Q(title__icontains=query)
        ).select_related("company")[:5]
        if deal_matches.exists():
            results["deals"] = [
                {
                    "id": d.id,
                    "title": d.title,
                    "subtitle": f"Deal ({d.stage}) - ${d.value} ({d.company.name})",
                    "type": "Deal",
                    "company_id": d.company_id,
                    "company_name": d.company.name,
                    "url": "/crm",
                }
                for d in deal_matches
            ]
            total_count += len(results["deals"])

        # 6. Inventory Products
        prod_matches = Product.objects.filter(
            company_id__in=company_ids,
            is_active=True,
        ).filter(
            Q(name__icontains=query) | Q(sku__icontains=query)
        ).select_related("company")[:5]
        if prod_matches.exists():
            results["products"] = [
                {
                    "id": p.id,
                    "title": p.name,
                    "subtitle": f"SKU: {p.sku} - Cost: ${p.cost_price} ({p.company.name})",
                    "type": "Product",
                    "company_id": p.company_id,
                    "company_name": p.company.name,
                    "url": "/inventory",
                }
                for p in prod_matches
            ]
            total_count += len(results["products"])

        # 7. Sales Invoices & Orders
        inv_matches = SalesInvoice.objects.filter(
            company_id__in=company_ids,
        ).filter(
            Q(invoice_number__icontains=query)
        ).select_related("company", "customer")[:5]
        if inv_matches.exists():
            results["sales"] = [
                {
                    "id": inv.id,
                    "title": f"Invoice {inv.invoice_number}",
                    "subtitle": f"${inv.total} - {inv.status} ({inv.company.name})",
                    "type": "Sales Invoice",
                    "company_id": inv.company_id,
                    "company_name": inv.company.name,
                    "url": "/sales",
                }
                for inv in inv_matches
            ]
            total_count += len(results["sales"])

        # 8. Purchase Invoices & Orders
        pinv_matches = PurchaseInvoice.objects.filter(
            company_id__in=company_ids,
        ).filter(
            Q(invoice_number__icontains=query)
        ).select_related("company", "vendor")[:5]
        if pinv_matches.exists():
            results["purchases"] = [
                {
                    "id": pi.id,
                    "title": f"Bill {pi.invoice_number}",
                    "subtitle": f"${pi.total} - {pi.status} ({pi.company.name})",
                    "type": "Purchase Bill",
                    "company_id": pi.company_id,
                    "company_name": pi.company.name,
                    "url": "/purchase",
                }
                for pi in pinv_matches
            ]
            total_count += len(results["purchases"])

        # 9. Documents
        doc_matches = Document.objects.filter(
            company_id__in=company_ids,
        ).filter(
            Q(name__icontains=query) | Q(tags__icontains=query)
        ).select_related("company")[:5]
        if doc_matches.exists():
            results["documents"] = [
                {
                    "id": d.id,
                    "title": d.name,
                    "subtitle": f"{d.file_type} ({d.category.title()}) - {d.file_size_formatted if hasattr(d, 'file_size_formatted') else ''} ({d.company.name})",
                    "type": "Document",
                    "company_id": d.company_id,
                    "company_name": d.company.name,
                    "url": "/documents",
                }
                for d in doc_matches
            ]
            total_count += len(results["documents"])

        # 10. Notes
        note_matches = Activity.objects.filter(
            company_id__in=company_ids,
            activity_type="Note",
        ).filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).select_related("company")[:5]
        if note_matches.exists():
            results["notes"] = [
                {
                    "id": n.id,
                    "title": n.title,
                    "subtitle": f"{n.description[:60]}... ({n.company.name})" if len(n.description) > 60 else f"{n.description} ({n.company.name})",
                    "type": "Note",
                    "company_id": n.company_id,
                    "company_name": n.company.name,
                    "url": "/notes",
                }
                for n in note_matches
            ]
            total_count += len(results["notes"])

        # 11. Calendar Events
        cal_matches = CalendarEvent.objects.filter(
            company_id__in=company_ids,
        ).filter(
            Q(title__icontains=query) | Q(description__icontains=query) | Q(location__icontains=query)
        ).select_related("company")[:5]
        if cal_matches.exists():
            results["calendar"] = [
                {
                    "id": ce.id,
                    "title": ce.title,
                    "subtitle": f"{ce.get_event_type_display()} at {ce.location or 'Online'} ({ce.company.name})",
                    "type": "Event",
                    "company_id": ce.company_id,
                    "company_name": ce.company.name,
                    "url": "/calendar",
                }
                for ce in cal_matches
            ]
            total_count += len(results["calendar"])

        return Response({
            "query": query,
            "total_results": total_count,
            "results": results,
        }, status=status.HTTP_200_OK)
