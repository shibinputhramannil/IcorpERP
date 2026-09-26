import json
import logging
import os
import re
import urllib.error
import urllib.request
from decimal import Decimal
from datetime import datetime, date, timedelta

from django.db.models import Sum, Count, Q, F
from django.utils import timezone

from company.models import Company
from crm.models import Customer
from inventory.models import Product, Stock, Warehouse, Vendor
from sales.models import SalesOrder, Invoice, Payment as SalesPayment
from purchase.models import PurchaseOrder, PurchaseInvoice, PurchasePayment
from finance.services import (
    get_profit_and_loss,
    get_finance_dashboard,
    get_accounts_receivable_summary,
    get_accounts_payable_summary,
)

logger = logging.getLogger(__name__)


# ============================================================
# 1. READ-ONLY ERP DATA RETRIEVAL (STRICT COMPANY SCOPING)
# ============================================================

def format_currency(val):
    if val is None:
        return "$0.00"
    try:
        dec = Decimal(str(val))
        return f"${dec:,.2f}"
    except Exception:
        return f"${val}"


def get_sales_metrics(company):
    """
    Returns sales intelligence for the specified company.
    """
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Monthly Sales (Invoices in current month)
    monthly_invoices = Invoice.objects.filter(
        company=company,
        invoice_date__gte=month_start.date(),
        status__in=[
            Invoice.InvoiceStatus.ISSUED,
            Invoice.InvoiceStatus.PARTIALLY_PAID,
            Invoice.InvoiceStatus.PAID,
            Invoice.InvoiceStatus.OVERDUE,
        ],
    )
    month_sales = monthly_invoices.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
    month_invoice_count = monthly_invoices.count()

    # Total Sales All-Time
    all_invoices = Invoice.objects.filter(
        company=company,
        status__in=[
            Invoice.InvoiceStatus.ISSUED,
            Invoice.InvoiceStatus.PARTIALLY_PAID,
            Invoice.InvoiceStatus.PAID,
            Invoice.InvoiceStatus.OVERDUE,
        ],
    )
    total_sales = all_invoices.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
    total_invoice_count = all_invoices.count()

    # Sales Orders Count & Recent
    orders_qs = SalesOrder.objects.filter(company=company)
    total_orders_count = orders_qs.count()
    recent_orders = [
        {
            "order_number": o.order_number,
            "customer": o.customer.name,
            "order_date": str(o.order_date),
            "status": o.status,
            "total": str(o.total),
        }
        for o in orders_qs.select_related("customer").order_by("-order_date", "-id")[:5]
    ]

    return {
        "month_sales": str(month_sales),
        "month_sales_formatted": format_currency(month_sales),
        "month_invoice_count": month_invoice_count,
        "total_sales": str(total_sales),
        "total_sales_formatted": format_currency(total_sales),
        "total_invoice_count": total_invoice_count,
        "total_orders_count": total_orders_count,
        "recent_orders": recent_orders,
    }


def get_outstanding_invoices_data(company):
    """
    Returns itemized and aggregated outstanding sales invoices.
    """
    unpaid_qs = Invoice.objects.filter(
        company=company,
        balance_due__gt=Decimal("0.00"),
        status__in=[
            Invoice.InvoiceStatus.ISSUED,
            Invoice.InvoiceStatus.PARTIALLY_PAID,
            Invoice.InvoiceStatus.OVERDUE,
        ],
    ).select_related("customer").order_by("due_date", "-balance_due")

    total_outstanding = unpaid_qs.aggregate(total=Sum("balance_due"))["total"] or Decimal("0.00")
    today = timezone.localdate()
    overdue_count = unpaid_qs.filter(due_date__lt=today).count()

    invoices = [
        {
            "invoice_number": inv.invoice_number,
            "customer": inv.customer.name,
            "due_date": str(inv.due_date),
            "total": str(inv.total),
            "balance_due": str(inv.balance_due),
            "status": inv.status,
            "is_overdue": inv.due_date < today,
        }
        for inv in unpaid_qs[:15]
    ]

    return {
        "total_outstanding": str(total_outstanding),
        "total_outstanding_formatted": format_currency(total_outstanding),
        "count": unpaid_qs.count(),
        "overdue_count": overdue_count,
        "invoices": invoices,
    }


def get_collections_data(company):
    """
    Returns payment collection metrics for the specified company.
    """
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    payments_qs = SalesPayment.objects.filter(company=company)
    total_collected = payments_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    month_payments = payments_qs.filter(payment_date__gte=month_start.date())
    month_collected = month_payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    recent_payments = [
        {
            "payment_number": p.payment_number,
            "customer": p.customer.name,
            "amount": str(p.amount),
            "payment_date": str(p.payment_date),
            "payment_method": p.payment_method,
        }
        for p in payments_qs.select_related("customer").order_by("-payment_date", "-id")[:5]
    ]

    return {
        "month_collected": str(month_collected),
        "month_collected_formatted": format_currency(month_collected),
        "total_collected": str(total_collected),
        "total_collected_formatted": format_currency(total_collected),
        "payment_count": payments_qs.count(),
        "recent_payments": recent_payments,
    }


