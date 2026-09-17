from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from inventory.models import Vendor, Product, Warehouse, Stock, StockTransaction
from .models import (
    PurchaseQuotation,
    PurchaseQuotationItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    generate_purchase_order_number,
    generate_purchase_receipt_number,
)
from .serializers import (
    PurchaseQuotationSerializer,
    PurchaseQuotationItemSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderItemSerializer,
    PurchaseReceiptSerializer,
    PurchaseReceiptItemSerializer,
)


class PurchaseBaseView(APIView):
    """
    Base view providing multi-tenant isolation and company membership verification.
    """
    permission_classes = [IsAuthenticated]

    def get_company(self, request, company_id):
        if request.user.is_superuser:
            return Company.objects.filter(id=company_id, is_active=True).first()

        membership = (
            request.user.company_memberships
            .select_related("company")
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
# 1. PURCHASE QUOTATION VIEWS
# ============================================================

class PurchaseQuotationListCreateView(PurchaseBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotations = (
            PurchaseQuotation.objects.filter(company=company)
            .select_related("vendor", "created_by")
            .prefetch_related("items__product")
        )

        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            quotations = quotations.filter(status=status_param)

        vendor_id = request.query_params.get("vendor")
        if vendor_id:
            quotations = quotations.filter(vendor_id=vendor_id)

        quotation_number = request.query_params.get("quotation_number")
        if quotation_number:
            quotations = quotations.filter(quotation_number__icontains=quotation_number.strip())

        date_from = request.query_params.get("date_from")
        if date_from:
            quotations = quotations.filter(quotation_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            quotations = quotations.filter(quotation_date__lte=date_to)

        search = request.query_params.get("search")
        if search:
            quotations = quotations.filter(
                Q(quotation_number__icontains=search)
                | Q(vendor__name__icontains=search)
                | Q(notes__icontains=search)
            )

        serializer = PurchaseQuotationSerializer(quotations, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        serializer = PurchaseQuotationSerializer(
            data=request.data,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            quotation = serializer.save()
            return Response(PurchaseQuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PurchaseQuotationDetailView(PurchaseBaseView):
    def get_object(self, company, pk):
        try:
            return (
                PurchaseQuotation.objects.filter(company=company, id=pk)
                .select_related("vendor", "created_by")
                .prefetch_related("items__product")
                .get()
            )
        except PurchaseQuotation.DoesNotExist:
            return None

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotation = self.get_object(company, pk)
        if not quotation:
            return Response({"detail": "Purchase quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(PurchaseQuotationSerializer(quotation).data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotation = self.get_object(company, pk)
        if not quotation:
            return Response({"detail": "Purchase quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PurchaseQuotationSerializer(
            quotation,
            data=request.data,
            partial=True,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            quotation = serializer.save()
            return Response(PurchaseQuotationSerializer(quotation).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotation = self.get_object(company, pk)
        if not quotation:
            return Response({"detail": "Purchase quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        if quotation.status == PurchaseQuotation.QuotationStatus.CONVERTED:
            return Response(
                {"detail": "Converted purchase quotations cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quotation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PurchaseQuotationConvertToOrderView(PurchaseBaseView):
    """
    Converts an active PurchaseQuotation into a confirmed PurchaseOrder.
    Rejects duplicate conversion if quotation was already converted or has linked order.
    """
    def post(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            quotation = (
                PurchaseQuotation.objects.filter(company=company, id=pk)
                .select_related("vendor")
                .prefetch_related("items__product")
                .get()
            )
        except PurchaseQuotation.DoesNotExist:
            return Response({"detail": "Purchase quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        # Duplicate conversion prevention
        if quotation.status == PurchaseQuotation.QuotationStatus.CONVERTED or quotation.orders.exists():
            return Response(
                {"detail": "This purchase quotation has already been converted to a purchase order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quotation.items.count() == 0:
            return Response(
                {"detail": "Cannot convert a purchase quotation with no line items."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional warehouse
        warehouse_id = request.data.get("warehouse")
        warehouse = None
        if warehouse_id:
            warehouse = Warehouse.objects.filter(company=company, id=warehouse_id).first()
            if not warehouse:
                return Response({"detail": "Invalid warehouse specified."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Pick first active warehouse if available
            warehouse = Warehouse.objects.filter(company=company, is_active=True).first()

        expected_date = request.data.get("expected_date") or quotation.valid_until
        notes = request.data.get("notes") or quotation.notes

        with transaction.atomic():
            order_number = generate_purchase_order_number(company)
            order = PurchaseOrder.objects.create(
                company=company,
                vendor=quotation.vendor,
                quotation=quotation,
                warehouse=warehouse,
                order_number=order_number,
                order_date=timezone.localdate(),
                expected_date=expected_date,
                status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
                notes=notes,
                created_by=request.user,
            )

            for quote_item in quotation.items.all():
                PurchaseOrderItem.objects.create(
                    purchase_order=order,
                    product=quote_item.product,
                    description=quote_item.description,
                    quantity=quote_item.quantity,
                    unit_price=quote_item.unit_price,
                    discount=quote_item.discount,
                    tax=quote_item.tax,
                )

            order.recalculate_totals()
            order.save()

            quotation.status = PurchaseQuotation.QuotationStatus.CONVERTED
            quotation.save(update_fields=["status", "updated_at"])

        return Response(PurchaseOrderSerializer(order).data, status=status.HTTP_201_CREATED)


# ============================================================
# 2. PURCHASE ORDER VIEWS
# ============================================================

class PurchaseOrderListCreateView(PurchaseBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        orders = (
            PurchaseOrder.objects.filter(company=company)
            .select_related("vendor", "warehouse", "quotation", "created_by")
            .prefetch_related("items__product")
        )

        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            orders = orders.filter(status=status_param)

        vendor_id = request.query_params.get("vendor")
        if vendor_id:
            orders = orders.filter(vendor_id=vendor_id)

        warehouse_id = request.query_params.get("warehouse")
        if warehouse_id:
            orders = orders.filter(warehouse_id=warehouse_id)

        order_number = request.query_params.get("order_number")
        if order_number:
            orders = orders.filter(order_number__icontains=order_number.strip())

        date_from = request.query_params.get("date_from")
        if date_from:
            orders = orders.filter(order_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            orders = orders.filter(order_date__lte=date_to)

        search = request.query_params.get("search")
        if search:
            orders = orders.filter(
                Q(order_number__icontains=search)
                | Q(vendor__name__icontains=search)
                | Q(notes__icontains=search)
            )

        serializer = PurchaseOrderSerializer(orders, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        serializer = PurchaseOrderSerializer(
            data=request.data,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            order = serializer.save()
            return Response(PurchaseOrderSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PurchaseOrderDetailView(PurchaseBaseView):
    def get_object(self, company, pk):
        try:
            return (
                PurchaseOrder.objects.filter(company=company, id=pk)
                .select_related("vendor", "warehouse", "quotation", "created_by")
                .prefetch_related("items__product")
                .get()
            )
        except PurchaseOrder.DoesNotExist:
            return None

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object(company, pk)
        if not order:
            return Response({"detail": "Purchase order not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(PurchaseOrderSerializer(order).data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object(company, pk)
        if not order:
            return Response({"detail": "Purchase order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PurchaseOrderSerializer(
            order,
            data=request.data,
            partial=True,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            order = serializer.save()
            return Response(PurchaseOrderSerializer(order).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object(company, pk)
        if not order:
            return Response({"detail": "Purchase order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status == PurchaseOrder.PurchaseOrderStatus.COMPLETED:
            return Response(
                {"detail": "Completed purchase orders cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# 3. GOODS RECEIVING & PURCHASE RECEIPT VIEWS
# ============================================================

class PurchaseOrderReceiveView(PurchaseBaseView):
    """
    Receives goods for a Purchase Order, updates live PostgreSQL inventory Stock,
    creates immutable StockTransaction (STOCK_IN) records, and progresses PO status.
    Atomic and multi-tenant isolated.
    """
    def post(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            order = PurchaseOrder.objects.filter(company=company, id=pk).select_related("vendor", "warehouse").get()
        except PurchaseOrder.DoesNotExist:
            return Response({"detail": "Purchase order not found."}, status=status.HTTP_404_NOT_FOUND)

        # Disallow receiving on DRAFT, COMPLETED, or CANCELLED
        if order.status == PurchaseOrder.PurchaseOrderStatus.DRAFT:
            return Response(
                {"detail": "Cannot receive goods for a draft purchase order. Please confirm it first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if order.status == PurchaseOrder.PurchaseOrderStatus.COMPLETED:
            return Response(
                {"detail": "This purchase order is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if order.status == PurchaseOrder.PurchaseOrderStatus.CANCELLED:
            return Response(
                {"detail": "Cannot receive goods for a cancelled purchase order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve warehouse
        warehouse_id = request.data.get("warehouse")
        if warehouse_id:
            warehouse = Warehouse.objects.filter(company=company, id=warehouse_id, is_active=True).first()
            if not warehouse:
                return Response(
                    {"detail": "Invalid or inactive warehouse for this company."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif order.warehouse:
            warehouse = order.warehouse
        else:
            warehouse = Warehouse.objects.filter(company=company, is_active=True).first()
            if not warehouse:
                return Response(
                    {"detail": "No active warehouse found for receiving stock. Please create or select a warehouse."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        items_payload = request.data.get("items")
        if not items_payload or not isinstance(items_payload, list) or len(items_payload) == 0:
            return Response(
                {"detail": "At least one item is required for receiving goods."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Map existing PO items
        po_items = {item.id: item for item in order.items.select_related("product").all()}

        parsed_items = []
        total_receiving_qty = Decimal("0.00")

        for idx, entry in enumerate(items_payload):
            item_id = entry.get("purchase_order_item") or entry.get("item_id") or entry.get("id")
            if not item_id:
                return Response(
                    {"detail": f"Item at index {idx} is missing purchase_order_item ID."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                item_id = int(item_id)
            except (ValueError, TypeError):
                return Response(
                    {"detail": f"Invalid item ID '{item_id}' at index {idx}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if item_id not in po_items:
                return Response(
                    {"detail": f"Item {item_id} does not belong to purchase order {order.order_number}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            po_item = po_items[item_id]

            # Validate quantity
            qty_raw = entry.get("received_quantity")
            if qty_raw is None:
                return Response(
                    {"detail": f"Received quantity is required for item {po_item.product.name}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                qty = Decimal(str(qty_raw))
            except Exception:
                return Response(
                    {"detail": f"Invalid received quantity '{qty_raw}' for item {po_item.product.name}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if qty < Decimal("0.00"):
                return Response(
                    {"detail": f"Received quantity cannot be negative for item {po_item.product.name}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            remaining = po_item.remaining_quantity
            if qty > remaining:
                return Response(
                    {
                        "detail": f"Cannot receive {qty} units of '{po_item.product.name}'. Only {remaining} units remain to be received."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            parsed_items.append({
                "po_item": po_item,
                "received_qty": qty,
                "notes": entry.get("notes", ""),
            })
            total_receiving_qty += qty

        if total_receiving_qty <= Decimal("0.00"):
            return Response(
                {"detail": "Total received quantity across all items must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        receipt_date = request.data.get("receipt_date") or timezone.localdate()
        notes = request.data.get("notes", "")

        # Execute atomically with row locking
        with transaction.atomic():
            # Re-fetch order with lock
            locked_order = (
                PurchaseOrder.objects.filter(company=company, id=order.id)
                .select_for_update()
                .first()
            )
            if locked_order.status in [
                PurchaseOrder.PurchaseOrderStatus.DRAFT,
                PurchaseOrder.PurchaseOrderStatus.COMPLETED,
                PurchaseOrder.PurchaseOrderStatus.CANCELLED,
            ]:
                return Response(
                    {"detail": f"Cannot receive goods for order with status '{locked_order.status}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Generate unique sequential GRN number
            receipt_number = generate_purchase_receipt_number(company)

            receipt = PurchaseReceipt.objects.create(
                company=company,
                purchase_order=locked_order,
                receipt_number=receipt_number,
                receipt_date=receipt_date,
                warehouse=warehouse,
                status=PurchaseReceipt.ReceiptStatus.RECEIVED,
                notes=notes,
                received_by=request.user,
            )

            for item_info in parsed_items:
                po_item = item_info["po_item"]
                received_qty = item_info["received_qty"]
                item_notes = item_info["notes"]

                if received_qty <= Decimal("0.00"):
                    continue

                prev_received = po_item.received_quantity

                # Create Receipt Item record
                PurchaseReceiptItem.objects.create(
                    receipt=receipt,
                    purchase_order_item=po_item,
                    product=po_item.product,
                    ordered_quantity=po_item.quantity,
                    previously_received_quantity=prev_received,
                    received_quantity=received_qty,
                    notes=item_notes,
                )

                # Update live stock with row-level locking
                stock, _ = Stock.objects.get_or_create(
                    product=po_item.product,
                    warehouse=warehouse,
                    defaults={"quantity": Decimal("0.00"), "reserved_quantity": Decimal("0.00")},
                )
                stock = Stock.objects.select_for_update().get(id=stock.id)
                stock.quantity += received_qty
                stock.save(update_fields=["quantity", "updated_at"])

                # Immutable StockTransaction audit log
                StockTransaction.objects.create(
                    company=company,
                    product=po_item.product,
                    warehouse=warehouse,
                    transaction_type=StockTransaction.TransactionType.STOCK_IN,
                    quantity=received_qty,
                    reference=f"{locked_order.order_number} / {receipt.receipt_number}",
                    notes=item_notes or f"Goods Received Note {receipt.receipt_number} for PO {locked_order.order_number}",
                    created_by=request.user,
                )

            # If order was not assigned a warehouse, link it now
            if not locked_order.warehouse:
                locked_order.warehouse = warehouse
                locked_order.save(update_fields=["warehouse", "updated_at"])

            # Recalculate order status
            locked_order.update_receiving_status()

        receipt_data = PurchaseReceiptSerializer(receipt).data
        return Response(receipt_data, status=status.HTTP_201_CREATED)


class PurchaseOrderReceiptListView(PurchaseBaseView):
    """
    List all Goods Receipts (GRNs) associated with a specific Purchase Order.
    """
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            order = PurchaseOrder.objects.filter(company=company, id=pk).get()
        except PurchaseOrder.DoesNotExist:
            return Response({"detail": "Purchase order not found."}, status=status.HTTP_404_NOT_FOUND)

        receipts = (
            order.receipts.filter(company=company)
            .select_related("purchase_order", "warehouse", "received_by")
            .prefetch_related("items__product")
            .order_by("-created_at")
        )
        return Response(PurchaseReceiptSerializer(receipts, many=True).data)


class PurchaseReceiptListCreateView(PurchaseBaseView):
    """
    List all Goods Receipts for a company with comprehensive filtering.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        receipts = (
            PurchaseReceipt.objects.filter(company=company)
            .select_related("purchase_order", "warehouse", "received_by")
            .prefetch_related("items__product")
        )

        order_param = request.query_params.get("purchase_order")
        if order_param:
            if str(order_param).isdigit():
                receipts = receipts.filter(purchase_order_id=int(order_param))
            else:
                receipts = receipts.filter(purchase_order__order_number__icontains=order_param.strip())

        warehouse_id = request.query_params.get("warehouse")
        if warehouse_id:
            receipts = receipts.filter(warehouse_id=warehouse_id)

        receipt_number = request.query_params.get("receipt_number")
        if receipt_number:
            receipts = receipts.filter(receipt_number__icontains=receipt_number.strip())

        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            receipts = receipts.filter(status=status_param)

        date_from = request.query_params.get("date_from")
        if date_from:
            receipts = receipts.filter(receipt_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            receipts = receipts.filter(receipt_date__lte=date_to)

        search = request.query_params.get("search")
        if search:
            receipts = receipts.filter(
                Q(receipt_number__icontains=search)
                | Q(purchase_order__order_number__icontains=search)
                | Q(purchase_order__vendor__name__icontains=search)
                | Q(notes__icontains=search)
            )

        return Response(PurchaseReceiptSerializer(receipts, many=True).data)


class PurchaseReceiptDetailView(PurchaseBaseView):
    """
    Retrieve details for a single Goods Receipt.
    """
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            receipt = (
                PurchaseReceipt.objects.filter(company=company, id=pk)
                .select_related("purchase_order", "warehouse", "received_by")
                .prefetch_related("items__product")
                .get()
            )
        except PurchaseReceipt.DoesNotExist:
            return Response({"detail": "Goods receipt not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(PurchaseReceiptSerializer(receipt).data)


# ============================================================
# 4. PURCHASE DASHBOARD VIEW
# ============================================================

class PurchaseDashboardView(PurchaseBaseView):
    """
    Returns backend-calculated procurement KPIs and recent activity for the company.
    All figures derived strictly from PostgreSQL.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotations_qs = PurchaseQuotation.objects.filter(company=company)
        orders_qs = PurchaseOrder.objects.filter(company=company)

        # Quotation Metrics
        total_quotations = quotations_qs.count()
        accepted_quotations = quotations_qs.filter(status=PurchaseQuotation.QuotationStatus.ACCEPTED).count()
        converted_quotations = quotations_qs.filter(status=PurchaseQuotation.QuotationStatus.CONVERTED).count()

        # Order Metrics
        total_orders = orders_qs.count()
        confirmed_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED).count()
        completed_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.COMPLETED).count()
        cancelled_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED).count()

        # Financial Aggregates
        active_orders = orders_qs.exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
        total_purchase_val = active_orders.aggregate(total=Sum("total"))["total"] or Decimal("0.00")

        pending_statuses = [
            PurchaseOrder.PurchaseOrderStatus.DRAFT,
            PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
            PurchaseOrder.PurchaseOrderStatus.PROCESSING,
            PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED,
        ]
        pending_orders = orders_qs.filter(status__in=pending_statuses)
        pending_purchase_val = pending_orders.aggregate(total=Sum("total"))["total"] or Decimal("0.00")

        # Active Vendors
        active_vendors_count = Vendor.objects.filter(company=company, is_active=True).count()

        # Receiving Metrics
        receipts_qs = PurchaseReceipt.objects.filter(company=company)
        total_goods_receipts = receipts_qs.count()
        partially_received_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED).count()
        pending_receiving_orders = orders_qs.filter(
            status__in=[
                PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
                PurchaseOrder.PurchaseOrderStatus.PROCESSING,
                PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED,
            ]
        ).count()
        total_units_received = (
            PurchaseReceiptItem.objects.filter(
                receipt__company=company,
                receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
            ).aggregate(total=Sum("received_quantity"))["total"]
            or Decimal("0.00")
        )

        # Status breakdowns
        orders_by_status = dict(
            orders_qs.values_list("status").annotate(count=Count("id")).values_list("status", "count")
        )
        quotations_by_status = dict(
            quotations_qs.values_list("status").annotate(count=Count("id")).values_list("status", "count")
        )

        # Recent records
        recent_quotations = PurchaseQuotationSerializer(
            quotations_qs.select_related("vendor", "created_by").order_by("-created_at")[:5],
            many=True,
        ).data

        recent_orders = PurchaseOrderSerializer(
            orders_qs.select_related("vendor", "warehouse", "created_by").order_by("-created_at")[:5],
            many=True,
        ).data

        recent_receipts = PurchaseReceiptSerializer(
            receipts_qs.select_related("purchase_order", "warehouse", "received_by")
            .prefetch_related("items__product")
            .order_by("-created_at")[:5],
            many=True,
        ).data

        return Response({
            "metrics": {
                "total_purchase_quotations": total_quotations,
                "accepted_quotations": accepted_quotations,
                "converted_quotations": converted_quotations,
                "total_purchase_orders": total_orders,
                "confirmed_orders": confirmed_orders,
                "completed_orders": completed_orders,
                "cancelled_orders": cancelled_orders,
                "pending_receiving_orders": pending_receiving_orders,
                "partially_received_orders": partially_received_orders,
                "completed_receiving_orders": completed_orders,
                "total_goods_receipts": total_goods_receipts,
                "total_units_received": str(total_units_received),
                "total_purchase_value": str(total_purchase_val),
                "pending_purchase_value": str(pending_purchase_val),
                "active_vendors": active_vendors_count,
            },
            "orders_by_status": orders_by_status,
            "quotations_by_status": quotations_by_status,
            "recent_quotations": recent_quotations,
            "recent_orders": recent_orders,
            "recent_receipts": recent_receipts,
        })


# ============================================================
# 4. VENDOR PURCHASE HISTORY VIEW
# ============================================================

class VendorPurchaseHistoryView(PurchaseBaseView):
    """
    Aggregates lifetime procurement history, orders, and quotations for a vendor.
    Enforces strict tenant isolation (returns 404 if vendor does not belong to company).
    """
    def get(self, request, company_id, vendor_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            vendor = Vendor.objects.filter(company=company, id=vendor_id).get()
        except Vendor.DoesNotExist:
            return Response({"detail": "Vendor not found for this company."}, status=status.HTTP_404_NOT_FOUND)

        quotations = (
            PurchaseQuotation.objects.filter(company=company, vendor=vendor)
            .select_related("created_by")
            .prefetch_related("items__product")
            .order_by("-created_at")
        )

        orders = (
            PurchaseOrder.objects.filter(company=company, vendor=vendor)
            .select_related("warehouse", "created_by")
            .prefetch_related("items__product")
            .order_by("-created_at")
        )

        total_orders_count = orders.count()
        completed_orders_count = orders.filter(status=PurchaseOrder.PurchaseOrderStatus.COMPLETED).count()
        pending_orders_count = orders.filter(
            status__in=[
                PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
                PurchaseOrder.PurchaseOrderStatus.PROCESSING,
                PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED,
            ]
        ).count()

        total_spent = (
            orders.exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
            .aggregate(total=Sum("total"))["total"]
            or Decimal("0.00")
        )

        return Response({
            "vendor": {
                "id": vendor.id,
                "name": vendor.name,
                "email": vendor.email,
                "phone": vendor.phone,
                "address": vendor.address,
                "tax_id": vendor.tax_id,
                "is_active": vendor.is_active,
            },
            "metrics": {
                "total_quotations": quotations.count(),
                "total_orders": total_orders_count,
                "completed_orders": completed_orders_count,
                "pending_orders": pending_orders_count,
                "total_purchased_amount": str(total_spent),
            },
            "quotations": PurchaseQuotationSerializer(quotations, many=True).data,
            "orders": PurchaseOrderSerializer(orders, many=True).data,
        })
