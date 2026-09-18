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
    PurchaseInvoice,
    PurchaseInvoiceItem,
    PurchasePayment,
    generate_purchase_order_number,
    generate_purchase_receipt_number,
    generate_purchase_invoice_number,
    generate_purchase_payment_number,
)
from .serializers import (
    PurchaseQuotationSerializer,
    PurchaseQuotationItemSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderItemSerializer,
    PurchaseReceiptSerializer,
    PurchaseReceiptItemSerializer,
    PurchaseInvoiceSerializer,
    PurchaseInvoiceItemSerializer,
    PurchasePaymentSerializer,
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

        product_id = request.query_params.get("product")
        if product_id:
            orders = orders.filter(items__product_id=product_id).distinct()

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
# ============================================================
# 4. PURCHASE INVOICE & PAYMENT VIEWS (FINANCIAL INTEGRATION)
# ============================================================

class PurchaseInvoiceListCreateView(PurchaseBaseView):
    """
    List and create Purchase Invoices (Vendor Bills).
    Company-scoped with multi-criteria filters.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoices = (
            PurchaseInvoice.objects.filter(company=company)
            .select_related("vendor", "purchase_order", "created_by")
            .prefetch_related("items__product", "payments")
        )

        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            invoices = invoices.filter(status=status_param)

        vendor_id = request.query_params.get("vendor")
        if vendor_id:
            invoices = invoices.filter(vendor_id=vendor_id)

        order_id = request.query_params.get("purchase_order")
        if order_id:
            if str(order_id).isdigit():
                invoices = invoices.filter(purchase_order_id=int(order_id))
            else:
                invoices = invoices.filter(purchase_order__order_number__icontains=order_id.strip())

        invoice_number = request.query_params.get("invoice_number")
        if invoice_number:
            invoices = invoices.filter(invoice_number__icontains=invoice_number.strip())

        date_from = request.query_params.get("date_from")
        if date_from:
            invoices = invoices.filter(invoice_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            invoices = invoices.filter(invoice_date__lte=date_to)

        product_id = request.query_params.get("product")
        if product_id:
            invoices = invoices.filter(items__product_id=product_id).distinct()

        search = request.query_params.get("search")
        if search:
            invoices = invoices.filter(
                Q(invoice_number__icontains=search)
                | Q(vendor__name__icontains=search)
                | Q(notes__icontains=search)
                | Q(purchase_order__order_number__icontains=search)
            )

        serializer = PurchaseInvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        serializer = PurchaseInvoiceSerializer(
            data=request.data,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            invoice = serializer.save()
            return Response(PurchaseInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PurchaseInvoiceDetailView(PurchaseBaseView):
    """
    Retrieve, update, or cancel a Purchase Invoice.
    """
    def get_object(self, company, pk):
        try:
            return (
                PurchaseInvoice.objects.filter(company=company, id=pk)
                .select_related("vendor", "purchase_order", "created_by")
                .prefetch_related("items__product", "payments")
                .get()
            )
        except PurchaseInvoice.DoesNotExist:
            return None

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object(company, pk)
        if not invoice:
            return Response({"detail": "Purchase invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(PurchaseInvoiceSerializer(invoice).data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object(company, pk)
        if not invoice:
            return Response({"detail": "Purchase invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PurchaseInvoiceSerializer(
            invoice,
            data=request.data,
            partial=True,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            updated_invoice = serializer.save()
            return Response(PurchaseInvoiceSerializer(updated_invoice).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object(company, pk)
        if not invoice:
            return Response({"detail": "Purchase invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status == PurchaseInvoice.InvoiceStatus.PAID or invoice.payments.exists() or invoice.amount_paid > Decimal("0.00"):
            return Response(
                {"detail": "Cannot cancel or delete a paid invoice or an invoice with recorded payments."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice.status = PurchaseInvoice.InvoiceStatus.CANCELLED
        invoice.balance_due = Decimal("0.00")
        invoice.save(update_fields=["status", "balance_due", "updated_at"])
        return Response({"detail": "Purchase invoice cancelled successfully."})


class PurchaseOrderInvoiceCreateView(PurchaseBaseView):
    """
    Generates a Purchase Invoice from an existing Purchase Order.
    Pre-populates line items, vendor, and sets the purchase order link.
    """
    def post(self, request, company_id, order_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            order = (
                PurchaseOrder.objects.filter(company=company, id=order_id)
                .select_related("vendor")
                .prefetch_related("items__product")
                .get()
            )
        except PurchaseOrder.DoesNotExist:
            return Response({"detail": "Purchase order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status in [PurchaseOrder.PurchaseOrderStatus.CANCELLED, PurchaseOrder.PurchaseOrderStatus.DRAFT]:
            return Response(
                {"detail": f"Cannot create an invoice for a purchase order in '{order.status}' status."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        due_date = request.data.get("due_date")
        invoice_date = request.data.get("invoice_date") or timezone.localdate()
        vendor_invoice_number = request.data.get("vendor_invoice_number") or ""
        notes = request.data.get("notes") or order.notes

        with transaction.atomic():
            invoice_number = generate_purchase_invoice_number(company)
            invoice = PurchaseInvoice.objects.create(
                company=company,
                vendor=order.vendor,
                purchase_order=order,
                invoice_number=invoice_number,
                vendor_invoice_number=vendor_invoice_number,
                invoice_date=invoice_date,
                due_date=due_date,
                status=PurchaseInvoice.InvoiceStatus.ISSUED,
                notes=notes,
                created_by=request.user,
            )

            # Copy items from PO
            for order_item in order.items.all():
                PurchaseInvoiceItem.objects.create(
                    invoice=invoice,
                    purchase_order_item=order_item,
                    product=order_item.product,
                    description=order_item.description,
                    quantity=order_item.quantity,
                    unit_price=order_item.unit_price,
                    discount=order_item.discount,
                    tax=order_item.tax,
                )

            invoice.recalculate_totals()
            invoice.save()

        return Response(PurchaseInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class PurchaseInvoicePaymentListCreateView(PurchaseBaseView):
    """
    List and create payments against a specific Purchase Invoice.
    """
    def get(self, request, company_id, invoice_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            invoice = PurchaseInvoice.objects.filter(company=company, id=invoice_id).get()
        except PurchaseInvoice.DoesNotExist:
            return Response({"detail": "Purchase invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        payments = invoice.payments.select_related("vendor", "created_by").order_by("-payment_date")
        return Response(PurchasePaymentSerializer(payments, many=True).data)

    def post(self, request, company_id, invoice_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        try:
            invoice = PurchaseInvoice.objects.filter(company=company, id=invoice_id).get()
        except PurchaseInvoice.DoesNotExist:
            return Response({"detail": "Purchase invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        payload = {**request.data, "invoice": invoice.id, "vendor": invoice.vendor_id}
        serializer = PurchasePaymentSerializer(
            data=payload,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            payment = serializer.save()
            return Response(PurchasePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        errors = dict(serializer.errors)
        detail_val = errors.get("detail") or errors.get("amount") or errors.get("non_field_errors")
        if isinstance(detail_val, (list, tuple)) and detail_val:
            detail_val = str(detail_val[0])
        elif detail_val:
            detail_val = str(detail_val)
        else:
            detail_val = "Invalid payment data."
        errors["detail"] = detail_val
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)


class PurchasePaymentListView(PurchaseBaseView):
    """
    Company-wide Purchase Payments ledger.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        payments = (
            PurchasePayment.objects.filter(company=company)
            .select_related("vendor", "invoice", "created_by")
            .order_by("-payment_date", "-created_at")
        )

        vendor_id = request.query_params.get("vendor")
        if vendor_id:
            payments = payments.filter(vendor_id=vendor_id)

        method = request.query_params.get("payment_method")
        if method:
            payments = payments.filter(payment_method=method)

        date_from = request.query_params.get("date_from")
        if date_from:
            payments = payments.filter(payment_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            payments = payments.filter(payment_date__lte=date_to)

        search = request.query_params.get("search")
        if search:
            payments = payments.filter(
                Q(payment_number__icontains=search)
                | Q(vendor__name__icontains=search)
                | Q(reference__icontains=search)
                | Q(invoice__invoice_number__icontains=search)
            )

        return Response(PurchasePaymentSerializer(payments, many=True).data)


# ============================================================
# 5. PURCHASE DASHBOARD FINALIZATION
# ============================================================

class PurchaseDashboardView(PurchaseBaseView):
    """
    Comprehensive procurement and AP financial KPIs derived directly from PostgreSQL.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotations_qs = PurchaseQuotation.objects.filter(company=company)
        orders_qs = PurchaseOrder.objects.filter(company=company)
        receipts_qs = PurchaseReceipt.objects.filter(company=company)
        invoices_qs = PurchaseInvoice.objects.filter(company=company)
        payments_qs = PurchasePayment.objects.filter(company=company)

        # Quotation Metrics
        total_quotations = quotations_qs.count()
        accepted_quotations = quotations_qs.filter(status=PurchaseQuotation.QuotationStatus.ACCEPTED).count()
        converted_quotations = quotations_qs.filter(status=PurchaseQuotation.QuotationStatus.CONVERTED).count()

        # Order Status Counts
        total_orders = orders_qs.count()
        draft_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.DRAFT).count()
        confirmed_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED).count()
        processing_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.PROCESSING).count()
        partially_received_orders = orders_qs.filter(status=PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED).count()
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

        # Received Goods Value & Units
        total_goods_receipts = receipts_qs.count()
        total_units_received = (
            PurchaseReceiptItem.objects.filter(
                receipt__company=company,
                receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
            ).aggregate(total=Sum("received_quantity"))["total"]
            or Decimal("0.00")
        )

        receipt_items = PurchaseReceiptItem.objects.filter(
            receipt__company=company,
            receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
        ).select_related("purchase_order_item")
        total_received_val = sum(
            (item.received_quantity * item.purchase_order_item.unit_price for item in receipt_items),
            Decimal("0.00")
        )

        # Invoicing & Payment Aggregates
        non_cancelled_invoices = invoices_qs.exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
        total_invoiced_val = non_cancelled_invoices.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
        total_paid_val = payments_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        total_outstanding_val = (
            non_cancelled_invoices.exclude(status=PurchaseInvoice.InvoiceStatus.PAID)
            .aggregate(total=Sum("balance_due"))["total"]
            or Decimal("0.00")
        )

        # Vendors
        total_vendors_count = Vendor.objects.filter(company=company).count()
        active_vendors_count = Vendor.objects.filter(company=company, is_active=True).count()

        # Breakdowns
        orders_by_status = dict(
            orders_qs.values_list("status").annotate(count=Count("id")).values_list("status", "count")
        )
        quotations_by_status = dict(
            quotations_qs.values_list("status").annotate(count=Count("id")).values_list("status", "count")
        )
        invoices_by_status = dict(
            invoices_qs.values_list("status").annotate(count=Count("id")).values_list("status", "count")
        )

        # Recent activities
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

        recent_invoices = PurchaseInvoiceSerializer(
            invoices_qs.select_related("vendor", "purchase_order", "created_by").order_by("-created_at")[:5],
            many=True,
        ).data

        recent_payments = PurchasePaymentSerializer(
            payments_qs.select_related("vendor", "invoice", "created_by").order_by("-created_at")[:5],
            many=True,
        ).data

        return Response({
            "metrics": {
                "total_purchase_quotations": total_quotations,
                "accepted_quotations": accepted_quotations,
                "converted_quotations": converted_quotations,
                "total_purchase_orders": total_orders,
                "draft_orders": draft_orders,
                "confirmed_orders": confirmed_orders,
                "processing_orders": processing_orders,
                "partially_received_orders": partially_received_orders,
                "completed_orders": completed_orders,
                "cancelled_orders": cancelled_orders,
                "pending_receiving_orders": partially_received_orders + confirmed_orders + processing_orders,
                "completed_receiving_orders": completed_orders,
                "total_goods_receipts": total_goods_receipts,
                "total_units_received": str(total_units_received),
                "total_purchase_value": str(total_purchase_val),
                "total_received_value": str(total_received_val),
                "total_invoiced_amount": str(total_invoiced_val),
                "total_paid_amount": str(total_paid_val),
                "total_outstanding_amount": str(total_outstanding_val),
                "pending_purchase_value": str(pending_purchase_val),
                "number_of_vendors": total_vendors_count,
                "number_of_active_vendors": active_vendors_count,
                "active_vendors": active_vendors_count,
            },
            "orders_by_status": orders_by_status,
            "quotations_by_status": quotations_by_status,
            "invoices_by_status": invoices_by_status,
            "recent_quotations": recent_quotations,
            "recent_orders": recent_orders,
            "recent_receipts": recent_receipts,
            "recent_invoices": recent_invoices,
            "recent_payments": recent_payments,
        })


# ============================================================
# 6. VENDOR PURCHASE HISTORY VIEW
# ============================================================

class VendorPurchaseHistoryView(PurchaseBaseView):
    """
    Aggregates lifetime procurement history, orders, quotations, receipts, invoices, and payments for a vendor.
    Strict tenant isolation enforced.
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
            .prefetch_related("items__product", "receipts")
            .order_by("-created_at")
        )

        receipts = (
            PurchaseReceipt.objects.filter(company=company, purchase_order__vendor=vendor)
            .select_related("purchase_order", "warehouse", "received_by")
            .prefetch_related("items__product")
            .order_by("-created_at")
        )

        invoices = (
            PurchaseInvoice.objects.filter(company=company, vendor=vendor)
            .select_related("purchase_order", "created_by")
            .prefetch_related("items__product", "payments")
            .order_by("-created_at")
        )

        payments = (
            PurchasePayment.objects.filter(company=company, vendor=vendor)
            .select_related("invoice", "created_by")
            .order_by("-payment_date", "-created_at")
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

        # Value of received goods for this vendor
        receipt_items = PurchaseReceiptItem.objects.filter(
            receipt__company=company,
            receipt__purchase_order__vendor=vendor,
            receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
        ).select_related("purchase_order_item")
        total_received_val = sum(
            (item.received_quantity * item.purchase_order_item.unit_price for item in receipt_items),
            Decimal("0.00")
        )

        non_cancelled_invoices = invoices.exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
        total_invoiced_val = non_cancelled_invoices.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
        total_paid_val = payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        outstanding_val = (
            non_cancelled_invoices.exclude(status=PurchaseInvoice.InvoiceStatus.PAID)
            .aggregate(total=Sum("balance_due"))["total"]
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
                "total_received_value": str(total_received_val),
                "total_invoiced_amount": str(total_invoiced_val),
                "total_paid_amount": str(total_paid_val),
                "outstanding_amount": str(outstanding_val),
            },
            "quotations": PurchaseQuotationSerializer(quotations, many=True).data,
            "orders": PurchaseOrderSerializer(orders, many=True).data,
            "receipts": PurchaseReceiptSerializer(receipts, many=True).data,
            "invoices": PurchaseInvoiceSerializer(invoices, many=True).data,
            "payments": PurchasePaymentSerializer(payments, many=True).data,
        })


