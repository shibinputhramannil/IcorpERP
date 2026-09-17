from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from company.models import Company


def generate_quotation_number(company):
    """
    Safely generates an incremental quotation number for a company.
    Format: QT-YYYY-XXXXXX (e.g. QT-2026-000001)
    """
    year = timezone.now().year
    prefix = f"QT-{year}-"
    # Find the latest sequence number for this company and year
    last_quote = (
        Quotation.objects.filter(company=company, quotation_number__startswith=prefix)
        .order_by("-quotation_number")
        .first()
    )
    if last_quote:
        try:
            last_seq = int(last_quote.quotation_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = Quotation.objects.filter(company=company).count() + 1
    else:
        new_seq = 1

    return f"{prefix}{new_seq:06d}"


def generate_order_number(company):
    """
    Safely generates an incremental sales order number for a company.
    Format: SO-YYYY-XXXXXX (e.g. SO-2026-000001)
    """
    year = timezone.now().year
    prefix = f"SO-{year}-"
    last_order = (
        SalesOrder.objects.filter(company=company, order_number__startswith=prefix)
        .order_by("-order_number")
        .first()
    )
    if last_order:
        try:
            last_seq = int(last_order.order_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = SalesOrder.objects.filter(company=company).count() + 1
    else:
        new_seq = 1

    return f"{prefix}{new_seq:06d}"


def generate_invoice_number(company):
    """
    Safely generates an incremental invoice number for a company.
    Format: INV-YYYY-XXXXXX (e.g. INV-2026-000001)
    """
    year = timezone.now().year
    prefix = f"INV-{year}-"
    last_inv = (
        Invoice.objects.filter(company=company, invoice_number__startswith=prefix)
        .order_by("-invoice_number")
        .first()
    )
    if last_inv:
        try:
            last_seq = int(last_inv.invoice_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = Invoice.objects.filter(company=company).count() + 1
    else:
        new_seq = 1

    return f"{prefix}{new_seq:06d}"


def generate_payment_number(company):
    """
    Safely generates an incremental payment number for a company.
    Format: PAY-YYYY-XXXXXX (e.g. PAY-2026-000001)
    """
    year = timezone.now().year
    prefix = f"PAY-{year}-"
    last_pay = (
        Payment.objects.filter(company=company, payment_number__startswith=prefix)
        .order_by("-payment_number")
        .first()
    )
    if last_pay:
        try:
            last_seq = int(last_pay.payment_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = Payment.objects.filter(company=company).count() + 1
    else:
        new_seq = 1

    return f"{prefix}{new_seq:06d}"


def generate_receipt_number(company):
    """
    Safely generates an incremental receipt number for a company.
    Format: REC-YYYY-XXXXXX (e.g. REC-2026-000001)
    """
    year = timezone.now().year
    prefix = f"REC-{year}-"
    last_rec = (
        Receipt.objects.filter(company=company, receipt_number__startswith=prefix)
        .order_by("-receipt_number")
        .first()
    )
    if last_rec:
        try:
            last_seq = int(last_rec.receipt_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = Receipt.objects.filter(company=company).count() + 1
    else:
        new_seq = 1

    return f"{prefix}{new_seq:06d}"


def generate_return_number(company):
    """
    Safely generates an incremental return number for a company.
    Format: RET-YYYY-XXXXXX (e.g. RET-2026-000001)
    """
    year = timezone.now().year
    prefix = f"RET-{year}-"
    last_ret = (
        SalesReturn.objects.filter(company=company, return_number__startswith=prefix)
        .order_by("-return_number")
        .first()
    )
    if last_ret:
        try:
            last_seq = int(last_ret.return_number.split("-")[-1])
            new_seq = last_seq + 1
        except (ValueError, IndexError):
            new_seq = SalesReturn.objects.filter(company=company).count() + 1
    else:
        new_seq = 1

    return f"{prefix}{new_seq:06d}"


class Quotation(models.Model):
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
        related_name="quotations",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.CASCADE,
        related_name="quotations",
    )
    quotation_number = models.CharField(max_length=50)
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
        related_name="created_quotations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("company", "quotation_number")]

    def __str__(self):
        return f"{self.quotation_number} - {self.customer.name} ({self.status})"

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


class QuotationItem(models.Model):
    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="quotation_items",
    )
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} x {self.product.name} @ {self.unit_price}"

    def save(self, *args, **kwargs):
        # Enforce line_total calculation on backend
        self.line_total = max(
            Decimal("0.00"),
            (self.quantity * self.unit_price) - self.discount + self.tax,
        )
        super().save(*args, **kwargs)


class SalesOrder(models.Model):
    class SalesOrderStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        CONFIRMED = "CONFIRMED", "Confirmed"
        RESERVED = "RESERVED", "Reserved"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="sales_orders",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.CASCADE,
        related_name="sales_orders",
    )
    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_orders",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_orders",
    )
    order_number = models.CharField(max_length=50)
    order_date = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=20,
        choices=SalesOrderStatus.choices,
        default=SalesOrderStatus.DRAFT,
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
        related_name="created_sales_orders",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("company", "order_number")]

    def __str__(self):
        return f"{self.order_number} - {self.customer.name} ({self.status})"

    def recalculate_totals(self):
        """
        Recalculates subtotal, discount, tax, and total from order items.
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
    def reservation_status(self):
        """
        Aggregates reservation status of the sales order:
        - ACTIVE if any active reservation exists
        - FULFILLED if fulfilled reservations exist and no active ones
        - RELEASED if released reservations exist and no active/fulfilled ones
        - CANCELLED if cancelled reservations exist and no active ones
        - NONE if no reservations exist
        """
        reservations = self.reservations.all()
        if not reservations.exists():
            return "NONE"
        statuses = set(reservations.values_list("status", flat=True))
        if "ACTIVE" in statuses:
            return "ACTIVE"
        if "FULFILLED" in statuses:
            return "FULFILLED"
        if "RELEASED" in statuses:
            return "RELEASED"
        if "CANCELLED" in statuses:
            return "CANCELLED"
        return "NONE"


class SalesOrderItem(models.Model):
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} x {self.product.name} @ {self.unit_price}"

    def save(self, *args, **kwargs):
        # Enforce line_total calculation on backend
        self.line_total = max(
            Decimal("0.00"),
            (self.quantity * self.unit_price) - self.discount + self.tax,
        )
        super().save(*args, **kwargs)

    @property
    def reserved_quantity(self):
        from django.db.models import Sum
        val = self.reservations.filter(status=SalesOrderReservation.ReservationStatus.ACTIVE).aggregate(total=Sum("quantity"))["total"]
        return val or Decimal("0.00")


class SalesOrderReservation(models.Model):
    class ReservationStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        RELEASED = "RELEASED", "Released"
        FULFILLED = "FULFILLED", "Fulfilled"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="sales_reservations",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name="reservations",
    )
    sales_order_item = models.ForeignKey(
        SalesOrderItem,
        on_delete=models.CASCADE,
        related_name="reservations",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="sales_reservations",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        related_name="sales_reservations",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=ReservationStatus.choices,
        default=ReservationStatus.ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reservation {self.id}: {self.quantity} x {self.product.sku} @ {self.warehouse.code} ({self.status})"


class Invoice(models.Model):
    class InvoiceStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid"
        PAID = "PAID", "Paid"
        OVERDUE = "OVERDUE", "Overdue"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="invoices",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="invoices",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    invoice_number = models.CharField(max_length=64)
    invoice_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField()
    status = models.CharField(
        max_length=32,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.ISSUED,
    )
    notes = models.TextField(blank=True, default="")
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
        related_name="created_invoices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-invoice_date", "-created_at"]
        unique_together = [("company", "invoice_number")]

    def __str__(self):
        return f"{self.invoice_number} - {self.customer.name} ({self.status})"

    def recalculate_totals(self):
        """
        Recalculates subtotal, discount, tax, total, and balance_due from invoice items.
        """
        items = self.items.all()
        if items.exists():
            subtotal = sum((item.quantity * item.unit_price for item in items), Decimal("0.00"))
            discount = sum((item.discount for item in items), Decimal("0.00"))
            tax = sum((item.tax for item in items), Decimal("0.00"))
            total = sum((item.line_total for item in items), Decimal("0.00"))

            self.subtotal = subtotal
            self.discount = discount
            self.tax = tax
            self.total = total
        self.balance_due = max(Decimal("0.00"), self.total - self.amount_paid)

    @property
    def is_overdue(self):
        if self.status in [self.InvoiceStatus.PAID, self.InvoiceStatus.CANCELLED, self.InvoiceStatus.DRAFT]:
            return False
        if self.due_date:
            due = self.due_date
            if isinstance(due, str):
                from datetime import date
                try:
                    due = date.fromisoformat(due)
                except (ValueError, TypeError):
                    due = None
            if due and due < timezone.localdate() and self.balance_due > Decimal("0.00"):
                return True
        return False

    @property
    def effective_status(self):
        """
        Returns dynamic status: if ISSUED or PARTIALLY_PAID and due_date has passed with balance > 0, returns OVERDUE.
        """
        if self.status in [self.InvoiceStatus.ISSUED, self.InvoiceStatus.PARTIALLY_PAID] and self.is_overdue:
            return self.InvoiceStatus.OVERDUE
        return self.status


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="invoice_items",
    )
    description = models.CharField(max_length=255, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} x {self.product.name} @ {self.unit_price}"

    def save(self, *args, **kwargs):
        # Enforce line_total calculation on backend
        self.line_total = max(
            Decimal("0.00"),
            (self.quantity * self.unit_price) - self.discount + self.tax,
        )
        super().save(*args, **kwargs)


class Payment(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"
        CARD = "CARD", "Credit/Debit Card"
        UPI = "UPI", "UPI"
        CHEQUE = "CHEQUE", "Cheque"
        OTHER = "OTHER", "Other"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="sales_payments",
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="sales_payments",
    )
    payment_number = models.CharField(max_length=64)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField(default=timezone.localdate)
    payment_method = models.CharField(
        max_length=32,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK_TRANSFER,
    )
    reference = models.CharField(max_length=128, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    received_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-created_at"]
        unique_together = [("company", "payment_number")]

    def __str__(self):
        return f"{self.payment_number} - {self.amount} for {self.invoice.invoice_number}"


class Receipt(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="sales_receipts",
    )
    payment = models.OneToOneField(
        Payment,
        on_delete=models.CASCADE,
        related_name="receipt",
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="sales_receipts",
    )
    receipt_number = models.CharField(max_length=64)
    receipt_date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_receipts",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-receipt_date", "-created_at"]
        unique_together = [("company", "receipt_number")]

    def __str__(self):
        return f"{self.receipt_number} - {self.amount} ({self.customer.name})"


class SalesReturn(models.Model):
    class ReturnStatus(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="sales_returns",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="returns",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.PROTECT,
        related_name="sales_returns",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        related_name="sales_returns",
    )
    return_number = models.CharField(max_length=64)
    return_date = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=32,
        choices=ReturnStatus.choices,
        default=ReturnStatus.COMPLETED,
    )
    reason = models.TextField(blank=True, default="")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_sales_returns",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-return_date", "-created_at"]
        unique_together = [("company", "return_number")]

    def __str__(self):
        return f"{self.return_number} - {self.sales_order.order_number} ({self.customer.name})"


class SalesReturnItem(models.Model):
    sales_return = models.ForeignKey(
        SalesReturn,
        on_delete=models.CASCADE,
        related_name="items",
    )
    sales_order_item = models.ForeignKey(
        SalesOrderItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="return_items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="sales_return_items",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} x {self.product.name} (Return {self.sales_return.return_number})"

    def save(self, *args, **kwargs):
        self.line_total = max(Decimal("0.00"), self.quantity * self.unit_price)
        super().save(*args, **kwargs)



