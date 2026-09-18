from decimal import Decimal
from django.db import transaction
from rest_framework import serializers
from inventory.models import Vendor, Product, Warehouse
from .models import (
    PurchaseQuotation,
    PurchaseQuotationItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseInvoice,
    PurchaseInvoiceItem,
    PurchasePayment,
    generate_purchase_quotation_number,
    generate_purchase_order_number,
    generate_purchase_receipt_number,
    generate_purchase_invoice_number,
    generate_purchase_payment_number,
)


class PurchaseQuotationItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseQuotationItem
        fields = [
            "id",
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

    def validate_quantity(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_discount(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Discount cannot be negative.")
        return value

    def validate_tax(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Tax cannot be negative.")
        return value

    def validate(self, attrs):
        product = attrs.get("product")
        company = self.context.get("company")
        if product and company and product.company_id != company.id:
            raise serializers.ValidationError({"product": "Product must belong to the selected company."})
        return attrs


class PurchaseQuotationSerializer(serializers.ModelSerializer):
    items = PurchaseQuotationItemSerializer(many=True, required=False)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    vendor_email = serializers.CharField(source="vendor.email", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseQuotation
        fields = [
            "id",
            "company",
            "vendor",
            "vendor_name",
            "vendor_email",
            "quotation_number",
            "quotation_date",
            "valid_until",
            "status",
            "notes",
            "subtotal",
            "discount",
            "tax",
            "total",
            "items",
            "items_count",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "company",
            "quotation_number",
            "subtotal",
            "discount",
            "tax",
            "total",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_items_count(self, obj):
        return obj.items.count()

    def validate_vendor(self, value):
        company = self.context.get("company")
        if company and value.company_id != company.id:
            raise serializers.ValidationError("Vendor must belong to the selected company.")
        return value

    def validate(self, attrs):
        items_data = self.initial_data.get("items")
        if self.instance is None and (not items_data or len(items_data) == 0):
            raise serializers.ValidationError({"items": "At least one quotation item is required."})

        company = self.context.get("company")
        vendor = attrs.get("vendor", getattr(self.instance, "vendor", None))
        if vendor and company and vendor.company_id != company.id:
            raise serializers.ValidationError({"vendor": "Vendor must belong to the selected company."})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        company = self.context.get("company")
        user = self.context.get("request").user if self.context.get("request") else None

        with transaction.atomic():
            quotation_number = generate_purchase_quotation_number(company)
            quotation = PurchaseQuotation.objects.create(
                company=company,
                created_by=user,
                quotation_number=quotation_number,
                **validated_data,
            )

            for item_data in items_data:
                product = item_data["product"]
                if product.company_id != company.id:
                    raise serializers.ValidationError(f"Product {product.name} does not belong to this company.")
                PurchaseQuotationItem.objects.create(quotation=quotation, **item_data)

            quotation.recalculate_totals()
            quotation.save()

        return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        company = self.context.get("company", instance.company)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if items_data is not None:
                instance.items.all().delete()
                for item_data in items_data:
                    product = item_data["product"]
                    if product.company_id != company.id:
                        raise serializers.ValidationError(f"Product {product.name} does not belong to this company.")
                    PurchaseQuotationItem.objects.create(quotation=instance, **item_data)
                instance.recalculate_totals()
                instance.save()

        return instance


class PurchaseReceiptItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = PurchaseReceiptItem
        fields = [
            "id",
            "purchase_order_item",
            "product",
            "product_name",
            "product_sku",
            "ordered_quantity",
            "previously_received_quantity",
            "received_quantity",
            "notes",
        ]


class PurchaseReceiptSerializer(serializers.ModelSerializer):
    items = PurchaseReceiptItemSerializer(many=True, read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.order_number", read_only=True)
    vendor_id = serializers.IntegerField(source="purchase_order.vendor_id", read_only=True)
    vendor_name = serializers.CharField(source="purchase_order.vendor.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    received_by_name = serializers.CharField(source="received_by.get_full_name", read_only=True)
    total_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseReceipt
        fields = [
            "id",
            "company",
            "purchase_order",
            "purchase_order_number",
            "vendor_id",
            "vendor_name",
            "receipt_number",
            "receipt_date",
            "warehouse",
            "warehouse_name",
            "status",
            "notes",
            "total_quantity",
            "items",
            "items_count",
            "received_by",
            "received_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "company",
            "receipt_number",
            "total_quantity",
            "items_count",
            "received_by",
            "created_at",
            "updated_at",
        ]

    def get_items_count(self, obj):
        return obj.items.count()


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    received_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "description",
            "quantity",
            "received_quantity",
            "remaining_quantity",
            "unit_price",
            "discount",
            "tax",
            "line_total",
        ]

    def validate_quantity(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_discount(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Discount cannot be negative.")
        return value

    def validate_tax(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Tax cannot be negative.")
        return value

    def validate(self, attrs):
        product = attrs.get("product")
        company = self.context.get("company")
        if product and company and product.company_id != company.id:
            raise serializers.ValidationError({"product": "Product must belong to the selected company."})
        return attrs


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, required=False)
    receipts = PurchaseReceiptSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    vendor_email = serializers.CharField(source="vendor.email", read_only=True)
    quotation_number = serializers.CharField(source="quotation.quotation_number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    items_count = serializers.SerializerMethodField()
    total_ordered_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_received_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_remaining_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    receiving_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    receipts_count = serializers.SerializerMethodField()
    total_invoiced_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    outstanding_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    payment_status = serializers.CharField(read_only=True)
    invoices = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "company",
            "vendor",
            "vendor_name",
            "vendor_email",
            "quotation",
            "quotation_number",
            "warehouse",
            "warehouse_name",
            "order_number",
            "order_date",
            "expected_date",
            "status",
            "notes",
            "subtotal",
            "discount",
            "tax",
            "total",
            "items",
            "items_count",
            "receipts",
            "receipts_count",
            "total_ordered_quantity",
            "total_received_quantity",
            "total_remaining_quantity",
            "receiving_percentage",
            "total_invoiced_amount",
            "paid_amount",
            "outstanding_amount",
            "payment_status",
            "invoices",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "company",
            "order_number",
            "subtotal",
            "discount",
            "tax",
            "total",
            "receipts",
            "receipts_count",
            "total_ordered_quantity",
            "total_received_quantity",
            "total_remaining_quantity",
            "receiving_percentage",
            "total_invoiced_amount",
            "paid_amount",
            "outstanding_amount",
            "payment_status",
            "invoices",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_items_count(self, obj):
        return obj.items.count()

    def get_receipts_count(self, obj):
        return obj.receipts.count()

    def get_invoices(self, obj):
        active_invoices = obj.invoices.exclude(status="CANCELLED")
        return [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "invoice_date": str(inv.invoice_date),
                "due_date": str(inv.due_date) if inv.due_date else None,
                "status": inv.status,
                "total": str(inv.total),
                "amount_paid": str(inv.amount_paid),
                "balance_due": str(inv.balance_due),
            }
            for inv in active_invoices
        ]

    def validate_vendor(self, value):
        company = self.context.get("company")
        if company and value.company_id != company.id:
            raise serializers.ValidationError("Vendor must belong to the selected company.")
        return value

    def validate_warehouse(self, value):
        company = self.context.get("company")
        if value and company and value.company_id != company.id:
            raise serializers.ValidationError("Warehouse must belong to the selected company.")
        return value

    def validate(self, attrs):
        items_data = self.initial_data.get("items")
        if self.instance is None and (not items_data or len(items_data) == 0):
            raise serializers.ValidationError({"items": "At least one order item is required."})

        company = self.context.get("company")
        vendor = attrs.get("vendor", getattr(self.instance, "vendor", None))
        if vendor and company and vendor.company_id != company.id:
            raise serializers.ValidationError({"vendor": "Vendor must belong to the selected company."})

        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))
        if warehouse and company and warehouse.company_id != company.id:
            raise serializers.ValidationError({"warehouse": "Warehouse must belong to the selected company."})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        company = self.context.get("company")
        user = self.context.get("request").user if self.context.get("request") else None

        with transaction.atomic():
            order_number = generate_purchase_order_number(company)
            order = PurchaseOrder.objects.create(
                company=company,
                created_by=user,
                order_number=order_number,
                **validated_data,
            )

            for item_data in items_data:
                product = item_data["product"]
                if product.company_id != company.id:
                    raise serializers.ValidationError(f"Product {product.name} does not belong to this company.")
                PurchaseOrderItem.objects.create(purchase_order=order, **item_data)

            order.recalculate_totals()
            order.save()

        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        company = self.context.get("company", instance.company)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if items_data is not None:
                instance.items.all().delete()
                for item_data in items_data:
                    product = item_data["product"]
                    if product.company_id != company.id:
                        raise serializers.ValidationError(f"Product {product.name} does not belong to this company.")
                    PurchaseOrderItem.objects.create(purchase_order=instance, **item_data)
                instance.recalculate_totals()
                instance.save()

        return instance


# ============================================================
# 5. PURCHASE INVOICE & PAYMENT SERIALIZERS (FINANCE)
# ============================================================

class PurchaseInvoiceItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseInvoiceItem
        fields = [
            "id",
            "purchase_order_item",
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

    def validate_quantity(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_discount(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Discount cannot be negative.")
        return value

    def validate_tax(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Tax cannot be negative.")
        return value


class PurchasePaymentSerializer(serializers.ModelSerializer):
    vendor = serializers.PrimaryKeyRelatedField(queryset=Vendor.objects.all(), required=False)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = PurchasePayment
        fields = [
            "id",
            "company",
            "vendor",
            "vendor_name",
            "invoice",
            "invoice_number",
            "payment_number",
            "payment_date",
            "amount",
            "payment_method",
            "reference",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "company",
            "payment_number",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value

    def validate(self, attrs):
        invoice = attrs.get("invoice")
        company = self.context.get("company")
        amount = attrs.get("amount")

        if not attrs.get("vendor") and invoice:
            attrs["vendor"] = invoice.vendor

        if invoice and company and invoice.company_id != company.id:
            raise serializers.ValidationError({"invoice": "Invoice does not belong to this company."})

        if invoice:
            if invoice.status == PurchaseInvoice.InvoiceStatus.CANCELLED:
                raise serializers.ValidationError({"invoice": "Cannot record payment against a cancelled invoice."})
            if amount and amount > invoice.balance_due:
                raise serializers.ValidationError({
                    "detail": f"Payment amount ({amount}) cannot exceed balance due ({invoice.balance_due}).",
                    "amount": f"Payment amount ({amount}) cannot exceed balance due ({invoice.balance_due}).",
                })
        return attrs

    def create(self, validated_data):
        company = self.context.get("company")
        user = self.context.get("request").user if self.context.get("request") else None
        invoice = validated_data.get("invoice")
        amount = validated_data.get("amount")

        with transaction.atomic():
            locked_invoice = PurchaseInvoice.objects.select_for_update().get(id=invoice.id)
            if amount > locked_invoice.balance_due:
                raise serializers.ValidationError({
                    "detail": f"Payment amount ({amount}) cannot exceed balance due ({locked_invoice.balance_due}).",
                    "amount": f"Payment amount ({amount}) cannot exceed balance due ({locked_invoice.balance_due}).",
                })

            payment_number = generate_purchase_payment_number(company)
            vendor_obj = validated_data.pop("vendor", None) or locked_invoice.vendor
            payment = PurchasePayment.objects.create(
                company=company,
                vendor=vendor_obj,
                created_by=user,
                payment_number=payment_number,
                **validated_data,
            )

            locked_invoice.recalculate_totals()
            locked_invoice.save()

            if locked_invoice.purchase_order:
                locked_invoice.purchase_order.refresh_from_db()

        return payment


class PurchaseInvoiceSerializer(serializers.ModelSerializer):
    items = PurchaseInvoiceItemSerializer(many=True, required=False)
    payments = PurchasePaymentSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    vendor_email = serializers.CharField(source="vendor.email", read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.order_number", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    items_count = serializers.SerializerMethodField()
    payments_count = serializers.SerializerMethodField()
    paid_amount = serializers.DecimalField(source="amount_paid", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseInvoice
        fields = [
            "id",
            "company",
            "vendor",
            "vendor_name",
            "vendor_email",
            "purchase_order",
            "purchase_order_number",
            "invoice_number",
            "vendor_invoice_number",
            "invoice_date",
            "due_date",
            "status",
            "notes",
            "subtotal",
            "discount",
            "tax",
            "total",
            "amount_paid",
            "paid_amount",
            "balance_due",
            "items",
            "items_count",
            "payments",
            "payments_count",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "company",
            "invoice_number",
            "subtotal",
            "discount",
            "tax",
            "total",
            "amount_paid",
            "paid_amount",
            "balance_due",
            "payments",
            "payments_count",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_items_count(self, obj):
        return obj.items.count()

    def get_payments_count(self, obj):
        return obj.payments.count()

    def validate_vendor(self, value):
        company = self.context.get("company")
        if company and value.company_id != company.id:
            raise serializers.ValidationError("Vendor must belong to the selected company.")
        return value

    def validate(self, attrs):
        items_data = self.initial_data.get("items")
        if self.instance is None and (not items_data or len(items_data) == 0):
            raise serializers.ValidationError({"items": "At least one invoice item is required."})

        company = self.context.get("company")
        vendor = attrs.get("vendor", getattr(self.instance, "vendor", None))
        if vendor and company and vendor.company_id != company.id:
            raise serializers.ValidationError({"vendor": "Vendor must belong to the selected company."})

        po = attrs.get("purchase_order", getattr(self.instance, "purchase_order", None))
        if po and company and po.company_id != company.id:
            raise serializers.ValidationError({"purchase_order": "Purchase order must belong to the selected company."})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        company = self.context.get("company")
        user = self.context.get("request").user if self.context.get("request") else None

        with transaction.atomic():
            invoice_number = generate_purchase_invoice_number(company)
            invoice = PurchaseInvoice.objects.create(
                company=company,
                created_by=user,
                invoice_number=invoice_number,
                **validated_data,
            )

            for item_data in items_data:
                product = item_data["product"]
                if product.company_id != company.id:
                    raise serializers.ValidationError(f"Product {product.name} does not belong to this company.")
                PurchaseInvoiceItem.objects.create(invoice=invoice, **item_data)

            invoice.recalculate_totals()
            invoice.save()

        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        company = self.context.get("company", instance.company)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if items_data is not None:
                instance.items.all().delete()
                for item_data in items_data:
                    product = item_data["product"]
                    if product.company_id != company.id:
                        raise serializers.ValidationError(f"Product {product.name} does not belong to this company.")
                    PurchaseInvoiceItem.objects.create(invoice=instance, **item_data)
                instance.recalculate_totals()
                instance.save()

        return instance