# ============================================================
# 7. PURCHASE ANALYTICS VIEW
# ============================================================

class PurchaseAnalyticsView(PurchaseBaseView):
    """
    Advanced multi-dimensional procurement and financial analytics:
    - Monthly trends (past 12 months: orders count, purchase total, received value, invoiced total, paid total)
    - Order status distribution
    - Invoice status distribution
    - Payment method distribution
    - Top vendors by spend, fulfillment, and payment
    - Top products by ordered & received quantities and revenue
    - Warehouse distribution
    - Ordered vs received fulfillment summary
    - Paid vs outstanding financial overview
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        orders_qs = PurchaseOrder.objects.filter(company=company)
        receipts_qs = PurchaseReceipt.objects.filter(company=company)
        invoices_qs = PurchaseInvoice.objects.filter(company=company)
        payments_qs = PurchasePayment.objects.filter(company=company)
        quotations_qs = PurchaseQuotation.objects.filter(company=company)

        # 1. Monthly Trends (Past 12 Months)
        today = timezone.localdate()
        monthly_trends = []
        for i in range(11, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            month_label = f"{y:04d}-{m:02d}"

            m_orders = orders_qs.filter(order_date__year=y, order_date__month=m).exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
            m_invoices = invoices_qs.filter(invoice_date__year=y, invoice_date__month=m).exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
            m_payments = payments_qs.filter(payment_date__year=y, payment_date__month=m)

            # Received items in month
            m_receipt_items = PurchaseReceiptItem.objects.filter(
                receipt__company=company,
                receipt__receipt_date__year=y,
                receipt__receipt_date__month=m,
                receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
            ).select_related("purchase_order_item")

            m_received_val = sum(
                (item.received_quantity * item.purchase_order_item.unit_price for item in m_receipt_items),
                Decimal("0.00")
            )

            orders_count = m_orders.count()
            purchase_total = m_orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            invoiced_total = m_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            paid_total = m_payments.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")

            monthly_trends.append({
                "month": month_label,
                "orders_count": orders_count,
                "purchase_total": str(purchase_total),
                "received_value": str(m_received_val),
                "invoiced_total": str(invoiced_total),
                "paid_total": str(paid_total),
            })

        # 2. Order Status Distribution
        order_status_distribution = []
        for choice, label in PurchaseOrder.PurchaseOrderStatus.choices:
            qs = orders_qs.filter(status=choice)
            count = qs.count()
            amt = qs.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            order_status_distribution.append({
                "status": choice,
                "label": label,
                "count": count,
                "total_amount": str(amt),
            })

        # 3. Invoice Status Distribution
        invoice_status_distribution = []
        for choice, label in PurchaseInvoice.InvoiceStatus.choices:
            qs = invoices_qs.filter(status=choice)
            count = qs.count()
            amt = qs.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            invoice_status_distribution.append({
                "status": choice,
                "label": label,
                "count": count,
                "total_amount": str(amt),
            })

        # 4. Payment Method Distribution
        payment_method_distribution = []
        for choice, label in PurchasePayment.PaymentMethod.choices:
            qs = payments_qs.filter(payment_method=choice)
            count = qs.count()
            amt = qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            payment_method_distribution.append({
                "method": choice,
                "label": label,
                "count": count,
                "total_amount": str(amt),
            })

        # 5. Top Vendors (by purchase spend)
        top_vendors_qs = (
            orders_qs.exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
            .values("vendor__id", "vendor__name")
            .annotate(
                order_count=Count("id"),
                total_spent=Sum("total"),
            )
            .order_by("-total_spent")[:10]
        )
        top_vendors = []
        for v in top_vendors_qs:
            v_id = v["vendor__id"]
            v_invoiced = (
                invoices_qs.filter(vendor_id=v_id).exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
                .aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            )
            v_paid = payments_qs.filter(vendor_id=v_id).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            v_balance = (
                invoices_qs.filter(vendor_id=v_id).exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
                .exclude(status=PurchaseInvoice.InvoiceStatus.PAID)
                .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
            )

            # Vendor received goods value
            v_receipt_items = PurchaseReceiptItem.objects.filter(
                receipt__company=company,
                receipt__purchase_order__vendor_id=v_id,
                receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
            ).select_related("purchase_order_item")
            v_received = sum(
                (item.received_quantity * item.purchase_order_item.unit_price for item in v_receipt_items),
                Decimal("0.00")
            )

            top_vendors.append({
                "vendor_id": v_id,
                "vendor_name": v["vendor__name"],
                "order_count": v["order_count"],
                "total_spent": str(v["total_spent"] or Decimal("0.00")),
                "received_value": str(v_received),
                "invoiced_total": str(v_invoiced),
                "paid_total": str(v_paid),
                "balance_due": str(v_balance),
            })

        # 6. Top Products (by quantity ordered and spend)
        top_products_qs = (
            PurchaseOrderItem.objects.filter(purchase_order__company=company)
            .exclude(purchase_order__status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
            .values("product__id", "product__name", "product__sku")
            .annotate(
                quantity_ordered=Sum("quantity"),
                purchase_amount=Sum("line_total"),
            )
            .order_by("-purchase_amount")[:10]
        )
        top_products = []
        for p in top_products_qs:
            p_id = p["product__id"]
            p_received = (
                PurchaseReceiptItem.objects.filter(
                    receipt__company=company,
                    product_id=p_id,
                    receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
                ).aggregate(s=Sum("received_quantity"))["s"] or Decimal("0.00")
            )
            top_products.append({
                "product_id": p_id,
                "product_name": p["product__name"],
                "product_sku": p["product__sku"],
                "quantity_ordered": str(p["quantity_ordered"] or Decimal("0.00")),
                "quantity_received": str(p_received),
                "purchase_amount": str(p["purchase_amount"] or Decimal("0.00")),
            })

        # 7. Warehouse Distribution
        warehouse_qs = (
            orders_qs.exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
            .filter(warehouse__isnull=False)
            .values("warehouse__id", "warehouse__name", "warehouse__code")
            .annotate(
                orders_count=Count("id"),
                purchase_total=Sum("total"),
            )
            .order_by("-purchase_total")
        )
        warehouse_distribution = [
            {
                "warehouse_id": w["warehouse__id"],
                "warehouse_name": w["warehouse__name"],
                "warehouse_code": w["warehouse__code"],
                "orders_count": w["orders_count"],
                "purchase_total": str(w["purchase_total"] or Decimal("0.00")),
            }
            for w in warehouse_qs
        ]

        # 8. Ordered vs Received Quantities (Fulfillment Rate)
        total_ordered_qty = (
            PurchaseOrderItem.objects.filter(purchase_order__company=company)
            .exclude(purchase_order__status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
            .aggregate(s=Sum("quantity"))["s"] or Decimal("0.00")
        )
        total_received_qty = (
            PurchaseReceiptItem.objects.filter(
                receipt__company=company,
                receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
            ).aggregate(s=Sum("received_quantity"))["s"] or Decimal("0.00")
        )
        fulfillment_rate = (
            round((total_received_qty / total_ordered_qty) * Decimal("100.00"), 1)
            if total_ordered_qty > Decimal("0.00")
            else Decimal("0.00")
        )

        # 9. Paid vs Outstanding Financial Overview
        non_cancelled_invoices = invoices_qs.exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
        total_invoiced = non_cancelled_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        total_paid = payments_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
        total_outstanding = (
            non_cancelled_invoices.exclude(status=PurchaseInvoice.InvoiceStatus.PAID)
            .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
        )
        payment_rate = (
            round((total_paid / total_invoiced) * Decimal("100.00"), 1)
            if total_invoiced > Decimal("0.00")
            else Decimal("0.00")
        )

        # 10. Quotation Conversion
        total_quotes = quotations_qs.count()
        converted_quotes = quotations_qs.filter(status=PurchaseQuotation.QuotationStatus.CONVERTED).count()
        quote_conversion_rate = (
            round((converted_quotes / total_quotes) * 100, 1) if total_quotes > 0 else 0.0
        )

        return Response({
            "monthly_trends": monthly_trends,
            "order_status_distribution": order_status_distribution,
            "invoice_status_distribution": invoice_status_distribution,
            "payment_method_distribution": payment_method_distribution,
            "top_vendors": top_vendors,
            "top_products": top_products,
            "warehouse_distribution": warehouse_distribution,
            "ordered_vs_received": {
                "total_ordered_quantity": str(total_ordered_qty),
                "total_received_quantity": str(total_received_qty),
                "fulfillment_rate_percentage": float(fulfillment_rate),
            },
            "financial_overview": {
                "total_invoiced": str(total_invoiced),
                "total_paid": str(total_paid),
                "total_outstanding": str(total_outstanding),
                "payment_rate_percentage": float(payment_rate),
            },
            "quotation_conversion": {
                "total_quotations": total_quotes,
                "converted_quotations": converted_quotes,
                "conversion_rate_percentage": quote_conversion_rate,
            },
        })


# ============================================================
# 8. PURCHASE REPORTS VIEW
# ============================================================

class PurchaseReportsView(PurchaseBaseView):
    """
    Purchase Reporting API supporting 5 distinct report types:
    - summary: high-level procurement & financial KPIs
    - orders: detailed purchase orders with receiving & payment fulfillment
    - vendors: vendor performance and spend breakdown
    - receiving: goods receiving log by warehouse & PO
    - financial: invoices, balance due, and payment ledger
    """
    default_report_type = None

    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        report_type = self.default_report_type or request.query_params.get("report_type") or request.query_params.get("type") or "summary"
        report_type = report_type.lower().strip()

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        vendor_id = request.query_params.get("vendor")
        warehouse_id = request.query_params.get("warehouse")
        status_param = request.query_params.get("status")
        product_id = request.query_params.get("product")

        orders_qs = PurchaseOrder.objects.filter(company=company)
        receipts_qs = PurchaseReceipt.objects.filter(company=company)
        invoices_qs = PurchaseInvoice.objects.filter(company=company)
        payments_qs = PurchasePayment.objects.filter(company=company)

        # Filters
        if date_from:
            orders_qs = orders_qs.filter(order_date__gte=date_from)
            receipts_qs = receipts_qs.filter(receipt_date__gte=date_from)
            invoices_qs = invoices_qs.filter(invoice_date__gte=date_from)
            payments_qs = payments_qs.filter(payment_date__gte=date_from)

        if date_to:
            orders_qs = orders_qs.filter(order_date__lte=date_to)
            receipts_qs = receipts_qs.filter(receipt_date__lte=date_to)
            invoices_qs = invoices_qs.filter(invoice_date__lte=date_to)
            payments_qs = payments_qs.filter(payment_date__lte=date_to)

        if vendor_id:
            orders_qs = orders_qs.filter(vendor_id=vendor_id)
            receipts_qs = receipts_qs.filter(purchase_order__vendor_id=vendor_id)
            invoices_qs = invoices_qs.filter(vendor_id=vendor_id)
            payments_qs = payments_qs.filter(vendor_id=vendor_id)

        if warehouse_id:
            orders_qs = orders_qs.filter(warehouse_id=warehouse_id)
            receipts_qs = receipts_qs.filter(warehouse_id=warehouse_id)

        if status_param and status_param != "ALL":
            orders_qs = orders_qs.filter(status=status_param)
            receipts_qs = receipts_qs.filter(status=status_param)
            invoices_qs = invoices_qs.filter(status=status_param)

        if product_id:
            orders_qs = orders_qs.filter(items__product_id=product_id).distinct()
            receipts_qs = receipts_qs.filter(items__product_id=product_id).distinct()
            invoices_qs = invoices_qs.filter(items__product_id=product_id).distinct()

        filters_payload = {
            "date_from": date_from,
            "date_to": date_to,
            "vendor": vendor_id,
            "warehouse": warehouse_id,
            "status": status_param,
            "product": product_id,
        }

        # ----------------------------------------------------
        # REPORT 1: SUMMARY
        # ----------------------------------------------------
        if report_type == "summary":
            non_cancelled_orders = orders_qs.exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
            total_orders = non_cancelled_orders.count()
            total_purchase_val = non_cancelled_orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            avg_order_val = round(total_purchase_val / total_orders, 2) if total_orders > 0 else Decimal("0.00")

            # Received Value
            received_items = PurchaseReceiptItem.objects.filter(
                receipt__in=receipts_qs.filter(status=PurchaseReceipt.ReceiptStatus.RECEIVED)
            ).select_related("purchase_order_item")
            total_received_val = sum(
                (item.received_quantity * item.purchase_order_item.unit_price for item in received_items),
                Decimal("0.00")
            )

            # Invoices & Payments
            non_cancelled_invoices = invoices_qs.exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
            total_invoiced = non_cancelled_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            total_paid = payments_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            total_outstanding = (
                non_cancelled_invoices.exclude(status=PurchaseInvoice.InvoiceStatus.PAID)
                .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
            )

            payment_rate = (
                round((total_paid / total_invoiced) * 100, 1) if total_invoiced > Decimal("0.00") else 0.0
            )

            # Fulfillment Rate
            ordered_qty = (
                PurchaseOrderItem.objects.filter(purchase_order__in=non_cancelled_orders)
                .aggregate(s=Sum("quantity"))["s"] or Decimal("0.00")
            )
            received_qty = (
                PurchaseReceiptItem.objects.filter(
                    receipt__in=receipts_qs.filter(status=PurchaseReceipt.ReceiptStatus.RECEIVED)
                ).aggregate(s=Sum("received_quantity"))["s"] or Decimal("0.00")
            )
            fulfillment_rate = (
                round((received_qty / ordered_qty) * 100, 1) if ordered_qty > Decimal("0.00") else 0.0
            )

            active_vendors_count = non_cancelled_orders.values("vendor_id").distinct().count()

            summary_payload = {
                "total_orders": total_orders,
                "total_purchase_value": str(total_purchase_val),
                "total_purchase_amount": str(total_purchase_val),
                "average_order_value": str(avg_order_val),
                "total_received_value": str(total_received_val),
                "total_invoiced": str(total_invoiced),
                "total_invoiced_amount": str(total_invoiced),
                "total_paid": str(total_paid),
                "total_paid_amount": str(total_paid),
                "total_outstanding": str(total_outstanding),
                "payment_rate_percentage": payment_rate,
                "fulfillment_rate_percentage": fulfillment_rate,
                "active_vendors_count": active_vendors_count,
                "total_receipts_count": receipts_qs.count(),
            }
            return Response({
                "report_type": "summary",
                "filters": filters_payload,
                "data": summary_payload,
                "summary": summary_payload,
            })

        # ----------------------------------------------------
        # REPORT 2: ORDERS REPORT
        # ----------------------------------------------------
        elif report_type in ["orders", "purchase_orders"]:
            rows = []
            for order in orders_qs.select_related("vendor", "warehouse").prefetch_related("items", "receipts", "invoices"):
                rows.append({
                    "id": order.id,
                    "order_number": order.order_number,
                    "order_date": str(order.order_date),
                    "expected_date": str(order.expected_date) if order.expected_date else None,
                    "vendor_id": order.vendor_id,
                    "vendor_name": order.vendor.name,
                    "warehouse_name": order.warehouse.name if order.warehouse else "N/A",
                    "status": order.status,
                    "total": str(order.total),
                    "total_ordered_quantity": str(order.total_ordered_quantity),
                    "total_received_quantity": str(order.total_received_quantity),
                    "total_remaining_quantity": str(order.total_remaining_quantity),
                    "receiving_percentage": str(order.receiving_percentage),
                    "total_invoiced_amount": str(order.total_invoiced_amount),
                    "paid_amount": str(order.paid_amount),
                    "outstanding_amount": str(order.outstanding_amount),
                    "payment_status": order.payment_status,
                })

            return Response({
                "report_type": "orders",
                "filters": filters_payload,
                "count": len(rows),
                "data": rows,
            })

        # ----------------------------------------------------
        # REPORT 3: VENDORS REPORT
        # ----------------------------------------------------
        elif report_type in ["vendors", "vendor"]:
            vendors = Vendor.objects.filter(company=company)
            if vendor_id:
                vendors = vendors.filter(id=vendor_id)

            rows = []
            for v in vendors:
                v_orders = orders_qs.filter(vendor=v).exclude(status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
                order_count = v_orders.count()
                spent_val = v_orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")

                v_invoices = invoices_qs.filter(vendor=v).exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
                invoiced_val = v_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
                paid_val = payments_qs.filter(vendor=v).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
                balance_val = (
                    v_invoices.exclude(status=PurchaseInvoice.InvoiceStatus.PAID)
                    .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
                )

                # Received value
                v_rcpt_items = PurchaseReceiptItem.objects.filter(
                    receipt__company=company,
                    receipt__purchase_order__vendor=v,
                    receipt__status=PurchaseReceipt.ReceiptStatus.RECEIVED,
                ).select_related("purchase_order_item")
                rcvd_val = sum(
                    (item.received_quantity * item.purchase_order_item.unit_price for item in v_rcpt_items),
                    Decimal("0.00")
                )

                if order_count > 0 or invoiced_val > Decimal("0.00") or paid_val > Decimal("0.00"):
                    rows.append({
                        "vendor_id": v.id,
                        "vendor_name": v.name,
                        "vendor_email": v.email or "",
                        "vendor_phone": v.phone or "",
                        "orders_count": order_count,
                        "order_count": order_count,
                        "total_spent": str(spent_val),
                        "total_received_value": str(rcvd_val),
                        "invoiced_total": str(invoiced_val),
                        "paid_total": str(paid_val),
                        "balance_due": str(balance_val),
                    })

            return Response({
                "report_type": "vendors",
                "filters": filters_payload,
                "count": len(rows),
                "data": rows,
            })

        # ----------------------------------------------------
        # REPORT 4: RECEIVING REPORT
        # ----------------------------------------------------
        elif report_type in ["receiving", "receipts"]:
            rows = []
            for r in receipts_qs.select_related("purchase_order__vendor", "warehouse", "received_by").prefetch_related("items__purchase_order_item"):
                total_qty = r.total_quantity
                r_items = r.items.all()
                r_val = sum(
                    (item.received_quantity * item.purchase_order_item.unit_price for item in r_items),
                    Decimal("0.00")
                )
                rows.append({
                    "id": r.id,
                    "receipt_number": r.receipt_number,
                    "receipt_date": str(r.receipt_date),
                    "purchase_order_id": r.purchase_order_id,
                    "purchase_order_number": r.purchase_order.order_number,
                    "vendor_name": r.purchase_order.vendor.name,
                    "warehouse_name": r.warehouse.name,
                    "status": r.status,
                    "items_count": r.items.count(),
                    "total_quantity": str(total_qty),
                    "receiving_value": str(r_val),
                    "received_by": r.received_by.get_full_name() if r.received_by else "N/A",
                })

            return Response({
                "report_type": "receiving",
                "filters": filters_payload,
                "count": len(rows),
                "data": rows,
            })

        # ----------------------------------------------------
        # REPORT 5: FINANCIAL REPORT
        # ----------------------------------------------------
        elif report_type in ["financial", "invoices"]:
            inv_rows = []
            for inv in invoices_qs.select_related("vendor", "purchase_order"):
                inv_rows.append({
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "invoice_date": str(inv.invoice_date),
                    "due_date": str(inv.due_date) if inv.due_date else None,
                    "purchase_order_number": inv.purchase_order.order_number if inv.purchase_order else "N/A",
                    "vendor_id": inv.vendor_id,
                    "vendor_name": inv.vendor.name,
                    "status": inv.status,
                    "total": str(inv.total),
                    "amount_paid": str(inv.amount_paid),
                    "balance_due": str(inv.balance_due),
                })

            payments_list = []
            for p in payments_qs.select_related("vendor", "invoice"):
                payments_list.append({
                    "id": p.id,
                    "payment_number": p.payment_number,
                    "payment_date": str(p.payment_date),
                    "invoice_number": p.invoice.invoice_number if p.invoice else "N/A",
                    "vendor_id": p.vendor_id,
                    "vendor_name": p.vendor.name if p.vendor else "N/A",
                    "amount": str(p.amount),
                    "payment_method": p.payment_method,
                    "reference": p.reference or "",
                })

            non_cancelled = invoices_qs.exclude(status=PurchaseInvoice.InvoiceStatus.CANCELLED)
            total_inv = non_cancelled.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            total_paid = payments_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            total_out = (
                non_cancelled.exclude(status=PurchaseInvoice.InvoiceStatus.PAID)
                .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
            )

            return Response({
                "report_type": "financial",
                "filters": filters_payload,
                "summary": {
                    "total_invoiced": str(total_inv),
                    "total_paid": str(total_paid),
                    "total_outstanding": str(total_out),
                    "invoices_count": len(inv_rows),
                    "payments_count": len(payments_list),
                },
                "data": inv_rows,
                "invoices": inv_rows,
                "payments": payments_list,
            })

        return Response({"detail": f"Unknown report type: '{report_type}'"}, status=status.HTTP_400_BAD_REQUEST)


class PurchaseReportSummaryView(PurchaseReportsView):
    default_report_type = "summary"

class PurchaseReportOrdersView(PurchaseReportsView):
    default_report_type = "orders"

class PurchaseReportVendorsView(PurchaseReportsView):
    default_report_type = "vendors"

class PurchaseReportReceivingView(PurchaseReportsView):
    default_report_type = "receiving"

class PurchaseReportFinancialView(PurchaseReportsView):
    default_report_type = "financial"
