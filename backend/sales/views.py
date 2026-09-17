from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from crm.models import Customer
from inventory.models import Product, Warehouse, Stock, StockTransaction
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
    generate_order_number,
    generate_invoice_number,
    generate_payment_number,
    generate_receipt_number,
    generate_return_number,
)
from .serializers import (
    QuotationSerializer,
    SalesOrderSerializer,
    SalesOrderReservationSerializer,
    InvoiceSerializer,
    InvoiceItemSerializer,
    PaymentSerializer,
    ReceiptSerializer,
    SalesFinancialSummarySerializer,
    SalesReturnSerializer,
    SalesReturnItemSerializer,
)


class SalesBaseView(APIView):
    """
    Base view providing multi-tenant isolation and company verification.
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
# 1. SALES QUOTATION VIEWS
# ============================================================

class QuotationListCreateView(SalesBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        queryset = Quotation.objects.filter(company=company).select_related("customer", "created_by").prefetch_related("items__product")

        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        customer_param = request.query_params.get("customer")
        if customer_param:
            queryset = queryset.filter(customer_id=customer_param)

        date_from = request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(quotation_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(quotation_date__lte=date_to)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(quotation_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(notes__icontains=search)
            )

        serializer = QuotationSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        serializer = QuotationSerializer(data=request.data, context={"company": company, "request": request})
        if serializer.is_valid():
            quotation = serializer.save(company=company, created_by=request.user)
            return Response(QuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class QuotationDetailView(SalesBaseView):
    def get_object(self, company, pk):
        try:
            return (
                Quotation.objects.filter(company=company, id=pk)
                .select_related("customer", "created_by")
                .prefetch_related("items__product")
                .get()
            )
        except Quotation.DoesNotExist:
            return None

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotation = self.get_object(company, pk)
        if not quotation:
            return Response({"detail": "Quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = QuotationSerializer(quotation)
        return Response(serializer.data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotation = self.get_object(company, pk)
        if not quotation:
            return Response({"detail": "Quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        if quotation.status == Quotation.QuotationStatus.CONVERTED:
            return Response(
                {"detail": "Cannot modify a quotation that has already been converted to a sales order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = QuotationSerializer(
            quotation,
            data=request.data,
            partial=True,
            context={"company": company, "request": request},
        )
        if serializer.is_valid():
            updated = serializer.save()
            return Response(QuotationSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        quotation = self.get_object(company, pk)
        if not quotation:
            return Response({"detail": "Quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        if quotation.status == Quotation.QuotationStatus.CONVERTED:
            return Response(
                {"detail": "Cannot delete a quotation that has already been converted to a sales order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quotation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuotationConvertView(SalesBaseView):
    """
    Atomic conversion of an accepted Quotation to a SalesOrder.
    Locks quotation with select_for_update to avoid duplicate conversions.
    """
    def post(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            try:
                quotation = (
                    Quotation.objects.select_for_update()
                    .prefetch_related("items__product")
                    .get(company=company, id=pk)
                )
            except Quotation.DoesNotExist:
                return Response({"detail": "Quotation not found."}, status=status.HTTP_404_NOT_FOUND)

            if quotation.status == Quotation.QuotationStatus.CONVERTED:
                return Response(
                    {"detail": "This quotation has already been converted to a sales order."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            quotation_items = list(quotation.items.all())
            if not quotation_items:
                return Response(
                    {"detail": "Cannot convert a quotation with no line items."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Generate new Order Number
            order_number = generate_order_number(company)

            # Create confirmed Sales Order
            order = SalesOrder.objects.create(
                company=company,
                customer=quotation.customer,
                quotation=quotation,
                order_number=order_number,
                order_date=timezone.localdate(),
                status=SalesOrder.SalesOrderStatus.CONFIRMED,
                notes=quotation.notes or f"Converted from Quotation {quotation.quotation_number}",
                subtotal=quotation.subtotal,
                discount=quotation.discount,
                tax=quotation.tax,
                total=quotation.total,
                created_by=request.user,
            )

            # Clone line items to order items
            for item in quotation_items:
                SalesOrderItem.objects.create(
                    sales_order=order,
                    product=item.product,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount=item.discount,
                    tax=item.tax,
                    line_total=item.line_total,
                )

            # Mark quotation as CONVERTED
            quotation.status = Quotation.QuotationStatus.CONVERTED
            quotation.save(update_fields=["status", "updated_at"])

            serializer = SalesOrderSerializer(order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)


# ============================================================
# 2. SALES ORDER VIEWS
# ============================================================

class SalesOrderListCreateView(SalesBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        queryset = (
            SalesOrder.objects.filter(company=company)
            .select_related("customer", "quotation", "warehouse", "created_by")
            .prefetch_related("items__product", "reservations")
        )

        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        customer_param = request.query_params.get("customer")
        if customer_param:
            queryset = queryset.filter(customer_id=customer_param)

        warehouse_param = request.query_params.get("warehouse")
        if warehouse_param:
            queryset = queryset.filter(warehouse_id=warehouse_param)

        date_from = request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(order_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(order_date__lte=date_to)

        order_number_param = request.query_params.get("order_number")
        if order_number_param:
            queryset = queryset.filter(order_number__icontains=order_number_param.strip())

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(order_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(notes__icontains=search)
            )

        serializer = SalesOrderSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        serializer = SalesOrderSerializer(data=request.data, context={"company": company, "request": request})
        if serializer.is_valid():
            order = serializer.save(company=company, created_by=request.user)
            return Response(SalesOrderSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SalesOrderDetailView(SalesBaseView):
    def get_object(self, company, pk):
        try:
            return (
                SalesOrder.objects.filter(company=company, id=pk)
                .select_related("customer", "quotation", "warehouse", "created_by")
                .prefetch_related("items__product", "reservations__warehouse", "reservations__product")
                .get()
            )
        except SalesOrder.DoesNotExist:
            return None

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object(company, pk)
        if not order:
            return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SalesOrderSerializer(order)
        return Response(serializer.data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            order = (
                SalesOrder.objects.select_for_update()
                .filter(company=company, id=pk)
                .first()
            )
            if not order:
                return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

            target_status = request.data.get("status")
            # If changing to CANCELLED, validate and atomically auto-release any active reservations
            if target_status == SalesOrder.SalesOrderStatus.CANCELLED:
                if order.status == SalesOrder.SalesOrderStatus.COMPLETED:
                    return Response(
                        {"detail": "Completed orders cannot be cancelled directly. Please process a sales return instead."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if order.status != SalesOrder.SalesOrderStatus.CANCELLED:
                    active_res = list(order.reservations.select_for_update().filter(status=SalesOrderReservation.ReservationStatus.ACTIVE))
                    for res in active_res:
                        stock = Stock.objects.select_for_update().filter(product=res.product, warehouse=res.warehouse).first()
                        if stock:
                            stock.reserved_quantity = max(Decimal("0.00"), stock.reserved_quantity - res.quantity)
                            stock.save(update_fields=["reserved_quantity", "updated_at"])
                        res.status = SalesOrderReservation.ReservationStatus.CANCELLED
                        res.save(update_fields=["status", "updated_at"])

            serializer = SalesOrderSerializer(
                order,
                data=request.data,
                partial=True,
                context={"company": company, "request": request},
            )
            if serializer.is_valid():
                updated = serializer.save()
                return Response(SalesOrderSerializer(updated).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            order = SalesOrder.objects.select_for_update().filter(company=company, id=pk).first()
            if not order:
                return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

            if order.status == SalesOrder.SalesOrderStatus.COMPLETED:
                return Response({"detail": "Cannot delete a fulfilled sales order."}, status=status.HTTP_400_BAD_REQUEST)

            # Auto-release any active reservations before deleting
            active_res = list(order.reservations.select_for_update().filter(status=SalesOrderReservation.ReservationStatus.ACTIVE))
            for res in active_res:
                stock = Stock.objects.select_for_update().filter(product=res.product, warehouse=res.warehouse).first()
                if stock:
                    stock.reserved_quantity = max(Decimal("0.00"), stock.reserved_quantity - res.quantity)
                    stock.save(update_fields=["reserved_quantity", "updated_at"])

            order.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# 3. SALES ORDER RESERVATION & FULFILLMENT VIEWS
# ============================================================

class SalesOrderReserveView(SalesBaseView):
    """
    Atomically reserves stock for all line items in a Sales Order.
    Locks stock rows using select_for_update().
    If ANY product has insufficient available stock, the entire operation rolls back.
    Physical stock does NOT decrease during reservation; only reserved_quantity increases.
    """
    def post(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            order = (
                SalesOrder.objects.select_for_update()
                .filter(company=company, id=pk)
                .first()
            )
            if not order:
                return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

            if order.status == SalesOrder.SalesOrderStatus.RESERVED:
                return Response({"detail": "Sales Order is already in RESERVED status."}, status=status.HTTP_400_BAD_REQUEST)

            if order.status in [SalesOrder.SalesOrderStatus.COMPLETED, SalesOrder.SalesOrderStatus.CANCELLED]:
                return Response(
                    {"detail": f"Cannot reserve stock for an order in {order.status} status."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Determine fulfillment warehouse
            warehouse_id = request.data.get("warehouse") or (order.warehouse_id if order.warehouse else None)
            if not warehouse_id:
                return Response({"warehouse": ["A fulfillment warehouse must be specified to reserve stock."]}, status=status.HTTP_400_BAD_REQUEST)

            warehouse = Warehouse.objects.filter(id=warehouse_id, company=company).first()
            if not warehouse:
                return Response({"warehouse": ["Warehouse not found in this company."]}, status=status.HTTP_400_BAD_REQUEST)
            if not warehouse.is_active:
                return Response({"warehouse": ["Selected warehouse is inactive."]}, status=status.HTTP_400_BAD_REQUEST)

            items = list(order.items.select_related("product").all())
            if not items:
                return Response({"detail": "Cannot reserve stock for an order with no line items."}, status=status.HTTP_400_BAD_REQUEST)

            # Validate products
            for item in items:
                prod = item.product
                if prod.company_id != company.id:
                    return Response({"detail": f"Product '{prod.name}' does not belong to this company."}, status=status.HTTP_400_BAD_REQUEST)
                if not prod.is_active:
                    return Response({"detail": f"Product '{prod.name}' is inactive."}, status=status.HTTP_400_BAD_REQUEST)

            # Row lock stock records and check stock availability for ALL items
            stock_map = {}
            for item in items:
                stock, _ = Stock.objects.select_for_update().get_or_create(
                    product=item.product,
                    warehouse=warehouse,
                    defaults={"quantity": Decimal("0.00"), "reorder_level": item.product.reorder_level},
                )
                stock_map[item.id] = stock
                if stock.available_quantity < item.quantity:
                    return Response(
                        {
                            "detail": f"Insufficient available stock for product '{item.product.name}' ({item.product.sku}) at warehouse '{warehouse.name}'. Available: {stock.available_quantity}, Required: {item.quantity}"
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # All items have sufficient stock -> execute reservation
            for item in items:
                stock = stock_map[item.id]
                stock.reserved_quantity += item.quantity
                stock.save(update_fields=["reserved_quantity", "updated_at"])

                SalesOrderReservation.objects.create(
                    company=company,
                    sales_order=order,
                    sales_order_item=item,
                    product=item.product,
                    warehouse=warehouse,
                    quantity=item.quantity,
                    status=SalesOrderReservation.ReservationStatus.ACTIVE,
                )

            order.warehouse = warehouse
            order.status = SalesOrder.SalesOrderStatus.RESERVED
            order.save(update_fields=["warehouse", "status", "updated_at"])

            serializer = SalesOrderSerializer(order)
            return Response(serializer.data, status=status.HTTP_200_OK)


class SalesOrderReleaseReservationView(SalesBaseView):
    """
    Atomically releases active stock reservations for a Sales Order.
    Decrements Stock.reserved_quantity and marks reservations RELEASED.
    Reverts Sales Order status from RESERVED back to CONFIRMED.
    """
    def post(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            order = (
                SalesOrder.objects.select_for_update()
                .filter(company=company, id=pk)
                .first()
            )
            if not order:
                return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

            active_reservations = list(
                order.reservations.select_for_update()
                .filter(status=SalesOrderReservation.ReservationStatus.ACTIVE)
                .select_related("product", "warehouse")
            )
            if not active_reservations:
                return Response({"detail": "No active reservations found for this sales order."}, status=status.HTTP_400_BAD_REQUEST)

            for res in active_reservations:
                stock = Stock.objects.select_for_update().filter(product=res.product, warehouse=res.warehouse).first()
                if stock:
                    stock.reserved_quantity = max(Decimal("0.00"), stock.reserved_quantity - res.quantity)
                    stock.save(update_fields=["reserved_quantity", "updated_at"])

                res.status = SalesOrderReservation.ReservationStatus.RELEASED
                res.save(update_fields=["status", "updated_at"])

            if order.status == SalesOrder.SalesOrderStatus.RESERVED:
                order.status = SalesOrder.SalesOrderStatus.CONFIRMED
                order.save(update_fields=["status", "updated_at"])

            serializer = SalesOrderSerializer(order)
            return Response(serializer.data, status=status.HTTP_200_OK)


class SalesOrderFulfillView(SalesBaseView):
    """
    Fulfills a reserved Sales Order.
    Deducts Stock.quantity (physical stock) and clears Stock.reserved_quantity.
    Writes immutable StockTransaction (STOCK_OUT) ledger records.
    Marks reservations FULFILLED and sets Sales Order status to COMPLETED.
    """
    def post(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            order = (
                SalesOrder.objects.select_for_update()
                .filter(company=company, id=pk)
                .first()
            )
            if not order:
                return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

            if order.status == SalesOrder.SalesOrderStatus.COMPLETED:
                return Response({"detail": "Sales Order is already fulfilled and completed."}, status=status.HTTP_400_BAD_REQUEST)

            if order.status == SalesOrder.SalesOrderStatus.CANCELLED:
                return Response({"detail": "Cannot fulfill a cancelled sales order."}, status=status.HTTP_400_BAD_REQUEST)

            active_reservations = list(
                order.reservations.select_for_update()
                .filter(status=SalesOrderReservation.ReservationStatus.ACTIVE)
                .select_related("product", "warehouse")
            )
            if not active_reservations:
                return Response(
                    {"detail": "Cannot fulfill an order without active stock reservations. Please reserve stock first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Deduct physical stock, clear reserved quantity, and create StockTransaction
            for res in active_reservations:
                stock = Stock.objects.select_for_update().filter(product=res.product, warehouse=res.warehouse).first()
                if not stock or stock.quantity < res.quantity:
                    return Response(
                        {"detail": f"Physical stock inconsistency: insufficient physical quantity for product '{res.product.name}'."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                stock.quantity -= res.quantity
                stock.reserved_quantity = max(Decimal("0.00"), stock.reserved_quantity - res.quantity)
                stock.save(update_fields=["quantity", "reserved_quantity", "updated_at"])

                # Immutable Stock Transaction audit
                StockTransaction.objects.create(
                    company=company,
                    product=res.product,
                    warehouse=res.warehouse,
                    transaction_type=StockTransaction.TransactionType.STOCK_OUT,
                    quantity=res.quantity,
                    reference=order.order_number,
                    notes=f"Order fulfillment for Sales Order {order.order_number} ({order.customer.name})",
                    created_by=request.user,
                )

                res.status = SalesOrderReservation.ReservationStatus.FULFILLED
                res.save(update_fields=["status", "updated_at"])

            order.status = SalesOrder.SalesOrderStatus.COMPLETED
            order.save(update_fields=["status", "updated_at"])

            serializer = SalesOrderSerializer(order)
            return Response(serializer.data, status=status.HTTP_200_OK)


class SalesOrderReservationListView(SalesBaseView):
    """
    Returns all reservations for a specific sales order.
    """
    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        order = SalesOrder.objects.filter(company=company, id=pk).first()
        if not order:
            return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

        reservations = (
            order.reservations.select_related("product", "warehouse", "sales_order_item")
            .order_by("-created_at")
        )
        serializer = SalesOrderReservationSerializer(reservations, many=True)
        return Response(serializer.data)


# ============================================================
# 4. SALES DASHBOARD METRICS VIEW
# ============================================================

class SalesDashboardView(SalesBaseView):
    """
    Calculates live sales foundation metrics:
    - Quotations summary (counts and total values by status)
    - Sales Orders summary (counts, total revenue by status)
    - Conversion Rate %
    - Recent activities (latest quotations and orders)
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        # Quotations aggregation
        quotations_qs = Quotation.objects.filter(company=company)
        total_quotations = quotations_qs.count()
        quotations_value = quotations_qs.aggregate(val=Sum("total"))["val"] or Decimal("0.00")
        draft_quotations = quotations_qs.filter(status=Quotation.QuotationStatus.DRAFT).count()
        sent_quotations = quotations_qs.filter(status=Quotation.QuotationStatus.SENT).count()
        accepted_quotations = quotations_qs.filter(status=Quotation.QuotationStatus.ACCEPTED).count()
        rejected_quotations = quotations_qs.filter(status=Quotation.QuotationStatus.REJECTED).count()
        expired_quotations = quotations_qs.filter(status=Quotation.QuotationStatus.EXPIRED).count()
        pending_quotations = quotations_qs.filter(status__in=[Quotation.QuotationStatus.DRAFT, Quotation.QuotationStatus.SENT]).count()
        converted_quotations = quotations_qs.filter(status=Quotation.QuotationStatus.CONVERTED).count()

        conversion_rate = (
            round((converted_quotations / total_quotations) * 100, 1)
            if total_quotations > 0
            else 0.0
        )

        # Orders aggregation
        orders_qs = SalesOrder.objects.filter(company=company)
        total_orders = orders_qs.count()
        total_sales_value = (
            orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            .aggregate(val=Sum("total"))["val"] or Decimal("0.00")
        )
        draft_orders = orders_qs.filter(status=SalesOrder.SalesOrderStatus.DRAFT).count()
        confirmed_orders = orders_qs.filter(status=SalesOrder.SalesOrderStatus.CONFIRMED).count()
        reserved_orders = orders_qs.filter(status=SalesOrder.SalesOrderStatus.RESERVED).count()
        processing_orders = orders_qs.filter(status=SalesOrder.SalesOrderStatus.PROCESSING).count()
        completed_orders = orders_qs.filter(status=SalesOrder.SalesOrderStatus.COMPLETED).count()
        cancelled_orders = orders_qs.filter(status=SalesOrder.SalesOrderStatus.CANCELLED).count()

        # Invoices and Payments aggregation
        invoices_qs = Invoice.objects.filter(company=company)
        payments_qs = Payment.objects.filter(company=company)

        total_invoices_count = invoices_qs.count()
        issued_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.ISSUED).count()
        partially_paid_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.PARTIALLY_PAID).count()
        paid_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.PAID).count()
        cancelled_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.CANCELLED).count()
        overdue_invoices_count = invoices_qs.filter(
            Q(status=Invoice.InvoiceStatus.OVERDUE)
            | (
                Q(status__in=[Invoice.InvoiceStatus.ISSUED, Invoice.InvoiceStatus.PARTIALLY_PAID])
                & Q(due_date__lt=timezone.localdate())
                & Q(balance_due__gt=0)
            )
        ).count()

        total_invoiced_amount = (
            invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
            .aggregate(val=Sum("total"))["val"] or Decimal("0.00")
        )
        total_paid_amount = (
            payments_qs.aggregate(val=Sum("amount"))["val"] or Decimal("0.00")
        )
        total_outstanding_amount = (
            invoices_qs.exclude(status__in=[Invoice.InvoiceStatus.CANCELLED, Invoice.InvoiceStatus.PAID])
            .aggregate(val=Sum("balance_due"))["val"] or Decimal("0.00")
        )

        # Monthly Comparison
        now = timezone.now()
        curr_year, curr_month = now.year, now.month
        if curr_month == 1:
            prev_year, prev_month = curr_year - 1, 12
        else:
            prev_year, prev_month = curr_year, curr_month - 1

        curr_month_sales = (
            orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            .filter(order_date__year=curr_year, order_date__month=curr_month)
            .aggregate(val=Sum("total"))["val"] or Decimal("0.00")
        )
        prev_month_sales = (
            orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            .filter(order_date__year=prev_year, order_date__month=prev_month)
            .aggregate(val=Sum("total"))["val"] or Decimal("0.00")
        )
        curr_month_orders = orders_qs.filter(order_date__year=curr_year, order_date__month=curr_month).count()
        prev_month_orders = orders_qs.filter(order_date__year=prev_year, order_date__month=prev_month).count()

        curr_month_invoiced = (
            invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
            .filter(invoice_date__year=curr_year, invoice_date__month=curr_month)
            .aggregate(val=Sum("total"))["val"] or Decimal("0.00")
        )
        prev_month_invoiced = (
            invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
            .filter(invoice_date__year=prev_year, invoice_date__month=prev_month)
            .aggregate(val=Sum("total"))["val"] or Decimal("0.00")
        )

        curr_month_collected = (
            payments_qs.filter(payment_date__year=curr_year, payment_date__month=curr_month)
            .aggregate(val=Sum("amount"))["val"] or Decimal("0.00")
        )
        prev_month_collected = (
            payments_qs.filter(payment_date__year=prev_year, payment_date__month=prev_month)
            .aggregate(val=Sum("amount"))["val"] or Decimal("0.00")
        )

        curr_month_quotations = quotations_qs.filter(quotation_date__year=curr_year, quotation_date__month=curr_month).count()
        prev_month_quotations = quotations_qs.filter(quotation_date__year=prev_year, quotation_date__month=prev_month).count()

        # Recent records
        recent_quotations = (
            quotations_qs.select_related("customer")
            .order_by("-created_at")[:5]
        )
        recent_orders = (
            orders_qs.select_related("customer", "warehouse")
            .order_by("-created_at")[:5]
        )
        recent_invoices = (
            invoices_qs.select_related("customer", "sales_order")
            .order_by("-created_at")[:5]
        )
        recent_payments = (
            payments_qs.select_related("customer", "invoice")
            .order_by("-created_at")[:5]
        )

        # Top customers by sales value
        top_customers_qs = (
            orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            .values("customer__id", "customer__name")
            .annotate(
                order_count=Count("id"),
                total_spent=Sum("total"),
            )
            .order_by("-total_spent")[:5]
        )

        return Response({
            "summary": {
                "total_quotations": total_quotations,
                "quotations_value": str(quotations_value),
                "draft_quotations": draft_quotations,
                "sent_quotations": sent_quotations,
                "accepted_quotations": accepted_quotations,
                "rejected_quotations": rejected_quotations,
                "expired_quotations": expired_quotations,
                "pending_quotations": pending_quotations,
                "converted_quotations": converted_quotations,
                "conversion_rate_percentage": conversion_rate,
                "total_orders": total_orders,
                "total_sales_value": str(total_sales_value),
                "draft_orders": draft_orders,
                "confirmed_orders": confirmed_orders,
                "reserved_orders": reserved_orders,
                "processing_orders": processing_orders,
                "completed_orders": completed_orders,
                "cancelled_orders": cancelled_orders,
                "total_invoices_count": total_invoices_count,
                "issued_invoices_count": issued_invoices_count,
                "partially_paid_invoices_count": partially_paid_invoices_count,
                "paid_invoices_count": paid_invoices_count,
                "overdue_invoices_count": overdue_invoices_count,
                "cancelled_invoices_count": cancelled_invoices_count,
                "total_invoiced_amount": str(total_invoiced_amount),
                "total_paid_amount": str(total_paid_amount),
                "total_outstanding_amount": str(total_outstanding_amount),
            },
            "comparisons": {
                "current_month_sales": str(curr_month_sales),
                "previous_month_sales": str(prev_month_sales),
                "current_month_orders_count": curr_month_orders,
                "previous_month_orders_count": prev_month_orders,
                "current_month_invoiced": str(curr_month_invoiced),
                "previous_month_invoiced": str(prev_month_invoiced),
                "current_month_collected": str(curr_month_collected),
                "previous_month_collected": str(prev_month_collected),
                "current_month_quotations_count": curr_month_quotations,
                "previous_month_quotations_count": prev_month_quotations,
            },
            "recent_quotations": QuotationSerializer(recent_quotations, many=True).data,
            "recent_orders": SalesOrderSerializer(recent_orders, many=True).data,
            "recent_invoices": InvoiceSerializer(recent_invoices, many=True).data,
            "recent_payments": PaymentSerializer(recent_payments, many=True).data,
            "top_customers": [
                {
                    "customer__id": c["customer__id"],
                    "customer__name": c["customer__name"],
                    "order_count": c["order_count"],
                    "total_spent": str(c["total_spent"] or Decimal("0.00")),
                }
                for c in top_customers_qs
            ],
        })


