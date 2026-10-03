import csv
import io
import logging
from decimal import Decimal
from datetime import datetime, date, timedelta

from django.db.models import Sum, Count, Q, F, Avg
from django.utils import timezone

from company.models import Company
from apps.employee.models import Employee
from crm.models import Customer, Lead, Deal, Contact
from inventory.models import Product, Stock, Warehouse, Category, Vendor
from sales.models import SalesOrder, Invoice, Payment as SalesPayment
from purchase.models import PurchaseOrder, PurchaseInvoice, PurchasePayment
from finance.models import Account, BankAccount, CashAccount
from finance.services import (
    get_profit_and_loss,
    get_finance_dashboard,
    get_accounts_receivable_summary,
    get_accounts_payable_summary,
)

logger = logging.getLogger(__name__)


def format_currency(val):
    if val is None:
        return "$0.00"
    try:
        dec = Decimal(str(val))
        return f"${dec:,.2f}"
    except Exception:
        return f"${val}"


# ============================================================
# 1. EXECUTIVE DASHBOARD SUMMARY REPORT
# ============================================================

def get_executive_summary(company, date_from=None, date_to=None):
    """
    Consolidated C-Suite executive overview across all 8 modules.
    """
    now = timezone.now()
    if not date_from:
        # Default: current month start
        date_from = now.replace(day=1).date()
    if not date_to:
        date_to = now.date()

    # 1. Sales Telemetry
    invoices_qs = Invoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
    ).exclude(status=Invoice.InvoiceStatus.CANCELLED)

    sales_total = invoices_qs.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    sales_paid = invoices_qs.aggregate(s=Sum("amount_paid"))["s"] or Decimal("0.00")
    sales_outstanding = invoices_qs.aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
    invoices_count = invoices_qs.count()

    # 2. Purchase Telemetry
    bills_qs = PurchaseInvoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
    ).exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)

    purchase_total = bills_qs.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    purchase_paid = bills_qs.aggregate(s=Sum("amount_paid"))["s"] or Decimal("0.00")
    purchase_outstanding = bills_qs.aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
    bills_count = bills_qs.count()

    # 3. Financial Net Profit & Margins
    try:
        pnl = get_profit_and_loss(company, date_from=date_from, date_to=date_to)
        net_profit = Decimal(str(pnl.get("net_profit", "0.00")))
        gross_profit = Decimal(str(pnl.get("gross_profit", "0.00")))
        operating_revenue = Decimal(str(pnl.get("revenue", {}).get("total", "0.00")))
        operating_expenses = Decimal(str(pnl.get("expenses", {}).get("total", "0.00")))
    except Exception as e:
        logger.warning(f"Error computing P&L in executive report: {e}")
        net_profit = Decimal("0.00")
        gross_profit = Decimal("0.00")
        operating_revenue = sales_total
        operating_expenses = Decimal("0.00")

    # Liquid Capital (Cash & Bank)
    try:
        dash = get_finance_dashboard(company)
        liquid_funds = Decimal(str(dash.get("kpis", {}).get("total_liquid_funds", "0.00")))
    except Exception:
        liquid_funds = Decimal("0.00")

    # 4. Inventory Telemetry
    products_qs = Product.objects.filter(company=company, is_active=True).prefetch_related("stocks")
    total_skus = products_qs.count()
    low_stock_count = 0
    out_of_stock_count = 0
    total_inventory_valuation = Decimal("0.00")

    for p in products_qs:
        stocks = list(p.stocks.all())
        qty = sum((s.quantity for s in stocks), Decimal("0.00"))
        total_inventory_valuation += qty * p.cost_price
        if qty <= Decimal("0.00"):
            out_of_stock_count += 1
        elif qty <= Decimal(str(p.reorder_level)):
            low_stock_count += 1

    # 5. CRM Telemetry
    total_customers = Customer.objects.filter(company=company).count()
    open_leads = Lead.objects.filter(company=company).exclude(status__in=["Converted", "Lost"]).count()
    open_deals_val = (
        Deal.objects.filter(company=company)
        .exclude(stage__in=["Won", "Lost"])
        .aggregate(s=Sum("value"))["s"] or Decimal("0.00")
    )

    # 6. Employee & HR Telemetry
    total_employees = Employee.objects.filter(company=company, is_active=True).count()

    # Net Operational Margin
    margin_pct = (
        round((net_profit / operating_revenue) * Decimal("100.00"), 2)
        if operating_revenue > Decimal("0.00")
        else Decimal("0.00")
    )

    return {
        "company_name": company.name,
        "date_from": str(date_from),
        "date_to": str(date_to),
        "kpis": {
            "sales_total": str(sales_total),
            "sales_total_formatted": format_currency(sales_total),
            "sales_paid": str(sales_paid),
            "sales_paid_formatted": format_currency(sales_paid),
            "sales_outstanding": str(sales_outstanding),
            "sales_outstanding_formatted": format_currency(sales_outstanding),
            "invoices_count": invoices_count,
            "purchase_total": str(purchase_total),
            "purchase_total_formatted": format_currency(purchase_total),
            "purchase_paid": str(purchase_paid),
            "purchase_paid_formatted": format_currency(purchase_paid),
            "purchase_outstanding": str(purchase_outstanding),
            "purchase_outstanding_formatted": format_currency(purchase_outstanding),
            "bills_count": bills_count,
            "net_profit": str(net_profit),
            "net_profit_formatted": format_currency(net_profit),
            "gross_profit": str(gross_profit),
            "gross_profit_formatted": format_currency(gross_profit),
            "operating_revenue": str(operating_revenue),
            "operating_revenue_formatted": format_currency(operating_revenue),
            "operating_expenses": str(operating_expenses),
            "operating_expenses_formatted": format_currency(operating_expenses),
            "margin_percentage": str(margin_pct),
            "liquid_funds": str(liquid_funds),
            "liquid_funds_formatted": format_currency(liquid_funds),
            "total_inventory_valuation": f"{total_inventory_valuation:.2f}",
            "total_inventory_valuation_formatted": format_currency(total_inventory_valuation),
            "total_skus": total_skus,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "total_customers": total_customers,
            "open_leads_count": open_leads,
            "open_deals_value": str(open_deals_val),
            "open_deals_value_formatted": format_currency(open_deals_val),
            "total_employees": total_employees,
        },
        "sales_vs_purchase": {
            "sales": str(sales_total),
            "purchases": str(purchase_total),
            "net_cash_flow": str(sales_paid - purchase_paid),
            "net_cash_flow_formatted": format_currency(sales_paid - purchase_paid),
        }
    }


