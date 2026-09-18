from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from company.models import Company


def generate_purchase_quotation_number(company=None):
    """
    Generates a unique incremental purchase quotation number.
    Format: PQT-YYYY-###### (e.g. PQT-2026-000001)
    """
    year = timezone.now().year
    prefix = f"PQT-{year}-"
    last_quote = (
        PurchaseQuotation.objects.filter(quotation_number__startswith=prefix)
        .order_by("-quotation_number")
        .first()
    )
    if last_quote:
        try:
            last_seq = int(last_quote.quotation_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = PurchaseQuotation.objects.count() + 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:06d}"
    while PurchaseQuotation.objects.filter(quotation_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:06d}"
    return candidate


def generate_purchase_order_number(company=None):
    """
    Generates a unique incremental purchase order number.
    Format: PO-YYYY-###### (e.g. PO-2026-000001)
    """
    year = timezone.now().year
    prefix = f"PO-{year}-"
    last_order = (
        PurchaseOrder.objects.filter(order_number__startswith=prefix)
        .order_by("-order_number")
        .first()
    )
    if last_order:
        try:
            last_seq = int(last_order.order_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = PurchaseOrder.objects.count() + 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:06d}"
    while PurchaseOrder.objects.filter(order_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:06d}"
    return candidate


def generate_purchase_receipt_number(company=None):
    """
    Generates a unique incremental purchase receipt number (Goods Received Note).
    Format: GRN-YYYY-###### (e.g. GRN-2026-000001)
    """
    year = timezone.now().year
    prefix = f"GRN-{year}-"
    last_receipt = (
        PurchaseReceipt.objects.filter(receipt_number__startswith=prefix)
        .order_by("-receipt_number")
        .first()
    )
    if last_receipt:
        try:
            last_seq = int(last_receipt.receipt_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = PurchaseReceipt.objects.count() + 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:06d}"
    while PurchaseReceipt.objects.filter(receipt_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:06d}"
    return candidate


def generate_purchase_invoice_number(company=None):
    """
    Generates a unique incremental purchase invoice (vendor bill) number.
    Format: PINV-YYYY-###### (e.g. PINV-2026-000001)
    """
    year = timezone.now().year
    prefix = f"PINV-{year}-"
    last_inv = (
        PurchaseInvoice.objects.filter(invoice_number__startswith=prefix)
        .order_by("-invoice_number")
        .first()
    )
    if last_inv:
        try:
            last_seq = int(last_inv.invoice_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = PurchaseInvoice.objects.count() + 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:06d}"
    while PurchaseInvoice.objects.filter(invoice_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:06d}"
    return candidate


def generate_purchase_payment_number(company=None):
    """
    Generates a unique incremental purchase payment number.
    Format: PPAY-YYYY-###### (e.g. PPAY-2026-000001)
    """
    year = timezone.now().year
    prefix = f"PPAY-{year}-"
    last_pay = (
        PurchasePayment.objects.filter(payment_number__startswith=prefix)
        .order_by("-payment_number")
        .first()
    )
    if last_pay:
        try:
            last_seq = int(last_pay.payment_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = PurchasePayment.objects.count() + 1
    else:
        new_seq = 1

    candidate = f"{prefix}{new_seq:06d}"
    while PurchasePayment.objects.filter(payment_number=candidate).exists():
        new_seq += 1
        candidate = f"{prefix}{new_seq:06d}"
    return candidate


class PurchaseQuotation(models.Model):
    class QuotationStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SENT = "SENT", "Sent"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        EXPIRED = "EXPIRED", "Expired"
        CONVERTED = "CONVERTED", "Converted"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="purchase_quotations",
    )
    vendor = models.ForeignKey(
        "inventory.Vendor",
        on_delete=models.CASCADE,
        related_name="purchase_quotations",
    )
    quotation_number = models.CharField(max_length=50, unique=True)
    quotation_date = models.DateField(default=timezone.localdate)
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=QuotationStatus.choices,
        default=QuotationStatus.DRAFT,
    )
    notes = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_purchase_quotations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Purchase Quotation"
        verbose_name_plural = "Purchase Quotations"

    def __str__(self):
        return f"{self.quotation_number} - {self.vendor.name} ({self.status})"

    def recalculate_totals(self):
        """
        Recalculates subtotal, discount, tax, and total from items.
        """
        items = self.items.all()
        subtotal = sum((item.quantity * item.unit_price for item in items), Decimal("0.00"))
        discount = sum((item.discount for item in items), Decimal("0.00"))
        tax = sum((item.tax for item in items), Decimal("0.00"))
        total = sum((item.line_total for item in items), Decimal("0.00"))

        self.subtotal = subtotal
        self.discount = discount
        self.tax = tax
        self.total = total


class PurchaseQuotationItem(models.Model):
    quotation = models.ForeignKey(
        PurchaseQuotation,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="purchase_quotation_items",
    )
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]
        verbose_name = "Purchase Quotation Item"
        verbose_name_plural = "Purchase Quotation Items"

    def __str__(self):
        return f"{self.quantity} x {self.product.name} @ {self.unit_price}"

    def save(self, *args, **kwargs):
        # Backend-enforced line_total calculation
        self.line_total = max(
            Decimal("0.00"),
            (self.quantity * self.unit_price) - self.discount + self.tax,
        )
        super().save(*args, **kwargs)