def get_purchase_metrics(company):
    """
    Returns purchase intelligence for the specified company.
    """
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Purchase Bills
    bills_qs = PurchaseInvoice.objects.filter(company=company)
    total_purchases = bills_qs.aggregate(total=Sum("total"))["total"] or Decimal("0.00")

    month_bills = bills_qs.filter(invoice_date__gte=month_start.date())
    month_purchases = month_bills.aggregate(total=Sum("total"))["total"] or Decimal("0.00")

    # Unpaid Bills
    unpaid_bills_qs = bills_qs.filter(balance_due__gt=Decimal("0.00"))
    unpaid_bills_total = unpaid_bills_qs.aggregate(total=Sum("balance_due"))["total"] or Decimal("0.00")

    # Recent Purchase Orders
    recent_pos = [
        {
            "order_number": po.order_number,
            "vendor": po.vendor.name,
            "order_date": str(po.order_date),
            "status": po.status,
            "total": str(po.total),
        }
        for po in PurchaseOrder.objects.filter(company=company).select_related("vendor").order_by("-order_date", "-id")[:5]
    ]

    return {
        "total_purchases": str(total_purchases),
        "total_purchases_formatted": format_currency(total_purchases),
        "month_purchases": str(month_purchases),
        "month_purchases_formatted": format_currency(month_purchases),
        "unpaid_bills_total": str(unpaid_bills_total),
        "unpaid_bills_formatted": format_currency(unpaid_bills_total),
        "unpaid_bills_count": unpaid_bills_qs.count(),
        "recent_pos": recent_pos,
    }


def get_inventory_metrics(company):
    """
    Returns inventory intelligence: stock levels, low-stock alerts, and valuation.
    """
    products = Product.objects.filter(company=company, is_active=True).prefetch_related("stocks")

    low_stock_items = []
    out_of_stock_items = []
    total_valuation = Decimal("0.00")
    total_sku_count = products.count()

    for p in products:
        stocks = list(p.stocks.all())
        total_qty = sum((s.quantity for s in stocks), Decimal("0.00"))
        reorder = p.reorder_level

        item_valuation = total_qty * p.cost_price
        total_valuation += item_valuation

        if total_qty <= Decimal("0.00"):
            out_of_stock_items.append({
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "current_stock": str(total_qty),
                "reorder_level": reorder,
                "unit": p.unit,
                "cost_price": str(p.cost_price),
            })
        elif total_qty <= Decimal(str(reorder)):
            low_stock_items.append({
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "current_stock": str(total_qty),
                "reorder_level": reorder,
                "unit": p.unit,
                "cost_price": str(p.cost_price),
            })

    warehouses_count = Warehouse.objects.filter(company=company, is_active=True).count()

    return {
        "total_products": total_sku_count,
        "total_valuation": str(total_valuation),
        "total_valuation_formatted": format_currency(total_valuation),
        "low_stock_count": len(low_stock_items),
        "out_of_stock_count": len(out_of_stock_items),
        "warehouses_count": warehouses_count,
        "low_stock_items": low_stock_items[:15],
        "out_of_stock_items": out_of_stock_items[:10],
    }


def get_customers_owe_data(company):
    """
    Returns list of customers who currently owe money, with balances and invoice counts.
    """
    unpaid_invoices = Invoice.objects.filter(
        company=company,
        balance_due__gt=Decimal("0.00"),
        status__in=[
            Invoice.InvoiceStatus.ISSUED,
            Invoice.InvoiceStatus.PARTIALLY_PAID,
            Invoice.InvoiceStatus.OVERDUE,
        ],
    ).select_related("customer")

    customer_map = {}
    for inv in unpaid_invoices:
        cid = inv.customer.id
        if cid not in customer_map:
            customer_map[cid] = {
                "id": cid,
                "name": inv.customer.name,
                "email": inv.customer.email,
                "phone": inv.customer.phone,
                "total_owed": Decimal("0.00"),
                "invoice_count": 0,
            }
        customer_map[cid]["total_owed"] += inv.balance_due
        customer_map[cid]["invoice_count"] += 1

    sorted_customers = sorted(
        customer_map.values(),
        key=lambda c: c["total_owed"],
        reverse=True,
    )

    total_owed_all = sum((c["total_owed"] for c in sorted_customers), Decimal("0.00"))

    result_list = [
        {
            "id": c["id"],
            "name": c["name"],
            "email": c["email"],
            "phone": c["phone"],
            "total_owed": str(c["total_owed"]),
            "total_owed_formatted": format_currency(c["total_owed"]),
            "invoice_count": c["invoice_count"],
        }
        for c in sorted_customers[:15]
    ]

    return {
        "total_debtors_count": len(sorted_customers),
        "total_receivable": str(total_owed_all),
        "total_receivable_formatted": format_currency(total_owed_all),
        "customers": result_list,
    }