# ============================================================
# 2. SALES SUMMARY REPORT
# ============================================================

def get_sales_summary(company, date_from=None, date_to=None):
    """
    Detailed sales report with invoices, collections, statuses, and top customer accounts.
    """
    invoices_qs = Invoice.objects.filter(company=company)
    orders_qs = SalesOrder.objects.filter(company=company)
    payments_qs = SalesPayment.objects.filter(company=company)

    if date_from:
        invoices_qs = invoices_qs.filter(invoice_date__gte=date_from)
        orders_qs = orders_qs.filter(order_date__gte=date_from)
        payments_qs = payments_qs.filter(payment_date__gte=date_from)
    if date_to:
        invoices_qs = invoices_qs.filter(invoice_date__lte=date_to)
        orders_qs = orders_qs.filter(order_date__lte=date_to)
        payments_qs = payments_qs.filter(payment_date__lte=date_to)

    non_cancelled_invoices = invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
    total_invoiced = non_cancelled_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    total_paid = non_cancelled_invoices.aggregate(s=Sum("amount_paid"))["s"] or Decimal("0.00")
    total_balance_due = non_cancelled_invoices.aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
    total_discount = non_cancelled_invoices.aggregate(s=Sum("discount"))["s"] or Decimal("0.00")
    total_tax = non_cancelled_invoices.aggregate(s=Sum("tax"))["s"] or Decimal("0.00")

    total_orders = orders_qs.count()
    total_orders_val = orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED).aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    avg_order_value = round(total_orders_val / Decimal(str(total_orders)), 2) if total_orders > 0 else Decimal("0.00")

    # Invoices by Status
    status_counts = (
        invoices_qs.values("status")
        .annotate(count=Count("id"), total_amount=Sum("total"))
        .order_by("status")
    )
    status_breakdown = [
        {
            "status": s["status"],
            "count": s["count"],
            "total_amount": str(s["total_amount"] or Decimal("0.00")),
            "total_formatted": format_currency(s["total_amount"]),
        }
        for s in status_counts
    ]

    # Top Customers by Invoiced Revenue
    customer_revenue = (
        non_cancelled_invoices.values("customer_id", "customer__name")
        .annotate(total_revenue=Sum("total"), invoices_count=Count("id"))
        .order_by("-total_revenue")[:5]
    )
    top_customers = [
        {
            "customer_id": c["customer_id"],
            "customer_name": c["customer__name"],
            "invoices_count": c["invoices_count"],
            "total_revenue": str(c["total_revenue"] or Decimal("0.00")),
            "total_revenue_formatted": format_currency(c["total_revenue"]),
        }
        for c in customer_revenue
    ]

    # Itemized Recent Invoices
    recent_invoices = [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": inv.customer.name,
            "invoice_date": str(inv.invoice_date),
            "due_date": str(inv.due_date),
            "status": inv.status,
            "total": str(inv.total),
            "amount_paid": str(inv.amount_paid),
            "balance_due": str(inv.balance_due),
        }
        for inv in non_cancelled_invoices.select_related("customer").order_by("-invoice_date", "-id")[:15]
    ]

    return {
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None,
        "summary": {
            "total_invoiced": str(total_invoiced),
            "total_invoiced_formatted": format_currency(total_invoiced),
            "total_paid": str(total_paid),
            "total_paid_formatted": format_currency(total_paid),
            "total_balance_due": str(total_balance_due),
            "total_balance_due_formatted": format_currency(total_balance_due),
            "total_discount": str(total_discount),
            "total_tax": str(total_tax),
            "invoices_count": non_cancelled_invoices.count(),
            "total_orders": total_orders,
            "total_orders_value": str(total_orders_val),
            "average_order_value": str(avg_order_value),
            "average_order_value_formatted": format_currency(avg_order_value),
        },
        "status_breakdown": status_breakdown,
        "top_customers": top_customers,
        "recent_invoices": recent_invoices,
    }