# ============================================================
# 3. SALES INVOICE, PAYMENT & RECEIPT VIEWS
# ============================================================

class InvoiceListCreateView(SalesBaseView):
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoices = (
            Invoice.objects.filter(company=company)
            .select_related("customer", "sales_order", "created_by")
            .prefetch_related("items__product", "payments", "receipts")
        )

        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            if status_param == "OVERDUE":
                invoices = invoices.filter(
                    Q(status=Invoice.InvoiceStatus.OVERDUE)
                    | (
                        Q(status__in=[Invoice.InvoiceStatus.ISSUED, Invoice.InvoiceStatus.PARTIALLY_PAID])
                        & Q(due_date__lt=timezone.localdate())
                        & Q(balance_due__gt=0)
                    )
                )
            else:
                invoices = invoices.filter(status=status_param)

        customer_id = request.query_params.get("customer")
        if customer_id:
            invoices = invoices.filter(customer_id=customer_id)

        sales_order_id = request.query_params.get("sales_order")
        if sales_order_id:
            invoices = invoices.filter(sales_order_id=sales_order_id)

        date_from = request.query_params.get("date_from")
        if date_from:
            invoices = invoices.filter(invoice_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            invoices = invoices.filter(invoice_date__lte=date_to)

        invoice_number_param = request.query_params.get("invoice_number")
        if invoice_number_param:
            invoices = invoices.filter(invoice_number__icontains=invoice_number_param.strip())

        search = request.query_params.get("search")
        if search:
            invoices = invoices.filter(
                Q(invoice_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(sales_order__order_number__icontains=search)
            )

        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    def post(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        serializer = InvoiceSerializer(data=request.data, context={"company": company, "request": request})
        if serializer.is_valid():
            invoice = serializer.save(company=company, created_by=request.user)
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InvoiceDetailView(SalesBaseView):
    def get_object(self, company, pk):
        try:
            return (
                Invoice.objects.filter(company=company, id=pk)
                .select_related("customer", "sales_order", "created_by")
                .prefetch_related("items__product", "payments", "receipts")
                .get()
            )
        except Invoice.DoesNotExist:
            return None

    def get(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object(company, pk)
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data)

    def patch(self, request, company_id, pk):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object(company, pk)
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        # Status transition restrictions
        target_status = request.data.get("status")
        if target_status:
            if invoice.status == Invoice.InvoiceStatus.PAID and target_status in [Invoice.InvoiceStatus.DRAFT, Invoice.InvoiceStatus.ISSUED]:
                return Response({"detail": "Cannot revert a PAID invoice back to DRAFT or ISSUED."}, status=status.HTTP_400_BAD_REQUEST)
            if invoice.status == Invoice.InvoiceStatus.CANCELLED and target_status == Invoice.InvoiceStatus.PAID:
                return Response({"detail": "Cannot mark a CANCELLED invoice as PAID."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = InvoiceSerializer(invoice, data=request.data, partial=True, context={"company": company, "request": request})
        if serializer.is_valid():
            updated = serializer.save()
            return Response(InvoiceSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SalesOrderInvoiceCreateView(SalesBaseView):
    """
    Creates an Invoice from a Sales Order.
    Atomic, ensures non-duplicate invoice, copies all items with backend recalculations.
    """
    def post(self, request, company_id, order_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            order = (
                SalesOrder.objects.select_for_update()
                .filter(company=company, id=order_id)
                .first()
            )
            if not order:
                return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

            if order.status == SalesOrder.SalesOrderStatus.CANCELLED:
                return Response({"detail": "Cannot create an invoice for a cancelled sales order."}, status=status.HTTP_400_BAD_REQUEST)

            # Prevent duplicate invoice creation for the same Sales Order
            active_invoice = order.invoices.filter(
                status__in=[
                    Invoice.InvoiceStatus.DRAFT,
                    Invoice.InvoiceStatus.ISSUED,
                    Invoice.InvoiceStatus.PARTIALLY_PAID,
                    Invoice.InvoiceStatus.PAID,
                ]
            ).first()
            if active_invoice:
                return Response(
                    {"detail": f"An active invoice ({active_invoice.invoice_number}) has already been generated for this Sales Order."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order_items = list(order.items.select_related("product").all())
            if not order_items:
                return Response({"detail": "Cannot create an invoice for a sales order with no line items."}, status=status.HTTP_400_BAD_REQUEST)

            # Default due date 30 days from order_date or today
            due_date = request.data.get("due_date")
            if due_date and isinstance(due_date, str):
                from datetime import date
                try:
                    due_date = date.fromisoformat(due_date)
                except (ValueError, TypeError):
                    due_date = None
            if not due_date:
                base_date = order.order_date or timezone.localdate()
                due_date = base_date + timezone.timedelta(days=30)

            invoice_date = request.data.get("invoice_date")
            if invoice_date and isinstance(invoice_date, str):
                from datetime import date
                try:
                    invoice_date = date.fromisoformat(invoice_date)
                except (ValueError, TypeError):
                    invoice_date = None
            if not invoice_date:
                invoice_date = timezone.localdate()

            invoice = Invoice.objects.create(
                company=company,
                customer=order.customer,
                sales_order=order,
                invoice_number=generate_invoice_number(company),
                invoice_date=invoice_date,
                due_date=due_date,
                status=Invoice.InvoiceStatus.ISSUED,
                notes=request.data.get("notes") or f"Invoice for Sales Order {order.order_number}",
                subtotal=order.subtotal,
                discount=order.discount,
                tax=order.tax,
                total=order.total,
                amount_paid=Decimal("0.00"),
                balance_due=order.total,
                created_by=request.user,
            )

            for item in order_items:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    product=item.product,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount=item.discount,
                    tax=item.tax,
                    line_total=item.line_total,
                )

            invoice.recalculate_totals()
            invoice.save(update_fields=["subtotal", "discount", "tax", "total", "balance_due"])
            invoice.refresh_from_db()

            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class InvoicePaymentListCreateView(SalesBaseView):
    """
    GET: List payments for an invoice.
    POST: Record payment with atomic row-locking on Invoice and simultaneous Receipt creation.
    """
    def get(self, request, company_id, invoice_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoice = Invoice.objects.filter(company=company, id=invoice_id).first()
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        payments = invoice.payments.select_related("customer", "received_by", "receipt").all()
        return Response(PaymentSerializer(payments, many=True).data)

    def post(self, request, company_id, invoice_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            # Concurrency row-level lock on invoice
            invoice = (
                Invoice.objects.select_for_update()
                .filter(company=company, id=invoice_id)
                .first()
            )
            if not invoice:
                return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

            if invoice.status == Invoice.InvoiceStatus.PAID:
                return Response({"detail": "Invoice is already fully paid. Cannot accept additional payment."}, status=status.HTTP_400_BAD_REQUEST)

            if invoice.status == Invoice.InvoiceStatus.CANCELLED:
                return Response({"detail": "Cannot record payment for a cancelled invoice."}, status=status.HTTP_400_BAD_REQUEST)

            amount_val = request.data.get("amount")
            if amount_val is None:
                return Response({"amount": ["Amount is required."]}, status=status.HTTP_400_BAD_REQUEST)

            try:
                amount = Decimal(str(amount_val))
            except Exception:
                return Response({"amount": ["Invalid monetary amount format."]}, status=status.HTTP_400_BAD_REQUEST)

            if amount <= Decimal("0.00"):
                return Response({"amount": ["Payment amount must be greater than zero."]}, status=status.HTTP_400_BAD_REQUEST)

            if amount > invoice.balance_due:
                return Response(
                    {"detail": f"Payment amount ({amount}) exceeds invoice balance due ({invoice.balance_due}). Overpayment is not permitted."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_method = request.data.get("payment_method") or Payment.PaymentMethod.BANK_TRANSFER
            if payment_method not in Payment.PaymentMethod.values:
                return Response({"payment_method": [f"Invalid payment method. Choices are: {Payment.PaymentMethod.values}"]}, status=status.HTTP_400_BAD_REQUEST)

            payment_date = request.data.get("payment_date") or timezone.localdate()
            reference = request.data.get("reference", "")
            notes = request.data.get("notes", "")

            # Create Payment
            payment = Payment.objects.create(
                company=company,
                invoice=invoice,
                customer=invoice.customer,
                payment_number=generate_payment_number(company),
                amount=amount,
                payment_date=payment_date,
                payment_method=payment_method,
                reference=reference,
                notes=notes,
                received_by=request.user,
            )

            # Update Invoice balances and status
            invoice.amount_paid += amount
            invoice.balance_due = max(Decimal("0.00"), invoice.total - invoice.amount_paid)
            if invoice.balance_due == Decimal("0.00"):
                invoice.status = Invoice.InvoiceStatus.PAID
            else:
                invoice.status = Invoice.InvoiceStatus.PARTIALLY_PAID
            invoice.save(update_fields=["amount_paid", "balance_due", "status", "updated_at"])

            # Atomically create Receipt
            receipt = Receipt.objects.create(
                company=company,
                payment=payment,
                invoice=invoice,
                customer=invoice.customer,
                receipt_number=generate_receipt_number(company),
                receipt_date=payment.payment_date,
                amount=payment.amount,
                notes=request.data.get("receipt_notes") or f"Payment receipt for invoice {invoice.invoice_number}",
                created_by=request.user,
            )

            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class InvoiceReceiptListView(SalesBaseView):
    """
    GET: List receipts for a specific invoice.
    """
    def get(self, request, company_id, invoice_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoice = Invoice.objects.filter(company=company, id=invoice_id).first()
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        receipts = invoice.receipts.select_related("payment", "customer", "created_by").all()
        return Response(ReceiptSerializer(receipts, many=True).data)


class ReceiptListView(SalesBaseView):
    """
    GET: List receipts across company with optional search/customer filter.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        receipts = (
            Receipt.objects.filter(company=company)
            .select_related("payment", "invoice", "customer", "created_by")
        )

        customer_id = request.query_params.get("customer")
        if customer_id:
            receipts = receipts.filter(customer_id=customer_id)

        search = request.query_params.get("search")
        if search:
            receipts = receipts.filter(
                Q(receipt_number__icontains=search)
                | Q(payment__payment_number__icontains=search)
                | Q(invoice__invoice_number__icontains=search)
                | Q(customer__name__icontains=search)
            )

        return Response(ReceiptSerializer(receipts, many=True).data)


class SalesFinancialSummaryView(SalesBaseView):
    """
    PostgreSQL-powered sales financial summary metrics.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        invoices_qs = Invoice.objects.filter(company=company)
        payments_qs = Payment.objects.filter(company=company)

        now = timezone.now()
        current_year = now.year
        current_month = now.month

        total_invoices_count = invoices_qs.count()
        issued_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.ISSUED).count()
        partially_paid_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.PARTIALLY_PAID).count()
        paid_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.PAID).count()
        cancelled_invoices_count = invoices_qs.filter(status=Invoice.InvoiceStatus.CANCELLED).count()

        overdue_invoices_count = invoices_qs.filter(
            Q(status=Invoice.InvoiceStatus.OVERDUE)
            | (
                Q(status__in=[Invoice.InvoiceStatus.ISSUED, Invoice.InvoiceStatus.PARTIALLY_PAID])
                & Q(due_date__lt=timezone.localdate())
                & Q(balance_due__gt=0)
            )
        ).count()

        total_invoiced_amount = (
            invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
            .aggregate(total=Sum("total"))["total"]
            or Decimal("0.00")
        )

        total_paid_amount = (
            payments_qs.aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        total_outstanding_amount = (
            invoices_qs.exclude(status__in=[Invoice.InvoiceStatus.CANCELLED, Invoice.InvoiceStatus.PAID])
            .aggregate(total=Sum("balance_due"))["total"]
            or Decimal("0.00")
        )

        current_month_invoiced_amount = (
            invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
            .filter(invoice_date__year=current_year, invoice_date__month=current_month)
            .aggregate(total=Sum("total"))["total"]
            or Decimal("0.00")
        )

        current_month_paid_amount = (
            payments_qs.filter(payment_date__year=current_year, payment_date__month=current_month)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        data = {
            "total_invoices_count": total_invoices_count,
            "issued_invoices_count": issued_invoices_count,
            "partially_paid_invoices_count": partially_paid_invoices_count,
            "paid_invoices_count": paid_invoices_count,
            "overdue_invoices_count": overdue_invoices_count,
            "cancelled_invoices_count": cancelled_invoices_count,
            "total_invoiced_amount": total_invoiced_amount,
            "total_paid_amount": total_paid_amount,
            "total_outstanding_amount": total_outstanding_amount,
            "current_month_invoiced_amount": current_month_invoiced_amount,
            "current_month_paid_amount": current_month_paid_amount,
        }

        serializer = SalesFinancialSummarySerializer(data)
        return Response(serializer.data)


# ============================================================
# 5. PHASE 4D: PAYMENT LIST VIEW
# ============================================================

class PaymentListView(SalesBaseView):
    """
    Company-wide payment listing with comprehensive filters.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        payments = (
            Payment.objects.filter(company=company)
            .select_related("customer", "invoice", "received_by")
            .order_by("-payment_date", "-created_at")
        )

        customer_id = request.query_params.get("customer")
        if customer_id:
            payments = payments.filter(customer_id=customer_id)

        payment_method = request.query_params.get("payment_method")
        if payment_method and payment_method != "ALL":
            payments = payments.filter(payment_method=payment_method.upper())

        date_from = request.query_params.get("date_from")
        if date_from:
            payments = payments.filter(payment_date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            payments = payments.filter(payment_date__lte=date_to)

        payment_number = request.query_params.get("payment_number")
        if payment_number:
            payments = payments.filter(payment_number__icontains=payment_number.strip())

        invoice_id = request.query_params.get("invoice")
        if invoice_id:
            payments = payments.filter(invoice_id=invoice_id)

        search = request.query_params.get("search")
        if search:
            payments = payments.filter(
                Q(payment_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(invoice__invoice_number__icontains=search)
                | Q(reference__icontains=search)
            )

        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data)


# ============================================================
# 6. PHASE 4D: SALES ANALYTICS VIEW
# ============================================================

class SalesAnalyticsView(SalesBaseView):
    """
    Advanced multi-dimensional sales analytics:
    - Monthly trends (past 12 months: orders count, sales total, invoiced total, collected total)
    - Order status distribution
    - Invoice status distribution
    - Payment method distribution
    - Top customers by sales value
    - Top products by quantity sold & revenue
    - Sales distribution by warehouse
    - Quotation conversion metrics
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        orders_qs = SalesOrder.objects.filter(company=company)
        invoices_qs = Invoice.objects.filter(company=company)
        payments_qs = Payment.objects.filter(company=company)
        quotations_qs = Quotation.objects.filter(company=company)

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

            m_orders = orders_qs.filter(order_date__year=y, order_date__month=m).exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            m_invoices = invoices_qs.filter(invoice_date__year=y, invoice_date__month=m).exclude(status=Invoice.InvoiceStatus.CANCELLED)
            m_payments = payments_qs.filter(payment_date__year=y, payment_date__month=m)

            orders_count = m_orders.count()
            sales_total = m_orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            invoiced_total = m_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            collected_total = m_payments.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")

            monthly_trends.append({
                "month": month_label,
                "orders_count": orders_count,
                "sales_total": str(sales_total),
                "invoiced_total": str(invoiced_total),
                "collected_total": str(collected_total),
            })

        # 2. Order Status Distribution
        order_status_distribution = []
        for choice, label in SalesOrder.SalesOrderStatus.choices:
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
        for choice, label in Invoice.InvoiceStatus.choices:
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
        for choice, label in Payment.PaymentMethod.choices:
            qs = payments_qs.filter(payment_method=choice)
            count = qs.count()
            amt = qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            payment_method_distribution.append({
                "method": choice,
                "label": label,
                "count": count,
                "total_amount": str(amt),
            })

        # 5. Top Customers (by sales total)
        top_customers_qs = (
            orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            .values("customer__id", "customer__name")
            .annotate(
                order_count=Count("id"),
                total_spent=Sum("total"),
            )
            .order_by("-total_spent")[:10]
        )
        top_customers = []
        for c in top_customers_qs:
            c_id = c["customer__id"]
            c_invoiced = (
                invoices_qs.filter(customer_id=c_id).exclude(status=Invoice.InvoiceStatus.CANCELLED)
                .aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            )
            c_paid = payments_qs.filter(customer_id=c_id).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            top_customers.append({
                "customer_id": c_id,
                "customer_name": c["customer__name"],
                "order_count": c["order_count"],
                "total_spent": str(c["total_spent"] or Decimal("0.00")),
                "invoiced_total": str(c_invoiced),
                "paid_total": str(c_paid),
            })

        # 6. Top Products (by revenue)
        top_products_qs = (
            SalesOrderItem.objects.filter(sales_order__company=company)
            .exclude(sales_order__status=SalesOrder.SalesOrderStatus.CANCELLED)
            .values("product__id", "product__name", "product__sku")
            .annotate(
                quantity_sold=Sum("quantity"),
                sales_amount=Sum("line_total"),
            )
            .order_by("-sales_amount")[:10]
        )
        top_products = [
            {
                "product_id": p["product__id"],
                "product_name": p["product__name"],
                "product_sku": p["product__sku"],
                "quantity_sold": str(p["quantity_sold"] or Decimal("0.00")),
                "sales_amount": str(p["sales_amount"] or Decimal("0.00")),
            }
            for p in top_products_qs
        ]

        # 7. Sales by Warehouse
        warehouse_qs = (
            orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            .filter(warehouse__isnull=False)
            .values("warehouse__id", "warehouse__name", "warehouse__code")
            .annotate(
                orders_count=Count("id"),
                sales_total=Sum("total"),
            )
            .order_by("-sales_total")
        )
        warehouse_distribution = [
            {
                "warehouse_id": w["warehouse__id"],
                "warehouse_name": w["warehouse__name"],
                "warehouse_code": w["warehouse__code"],
                "orders_count": w["orders_count"],
                "sales_total": str(w["sales_total"] or Decimal("0.00")),
            }
            for w in warehouse_qs
        ]

        # 8. Quotation Conversion Metrics
        total_quotes = quotations_qs.count()
        converted_quotes = quotations_qs.filter(status=Quotation.QuotationStatus.CONVERTED).count()
        conversion_rate = round((converted_quotes / total_quotes) * 100, 1) if total_quotes > 0 else 0.0
        total_quote_value = quotations_qs.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        converted_quote_value = (
            quotations_qs.filter(status=Quotation.QuotationStatus.CONVERTED)
            .aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        )

        return Response({
            "monthly_trends": monthly_trends,
            "order_status_distribution": order_status_distribution,
            "invoice_status_distribution": invoice_status_distribution,
            "payment_method_distribution": payment_method_distribution,
            "top_customers": top_customers,
            "top_products": top_products,
            "warehouse_distribution": warehouse_distribution,
            "quotation_conversion": {
                "total_quotations": total_quotes,
                "converted_quotations": converted_quotes,
                "conversion_rate_percentage": conversion_rate,
                "total_quotation_value": str(total_quote_value),
                "converted_quotation_value": str(converted_quote_value),
            },
        })


# ============================================================
# 7. PHASE 4D: SALES REPORTS VIEW
# ============================================================

class SalesReportsView(SalesBaseView):
    """
    Sales Reporting API supporting 5 distinct report types:
    - summary: high-level financial & sales KPIs
    - customer: customer performance breakdown
    - product: product sales and revenue volume
    - invoice: detailed invoices with aging buckets
    - payment: payment transaction ledger
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        report_type = request.query_params.get("report_type") or request.query_params.get("type") or "summary"
        report_type = report_type.lower().strip()

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        customer_id = request.query_params.get("customer")
        product_id = request.query_params.get("product")
        warehouse_id = request.query_params.get("warehouse")
        status_param = request.query_params.get("status")

        orders_qs = SalesOrder.objects.filter(company=company)
        invoices_qs = Invoice.objects.filter(company=company)
        payments_qs = Payment.objects.filter(company=company)
        returns_qs = SalesReturn.objects.filter(company=company)

        # Apply common filters
        if date_from:
            orders_qs = orders_qs.filter(order_date__gte=date_from)
            invoices_qs = invoices_qs.filter(invoice_date__gte=date_from)
            payments_qs = payments_qs.filter(payment_date__gte=date_from)
            returns_qs = returns_qs.filter(return_date__gte=date_from)
        if date_to:
            orders_qs = orders_qs.filter(order_date__lte=date_to)
            invoices_qs = invoices_qs.filter(invoice_date__lte=date_to)
            payments_qs = payments_qs.filter(payment_date__lte=date_to)
            returns_qs = returns_qs.filter(return_date__lte=date_to)
        if customer_id:
            orders_qs = orders_qs.filter(customer_id=customer_id)
            invoices_qs = invoices_qs.filter(customer_id=customer_id)
            payments_qs = payments_qs.filter(customer_id=customer_id)
            returns_qs = returns_qs.filter(customer_id=customer_id)
        if warehouse_id:
            orders_qs = orders_qs.filter(warehouse_id=warehouse_id)
            returns_qs = returns_qs.filter(warehouse_id=warehouse_id)

        # ----------------------------------------------------
        # REPORT 1: SUMMARY
        # ----------------------------------------------------
        if report_type == "summary":
            non_cancelled_orders = orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            total_orders = non_cancelled_orders.count()
            total_sales_value = non_cancelled_orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            average_order_value = (
                round(total_sales_value / total_orders, 2)
                if total_orders > 0
                else Decimal("0.00")
            )

            non_cancelled_invoices = invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
            total_invoiced = non_cancelled_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
            total_collected = payments_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            total_outstanding = (
                non_cancelled_invoices.exclude(status=Invoice.InvoiceStatus.PAID)
                .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
            )

            collection_rate = (
                round((total_collected / total_invoiced) * 100, 1)
                if total_invoiced > 0
                else 0.0
            )

            total_returns_amount = returns_qs.aggregate(s=Sum("total_amount"))["s"] or Decimal("0.00")
            active_customers_count = non_cancelled_orders.values("customer_id").distinct().count()

            return Response({
                "report_type": "summary",
                "filters": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "customer": customer_id,
                    "warehouse": warehouse_id,
                },
                "data": {
                    "total_orders": total_orders,
                    "total_sales_value": str(total_sales_value),
                    "average_order_value": str(average_order_value),
                    "total_invoiced": str(total_invoiced),
                    "total_collected": str(total_collected),
                    "total_outstanding": str(total_outstanding),
                    "collection_rate_percentage": collection_rate,
                    "total_returns_amount": str(total_returns_amount),
                    "active_customers_count": active_customers_count,
                }
            })

        # ----------------------------------------------------
        # REPORT 2: CUSTOMER
        # ----------------------------------------------------
        elif report_type == "customer":
            customers = Customer.objects.filter(company=company)
            if customer_id:
                customers = customers.filter(id=customer_id)

            rows = []
            for cust in customers:
                c_orders = orders_qs.filter(customer=cust).exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
                order_count = c_orders.count()
                sales_val = c_orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")

                c_invoices = invoices_qs.filter(customer=cust).exclude(status=Invoice.InvoiceStatus.CANCELLED)
                invoiced_val = c_invoices.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
                paid_val = payments_qs.filter(customer=cust).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
                balance_val = (
                    c_invoices.exclude(status=Invoice.InvoiceStatus.PAID)
                    .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
                )

                if order_count > 0 or invoiced_val > 0 or paid_val > 0:
                    rows.append({
                        "customer_id": cust.id,
                        "customer_name": cust.name,
                        "customer_email": cust.email or "",
                        "orders_count": order_count,
                        "total_sales": str(sales_val),
                        "invoiced_total": str(invoiced_val),
                        "paid_total": str(paid_val),
                        "balance_due": str(balance_val),
                    })

            rows.sort(key=lambda x: Decimal(x["total_sales"]), reverse=True)
            return Response({
                "report_type": "customer",
                "filters": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "customer": customer_id,
                },
                "rows": rows,
            })

        # ----------------------------------------------------
        # REPORT 3: PRODUCT
        # ----------------------------------------------------
        elif report_type == "product":
            order_items_qs = (
                SalesOrderItem.objects.filter(sales_order__company=company)
                .exclude(sales_order__status=SalesOrder.SalesOrderStatus.CANCELLED)
            )
            if date_from:
                order_items_qs = order_items_qs.filter(sales_order__order_date__gte=date_from)
            if date_to:
                order_items_qs = order_items_qs.filter(sales_order__order_date__lte=date_to)
            if customer_id:
                order_items_qs = order_items_qs.filter(sales_order__customer_id=customer_id)
            if warehouse_id:
                order_items_qs = order_items_qs.filter(sales_order__warehouse_id=warehouse_id)
            if product_id:
                order_items_qs = order_items_qs.filter(product_id=product_id)

            grouped_prods = (
                order_items_qs.values("product__id", "product__name", "product__sku")
                .annotate(
                    units_sold=Sum("quantity"),
                    total_sales=Sum("line_total"),
                )
                .order_by("-total_sales")
            )

            rows = []
            for p in grouped_prods:
                qty = p["units_sold"] or Decimal("0.00")
                sales = p["total_sales"] or Decimal("0.00")
                avg_price = round(sales / qty, 2) if qty > 0 else Decimal("0.00")
                rows.append({
                    "product_id": p["product__id"],
                    "product_name": p["product__name"],
                    "product_sku": p["product__sku"],
                    "units_sold": str(qty),
                    "total_sales": str(sales),
                    "average_unit_price": str(avg_price),
                })

            return Response({
                "report_type": "product",
                "filters": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "warehouse": warehouse_id,
                    "product": product_id,
                },
                "rows": rows,
            })

        # ----------------------------------------------------
        # REPORT 4: INVOICE & AGING
        # ----------------------------------------------------
        elif report_type == "invoice":
            inv_qs = (
                invoices_qs.select_related("customer", "sales_order")
                .order_by("-invoice_date")
            )
            if status_param and status_param != "ALL":
                inv_qs = inv_qs.filter(status=status_param.upper())

            today = timezone.localdate()
            rows = []
            current_amt = Decimal("0.00")
            days_1_30_amt = Decimal("0.00")
            days_31_60_amt = Decimal("0.00")
            days_60_plus_amt = Decimal("0.00")

            for inv in inv_qs:
                days_overdue = 0
                aging_bucket = "CURRENT"
                if inv.due_date and inv.due_date < today and inv.balance_due > 0 and inv.status not in [Invoice.InvoiceStatus.PAID, Invoice.InvoiceStatus.CANCELLED]:
                    days_overdue = (today - inv.due_date).days
                    if days_overdue <= 30:
                        aging_bucket = "1-30_DAYS"
                        days_1_30_amt += inv.balance_due
                    elif days_overdue <= 60:
                        aging_bucket = "31-60_DAYS"
                        days_31_60_amt += inv.balance_due
                    else:
                        aging_bucket = "60+_DAYS"
                        days_60_plus_amt += inv.balance_due
                else:
                    if inv.balance_due > 0 and inv.status not in [Invoice.InvoiceStatus.CANCELLED, Invoice.InvoiceStatus.PAID]:
                        current_amt += inv.balance_due

                rows.append({
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "customer_id": inv.customer.id,
                    "customer_name": inv.customer.name,
                    "order_number": inv.sales_order.order_number if inv.sales_order else "",
                    "invoice_date": str(inv.invoice_date),
                    "due_date": str(inv.due_date),
                    "total": str(inv.total),
                    "amount_paid": str(inv.amount_paid),
                    "balance_due": str(inv.balance_due),
                    "status": inv.status,
                    "aging_bucket": aging_bucket,
                    "days_overdue": days_overdue,
                })

            total_outstanding = current_amt + days_1_30_amt + days_31_60_amt + days_60_plus_amt
            return Response({
                "report_type": "invoice",
                "filters": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "customer": customer_id,
                    "status": status_param,
                },
                "summary": {
                    "current_amount": str(current_amt),
                    "days_1_30_amount": str(days_1_30_amt),
                    "days_31_60_amount": str(days_31_60_amt),
                    "days_60_plus_amount": str(days_60_plus_amt),
                    "total_outstanding": str(total_outstanding),
                },
                "rows": rows,
            })

        # ----------------------------------------------------
        # REPORT 5: PAYMENT
        # ----------------------------------------------------
        elif report_type == "payment":
            pay_qs = (
                payments_qs.select_related("customer", "invoice")
                .order_by("-payment_date")
            )
            method_param = request.query_params.get("payment_method")
            if method_param and method_param != "ALL":
                pay_qs = pay_qs.filter(payment_method=method_param.upper())

            rows = []
            method_totals = {}
            for pay in pay_qs:
                rows.append({
                    "id": pay.id,
                    "payment_number": pay.payment_number,
                    "payment_date": str(pay.payment_date),
                    "customer_id": pay.customer.id,
                    "customer_name": pay.customer.name,
                    "invoice_number": pay.invoice.invoice_number,
                    "payment_method": pay.payment_method,
                    "amount": str(pay.amount),
                    "reference": pay.reference or "",
                })
                method_totals[pay.payment_method] = method_totals.get(pay.payment_method, Decimal("0.00")) + pay.amount

            total_collected = sum(method_totals.values(), Decimal("0.00"))
            return Response({
                "report_type": "payment",
                "filters": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "customer": customer_id,
                    "payment_method": method_param,
                },
                "total_collected": str(total_collected),
                "method_totals": {k: str(v) for k, v in method_totals.items()},
                "rows": rows,
            })

        else:
            return Response(
                {"detail": f"Unknown report_type '{report_type}'. Supported: summary, customer, product, invoice, payment"},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ============================================================
# 8. PHASE 4D: CUSTOMER SALES HISTORY VIEW
# ============================================================

class CustomerSalesHistoryView(SalesBaseView):
    """
    Returns complete sales history and lifetime metrics for a CRM Customer.
    Tenant isolated: customer must belong to the active company.
    """
    def get(self, request, company_id, customer_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        customer = Customer.objects.filter(company=company, id=customer_id).first()
        if not customer:
            return Response({"detail": "Customer not found in this company."}, status=status.HTTP_404_NOT_FOUND)

        quotations_qs = Quotation.objects.filter(company=company, customer=customer).select_related("created_by")
        orders_qs = SalesOrder.objects.filter(company=company, customer=customer).select_related("warehouse", "created_by")
        invoices_qs = Invoice.objects.filter(company=company, customer=customer).select_related("sales_order", "created_by")
        payments_qs = Payment.objects.filter(company=company, customer=customer).select_related("invoice", "received_by")
        receipts_qs = Receipt.objects.filter(company=company, customer=customer).select_related("payment", "invoice", "created_by")

        # Metrics aggregation
        total_orders = orders_qs.count()
        completed_orders = orders_qs.filter(status=SalesOrder.SalesOrderStatus.COMPLETED).count()
        total_sales_amount = (
            orders_qs.exclude(status=SalesOrder.SalesOrderStatus.CANCELLED)
            .aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        )

        total_quotations = quotations_qs.count()
        converted_quotations = quotations_qs.filter(status=Quotation.QuotationStatus.CONVERTED).count()
        conversion_rate = (
            round((converted_quotations / total_quotations) * 100, 1)
            if total_quotations > 0
            else 0.0
        )

        total_invoices = invoices_qs.count()
        total_invoiced_amount = (
            invoices_qs.exclude(status=Invoice.InvoiceStatus.CANCELLED)
            .aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        )
        total_paid_amount = payments_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
        total_balance_due = (
            invoices_qs.exclude(status__in=[Invoice.InvoiceStatus.CANCELLED, Invoice.InvoiceStatus.PAID])
            .aggregate(s=Sum("balance_due"))["s"] or Decimal("0.00")
        )

        return Response({
            "customer": {
                "id": customer.id,
                "name": customer.name,
                "email": customer.email or "",
                "phone": customer.phone or "",
                "company_id": company.id,
                "company_name": company.name,
            },
            "metrics": {
                "total_orders": total_orders,
                "completed_orders": completed_orders,
                "total_sales_amount": str(total_sales_amount),
                "total_quotations": total_quotations,
                "converted_quotations": converted_quotations,
                "conversion_rate_percentage": conversion_rate,
                "total_invoices": total_invoices,
                "total_invoiced_amount": str(total_invoiced_amount),
                "total_paid_amount": str(total_paid_amount),
                "total_balance_due": str(total_balance_due),
            },
            "quotations": QuotationSerializer(quotations_qs, many=True).data,
            "orders": SalesOrderSerializer(orders_qs, many=True).data,
            "invoices": InvoiceSerializer(invoices_qs, many=True).data,
            "payments": PaymentSerializer(payments_qs, many=True).data,
            "receipts": ReceiptSerializer(receipts_qs, many=True).data,
        })


# ============================================================
# 9. PHASE 4D: SALES ORDER RETURN VIEWS
# ============================================================

class SalesOrderReturnView(SalesBaseView):
    """
    POST: Processes a Sales Return for a COMPLETED sales order.
    Atomically restores inventory stock in warehouse via STOCK_IN StockTransaction.
    """
    def post(self, request, company_id, order_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            order = (
                SalesOrder.objects.select_for_update()
                .filter(company=company, id=order_id)
                .first()
            )
            if not order:
                return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

            if order.status != SalesOrder.SalesOrderStatus.COMPLETED:
                return Response(
                    {"detail": "Only completed orders can be returned."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not order.warehouse:
                return Response(
                    {"detail": "Order has no associated warehouse for inventory return."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            items_payload = request.data.get("items")
            return_items_to_process = []

            if items_payload and isinstance(items_payload, list) and len(items_payload) > 0:
                # Specific items return
                for itm in items_payload:
                    order_item_id = itm.get("sales_order_item")
                    product_id = itm.get("product")
                    qty = Decimal(str(itm.get("quantity", "0")))
                    if qty <= Decimal("0.00"):
                        continue

                    order_item = None
                    if order_item_id:
                        order_item = order.items.filter(id=order_item_id).first()
                    elif product_id:
                        order_item = order.items.filter(product_id=product_id).first()

                    if not order_item:
                        return Response(
                            {"detail": f"Item or product not found in order {order.order_number}."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if qty > order_item.quantity:
                        return Response(
                            {"detail": f"Return quantity ({qty}) exceeds ordered quantity ({order_item.quantity}) for {order_item.product.name}."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    return_items_to_process.append((order_item, qty))
            else:
                # Return all items in the order
                for order_item in order.items.all():
                    return_items_to_process.append((order_item, order_item.quantity))

            if not return_items_to_process:
                return Response(
                    {"detail": "No valid items specified for return."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return_number = generate_return_number(company)
            reason = request.data.get("reason", "Customer return").strip()

            sales_return = SalesReturn.objects.create(
                company=company,
                sales_order=order,
                customer=order.customer,
                warehouse=order.warehouse,
                return_number=return_number,
                return_date=timezone.localdate(),
                status=SalesReturn.ReturnStatus.COMPLETED,
                reason=reason,
                total_amount=Decimal("0.00"),
                created_by=request.user,
            )

            total_return_amount = Decimal("0.00")
            for order_item, qty in return_items_to_process:
                line_total = qty * order_item.unit_price
                total_return_amount += line_total

                SalesReturnItem.objects.create(
                    sales_return=sales_return,
                    sales_order_item=order_item,
                    product=order_item.product,
                    quantity=qty,
                    unit_price=order_item.unit_price,
                    line_total=line_total,
                )

                # Atomically restore physical and available stock in the warehouse
                stock, _ = Stock.objects.select_for_update().get_or_create(
                    warehouse=order.warehouse,
                    product=order_item.product,
                    defaults={
                        "quantity": Decimal("0.00"),
                        "reserved_quantity": Decimal("0.00"),
                    },
                )
                stock.quantity += qty
                stock.save(update_fields=["quantity", "updated_at"])

                # Create audit StockTransaction
                StockTransaction.objects.create(
                    company=company,
                    product=order_item.product,
                    warehouse=order.warehouse,
                    transaction_type=StockTransaction.TransactionType.STOCK_IN,
                    quantity=qty,
                    notes=f"Sales Return {return_number} for Order {order.order_number}",
                    created_by=request.user,
                )

            sales_return.total_amount = total_return_amount
            sales_return.save(update_fields=["total_amount", "updated_at"])

            serializer = SalesReturnSerializer(sales_return)
            return Response(serializer.data, status=status.HTTP_201_CREATED)


class SalesOrderReturnListView(SalesBaseView):
    """
    GET: List returns for a specific order.
    """
    def get(self, request, company_id, order_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        order = SalesOrder.objects.filter(company=company, id=order_id).first()
        if not order:
            return Response({"detail": "Sales Order not found."}, status=status.HTTP_404_NOT_FOUND)

        returns = order.returns.select_related("customer", "warehouse", "created_by").prefetch_related("items__product")
        return Response(SalesReturnSerializer(returns, many=True).data)


class SalesReturnListView(SalesBaseView):
    """
    GET: List all sales returns across company with filters.
    """
    def get(self, request, company_id):
        company = self.get_company(request, company_id)
        if not company:
            return Response({"detail": "You do not have access to this company."}, status=status.HTTP_403_FORBIDDEN)

        returns = (
            SalesReturn.objects.filter(company=company)
            .select_related("sales_order", "customer", "warehouse", "created_by")
            .prefetch_related("items__product")
            .order_by("-return_date", "-created_at")
        )

        customer_id = request.query_params.get("customer")
        if customer_id:
            returns = returns.filter(customer_id=customer_id)

        search = request.query_params.get("search")
        if search:
            returns = returns.filter(
                Q(return_number__icontains=search)
                | Q(sales_order__order_number__icontains=search)
                | Q(customer__name__icontains=search)
            )

        return Response(SalesReturnSerializer(returns, many=True).data)