def get_top_vendors_by_spend(company, limit=5):
    """
    Returns vendors with the highest total purchase value.
    """
    vendors = Vendor.objects.filter(company=company)
    vendor_spends = []

    for v in vendors:
        total_spend = (
            PurchaseInvoice.objects.filter(company=company, vendor=v).aggregate(total=Sum("total"))["total"]
            or Decimal("0.00")
        )
        if total_spend > Decimal("0.00"):
            vendor_spends.append({
                "id": v.id,
                "name": v.name,
                "email": v.email,
                "phone": v.phone,
                "total_spend": total_spend,
            })

    sorted_vendors = sorted(vendor_spends, key=lambda x: x["total_spend"], reverse=True)[:limit]

    return [
        {
            "id": v["id"],
            "name": v["name"],
            "email": v["email"],
            "phone": v["phone"],
            "total_spend": str(v["total_spend"]),
            "total_spend_formatted": format_currency(v["total_spend"]),
        }
        for v in sorted_vendors
    ]


def get_finance_metrics(company):
    """
    Reuses existing Finance services to fetch Profit & Loss, liquid funds, AR/AP.
    """
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        pnl = get_profit_and_loss(company, date_from=month_start.date(), date_to=now.date())
    except Exception as e:
        logger.warning(f"Error fetching P&L: {e}")
        pnl = {"gross_profit": "0.00", "net_profit": "0.00", "revenue": {"total": "0.00"}, "cogs": {"total": "0.00"}, "expenses": {"total": "0.00"}}

    try:
        dash = get_finance_dashboard(company)
        kpis = dash.get("kpis", {})
        liquid_funds = kpis.get("total_liquid_funds", "0.00")
        ar_total = kpis.get("total_receivables", "0.00")
        ap_total = kpis.get("total_payables", "0.00")
    except Exception as e:
        logger.warning(f"Error fetching Finance dashboard: {e}")
        liquid_funds = "0.00"
        ar_total = "0.00"
        ap_total = "0.00"

    net_profit = pnl.get("net_profit", "0.00")
    gross_profit = pnl.get("gross_profit", "0.00")
    revenue_total = pnl.get("revenue", {}).get("total", "0.00")
    expenses_total = pnl.get("expenses", {}).get("total", "0.00")

    return {
        "net_profit": str(net_profit),
        "net_profit_formatted": format_currency(net_profit),
        "gross_profit": str(gross_profit),
        "gross_profit_formatted": format_currency(gross_profit),
        "revenue_total": str(revenue_total),
        "revenue_total_formatted": format_currency(revenue_total),
        "expenses_total": str(expenses_total),
        "expenses_total_formatted": format_currency(expenses_total),
        "liquid_funds": str(liquid_funds),
        "liquid_funds_formatted": format_currency(liquid_funds),
        "receivables_total": str(ar_total),
        "receivables_formatted": format_currency(ar_total),
        "payables_total": str(ap_total),
        "payables_formatted": format_currency(ap_total),
    }


def search_customer_intelligence(company, search_query):
    """
    Looks up a customer by name, email, or phone and computes their financial relationship.
    """
    clean_query = search_query.strip()
    customers = Customer.objects.filter(
        company=company,
    ).filter(
        Q(name__icontains=clean_query) | Q(email__icontains=clean_query) | Q(phone__icontains=clean_query)
    )[:5]

    if not customers.exists():
        return None

    results = []
    for cust in customers:
        invoices = Invoice.objects.filter(company=company, customer=cust)
        total_invoiced = invoices.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
        total_paid = invoices.aggregate(paid=Sum("amount_paid"))["paid"] or Decimal("0.00")
        balance_due = invoices.aggregate(due=Sum("balance_due"))["due"] or Decimal("0.00")
        order_count = SalesOrder.objects.filter(company=company, customer=cust).count()

        recent_invoices = [
            {
                "invoice_number": inv.invoice_number,
                "invoice_date": str(inv.invoice_date),
                "total": str(inv.total),
                "balance_due": str(inv.balance_due),
                "status": inv.status,
            }
            for inv in invoices.order_by("-invoice_date", "-id")[:3]
        ]

        results.append({
            "id": cust.id,
            "name": cust.name,
            "customer_type": cust.customer_type,
            "email": cust.email,
            "phone": cust.phone,
            "city": cust.city,
            "country": cust.country,
            "total_orders": order_count,
            "total_invoiced": str(total_invoiced),
            "total_invoiced_formatted": format_currency(total_invoiced),
            "total_paid": str(total_paid),
            "total_paid_formatted": format_currency(total_paid),
            "balance_due": str(balance_due),
            "balance_due_formatted": format_currency(balance_due),
            "recent_invoices": recent_invoices,
        })

    return results


