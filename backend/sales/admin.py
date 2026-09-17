from django.contrib import admin
from .models import (
    Quotation,
    QuotationItem,
    SalesOrder,
    SalesOrderItem,
    SalesOrderReservation,
    Invoice,
    InvoiceItem,
    Payment,
    Receipt,
)


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ["quotation_number", "company", "customer", "quotation_date", "status", "total"]
    list_filter = ["status", "company", "quotation_date"]
    search_fields = ["quotation_number", "customer__name"]
    inlines = [QuotationItemInline]


class SalesOrderItemInline(admin.TabularInline):
    model = SalesOrderItem
    extra = 1


class SalesOrderReservationInline(admin.TabularInline):
    model = SalesOrderReservation
    extra = 0
    readonly_fields = ["product", "warehouse", "quantity", "status", "created_at"]


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ["order_number", "company", "customer", "warehouse", "order_date", "status", "total"]
    list_filter = ["status", "company", "warehouse", "order_date"]
    search_fields = ["order_number", "customer__name"]
    inlines = [SalesOrderItemInline, SalesOrderReservationInline]


@admin.register(SalesOrderReservation)
class SalesOrderReservationAdmin(admin.ModelAdmin):
    list_display = ["id", "company", "sales_order", "product", "warehouse", "quantity", "status", "created_at"]
    list_filter = ["status", "company", "warehouse"]
    search_fields = ["sales_order__order_number", "product__name", "product__sku"]


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["invoice_number", "company", "customer", "sales_order", "invoice_date", "due_date", "status", "total", "amount_paid", "balance_due"]
    list_filter = ["status", "company", "invoice_date", "due_date"]
    search_fields = ["invoice_number", "customer__name", "sales_order__order_number"]
    inlines = [InvoiceItemInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["payment_number", "company", "invoice", "customer", "payment_date", "payment_method", "amount"]
    list_filter = ["payment_method", "company", "payment_date"]
    search_fields = ["payment_number", "invoice__invoice_number", "customer__name", "reference"]


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ["receipt_number", "company", "payment", "invoice", "customer", "receipt_date", "amount"]
    list_filter = ["company", "receipt_date"]
    search_fields = ["receipt_number", "payment__payment_number", "invoice__invoice_number", "customer__name"]