class PurchaseOrder(models.Model):
    class PurchaseOrderStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        CONFIRMED = "CONFIRMED", "Confirmed"
        PROCESSING = "PROCESSING", "Processing"
        PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED", "Partially Received"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="purchase_orders",
    )
    vendor = models.ForeignKey(
        "inventory.Vendor",
        on_delete=models.CASCADE,
        related_name="purchase_orders",
    )
    quotation = models.ForeignKey(
        PurchaseQuotation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    order_number = models.CharField(max_length=50, unique=True)
    order_date = models.DateField(default=timezone.localdate)
    expected_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=25,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.CONFIRMED,
    )
    notes = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_purchase_orders",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Purchase Order"
        verbose_name_plural = "Purchase Orders"

    def __str__(self):
        return f"{self.order_number} - {self.vendor.name} ({self.status})"

    def recalculate_totals(self):
        """
        Recalculates subtotal, discount, tax, and total from items.
        """
        items = self.items.all()
        subtotal = sum((item.quantity * item.unit_price for item in items), Decimal("0.00"))
        discount = sum((item.discount for item in items), Decimal("0.00"))
        tax = sum((item.tax for item in items), Decimal("0.00"))
        total = sum((item.line_total for item in items), Decimal("0.00"))

        self.subtotal = subtotal
        self.discount = discount
        self.tax = tax
        self.total = total

    @property
    def total_ordered_quantity(self):
        return sum((item.quantity for item in self.items.all()), Decimal("0.00"))

    @property
    def total_received_quantity(self):
        return sum((item.received_quantity for item in self.items.all()), Decimal("0.00"))

    @property
    def total_remaining_quantity(self):
        return sum((item.remaining_quantity for item in self.items.all()), Decimal("0.00"))

    @property
    def receiving_percentage(self):
        ordered = self.total_ordered_quantity
        if ordered <= Decimal("0.00"):
            return Decimal("0.00")
        received = self.total_received_quantity
        pct = (received / ordered) * Decimal("100.00")
        return min(Decimal("100.00"), round(pct, 2))

    @property
    def total_invoiced_amount(self):
        active_invoices = self.invoices.exclude(status="CANCELLED")
        return sum((inv.total for inv in active_invoices), Decimal("0.00"))

    @property
    def paid_amount(self):
        active_invoices = self.invoices.exclude(status="CANCELLED")
        return sum((inv.amount_paid for inv in active_invoices), Decimal("0.00"))

    @property
    def outstanding_amount(self):
        active_invoices = self.invoices.exclude(status="CANCELLED")
        return sum((inv.balance_due for inv in active_invoices), Decimal("0.00"))

    @property
    def payment_status(self):
        active_invoices = self.invoices.exclude(status="CANCELLED")
        if not active_invoices.exists():
            return "UNINVOICED"
        invoiced = self.total_invoiced_amount
        paid = self.paid_amount
        if paid >= invoiced and invoiced > Decimal("0.00"):
            return "PAID"
        elif paid > Decimal("0.00"):
            return "PARTIALLY_PAID"
        return "UNPAID"

    def update_receiving_status(self):
        """
        Updates order status based on item receipt fulfillment:
        - If all remaining quantities are 0 -> COMPLETED
        - If any item has received > 0 but not all fulfilled -> PARTIALLY_RECEIVED
        - If none received and current status is CONFIRMED -> leaves as CONFIRMED
        """
        if self.status in [self.PurchaseOrderStatus.CANCELLED, self.PurchaseOrderStatus.DRAFT]:
            return self.status

        items = list(self.items.all())
        if not items:
            return self.status

        all_completed = all(item.remaining_quantity == Decimal("0.00") for item in items)
        any_received = any(item.received_quantity > Decimal("0.00") for item in items)

        if all_completed:
            new_status = self.PurchaseOrderStatus.COMPLETED
        elif any_received:
            new_status = self.PurchaseOrderStatus.PARTIALLY_RECEIVED
        else:
            new_status = self.status

        if self.status != new_status:
            self.status = new_status
            self.save(update_fields=["status", "updated_at"])
        return self.status


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="purchase_order_items",
    )
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]
        verbose_name = "Purchase Order Item"
        verbose_name_plural = "Purchase Order Items"

    def __str__(self):
        return f"{self.quantity} x {self.product.name} @ {self.unit_price}"

    def save(self, *args, **kwargs):
        # Backend-enforced line_total calculation
        self.line_total = max(
            Decimal("0.00"),
            (self.quantity * self.unit_price) - self.discount + self.tax,
        )
        super().save(*args, **kwargs)

    @property
    def received_quantity(self):
        total = self.receipt_items.filter(
            receipt__status="RECEIVED"
        ).aggregate(total=models.Sum("received_quantity"))["total"]
        return total or Decimal("0.00")

    @property
    def remaining_quantity(self):
        return max(Decimal("0.00"), self.quantity - self.received_quantity)