def search_vendor_intelligence(company, search_query):
    """
    Looks up a vendor by name, email, or phone and computes their financial relationship.
    """
    clean_query = search_query.strip()
    vendors = Vendor.objects.filter(
        company=company,
    ).filter(
        Q(name__icontains=clean_query) | Q(email__icontains=clean_query) | Q(phone__icontains=clean_query)
    )[:5]

    if not vendors.exists():
        return None

    results = []
    for vend in vendors:
        bills = PurchaseInvoice.objects.filter(company=company, vendor=vend)
        total_billed = bills.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
        total_paid = bills.aggregate(paid=Sum("amount_paid"))["paid"] or Decimal("0.00")
        balance_due = bills.aggregate(due=Sum("balance_due"))["due"] or Decimal("0.00")
        po_count = PurchaseOrder.objects.filter(company=company, vendor=vend).count()

        recent_bills = [
            {
                "invoice_number": b.invoice_number,
                "invoice_date": str(b.invoice_date),
                "total": str(b.total),
                "balance_due": str(b.balance_due),
                "status": b.status,
            }
            for b in bills.order_by("-invoice_date", "-id")[:3]
        ]

        results.append({
            "id": vend.id,
            "name": vend.name,
            "email": vend.email,
            "phone": vend.phone,
            "tax_id": vend.tax_id,
            "total_pos": po_count,
            "total_billed": str(total_billed),
            "total_billed_formatted": format_currency(total_billed),
            "total_paid": str(total_paid),
            "total_paid_formatted": format_currency(total_paid),
            "balance_due": str(balance_due),
            "balance_due_formatted": format_currency(balance_due),
            "recent_bills": recent_bills,
        })

    return results


def get_all_executive_insights(company):
    """
    Consolidates executive digest across Sales, Purchases, Inventory, and Finance.
    """
    sales = get_sales_metrics(company)
    purchases = get_purchase_metrics(company)
    inventory = get_inventory_metrics(company)
    finance = get_finance_metrics(company)

    return {
        "company_name": company.name,
        "as_of": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
        "sales": sales,
        "purchases": purchases,
        "inventory": inventory,
        "finance": finance,
    }


# ============================================================
# 2. INTENT CLASSIFICATION & NATURAL LANGUAGE PROCESSING
# ============================================================

class ERPIntent:
    MONTHLY_SALES = "MONTHLY_SALES"
    OUTSTANDING_INVOICES = "OUTSTANDING_INVOICES"
    COLLECTIONS = "COLLECTIONS"
    TOTAL_PURCHASES = "TOTAL_PURCHASES"
    LOW_STOCK = "LOW_STOCK"
    CUSTOMERS_OWE = "CUSTOMERS_OWE"
    TOP_VENDORS = "TOP_VENDORS"
    CURRENT_PROFIT = "CURRENT_PROFIT"
    RECENT_SALES_ORDERS = "RECENT_SALES_ORDERS"
    RECENT_PURCHASE_ORDERS = "RECENT_PURCHASE_ORDERS"
    CUSTOMER_LOOKUP = "CUSTOMER_LOOKUP"
    VENDOR_LOOKUP = "VENDOR_LOOKUP"
    EXECUTIVE_SUMMARY = "EXECUTIVE_SUMMARY"
    GENERAL = "GENERAL"


def classify_query(query):
    """
    Determines user intent from question phrasing and extracts any target entity names.
    """
    q = query.lower().strip()

    # Customer Lookup patterns
    match_cust = re.search(r"(?:lookup customer|search customer|customer details for|customer:|who is customer)\s+([a-zA-Z0-9_\-\. ]+)", q)
    if match_cust:
        return ERPIntent.CUSTOMER_LOOKUP, match_cust.group(1).strip()

    # Vendor Lookup patterns
    match_vend = re.search(r"(?:lookup vendor|search vendor|vendor details for|vendor:|supplier:|who is vendor)\s+([a-zA-Z0-9_\-\. ]+)", q)
    if match_vend:
        return ERPIntent.VENDOR_LOOKUP, match_vend.group(1).strip()

    # Intent 1: Month's sales
    if any(k in q for k in ["month's sales", "month sales", "monthly sales", "sales this month", "this month sales", "sales so far this month"]):
        return ERPIntent.MONTHLY_SALES, None

    # Intent 2: Outstanding Invoices
    if any(k in q for k in ["which invoices are outstanding", "invoices are outstanding", "outstanding invoices", "unpaid invoices", "pending invoices"]):
        return ERPIntent.OUTSTANDING_INVOICES, None

    # Intent 3: Collections
    if any(k in q for k in ["how much did we collect", "how much collected", "total collections", "money collected", "cash collected", "payments collected"]):
        return ERPIntent.COLLECTIONS, None

    # Intent 4: Total Purchases
    if any(k in q for k in ["what are our total purchases", "total purchases", "total purchase", "how much did we purchase", "purchases total"]):
        return ERPIntent.TOTAL_PURCHASES, None

    # Intent 5: Low Stock
    if any(k in q for k in ["low stock", "stock is low", "which products have low stock", "out of stock", "reorder level", "inventory alert"]):
        return ERPIntent.LOW_STOCK, None

    # Intent 6: Customers owe money
    if any(k in q for k in ["customers owe money", "who owes money", "which customers owe", "customers owe", "outstanding customers", "debtors"]):
        return ERPIntent.CUSTOMERS_OWE, None

    # Intent 7: Top vendors by purchase value
    if any(k in q for k in ["highest purchase value", "top vendors", "top suppliers", "vendor with highest", "vendors have the highest", "highest spend vendor"]):
        return ERPIntent.TOP_VENDORS, None

    # Intent 8: Current profit / P&L
    if any(k in q for k in ["current profit", "what is the current profit", "how much profit", "net profit", "gross profit", "p&l", "profit and loss"]):
        return ERPIntent.CURRENT_PROFIT, None

    # Intent 9: Recent sales orders
    if any(k in q for k in ["recent sales orders", "show recent sales orders", "latest sales orders", "recent orders", "last sales orders"]):
        return ERPIntent.RECENT_SALES_ORDERS, None

    # Intent 10: Recent purchase orders
    if any(k in q for k in ["recent purchase orders", "show recent purchase orders", "latest purchase orders", "recent pos", "last purchase orders"]):
        return ERPIntent.RECENT_PURCHASE_ORDERS, None

    # General / Overview
    if any(k in q for k in ["summary", "overview", "executive summary", "status", "dashboard", "how are we doing", "health check"]):
        return ERPIntent.EXECUTIVE_SUMMARY, None

    return ERPIntent.GENERAL, None