# ============================================================
# 3. PURCHASE SUMMARY REPORT
# ============================================================

def get_purchase_summary(company, date_from=None, date_to=None):
    """
    Detailed procurement and vendor obligations report.
    """
    bills_qs = PurchaseInvoice.objects.filter(company=company)
    pos_qs = PurchaseOrder.objects.filter(company=company)
    payments_qs = PurchasePayment.objects.filter(company=company)

    if date_from:
        bills_qs = bills_qs.filter(invoice_date__gte=date_from)
        pos_qs = pos_qs.filter(order_date__gte=date_from)
        payments_qs = payments_qs.filter(payment_date__gte=date_from)
    if date_to:
        bills_qs = bills_qs.filter(invoice_date__lte=date_to)
        pos_qs = pos_qs.filter(order_date__lte=date_to)
        payments_qs = payments_qs.filter(payment_date__lte=date_to)

    non_cancelled_bills = bills_qs.exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
    total_billed = non_cancelled_bills.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    total_paid = non_cancelled_bills.aggregate(s=Sum("amount_paid"))["s"] or Decimal("0.00")
    total_balance_due = non_cancelled_bills.aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")

    total_pos = pos_qs.count()
    total_pos_val = pos_qs.exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED).aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    avg_po_value = round(total_pos_val / Decimal(str(total_pos)), 2) if total_pos > 0 else Decimal("0.00")

    # Status Breakdown
    status_counts = (
        bills_qs.values("status")
        .annotate(count=Count("id"), total_amount=Sum("total"))
        .order_by("status")
    )
    status_breakdown = [
        {
            "status": s["status"],
            "count": s["count"],
            "total_amount": str(s["total_amount"] or Decimal("0.00")),
            "total_formatted": format_currency(s["total_amount"]),
        }
        for s in status_counts
    ]

    # Top Vendors by Spend
    vendor_spends = (
        non_cancelled_bills.values("vendor_id", "vendor__name")
        .annotate(total_spend=Sum("total"), bills_count=Count("id"))
        .order_by("-total_spend")[:5]
    )
    top_vendors = [
        {
            "vendor_id": v["vendor_id"],
            "vendor_name": v["vendor__name"],
            "bills_count": v["bills_count"],
            "total_spend": str(v["total_spend"] or Decimal("0.00")),
            "total_spend_formatted": format_currency(v["total_spend"]),
        }
        for v in vendor_spends
    ]

    # Recent Vendor Bills
    recent_bills = [
        {
            "id": b.id,
            "invoice_number": b.invoice_number,
            "vendor_name": b.vendor.name,
            "invoice_date": str(b.invoice_date),
            "due_date": str(b.due_date) if b.due_date else None,
            "status": b.status,
            "total": str(b.total),
            "amount_paid": str(b.amount_paid),
            "balance_due": str(b.balance_due),
        }
        for b in non_cancelled_bills.select_related("vendor").order_by("-invoice_date", "-id")[:15]
    ]

    return {
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None,
        "summary": {
            "total_billed": str(total_billed),
            "total_billed_formatted": format_currency(total_billed),
            "total_paid": str(total_paid),
            "total_paid_formatted": format_currency(total_paid),
            "total_balance_due": str(total_balance_due),
            "total_balance_due_formatted": format_currency(total_balance_due),
            "bills_count": non_cancelled_bills.count(),
            "total_purchase_orders": total_pos,
            "total_purchase_orders_value": str(total_pos_val),
            "average_po_value": str(avg_po_value),
            "average_po_value_formatted": format_currency(avg_po_value),
        },
        "status_breakdown": status_breakdown,
        "top_vendors": top_vendors,
        "recent_bills": recent_bills,
    }


