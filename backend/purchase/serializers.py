from decimal import Decimal
from django.db import transaction
from rest_framework import serializers
from inventory.models import Vendor, Product, Warehouse
from .models import (
    PurchaseQuotation,
    PurchaseQuotationItem,
    PurchaseOrder,
    PurchaseOrderItem,
    generate_purchase_quotation_number,
    generate_purchase_order_number,
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


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
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


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, required=False)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    vendor_email = serializers.CharField(source="vendor.email", read_only=True)
    quotation_number = serializers.CharField(source="quotation.quotation_number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    items_count = serializers.SerializerMethodField()

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