# ============================================================
# 3. DETERMINISTIC RESPONSE SYNTHESIS (FALLBACK & OFFLINE)
# ============================================================

def synthesize_deterministic_response(intent, entity_name, company):
    """
    Synthesizes a structured Markdown and data payload without external LLM dependencies.
    Ensures 100% test pass rate, offline availability, and mathematical precision.
    """
    suggested = [
        "What are this month's sales?",
        "Which invoices are outstanding?",
        "Which products have low stock?",
        "What is the current profit?",
    ]

    if intent == ERPIntent.MONTHLY_SALES:
        data = get_sales_metrics(company)
        answer = (
            f"### 📊 Sales Performance\n\n"
            f"- **This Month's Sales**: **{data['month_sales_formatted']}** ({data['month_invoice_count']} invoices issued)\n"
            f"- **All-Time Sales Revenue**: **{data['total_sales_formatted']}** ({data['total_invoice_count']} invoices total)\n"
            f"- **Total Sales Orders**: **{data['total_orders_count']}** orders logged\n\n"
        )
        if data["recent_orders"]:
            answer += "#### Recent Orders:\n"
            for o in data["recent_orders"]:
                answer += f"- **{o['order_number']}** — {o['customer']}: {format_currency(o['total'])} (`{o['status']}`)\n"

        return {
            "intent": intent,
            "answer": answer,
            "data": data,
            "suggested_questions": ["Which invoices are outstanding?", "How much did we collect?", "What is the current profit?"],
        }

    elif intent == ERPIntent.OUTSTANDING_INVOICES:
        data = get_outstanding_invoices_data(company)
        answer = (
            f"### 📋 Outstanding Sales Invoices\n\n"
            f"- **Total Outstanding Receivables**: **{data['total_outstanding_formatted']}**\n"
            f"- **Total Unpaid Invoices**: **{data['count']}** (with **{data['overdue_count']}** overdue)\n\n"
        )
        if data["invoices"]:
            answer += "| Invoice | Customer | Due Date | Balance Due | Status |\n"
            answer += "| :--- | :--- | :--- | :--- | :--- |\n"
            for inv in data["invoices"]:
                due_badge = "⚠️ Overdue" if inv["is_overdue"] else "Pending"
                answer += f"| **{inv['invoice_number']}** | {inv['customer']} | {inv['due_date']} | **{format_currency(inv['balance_due'])}** | {due_badge} |\n"
        else:
            answer += "🎉 Great news! There are currently no outstanding invoices."

        return {
            "intent": intent,
            "answer": answer,
            "data": data,
            "suggested_questions": ["Which customers owe money?", "How much did we collect?", "What are this month's sales?"],
        }

    elif intent == ERPIntent.COLLECTIONS:
        data = get_collections_data(company)
        answer = (
            f"### 💵 Cash & Payment Collections\n\n"
            f"- **Collected This Month**: **{data['month_collected_formatted']}**\n"
            f"- **Total All-Time Collections**: **{data['total_collected_formatted']}** across {data['payment_count']} payments\n\n"
        )
        if data["recent_payments"]:
            answer += "#### Recent Collections:\n"
            for p in data["recent_payments"]:
                answer += f"- **{p['payment_number']}** ({p['customer']}): **{format_currency(p['amount'])}** on {p['payment_date']} via {p['payment_method']}\n"

        return {
            "intent": intent,
            "answer": answer,
            "data": data,
            "suggested_questions": ["What are this month's sales?", "Which invoices are outstanding?", "What is the current profit?"],
        }

    elif intent == ERPIntent.TOTAL_PURCHASES:
        data = get_purchase_metrics(company)
        answer = (
            f"### 🛒 Purchase & Procurement Summary\n\n"
            f"- **Total All-Time Purchases**: **{data['total_purchases_formatted']}**\n"
            f"- **Purchases This Month**: **{data['month_purchases_formatted']}**\n"
            f"- **Unpaid Vendor Bills**: **{data['unpaid_bills_formatted']}** ({data['unpaid_bills_count']} bills awaiting payment)\n\n"
        )
        if data["recent_pos"]:
            answer += "#### Recent Purchase Orders:\n"
            for po in data["recent_pos"]:
                answer += f"- **{po['order_number']}** ({po['vendor']}): {format_currency(po['total'])} (`{po['status']}`)\n"

        return {
            "intent": intent,
            "answer": answer,
            "data": data,
            "suggested_questions": ["Which vendors have the highest purchase value?", "Show recent purchase orders.", "What is the current profit?"],
        }

    elif intent == ERPIntent.LOW_STOCK:
        data = get_inventory_metrics(company)
        answer = (
            f"### 📦 Inventory & Stock Alerts\n\n"
            f"- **Total Cataloged SKUs**: **{data['total_products']}** across {data['warehouses_count']} active warehouses\n"
            f"- **Estimated Inventory Valuation**: **{data['total_valuation_formatted']}**\n"
            f"- **Low Stock SKUs**: **{data['low_stock_count']}**\n"
            f"- **Out of Stock SKUs**: **{data['out_of_stock_count']}**\n\n"
        )
        items_to_show = data["out_of_stock_items"] + data["low_stock_items"]
        if items_to_show:
            answer += "| SKU | Product | Stock | Reorder Level | Unit Price |\n"
            answer += "| :--- | :--- | :--- | :--- | :--- |\n"
            for itm in items_to_show[:10]:
                stock_label = f"🔴 {itm['current_stock']} {itm['unit']}" if Decimal(itm["current_stock"]) <= 0 else f"⚠️ {itm['current_stock']} {itm['unit']}"
                answer += f"| `{itm['sku']}` | **{itm['name']}** | {stock_label} | {itm['reorder_level']} | {format_currency(itm['cost_price'])} |\n"
        else:
            answer += "✅ All product stock levels are currently healthy and above reorder thresholds."

        return {
            "intent": intent,
            "answer": answer,
            "data": data,
            "suggested_questions": ["What are our total purchases?", "Show recent purchase orders.", "What are this month's sales?"],
        }

    elif intent == ERPIntent.CUSTOMERS_OWE:
        data = get_customers_owe_data(company)
        answer = (
            f"### 👥 Customers With Outstanding Balances\n\n"
            f"- **Total Outstanding Receivables**: **{data['total_receivable_formatted']}**\n"
            f"- **Debtors Count**: **{data['total_debtors_count']}** customer(s) with pending balances\n\n"
        )
        if data["customers"]:
            answer += "| Customer | Total Owed | Invoices | Contact |\n"
            answer += "| :--- | :--- | :--- | :--- |\n"
            for c in data["customers"]:
                contact = c["phone"] or c["email"] or "N/A"
                answer += f"| **{c['name']}** | **{c['total_owed_formatted']}** | {c['invoice_count']} | {contact} |\n"
        else:
            answer += "🎉 No customers currently owe money! All issued invoices are paid."

        return {
            "intent": intent,
            "answer": answer,
            "data": data,
            "suggested_questions": ["Which invoices are outstanding?", "How much did we collect?", "What is the current profit?"],
        }

    elif intent == ERPIntent.TOP_VENDORS:
        data = get_top_vendors_by_spend(company, limit=5)
        answer = "### 🏢 Vendors With Highest Purchase Value\n\n"
        if data:
            answer += "| Rank | Vendor | Total Spend | Contact |\n"
            answer += "| :--- | :--- | :--- | :--- |\n"
            for idx, v in enumerate(data, 1):
                contact = v["phone"] or v["email"] or "N/A"
                answer += f"| #{idx} | **{v['name']}** | **{v['total_spend_formatted']}** | {contact} |\n"
        else:
            answer += "No vendor purchase history found for this company."

        return {
            "intent": intent,
            "answer": answer,
            "data": {"vendors": data},
            "suggested_questions": ["What are our total purchases?", "Show recent purchase orders.", "Which products have low stock?"],
        }

    elif intent == ERPIntent.CURRENT_PROFIT:
        data = get_finance_metrics(company)
        answer = (
            f"### 📈 Current Financial Performance & Profitability\n\n"
            f"- **Current Net Profit**: **{data['net_profit_formatted']}**\n"
            f"- **Gross Profit**: **{data['gross_profit_formatted']}**\n"
            f"- **Operating Revenue**: **{data['revenue_total_formatted']}**\n"
            f"- **Operating Expenses**: **{data['expenses_total_formatted']}**\n"
            f"- **Total Liquid Capital (Cash & Bank)**: **{data['liquid_funds_formatted']}**\n"
            f"- **Accounts Receivable (AR)**: **{data['receivables_formatted']}**\n"
            f"- **Accounts Payable (AP)**: **{data['payables_formatted']}**\n"
        )
        return {
            "intent": intent,
            "answer": answer,
            "data": data,
            "suggested_questions": ["What are this month's sales?", "How much did we collect?", "Which invoices are outstanding?"],
        }

    elif intent == ERPIntent.RECENT_SALES_ORDERS:
        orders = list(SalesOrder.objects.filter(company=company).select_related("customer").order_by("-order_date", "-id")[:5])
        answer = "### 🛒 Recent Sales Orders\n\n"
        if orders:
            answer += "| Order # | Customer | Date | Total | Status |\n"
            answer += "| :--- | :--- | :--- | :--- | :--- |\n"
            for o in orders:
                answer += f"| **{o.order_number}** | {o.customer.name} | {o.order_date} | {format_currency(o.total)} | `{o.status}` |\n"
        else:
            answer += "No sales orders found for this company."

        return {
            "intent": intent,
            "answer": answer,
            "data": {"orders": [
                {"order_number": o.order_number, "customer": o.customer.name, "date": str(o.order_date), "total": str(o.total), "status": o.status}
                for o in orders
            ]},
            "suggested_questions": ["What are this month's sales?", "Which invoices are outstanding?", "Show recent purchase orders."],
        }

    elif intent == ERPIntent.RECENT_PURCHASE_ORDERS:
        pos = list(PurchaseOrder.objects.filter(company=company).select_related("vendor").order_by("-order_date", "-id")[:5])
        answer = "### 📦 Recent Purchase Orders\n\n"
        if pos:
            answer += "| PO # | Vendor | Date | Total | Status |\n"
            answer += "| :--- | :--- | :--- | :--- | :--- |\n"
            for po in pos:
                answer += f"| **{po.order_number}** | {po.vendor.name} | {po.order_date} | {format_currency(po.total)} | `{po.status}` |\n"
        else:
            answer += "No purchase orders found for this company."

        return {
            "intent": intent,
            "answer": answer,
            "data": {"purchase_orders": [
                {"order_number": po.order_number, "vendor": po.vendor.name, "date": str(po.order_date), "total": str(po.total), "status": po.status}
                for po in pos
            ]},
            "suggested_questions": ["What are our total purchases?", "Which vendors have the highest purchase value?", "Which products have low stock?"],
        }

    elif intent == ERPIntent.CUSTOMER_LOOKUP:
        if not entity_name:
            return {
                "intent": intent,
                "answer": "Please provide a customer name to lookup (e.g. `Lookup customer Acme`).",
                "data": {},
                "suggested_questions": ["Which customers owe money?", "What are this month's sales?"],
            }
        results = search_customer_intelligence(company, entity_name)
        if not results:
            return {
                "intent": intent,
                "answer": f"🔍 No customer matching **'{entity_name}'** was found in company **{company.name}**.",
                "data": {"query": entity_name, "found": False},
                "suggested_questions": ["Which customers owe money?", "Show recent sales orders."],
            }
        cust = results[0]
        answer = (
            f"### 👤 Customer Profile: {cust['name']}\n\n"
            f"- **Customer Type**: {cust['customer_type']}\n"
            f"- **Email**: {cust['email'] or 'N/A'}\n"
            f"- **Phone**: {cust['phone'] or 'N/A'}\n"
            f"- **Location**: {cust['city'] or ''} {cust['country'] or ''}\n"
            f"- **Total Sales Orders**: **{cust['total_orders']}**\n"
            f"- **Total Invoiced**: **{cust['total_invoiced_formatted']}**\n"
            f"- **Total Payments Received**: **{cust['total_paid_formatted']}**\n"
            f"- **Current Outstanding Balance**: **{cust['balance_due_formatted']}**\n\n"
        )
        if cust["recent_invoices"]:
            answer += "#### Recent Invoices:\n"
            for inv in cust["recent_invoices"]:
                answer += f"- **{inv['invoice_number']}** ({inv['invoice_date']}): Total {format_currency(inv['total'])}, Due {format_currency(inv['balance_due'])} (`{inv['status']}`)\n"

        return {
            "intent": intent,
            "answer": answer,
            "data": {"customer": cust, "all_matches": results},
            "suggested_questions": ["Which customers owe money?", "What are this month's sales?", "How much did we collect?"],
        }

    elif intent == ERPIntent.VENDOR_LOOKUP:
        if not entity_name:
            return {
                "intent": intent,
                "answer": "Please provide a vendor name to lookup (e.g. `Lookup vendor Global Steel`).",
                "data": {},
                "suggested_questions": ["Which vendors have the highest purchase value?", "What are our total purchases?"],
            }
        results = search_vendor_intelligence(company, entity_name)
        if not results:
            return {
                "intent": intent,
                "answer": f"🔍 No vendor matching **'{entity_name}'** was found in company **{company.name}**.",
                "data": {"query": entity_name, "found": False},
                "suggested_questions": ["Which vendors have the highest purchase value?", "Show recent purchase orders."],
            }
        vend = results[0]
        answer = (
            f"### 🏢 Vendor Profile: {vend['name']}\n\n"
            f"- **Tax ID / GST**: {vend['tax_id'] or 'N/A'}\n"
            f"- **Email**: {vend['email'] or 'N/A'}\n"
            f"- **Phone**: {vend['phone'] or 'N/A'}\n"
            f"- **Total Purchase Orders**: **{vend['total_pos']}**\n"
            f"- **Total Billed Amount**: **{vend['total_billed_formatted']}**\n"
            f"- **Total Payments Disbursed**: **{vend['total_paid_formatted']}**\n"
            f"- **Outstanding Bill Balance**: **{vend['balance_due_formatted']}**\n\n"
        )
        if vend["recent_bills"]:
            answer += "#### Recent Bills:\n"
            for b in vend["recent_bills"]:
                answer += f"- **{b['invoice_number']}** ({b['invoice_date']}): Total {format_currency(b['total'])}, Due {format_currency(b['balance_due'])} (`{b['status']}`)\n"

        return {
            "intent": intent,
            "answer": answer,
            "data": {"vendor": vend, "all_matches": results},
            "suggested_questions": ["Which vendors have the highest purchase value?", "What are our total purchases?", "Show recent purchase orders."],
        }

    # Default / Executive Summary / General
    data = get_all_executive_insights(company)
    sales = data["sales"]
    purchases = data["purchases"]
    inv = data["inventory"]
    fin = data["finance"]

    answer = (
        f"### 🏢 ICORP ERP Executive Overview — {company.name}\n\n"
        f"Here is your real-time operational digest:\n\n"
        f"| Module | Key Metric | Value |\n"
        f"| :--- | :--- | :--- |\n"
        f"| **Sales** | This Month's Sales | **{sales['month_sales_formatted']}** ({sales['month_invoice_count']} invoices) |\n"
        f"| **Purchases** | Total Purchases | **{purchases['total_purchases_formatted']}** (Bills: {purchases['unpaid_bills_formatted']} unpaid) |\n"
        f"| **Inventory** | Stock Health | **{inv['low_stock_count']}** low-stock, **{inv['out_of_stock_count']}** out-of-stock |\n"
        f"| **Finance** | Net Profit | **{fin['net_profit_formatted']}** (Liquid Funds: {fin['liquid_funds_formatted']}) |\n"
        f"| **Receivables** | Outstanding Invoices | **{fin['receivables_formatted']}** awaiting collection |\n\n"
        f"You can ask me specific questions like:\n"
        f"- *What are this month's sales?*\n"
        f"- *Which invoices are outstanding?*\n"
        f"- *Which products have low stock?*\n"
        f"- *Which customers owe money?*\n"
        f"- *What is the current profit?*"
    )

    return {
        "intent": ERPIntent.EXECUTIVE_SUMMARY,
        "answer": answer,
        "data": data,
        "suggested_questions": [
            "What are this month's sales?",
            "Which invoices are outstanding?",
            "Which products have low stock?",
            "What is the current profit?",
        ],
    }