# ============================================================
# 4. INVENTORY SUMMARY REPORT
# ============================================================

def get_inventory_summary(company):
    """
    Catalog, warehouse inventory valuations, and reorder alerts.
    """
    products_qs = Product.objects.filter(company=company, is_active=True).prefetch_related("stocks", "category")
    warehouses_qs = Warehouse.objects.filter(company=company, is_active=True)

    total_skus = products_qs.count()
    total_quantity = Decimal("0.00")
    total_valuation = Decimal("0.00")
    low_stock_items = []
    out_of_stock_items = []

    for p in products_qs:
        stocks = list(p.stocks.all())
        qty = sum((s.quantity for s in stocks), Decimal("0.00"))
        total_quantity += qty
        val = qty * p.cost_price
        total_valuation += val

        item_payload = {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category.name if p.category else "Uncategorized",
            "quantity": str(qty),
            "reorder_level": p.reorder_level,
            "cost_price": str(p.cost_price),
            "selling_price": str(p.selling_price),
            "valuation": f"{val:.2f}",
        }

        if qty <= Decimal("0.00"):
            out_of_stock_items.append(item_payload)
        elif qty <= Decimal(str(p.reorder_level)):
            low_stock_items.append(item_payload)

    # Warehouse Breakdown
    warehouse_breakdown = []
    for wh in warehouses_qs:
        wh_stocks = Stock.objects.filter(warehouse=wh).select_related("product")
        wh_qty = wh_stocks.aggregate(s=Sum("quantity"))["s"] or Decimal("0.00")
        wh_val = sum((s.quantity * s.product.cost_price for s in wh_stocks), Decimal("0.00"))
        warehouse_breakdown.append({
            "warehouse_id": wh.id,
            "name": wh.name,
            "code": wh.code,
            "items_count": wh_stocks.count(),
            "total_quantity": str(wh_qty),
            "total_valuation": f"{wh_val:.2f}",
            "total_valuation_formatted": format_currency(wh_val),
        })

    return {
        "summary": {
            "total_skus": total_skus,
            "total_quantity": str(total_quantity),
            "total_valuation": f"{total_valuation:.2f}",
            "total_valuation_formatted": format_currency(total_valuation),
            "warehouses_count": warehouses_qs.count(),
            "low_stock_count": len(low_stock_items),
            "out_of_stock_count": len(out_of_stock_items),
        },
        "warehouses": warehouse_breakdown,
        "low_stock_items": low_stock_items[:20],
        "out_of_stock_items": out_of_stock_items[:20],
    }


