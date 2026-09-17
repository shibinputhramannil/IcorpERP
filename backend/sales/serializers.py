from decimal import Decimal
from rest_framework import serializers

from crm.models import Customer
from inventory.models import Product, Warehouse, Stock
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
    SalesReturn,
    SalesReturnItem,
    generate_quotation_number,
    generate_order_number,
    generate_invoice_number,
    generate_payment_number,
    generate_receipt_number,
    generate_return_number,
)


class QuotationItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = QuotationItem
        fields = [
            "id",
            "quotation",
            "product",
            "product_name",
            "product_sku",
            "description",
            "quantity",
            "unit_price",
            "discount",
            "tax",
            "line_total",
        ]
        read_only_fields = ["id", "quotation", "product_name", "product_sku", "line_total"]

    def validate_quantity(self, value):
        if value is None or Decimal(str(value)) <= Decimal("0.00"):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value is None or Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_discount(self, value):
        if value is not None and Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Discount cannot be negative.")
        return value

    def validate_tax(self, value):
        if value is not None and Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Tax cannot be negative.")
        return value


class QuotationSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    items = QuotationItemSerializer(many=True, required=False)
    items_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = Quotation
        fields = [
            "id",
            "company",
            "company_name",
            "customer",
            "customer_name",
            "customer_email",
            "quotation_number",
            "quotation_date",
            "valid_until",
            "status",
            "notes",
            "subtotal",
            "discount",
            "tax",
            "total",
            "created_by",
            "created_by_name",
            "items",
            "items_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "quotation_number",
            "customer_name",
            "customer_email",
            "created_by",
            "created_by_name",
            "subtotal",
            "discount",
            "tax",
            "total",
            "items_count",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = self.context.get("company")
        if not company and self.instance:
            company = self.instance.company

        customer = attrs.get("customer")
        if customer and company and customer.company_id != company.id:
            raise serializers.ValidationError({
                "customer": "Customer must belong to the selected company."
            })

        # Validate nested items
        items_data = self.initial_data.get("items", [])
        if isinstance(items_data, list):
            for item in items_data:
                product_id = item.get("product")
                if product_id:
                    try:
                        product = Product.objects.get(id=product_id)
                        if company and product.company_id != company.id:
                            raise serializers.ValidationError({
                                "items": f"Product '{product.name}' does not belong to this company."
                            })
                        if not product.is_active:
                            raise serializers.ValidationError({
                                "items": f"Product '{product.name}' is inactive."
                            })
                    except Product.DoesNotExist:
                        raise serializers.ValidationError({
                            "items": f"Product ID {product_id} does not exist."
                        })

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        company = validated_data["company"]

        if not validated_data.get("quotation_number"):
            validated_data["quotation_number"] = generate_quotation_number(company)

        quotation = Quotation.objects.create(**validated_data)

        for item_data in items_data:
            QuotationItem.objects.create(quotation=quotation, **item_data)

        quotation.recalculate_totals()
        quotation.save(update_fields=["subtotal", "discount", "tax", "total"])
        return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                QuotationItem.objects.create(quotation=instance, **item_data)
            instance.recalculate_totals()
            instance.save(update_fields=["subtotal", "discount", "tax", "total"])

        return instance


class SalesOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    reserved_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    available_stock = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderItem
        fields = [
            "id",
            "sales_order",
            "product",
            "product_name",
            "product_sku",
            "description",
            "quantity",
            "unit_price",
            "discount",
            "tax",
            "line_total",
            "reserved_quantity",
            "available_stock",
        ]
        read_only_fields = [
            "id",
            "sales_order",
            "product_name",
            "product_sku",
            "line_total",
            "reserved_quantity",
            "available_stock",
        ]

    def get_available_stock(self, obj):
        order = obj.sales_order
        if order and order.warehouse_id:
            stock = Stock.objects.filter(product_id=obj.product_id, warehouse_id=order.warehouse_id).first()
            if stock:
                return str(stock.available_quantity)
        return "0.00"

    def validate_quantity(self, value):
        if value is None or Decimal(str(value)) <= Decimal("0.00"):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value is None or Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_discount(self, value):
        if value is not None and Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Discount cannot be negative.")
        return value

    def validate_tax(self, value):
        if value is not None and Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Tax cannot be negative.")
        return value


class SalesOrderReservationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:
        model = SalesOrderReservation
        fields = [
            "id",
            "company",
            "sales_order",
            "sales_order_item",
            "product",
            "product_name",
            "product_sku",
            "warehouse",
            "warehouse_name",
            "warehouse_code",
            "quantity",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "sales_order",
            "sales_order_item",
            "product_name",
            "product_sku",
            "warehouse_name",
            "warehouse_code",
            "created_at",
            "updated_at",
        ]


class SalesOrderSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, default=None)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True, default=None)
    quotation_number = serializers.CharField(source="quotation.quotation_number", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    reservation_status = serializers.CharField(read_only=True)
    items = SalesOrderItemSerializer(many=True, required=False)
    items_count = serializers.IntegerField(source="items.count", read_only=True)
    reservations = SalesOrderReservationSerializer(many=True, read_only=True)

    class Meta:
        model = SalesOrder
        fields = [
            "id",
            "company",
            "company_name",
            "customer",
            "customer_name",
            "customer_email",
            "warehouse",
            "warehouse_name",
            "warehouse_code",
            "quotation",
            "quotation_number",
            "order_number",
            "order_date",
            "status",
            "reservation_status",
            "notes",
            "subtotal",
            "discount",
            "tax",
            "total",
            "created_by",
            "created_by_name",
            "items",
            "items_count",
            "reservations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "order_number",
            "quotation_number",
            "customer_name",
            "customer_email",
            "warehouse_name",
            "warehouse_code",
            "reservation_status",
            "created_by",
            "created_by_name",
            "subtotal",
            "discount",
            "tax",
            "total",
            "items_count",
            "reservations",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = self.context.get("company")
        if not company and self.instance:
            company = self.instance.company

        customer = attrs.get("customer")
        if customer and company and customer.company_id != company.id:
            raise serializers.ValidationError({
                "customer": "Customer must belong to the selected company."
            })

        warehouse = attrs.get("warehouse")
        if warehouse:
            if company and warehouse.company_id != company.id:
                raise serializers.ValidationError({
                    "warehouse": "Warehouse must belong to the selected company."
                })
            if not warehouse.is_active:
                raise serializers.ValidationError({
                    "warehouse": "Selected warehouse is inactive."
                })

        quotation = attrs.get("quotation")
        if quotation and company and quotation.company_id != company.id:
            raise serializers.ValidationError({
                "quotation": "Quotation must belong to the selected company."
            })

        # Validate nested items
        items_data = self.initial_data.get("items", [])
        if isinstance(items_data, list):
            for item in items_data:
                product_id = item.get("product")
                if product_id:
                    try:
                        product = Product.objects.get(id=product_id)
                        if company and product.company_id != company.id:
                            raise serializers.ValidationError({
                                "items": f"Product '{product.name}' does not belong to this company."
                            })
                        if not product.is_active:
                            raise serializers.ValidationError({
                                "items": f"Product '{product.name}' is inactive."
                            })
                    except Product.DoesNotExist:
                        raise serializers.ValidationError({
                            "items": f"Product ID {product_id} does not exist."
                        })

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        company = validated_data["company"]

        if not validated_data.get("order_number"):
            validated_data["order_number"] = generate_order_number(company)

        order = SalesOrder.objects.create(**validated_data)

        for item_data in items_data:
            SalesOrderItem.objects.create(sales_order=order, **item_data)

        order.recalculate_totals()
        order.save(update_fields=["subtotal", "discount", "tax", "total"])
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                SalesOrderItem.objects.create(sales_order=instance, **item_data)
            instance.recalculate_totals()
            instance.save(update_fields=["subtotal", "discount", "tax", "total"])

        return instance


# ============================================================
# 3. INVOICE, PAYMENT & RECEIPT SERIALIZERS
# ============================================================

class InvoiceItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = InvoiceItem
        fields = [
            "id",
            "invoice",
            "product",
            "product_name",
            "product_sku",
            "description",
            "quantity",
            "unit_price",
            "discount",
            "tax",
            "line_total",
        ]
        read_only_fields = ["id", "invoice", "product_name", "product_sku", "line_total"]

    def validate_quantity(self, value):
        if value is None or Decimal(str(value)) <= Decimal("0.00"):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value is None or Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_discount(self, value):
        if value is not None and Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Discount cannot be negative.")
        return value

    def validate_tax(self, value):
        if value is not None and Decimal(str(value)) < Decimal("0.00"):
            raise serializers.ValidationError("Tax cannot be negative.")
        return value


class ReceiptSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    payment_number = serializers.CharField(source="payment.payment_number", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id",
            "company",
            "company_name",
            "payment",
            "payment_number",
            "invoice",
            "invoice_number",
            "customer",
            "customer_name",
            "receipt_number",
            "receipt_date",
            "amount",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "payment",
            "payment_number",
            "invoice",
            "invoice_number",
            "customer_name",
            "receipt_number",
            "created_by_name",
            "created_at",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    received_by_name = serializers.CharField(source="received_by.get_full_name", read_only=True)
    receipt = ReceiptSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "company",
            "company_name",
            "invoice",
            "invoice_number",
            "customer",
            "customer_name",
            "payment_number",
            "amount",
            "payment_date",
            "payment_method",
            "reference",
            "notes",
            "received_by",
            "received_by_name",
            "receipt",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "invoice",
            "invoice_number",
            "customer",
            "customer_name",
            "payment_number",
            "received_by_name",
            "receipt",
            "created_at",
        ]

    def validate_amount(self, value):
        if value is None or Decimal(str(value)) <= Decimal("0.00"):
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    effective_status = serializers.CharField(read_only=True)
    items = InvoiceItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)
    receipts = ReceiptSerializer(many=True, read_only=True)
    payments_count = serializers.IntegerField(source="payments.count", read_only=True)
    receipts_count = serializers.IntegerField(source="receipts.count", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "company",
            "company_name",
            "customer",
            "customer_name",
            "customer_email",
            "sales_order",
            "order_number",
            "invoice_number",
            "invoice_date",
            "due_date",
            "status",
            "effective_status",
            "is_overdue",
            "notes",
            "subtotal",
            "discount",
            "tax",
            "total",
            "amount_paid",
            "balance_due",
            "created_by",
            "created_by_name",
            "items",
            "payments",
            "receipts",
            "payments_count",
            "receipts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "customer_name",
            "customer_email",
            "order_number",
            "invoice_number",
            "effective_status",
            "is_overdue",
            "subtotal",
            "discount",
            "tax",
            "total",
            "amount_paid",
            "balance_due",
            "created_by_name",
            "payments",
            "receipts",
            "payments_count",
            "receipts_count",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = attrs.get("company") or (self.instance.company if self.instance else None)
        customer = attrs.get("customer")
        if customer and company and customer.company_id != company.id:
            raise serializers.ValidationError({
                "customer": "Customer must belong to the selected company."
            })

        # Validate nested items
        items_data = self.initial_data.get("items", [])
        if isinstance(items_data, list):
            for item in items_data:
                product_id = item.get("product")
                if product_id:
                    try:
                        product = Product.objects.get(id=product_id)
                        if company and product.company_id != company.id:
                            raise serializers.ValidationError({
                                "items": f"Product '{product.name}' does not belong to this company."
                            })
                        if not product.is_active:
                            raise serializers.ValidationError({
                                "items": f"Product '{product.name}' is inactive."
                            })
                    except Product.DoesNotExist:
                        raise serializers.ValidationError({
                            "items": f"Product ID {product_id} does not exist."
                        })

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        company = validated_data["company"]

        if not validated_data.get("invoice_number"):
            validated_data["invoice_number"] = generate_invoice_number(company)

        invoice = Invoice.objects.create(**validated_data)

        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)

        invoice.recalculate_totals()
        invoice.save(update_fields=["subtotal", "discount", "tax", "total", "balance_due"])
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                InvoiceItem.objects.create(invoice=instance, **item_data)
            instance.recalculate_totals()
            instance.save(update_fields=["subtotal", "discount", "tax", "total", "balance_due"])

        return instance


class SalesFinancialSummarySerializer(serializers.Serializer):
    total_invoices_count = serializers.IntegerField()
    issued_invoices_count = serializers.IntegerField()
    partially_paid_invoices_count = serializers.IntegerField()
    paid_invoices_count = serializers.IntegerField()
    overdue_invoices_count = serializers.IntegerField()
    cancelled_invoices_count = serializers.IntegerField()
    total_invoiced_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_paid_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_outstanding_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    current_month_invoiced_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    current_month_paid_amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class SalesReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = SalesReturnItem
        fields = [
            "id",
            "sales_return",
            "sales_order_item",
            "product",
            "product_name",
            "product_sku",
            "quantity",
            "unit_price",
            "line_total",
        ]
        read_only_fields = ["id", "sales_return", "product_name", "product_sku", "line_total"]


class SalesReturnSerializer(serializers.ModelSerializer):
    items = SalesReturnItemSerializer(many=True, required=False)
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = SalesReturn
        fields = [
            "id",
            "company",
            "sales_order",
            "order_number",
            "customer",
            "customer_name",
            "warehouse",
            "warehouse_name",
            "return_number",
            "return_date",
            "status",
            "reason",
            "total_amount",
            "created_by",
            "created_by_name",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "return_number",
            "order_number",
            "customer_name",
            "warehouse_name",
            "created_by",
            "created_by_name",
            "total_amount",
            "created_at",
            "updated_at",
        ]