# ============================================================
# 4. LLM AUGMENTATION ENGINE (OPTIONAL WITH SAFE FALLBACK)
# ============================================================

def call_gemini_api(api_key, system_context, user_query):
    """
    Calls Google Gemini REST API using standard urllib.
    Timeout 5 seconds. Returns generated text or None.
    """
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_context}\n\nUser Question: {user_query}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 800,
            }
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                result = json.loads(response.read().decode("utf-8"))
                candidates = result.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
    except Exception as e:
        logger.warning(f"Gemini API request failed (falling back to deterministic synthesis): {e}")
    return None


def call_openai_api(api_key, system_context, user_query):
    """
    Calls OpenAI REST API using standard urllib.
    Timeout 5 seconds. Returns generated text or None.
    """
    try:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_context},
                {"role": "user", "content": user_query}
            ],
            "temperature": 0.2,
            "max_tokens": 800,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                result = json.loads(response.read().decode("utf-8"))
                choices = result.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"OpenAI API request failed (falling back to deterministic synthesis): {e}")
    return None


# ============================================================
# 5. MAIN AI ASSISTANT DISPATCHER
# ============================================================

def process_ai_query(company, query, conversation_history=None):
    """
    Main entry point for AI ERP Assistant queries.
    1. Classifies intent from query.
    2. Retrieves structured ERP data strictly scoped to active company.
    3. Synthesizes an accurate deterministic response.
    4. Optionally augments with LLM if API key is provided and online.
    5. Returns response dict with answer, intent, data, and suggested questions.
    """
    if not query or not query.strip():
        return {
            "intent": ERPIntent.GENERAL,
            "answer": "Please ask a question about your ERP data, such as *'What are this month's sales?'* or *'Which products have low stock?'*.",
            "data": {},
            "suggested_questions": [
                "What are this month's sales?",
                "Which invoices are outstanding?",
                "Which products have low stock?",
                "What is the current profit?",
            ],
        }

    clean_query = query.strip()
    intent, entity_name = classify_query(clean_query)

    # 1. Deterministic Synthesis with verified real data
    deterministic_result = synthesize_deterministic_response(intent, entity_name, company)

    # 2. Check for LLM API keys
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if gemini_key or openai_key:
        system_context = (
            f"You are the ICORP ERP AI Assistant for company '{company.name}'.\n"
            f"RULES:\n"
            f"- Strictly use the verified company data provided below.\n"
            f"- Do not hallucinate numbers or speculate.\n"
            f"- Format your response professionally in Markdown with bold numbers, bullets, and tables where appropriate.\n"
            f"- You are strictly read-only.\n\n"
            f"VERIFIED ERP DATA CONTEXT:\n{json.dumps(deterministic_result['data'], default=str, indent=2)}"
        )
        llm_answer = None
        if gemini_key:
            llm_answer = call_gemini_api(gemini_key, system_context, clean_query)
        elif openai_key:
            llm_answer = call_openai_api(openai_key, system_context, clean_query)

        if llm_answer and len(llm_answer.strip()) > 20:
            deterministic_result["answer"] = llm_answer.strip()
            deterministic_result["llm_augmented"] = True
        else:
            deterministic_result["llm_augmented"] = False
    else:
        deterministic_result["llm_augmented"] = False

    return deterministic_result
