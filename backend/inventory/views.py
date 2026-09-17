from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q, F
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from .models import Category, Product, Warehouse, Stock, StockTransaction, Vendor
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    WarehouseSerializer,
    StockSerializer,
    StockTransactionSerializer,
    StockMovementCreateSerializer,
    VendorSerializer,
)


class InventoryBaseView(APIView):
    """
    Base view providing multi-tenant isolation and role checks.
    """
    permission_classes = [IsAuthenticated]

    def get_company(self, request, company_id):
        if request.user.is_superuser:
            return Company.objects.filter(id=company_id, is_active=True).first()

        membership = (
            request.user.company_memberships
            .select_related("company", "role")
            .filter(
                user=request.user,
                company_id=company_id,
                company__is_active=True,
            )
            .first()
        )
        if not membership:
            return None
        return membership.company


# ============================================================
# 1. CATEGORIES APIs
# ============================================================

class CategoryListCreateView(InventoryBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Category.objects.filter(company=company)
        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        categories = queryset.prefetch_related("products").order_by("name")
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        name = request.data.get("name", "").strip()
        if not name:
            return Response({"name": ["Category name is required."]}, status=400)

        if Category.objects.filter(company=company, name__iexact=name).exists():
            return Response({"name": ["A category with this name already exists in this company."]}, status=400)

        serializer = CategorySerializer(data=request.data)
        if serializer.is_valid():
            category = serializer.save(company=company)
            return Response(CategorySerializer(category).data, status=201)

        return Response(serializer.errors, status=400)


class CategoryDetailView(InventoryBaseView):
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        category = Category.objects.filter(id=pk, company=company).first()
        if not category:
            return Response({"detail": "Category not found."}, status=404)

        return Response(CategorySerializer(category).data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        category = Category.objects.filter(id=pk, company=company).first()
        if not category:
            return Response({"detail": "Category not found."}, status=404)

        name = request.data.get("name")
        if name and name.strip():
            name = name.strip()
            if Category.objects.filter(company=company, name__iexact=name).exclude(id=pk).exists():
                return Response({"name": ["A category with this name already exists in this company."]}, status=400)

        serializer = CategorySerializer(category, data=request.data, partial=True)
        if serializer.is_valid():
            cat = serializer.save()
            return Response(CategorySerializer(cat).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        category = Category.objects.filter(id=pk, company=company).first()
        if not category:
            return Response({"detail": "Category not found."}, status=404)

        category.is_active = False
        category.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": "Category deactivated successfully."}, status=200)


# ============================================================
# 2. PRODUCTS / ITEMS APIs
# ============================================================

class ProductListCreateView(InventoryBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Product.objects.filter(company=company)

        # Filters
        category_id = request.query_params.get("category")
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(sku__icontains=search) | Q(description__icontains=search)
            )

        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        products = queryset.select_related("company", "category").prefetch_related("stocks").order_by("name")
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        sku = request.data.get("sku", "").strip().upper()
        if not sku:
            return Response({"sku": ["SKU is required."]}, status=400)

        if Product.objects.filter(company=company, sku=sku).exists():
            return Response({"sku": [f"Product with SKU '{sku}' already exists in this company."]}, status=400)

        category_id = request.data.get("category")
        category = None
        if category_id:
            category = Category.objects.filter(id=category_id, company=company).first()
            if not category:
                return Response({"category": ["Category does not exist in this company."]}, status=400)

        serializer = ProductSerializer(data=request.data)
        if serializer.is_valid():
            product = serializer.save(company=company, category=category, sku=sku)
            return Response(ProductSerializer(product).data, status=201)

        return Response(serializer.errors, status=400)


class ProductDetailView(InventoryBaseView):
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        product = Product.objects.filter(id=pk, company=company).select_related("company", "category").prefetch_related("stocks").first()
        if not product:
            return Response({"detail": "Product not found."}, status=404)

        return Response(ProductSerializer(product).data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        product = Product.objects.filter(id=pk, company=company).first()
        if not product:
            return Response({"detail": "Product not found."}, status=404)

        sku = request.data.get("sku")
        if sku and sku.strip():
            sku = sku.strip().upper()
            if Product.objects.filter(company=company, sku=sku).exclude(id=pk).exists():
                return Response({"sku": [f"Product with SKU '{sku}' already exists in this company."]}, status=400)

        category_id = request.data.get("category")
        if category_id:
            category = Category.objects.filter(id=category_id, company=company).first()
            if not category:
                return Response({"category": ["Category does not exist in this company."]}, status=400)

        serializer = ProductSerializer(product, data=request.data, partial=True)
        if serializer.is_valid():
            prod = serializer.save()
            if sku:
                prod.sku = sku
                prod.save(update_fields=["sku", "updated_at"])
            return Response(ProductSerializer(prod).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        product = Product.objects.filter(id=pk, company=company).first()
        if not product:
            return Response({"detail": "Product not found."}, status=404)

        product.is_active = False
        product.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": "Product deactivated successfully."}, status=200)


# ============================================================
# 3. WAREHOUSES APIs
# ============================================================

class WarehouseListCreateView(InventoryBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Warehouse.objects.filter(company=company)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))

        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        warehouses = queryset.order_by("name")
        serializer = WarehouseSerializer(warehouses, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        code = request.data.get("code", "").strip().upper()
        if not code:
            return Response({"code": ["Warehouse code is required."]}, status=400)

        if Warehouse.objects.filter(company=company, code=code).exists():
            return Response({"code": [f"Warehouse with code '{code}' already exists in this company."]}, status=400)

        serializer = WarehouseSerializer(data=request.data)
        if serializer.is_valid():
            warehouse = serializer.save(company=company, code=code)
            return Response(WarehouseSerializer(warehouse).data, status=201)

        return Response(serializer.errors, status=400)


class WarehouseDetailView(InventoryBaseView):
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        warehouse = Warehouse.objects.filter(id=pk, company=company).first()
        if not warehouse:
            return Response({"detail": "Warehouse not found."}, status=404)

        return Response(WarehouseSerializer(warehouse).data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        warehouse = Warehouse.objects.filter(id=pk, company=company).first()
        if not warehouse:
            return Response({"detail": "Warehouse not found."}, status=404)

        code = request.data.get("code")
        if code and code.strip():
            code = code.strip().upper()
            if Warehouse.objects.filter(company=company, code=code).exclude(id=pk).exists():
                return Response({"code": [f"Warehouse with code '{code}' already exists in this company."]}, status=400)

        serializer = WarehouseSerializer(warehouse, data=request.data, partial=True)
        if serializer.is_valid():
            wh = serializer.save()
            if code:
                wh.code = code
                wh.save(update_fields=["code", "updated_at"])
            return Response(WarehouseSerializer(wh).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        warehouse = Warehouse.objects.filter(id=pk, company=company).first()
        if not warehouse:
            return Response({"detail": "Warehouse not found."}, status=404)

        warehouse.is_active = False
        warehouse.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": "Warehouse deactivated successfully."}, status=200)


# ============================================================
# 4. INVENTORY STOCK APIs
# ============================================================

class StockListView(InventoryBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Stock.objects.filter(product__company=company)

        warehouse_id = request.query_params.get("warehouse")
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)

        product_id = request.query_params.get("product")
        if product_id:
            queryset = queryset.filter(product_id=product_id)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(product__name__icontains=search) |
                Q(product__sku__icontains=search) |
                Q(warehouse__name__icontains=search) |
                Q(warehouse__code__icontains=search)
            )

        low_stock = request.query_params.get("low_stock")
        if low_stock == "true":
            queryset = queryset.filter(quantity__lte=F("reorder_level"))

        stocks = queryset.select_related("product", "warehouse").order_by("product__name", "warehouse__name")
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data)


class StockDetailView(InventoryBaseView):
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        stock = Stock.objects.filter(id=pk, product__company=company).select_related("product", "warehouse").first()
        if not stock:
            return Response({"detail": "Stock record not found."}, status=404)

        return Response(StockSerializer(stock).data)


# ============================================================
# 5. STOCK TRANSACTIONS & MOVEMENT ENGINE
# ============================================================

class StockTransactionListView(InventoryBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = StockTransaction.objects.filter(company=company)

        trans_type = request.query_params.get("type")
        if trans_type and trans_type != "ALL":
            queryset = queryset.filter(transaction_type=trans_type)

        product_id = request.query_params.get("product")
        if product_id:
            queryset = queryset.filter(product_id=product_id)

        warehouse_id = request.query_params.get("warehouse")
        if warehouse_id:
            queryset = queryset.filter(Q(warehouse_id=warehouse_id) | Q(destination_warehouse_id=warehouse_id))

        transactions = queryset.select_related(
            "company", "product", "warehouse", "destination_warehouse", "created_by"
        ).order_by("-created_at")[:100]

        serializer = StockTransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        serializer = StockMovementCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        product_id = data["product"]
        warehouse_id = data["warehouse"]
        dest_warehouse_id = data.get("destination_warehouse")
        trans_type = data["transaction_type"]
        qty = data["quantity"]
        reference = data.get("reference", "")
        notes = data.get("notes", "")

        with transaction.atomic():
            # 1. Resolve Product (strictly company scoped & active)
            product = Product.objects.filter(id=product_id, company=company, is_active=True).first()
            if not product:
                return Response({"product": ["Active product not found in this company."]}, status=400)

            # 2. Resolve Source Warehouse (strictly company scoped & active)
            warehouse = Warehouse.objects.filter(id=warehouse_id, company=company, is_active=True).first()
            if not warehouse:
                return Response({"warehouse": ["Active warehouse not found in this company."]}, status=400)

            # 3. Process Transaction Type
            dest_warehouse = None

            if trans_type == StockTransaction.TransactionType.STOCK_IN:
                stock, _ = Stock.objects.select_for_update().get_or_create(
                    product=product,
                    warehouse=warehouse,
                    defaults={"quantity": Decimal("0.00"), "reorder_level": product.reorder_level},
                )
                stock.quantity += qty
                stock.save(update_fields=["quantity", "updated_at"])

            elif trans_type == StockTransaction.TransactionType.STOCK_OUT:
                stock = Stock.objects.select_for_update().filter(product=product, warehouse=warehouse).first()
                if not stock or stock.available_quantity < qty:
                    available = stock.available_quantity if stock else Decimal("0.00")
                    return Response({
                        "quantity": [f"Insufficient available stock at {warehouse.name}. Available: {available}, Requested: {qty}"]
                    }, status=400)

                stock.quantity -= qty
                stock.save(update_fields=["quantity", "updated_at"])

            elif trans_type == StockTransaction.TransactionType.ADJUSTMENT:
                stock, _ = Stock.objects.select_for_update().get_or_create(
                    product=product,
                    warehouse=warehouse,
                    defaults={"quantity": Decimal("0.00"), "reorder_level": product.reorder_level},
                )
                # Overwrites stock count to the exact audited quantity
                stock.quantity = qty
                stock.save(update_fields=["quantity", "updated_at"])

            elif trans_type == StockTransaction.TransactionType.TRANSFER:
                dest_warehouse = Warehouse.objects.filter(id=dest_warehouse_id, company=company, is_active=True).first()
                if not dest_warehouse:
                    return Response({"destination_warehouse": ["Active destination warehouse not found in this company."]}, status=400)

                stock_src = Stock.objects.select_for_update().filter(product=product, warehouse=warehouse).first()
                if not stock_src or stock_src.available_quantity < qty:
                    available = stock_src.available_quantity if stock_src else Decimal("0.00")
                    return Response({
                        "quantity": [f"Insufficient available stock at source warehouse {warehouse.name}. Available: {available}, Requested: {qty}"]
                    }, status=400)

                stock_dest, _ = Stock.objects.select_for_update().get_or_create(
                    product=product,
                    warehouse=dest_warehouse,
                    defaults={"quantity": Decimal("0.00"), "reorder_level": product.reorder_level},
                )

                # Atomically deduct from source and add to destination
                stock_src.quantity -= qty
                stock_src.save(update_fields=["quantity", "updated_at"])

                stock_dest.quantity += qty
                stock_dest.save(update_fields=["quantity", "updated_at"])

            # 4. Record Immutable Ledger Transaction
            st_record = StockTransaction.objects.create(
                company=company,
                product=product,
                warehouse=warehouse,
                destination_warehouse=dest_warehouse,
                transaction_type=trans_type,
                quantity=qty,
                reference=reference,
                notes=notes,
                created_by=request.user,
            )

        return Response(StockTransactionSerializer(st_record).data, status=201)


# ============================================================
# 6. VENDORS / SUPPLIERS APIs
# ============================================================

class VendorListCreateView(InventoryBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        queryset = Vendor.objects.filter(company=company)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(email__icontains=search) | Q(phone__icontains=search) | Q(tax_id__icontains=search)
            )

        if request.query_params.get("all") != "true":
            queryset = queryset.filter(is_active=True)

        vendors = queryset.order_by("name")
        serializer = VendorSerializer(vendors, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        name = request.data.get("name", "").strip()
        if not name:
            return Response({"name": ["Vendor name is required."]}, status=400)

        serializer = VendorSerializer(data=request.data)
        if serializer.is_valid():
            vendor = serializer.save(company=company)
            return Response(VendorSerializer(vendor).data, status=201)

        return Response(serializer.errors, status=400)


class VendorDetailView(InventoryBaseView):
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        vendor = Vendor.objects.filter(id=pk, company=company).first()
        if not vendor:
            return Response({"detail": "Vendor not found."}, status=404)

        return Response(VendorSerializer(vendor).data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        vendor = Vendor.objects.filter(id=pk, company=company).first()
        if not vendor:
            return Response({"detail": "Vendor not found."}, status=404)

        serializer = VendorSerializer(vendor, data=request.data, partial=True)
        if serializer.is_valid():
            vend = serializer.save()
            return Response(VendorSerializer(vend).data)

        return Response(serializer.errors, status=400)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        vendor = Vendor.objects.filter(id=pk, company=company).first()
        if not vendor:
            return Response({"detail": "Vendor not found."}, status=404)

        vendor.is_active = False
        vendor.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": "Vendor deactivated successfully."}, status=200)


# ============================================================
# 7. INVENTORY DASHBOARD API
# ============================================================

class InventoryDashboardView(InventoryBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=403)

        # 1. Product stats
        products_qs = Product.objects.filter(company=company)
        total_products = products_qs.count()
        active_products = products_qs.filter(is_active=True).count()

        # 2. Warehouse stats
        total_warehouses = Warehouse.objects.filter(company=company, is_active=True).count()

        # 3. Stock stats
        stocks_qs = Stock.objects.filter(product__company=company)
        total_stock_qty = stocks_qs.aggregate(total=Sum("quantity"))["total"] or Decimal("0.00")

        # 4. Low stock and out of stock counts
        low_stock_count = stocks_qs.filter(quantity__lte=F("reorder_level"), quantity__gt=0).count()
        out_of_stock_count = stocks_qs.filter(quantity=0).count()

        # 5. Inventory valuation: Sum(stock.quantity * product.cost_price)
        valuation = Decimal("0.00")
        for s in stocks_qs.select_related("product"):
            valuation += s.quantity * s.product.cost_price

        # 6. Recent stock transactions
        recent_txs = StockTransaction.objects.filter(company=company).select_related(
            "product", "warehouse", "destination_warehouse", "created_by"
        ).order_by("-created_at")[:8]

        return Response({
            "metrics": {
                "total_products": total_products,
                "active_products": active_products,
                "total_warehouses": total_warehouses,
                "total_stock_quantity": float(total_stock_qty),
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "stock_valuation": float(valuation),
            },
            "recent_transactions": StockTransactionSerializer(recent_txs, many=True).data,
        })