# ============================================================
# 5. CRM SUMMARY REPORT
# ============================================================

def get_crm_summary(company, date_from=None, date_to=None):
    """
    CRM customer segmentation, lead conversion funnel, and deal pipeline.
    """
    customers_qs = Customer.objects.filter(company=company)
    leads_qs = Lead.objects.filter(company=company)
    deals_qs = Deal.objects.filter(company=company)

    if date_from:
        customers_qs = customers_qs.filter(created_at__date__gte=date_from)
        leads_qs = leads_qs.filter(created_at__date__gte=date_from)
        deals_qs = deals_qs.filter(created_at__date__gte=date_from)
    if date_to:
        customers_qs = customers_qs.filter(created_at__date__lte=date_to)
        leads_qs = leads_qs.filter(created_at__date__lte=date_to)
        deals_qs = deals_qs.filter(created_at__date__lte=date_to)

    total_customers = customers_qs.count()
    corporate_customers = customers_qs.filter(customer_type="Corporate").count()
    individual_customers = customers_qs.filter(customer_type="Individual").count()

    total_leads = leads_qs.count()
    converted_leads = leads_qs.filter(status="Converted").count()
    conversion_rate = round((Decimal(str(converted_leads)) / Decimal(str(total_leads))) * Decimal("100.00"), 2) if total_leads > 0 else Decimal("0.00")

    # Leads by Status Funnel
    lead_status_counts = (
        leads_qs.values("status")
        .annotate(count=Count("id"), total_value=Sum("estimated_value"))
        .order_by("status")
    )
    leads_funnel = [
        {
            "status": s["status"],
            "count": s["count"],
            "total_value": str(s["total_value"] or Decimal("0.00")),
            "total_value_formatted": format_currency(s["total_value"]),
        }
        for s in lead_status_counts
    ]

    # Deals by Stage
    deals_count = deals_qs.count()
    total_deal_pipeline_val = deals_qs.aggregate(s=Sum("value"))["s"] or Decimal("0.00")
    deal_stages = (
        deals_qs.values("stage")
        .annotate(count=Count("id"), total_value=Sum("value"))
        .order_by("stage")
    )
    deals_breakdown = [
        {
            "stage": s["stage"],
            "count": s["count"],
            "total_value": str(s["total_value"] or Decimal("0.00")),
            "total_value_formatted": format_currency(s["total_value"]),
        }
        for s in deal_stages
    ]

    return {
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None,
        "summary": {
            "total_customers": total_customers,
            "corporate_customers": corporate_customers,
            "individual_customers": individual_customers,
            "total_leads": total_leads,
            "converted_leads": converted_leads,
            "conversion_rate_percentage": str(conversion_rate),
            "total_deals": deals_count,
            "total_deal_pipeline_value": str(total_deal_pipeline_val),
            "total_deal_pipeline_value_formatted": format_currency(total_deal_pipeline_val),
        },
        "leads_funnel": leads_funnel,
        "deals_breakdown": deals_breakdown,
    }


# ============================================================
# 6. FINANCE SUMMARY REPORT
# ============================================================

