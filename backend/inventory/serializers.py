from decimal import Decimal
from rest_framework import serializers
from .models import Category, Product, Warehouse, Stock, StockTransaction, Vendor


class CategorySerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    products_count = serializers.IntegerField(source="products.count", read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "description",
            "is_active",
            "products_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "company_name", "products_count", "created_at", "updated_at"]


class ProductSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    total_stock = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_available_stock = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "company",
            "company_name",
            "category",
            "category_name",
            "name",
            "sku",
            "unit",
            "description",
            "cost_price",
            "selling_price",
            "tax",
            "reorder_level",
            "is_active",
            "total_stock",
            "total_available_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "company_name",
            "category_name",
            "total_stock",
            "total_available_stock",
            "created_at",
            "updated_at",
        ]


class WarehouseSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    total_stock_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "code",
            "address",
            "is_active",
            "total_stock_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "company_name", "total_stock_count", "created_at", "updated_at"]

    def get_total_stock_count(self, obj):
        from django.db.models import Sum
        val = obj.stocks.aggregate(total=Sum("quantity"))["total"]
        return float(val or 0.00)


class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_unit = serializers.CharField(source="product.unit", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    available_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Stock
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "product_unit",
            "warehouse",
            "warehouse_name",
            "warehouse_code",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "reorder_level",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "product_name",
            "product_sku",
            "product_unit",
            "warehouse_name",
            "warehouse_code",
            "available_quantity",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]


class StockTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    destination_warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True)
    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            "id",
            "company",
            "product",
            "product_name",
            "product_sku",
            "warehouse",
            "warehouse_name",
            "warehouse_code",
            "destination_warehouse",
            "destination_warehouse_name",
            "destination_warehouse_code",
            "transaction_type",
            "quantity",
            "reference",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "product_name",
            "product_sku",
            "warehouse_name",
            "warehouse_code",
            "destination_warehouse_name",
            "destination_warehouse_code",
            "created_by",
            "created_by_name",
            "created_at",
        ]


class StockMovementCreateSerializer(serializers.Serializer):
    product = serializers.IntegerField(required=True)
    warehouse = serializers.IntegerField(required=True)
    destination_warehouse = serializers.IntegerField(required=False, allow_null=True)
    transaction_type = serializers.ChoiceField(choices=StockTransaction.TransactionType.choices)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        trans_type = attrs.get("transaction_type")
        wh = attrs.get("warehouse")
        dest_wh = attrs.get("destination_warehouse")

        if trans_type == StockTransaction.TransactionType.TRANSFER:
            if not dest_wh:
                raise serializers.ValidationError({"destination_warehouse": "Destination warehouse is required for transfer transactions."})
            if wh == dest_wh:
                raise serializers.ValidationError({"destination_warehouse": "Source and destination warehouse cannot be the same."})

        return attrs


class VendorSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = Vendor
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "email",
            "phone",
            "address",
            "tax_id",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "company_name", "created_at", "updated_at"]
