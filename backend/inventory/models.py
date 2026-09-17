from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from company.models import Company


class Category(models.Model):
    """
    Company-scoped categorization for inventory products and items.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="inventory_categories",
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("company", "name")]
        verbose_name_plural = "Categories"

    def __str__(self):
        return f"{self.name} ({self.company.name})"


class Product(models.Model):
    """
    Inventory product / stock-keeping unit (SKU) item.
    Scoped strictly to a Company.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="inventory_products",
    )
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=100)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    unit = models.CharField(max_length=50, default="pcs")
    description = models.TextField(blank=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    reorder_level = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("company", "sku")]

    def __str__(self):
        return f"{self.name} [{self.sku}]"

    @property
    def total_stock(self):
        result = self.stocks.aggregate(total=models.Sum("quantity"))["total"]
        return result or Decimal("0.00")

    @property
    def total_available_stock(self):
        stocks = self.stocks.all()
        return sum((s.available_quantity for s in stocks), Decimal("0.00"))


class Warehouse(models.Model):
    """
    Storage location / warehouse facility strictly scoped to a Company.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="inventory_warehouses",
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("company", "code")]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Stock(models.Model):
    """
    Tracks inventory stock count for a specific Product in a specific Warehouse.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="stocks",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="stocks",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    reserved_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    reorder_level = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product", "warehouse"]
        unique_together = [("product", "warehouse")]

    def __str__(self):
        return f"{self.product.name} @ {self.warehouse.code}: {self.quantity}"

    @property
    def available_quantity(self):
        return max(Decimal("0.00"), self.quantity - self.reserved_quantity)

    @property
    def is_low_stock(self):
        return self.quantity <= Decimal(str(self.reorder_level))


class StockTransaction(models.Model):
    """
    Immutable inventory transaction ledger.
    Every change to stock (in, out, adjustment, transfer) writes an audit record here.
    """
    class TransactionType(models.TextChoices):
        STOCK_IN = "STOCK_IN", "Stock In"
        STOCK_OUT = "STOCK_OUT", "Stock Out"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        TRANSFER = "TRANSFER", "Transfer"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="inventory_transactions",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="stock_transactions",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="outgoing_transactions",
    )
    destination_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incoming_transactions",
    )
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.transaction_type}] {self.quantity} x {self.product.sku} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class Vendor(models.Model):
    """
    Supplier / Vendor registry scoped strictly to a Company.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="inventory_vendors",
    )
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    tax_id = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.company.name})"