def get_finance_summary(company, date_from=None, date_to=None):
    """
    Consolidated financial ledger reporting (P&L, AR, AP, Cash/Bank balances).
    """
    try:
        pnl = get_profit_and_loss(company, date_from=date_from, date_to=date_to)
    except Exception as e:
        logger.warning(f"Error fetching P&L in finance summary: {e}")
        pnl = {
            "gross_profit": "0.00",
            "net_profit": "0.00",
            "revenue": {"total": "0.00", "accounts": []},
            "cogs": {"total": "0.00", "accounts": []},
            "expenses": {"total": "0.00", "accounts": []},
        }

    try:
        ar_summary = get_accounts_receivable_summary(company)
    except Exception:
        ar_summary = {"total_receivables": "0.00", "overdue_total": "0.00", "customers": []}

    try:
        ap_summary = get_accounts_payable_summary(company)
    except Exception:
        ap_summary = {"total_payables": "0.00", "overdue_total": "0.00", "vendors": []}

    # Bank and Cash balances
    bank_accounts = BankAccount.objects.filter(company=company, is_active=True).select_related("account")
    cash_accounts = CashAccount.objects.filter(company=company, is_active=True).select_related("account")

    total_bank_balance = sum((b.current_balance for b in bank_accounts), Decimal("0.00"))
    total_cash_balance = sum((c.current_balance for c in cash_accounts), Decimal("0.00"))
    liquid_capital = total_bank_balance + total_cash_balance

    return {
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None,
        "pnl": {
            "net_profit": pnl.get("net_profit", "0.00"),
            "net_profit_formatted": format_currency(pnl.get("net_profit")),
            "gross_profit": pnl.get("gross_profit", "0.00"),
            "gross_profit_formatted": format_currency(pnl.get("gross_profit")),
            "operating_revenue": pnl.get("revenue", {}).get("total", "0.00"),
            "operating_revenue_formatted": format_currency(pnl.get("revenue", {}).get("total")),
            "cost_of_goods_sold": pnl.get("cogs", {}).get("total", "0.00"),
            "cost_of_goods_sold_formatted": format_currency(pnl.get("cogs", {}).get("total")),
            "operating_expenses": pnl.get("expenses", {}).get("total", "0.00"),
            "operating_expenses_formatted": format_currency(pnl.get("expenses", {}).get("total")),
        },
        "liquidity": {
            "total_liquid_capital": str(liquid_capital),
            "total_liquid_capital_formatted": format_currency(liquid_capital),
            "total_bank_balance": str(total_bank_balance),
            "total_bank_balance_formatted": format_currency(total_bank_balance),
            "total_cash_balance": str(total_cash_balance),
            "total_cash_balance_formatted": format_currency(total_cash_balance),
            "bank_accounts_count": bank_accounts.count(),
            "cash_accounts_count": cash_accounts.count(),
        },
        "receivables": {
            "total_receivables": str(ar_summary.get("total_receivables", "0.00")),
            "total_receivables_formatted": format_currency(ar_summary.get("total_receivables")),
            "overdue_total": str(ar_summary.get("overdue_total", "0.00")),
        },
        "payables": {
            "total_payables": str(ap_summary.get("total_payables", "0.00")),
            "total_payables_formatted": format_currency(ap_summary.get("total_payables")),
            "overdue_total": str(ap_summary.get("overdue_total", "0.00")),
        },
    }


# ============================================================
# 7. EMPLOYEE / HR SUMMARY REPORT
# ============================================================