class PurchaseReceipt(models.Model):
    class ReceiptStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        RECEIVED = "RECEIVED", "Received"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="purchase_receipts",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    receipt_number = models.CharField(max_length=50, unique=True)
    receipt_date = models.DateField(default=timezone.localdate)
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        related_name="purchase_receipts",
    )
    status = models.CharField(
        max_length=20,
        choices=ReceiptStatus.choices,
        default=ReceiptStatus.RECEIVED,
    )
    notes = models.TextField(blank=True)
    received_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_purchase_receipts",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Purchase Receipt"
        verbose_name_plural = "Purchase Receipts"

    def __str__(self):
        return f"{self.receipt_number} - PO {self.purchase_order.order_number} ({self.status})"

    @property
    def total_quantity(self):
        return sum((item.received_quantity for item in self.items.all()), Decimal("0.00"))


class PurchaseReceiptItem(models.Model):
    receipt = models.ForeignKey(
        PurchaseReceipt,
        on_delete=models.CASCADE,
        related_name="items",
    )
    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name="receipt_items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="purchase_receipt_items",
    )
    ordered_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    previously_received_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    received_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "Purchase Receipt Item"
        verbose_name_plural = "Purchase Receipt Items"

    def __str__(self):
        return f"{self.receipt.receipt_number}: {self.received_quantity} x {self.product.name}"


# ============================================================
# 4. PURCHASE INVOICE & PAYMENT MODELS (FINANCIAL INTEGRATION)
# ============================================================

class PurchaseInvoice(models.Model):
    class InvoiceStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="purchase_invoices",
    )
    vendor = models.ForeignKey(
        "inventory.Vendor",
        on_delete=models.PROTECT,
        related_name="purchase_invoices",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    invoice_number = models.CharField(max_length=50, unique=True)
    vendor_invoice_number = models.CharField(max_length=100, blank=True, default="")
    invoice_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.ISSUED,
    )
    notes = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    balance_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_purchase_invoices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Purchase Invoice"
        verbose_name_plural = "Purchase Invoices"

    def __str__(self):
        return f"{self.invoice_number} - {self.vendor.name} ({self.status})"

    @property
    def paid_amount(self):
        return self.amount_paid

    @paid_amount.setter
    def paid_amount(self, value):
        self.amount_paid = value

    def recalculate_totals(self):
        """
        Recalculates subtotal, discount, tax, total, and balance due from items and payments.
        """
        if self.items.exists():
            items = self.items.all()
            subtotal = sum((item.quantity * item.unit_price for item in items), Decimal("0.00"))
            discount = sum((item.discount for item in items), Decimal("0.00"))
            tax = sum((item.tax for item in items), Decimal("0.00"))
            total = sum((item.line_total for item in items), Decimal("0.00"))

            self.subtotal = subtotal
            self.discount = discount
            self.tax = tax
            self.total = total

        # Recalculate amount paid from active payments
        paid = self.payments.aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")
        self.amount_paid = paid
        self.balance_due = max(Decimal("0.00"), self.total - self.amount_paid)

        # Update status if not cancelled
        if self.status != self.InvoiceStatus.CANCELLED:
            if self.total > Decimal("0.00") and self.balance_due == Decimal("0.00"):
                self.status = self.InvoiceStatus.PAID
            elif self.amount_paid > Decimal("0.00"):
                self.status = self.InvoiceStatus.PARTIALLY_PAID
            elif self.status not in [self.InvoiceStatus.DRAFT]:
                self.status = self.InvoiceStatus.ISSUED


class PurchaseInvoiceItem(models.Model):
    invoice = models.ForeignKey(
        PurchaseInvoice,
        on_delete=models.CASCADE,
        related_name="items",
    )
    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="purchase_invoice_items",
    )
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]
        verbose_name = "Purchase Invoice Item"
        verbose_name_plural = "Purchase Invoice Items"

    def __str__(self):
        return f"{self.quantity} x {self.product.name} @ {self.unit_price}"

    def save(self, *args, **kwargs):
        self.line_total = max(
            Decimal("0.00"),
            (self.quantity * self.unit_price) - self.discount + self.tax,
        )
        super().save(*args, **kwargs)


class PurchasePayment(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"
        CHEQUE = "CHEQUE", "Cheque"
        CREDIT_CARD = "CREDIT_CARD", "Credit Card"
        OTHER = "OTHER", "Other"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="purchase_payments",
    )
    vendor = models.ForeignKey(
        "inventory.Vendor",
        on_delete=models.PROTECT,
        related_name="purchase_payments",
    )
    invoice = models.ForeignKey(
        PurchaseInvoice,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    payment_number = models.CharField(max_length=50, unique=True)
    payment_date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK_TRANSFER,
    )
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_purchase_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Purchase Payment"
        verbose_name_plural = "Purchase Payments"

    def __str__(self):
        return f"{self.payment_number} - {self.vendor.name} ({self.amount})"