def get_employee_hr_summary(company):
    """
    Staffing, department allocation, and HR headcount report.
    """
    employees_qs = Employee.objects.filter(company=company)
    total_count = employees_qs.count()
    active_count = employees_qs.filter(is_active=True).count()
    inactive_count = total_count - active_count

    # Department Allocation
    dept_counts = (
        employees_qs.values("department")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    departments = [
        {
            "department": d["department"] or "General / Unassigned",
            "count": d["count"],
        }
        for d in dept_counts
    ]

    # Designation Breakdown
    desig_counts = (
        employees_qs.values("designation")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    designations = [
        {
            "designation": d["designation"] or "Unassigned",
            "count": d["count"],
        }
        for d in desig_counts
    ]

    # Employee roster listing
    employee_roster = [
        {
            "id": emp.id,
            "employee_id": emp.employee_id,
            "name": f"{emp.first_name} {emp.last_name}".strip(),
            "email": emp.user.email if emp.user else "",
            "phone": emp.phone,
            "department": emp.department or "N/A",
            "designation": emp.designation or "N/A",
            "joining_date": str(emp.joining_date) if emp.joining_date else None,
            "is_active": emp.is_active,
        }
        for emp in employees_qs.select_related("user").order_by("department", "first_name")[:50]
    ]

    return {
        "summary": {
            "total_employees": total_count,
            "active_employees": active_count,
            "inactive_employees": inactive_count,
            "departments_count": len(departments),
        },
        "departments": departments,
        "designations": designations,
        "roster": employee_roster,
    }


# ============================================================
# 8. MONTHLY BUSINESS SUMMARY REPORT
# ============================================================

def get_monthly_business_summary(company, num_months=6):
    """
    Month-by-month historical operational comparison (Revenue, Purchases, Collections, Margin).
    """
    now = timezone.now()
    monthly_data = []

    for i in range(num_months - 1, -1, -1):
        # Calculate month date window
        # Approximate month offsets cleanly
        target_year = now.year
        target_month = now.month - i
        while target_month <= 0:
            target_month += 12
            target_year -= 1

        start_date = date(target_year, target_month, 1)
        if target_month == 12:
            end_date = date(target_year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(target_year, target_month + 1, 1) - timedelta(days=1)

        month_label = start_date.strftime("%b %Y")
        month_key = start_date.strftime("%Y-%m")

        # Invoiced Sales
        sales_val = (
            Invoice.objects.filter(
                company=company,
                invoice_date__gte=start_date,
                invoice_date__lte=end_date,
            )
            .exclude(status=Invoice.InvoiceStatus.CANCELLED)
            .aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        )

        # Purchase Bills
        purchase_val = (
            PurchaseInvoice.objects.filter(
                company=company,
                invoice_date__gte=start_date,
                invoice_date__lte=end_date,
            )
            .exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
            .aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        )

        # Collections
        collected_val = (
            SalesPayment.objects.filter(
                company=company,
                payment_date__gte=start_date,
                payment_date__lte=end_date,
            )
            .aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
        )

        net_margin = sales_val - purchase_val

        monthly_data.append({
            "month_key": month_key,
            "month_label": month_label,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "sales": str(sales_val),
            "sales_formatted": format_currency(sales_val),
            "purchases": str(purchase_val),
            "purchases_formatted": format_currency(purchase_val),
            "collections": str(collected_val),
            "collections_formatted": format_currency(collected_val),
            "net_margin": str(net_margin),
            "net_margin_formatted": format_currency(net_margin),
        })

    return {
        "num_months": num_months,
        "monthly_history": monthly_data,
    }


# ============================================================
# 9. CSV EXPORT UTILITY
# ============================================================

def generate_csv_report(report_type, company, date_from=None, date_to=None):
    """
    Exports clean, human-readable CSV for the specified report type.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    if report_type == "sales":
        data = get_sales_summary(company, date_from, date_to)
        writer.writerow(["transt - SALES SUMMARY REPORT"])
        writer.writerow(["Company", company.name])
        writer.writerow(["Date Range", f"{date_from or 'Beginning'} to {date_to or 'Present'}"])
        writer.writerow([])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Total Invoiced", data["summary"]["total_invoiced_formatted"]])
        writer.writerow(["Total Paid", data["summary"]["total_paid_formatted"]])
        writer.writerow(["Total Balance Due", data["summary"]["total_balance_due_formatted"]])
        writer.writerow(["Invoices Count", data["summary"]["invoices_count"]])
        writer.writerow(["Total Orders", data["summary"]["total_orders"]])
        writer.writerow(["Average Order Value", data["summary"]["average_order_value_formatted"]])
        writer.writerow([])
        writer.writerow(["Invoice Number", "Customer", "Invoice Date", "Due Date", "Status", "Total", "Paid", "Balance Due"])
        for inv in data["recent_invoices"]:
            writer.writerow([
                inv["invoice_number"],
                inv["customer_name"],
                inv["invoice_date"],
                inv["due_date"],
                inv["status"],
                inv["total"],
                inv["amount_paid"],
                inv["balance_due"],
            ])

    elif report_type == "purchase":
        data = get_purchase_summary(company, date_from, date_to)
        writer.writerow(["transt - PURCHASE SUMMARY REPORT"])
        writer.writerow(["Company", company.name])
        writer.writerow(["Date Range", f"{date_from or 'Beginning'} to {date_to or 'Present'}"])
        writer.writerow([])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Total Billed", data["summary"]["total_billed_formatted"]])
        writer.writerow(["Total Paid", data["summary"]["total_paid_formatted"]])
        writer.writerow(["Total Outstanding", data["summary"]["total_balance_due_formatted"]])
        writer.writerow(["Bills Count", data["summary"]["bills_count"]])
        writer.writerow([])
        writer.writerow(["Bill Number", "Vendor", "Bill Date", "Due Date", "Status", "Total", "Paid", "Balance Due"])
        for b in data["recent_bills"]:
            writer.writerow([
                b["invoice_number"],
                b["vendor_name"],
                b["invoice_date"],
                b["due_date"],
                b["status"],
                b["total"],
                b["amount_paid"],
                b["balance_due"],
            ])

    elif report_type == "inventory":
        data = get_inventory_summary(company)
        writer.writerow(["transt - INVENTORY SUMMARY REPORT"])
        writer.writerow(["Company", company.name])
        writer.writerow(["Total Valuation", data["summary"]["total_valuation_formatted"]])
        writer.writerow(["Total Cataloged SKUs", data["summary"]["total_skus"]])
        writer.writerow(["Low Stock Items Count", data["summary"]["low_stock_count"]])
        writer.writerow([])
        writer.writerow(["SKU", "Product Name", "Category", "Quantity", "Reorder Level", "Cost Price", "Valuation"])
        for itm in data["low_stock_items"] + data["out_of_stock_items"]:
            writer.writerow([
                itm["sku"],
                itm["name"],
                itm["category"],
                itm["quantity"],
                itm["reorder_level"],
                itm["cost_price"],
                itm["valuation"],
            ])

    elif report_type == "employees":
        data = get_employee_hr_summary(company)
        writer.writerow(["transt - EMPLOYEE & HR ROSTER REPORT"])
        writer.writerow(["Company", company.name])
        writer.writerow(["Total Employees", data["summary"]["total_employees"]])
        writer.writerow(["Active Employees", data["summary"]["active_employees"]])
        writer.writerow([])
        writer.writerow(["Employee ID", "Full Name", "Email", "Phone", "Department", "Designation", "Joining Date", "Status"])
        for emp in data["roster"]:
            writer.writerow([
                emp["employee_id"],
                emp["name"],
                emp["email"],
                emp["phone"],
                emp["department"],
                emp["designation"],
                emp["joining_date"],
                "Active" if emp["is_active"] else "Inactive",
            ])

    elif report_type == "monthly":
        data = get_monthly_business_summary(company)
        writer.writerow(["transt - MONTHLY BUSINESS HISTORICAL SUMMARY"])
        writer.writerow(["Company", company.name])
        writer.writerow([])
        writer.writerow(["Month", "Sales Invoiced", "Purchases Billed", "Collections", "Net Margin"])
        for m in data["monthly_history"]:
            writer.writerow([
                m["month_label"],
                m["sales_formatted"],
                m["purchases_formatted"],
                m["collections_formatted"],
                m["net_margin_formatted"],
            ])

    else:
        # Executive default
        data = get_executive_summary(company, date_from, date_to)
        writer.writerow(["transt - EXECUTIVE CONSOLIDATED REPORT"])
        writer.writerow(["Company", company.name])
        writer.writerow(["Date Range", f"{data['date_from']} to {data['date_to']}"])
        writer.writerow([])
        writer.writerow(["Metric", "Value"])
        kpis = data["kpis"]
        writer.writerow(["Total Sales", kpis["sales_total_formatted"]])
        writer.writerow(["Sales Collected", kpis["sales_paid_formatted"]])
        writer.writerow(["Outstanding Receivables", kpis["sales_outstanding_formatted"]])
        writer.writerow(["Total Purchases", kpis["purchase_total_formatted"]])
        writer.writerow(["Purchases Disbursed", kpis["purchase_paid_formatted"]])
        writer.writerow(["Outstanding Payables", kpis["purchase_outstanding_formatted"]])
        writer.writerow(["Net Operating Profit", kpis["net_profit_formatted"]])
        writer.writerow(["Profit Margin %", f"{kpis['margin_percentage']}%"])
        writer.writerow(["Total Liquid Capital", kpis["liquid_funds_formatted"]])
        writer.writerow(["Inventory Valuation", kpis["total_inventory_valuation_formatted"]])
        writer.writerow(["Cataloged SKUs", kpis["total_skus"]])
        writer.writerow(["Total Customers", kpis["total_customers"]])
        writer.writerow(["Total Employees", kpis["total_employees"]])

    return buffer.getvalue()
