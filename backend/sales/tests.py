from decimal import Decimal
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from crm.models import Customer
from inventory.models import Category, Product, Warehouse, Stock, StockTransaction
from sales.models import (
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
    generate_quotation_number,
    generate_order_number,
    generate_invoice_number,
    generate_payment_number,
    generate_receipt_number,
    generate_return_number,
)


class SalesFoundationTests(APITestCase):
    def setUp(self):
        # 1. User roles
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")

        # 2. Users
        self.user1 = User.objects.create_user(
            username="sales_admin1", email="sales1@corp1.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            username="sales_admin2", email="sales2@corp2.com", password="password123"
        )

        # 3. Companies
        self.comp1 = Company.objects.create(name="Alpha Corp", email="contact@alphacorp.com", is_active=True)
        self.comp2 = Company.objects.create(name="Beta Industries", email="info@betaindustries.com", is_active=True)

        # 4. Memberships
        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        # 5. Base Data for Comp1
        self.cust1 = Customer.objects.create(
            company=self.comp1, name="Acme Global", email="contact@acme.com", phone="1234567890"
        )
        self.cat1 = Category.objects.create(company=self.comp1, name="Hardware")
        self.prod1 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Server Rack 42U",
            sku="SR-42U",
            unit="unit",
            cost_price=Decimal("400.00"),
            selling_price=Decimal("750.00"),
            tax=Decimal("10.00"),
            is_active=True,
        )
        self.prod2 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Fiber Patch Cable 5m",
            sku="FPC-05M",
            unit="pcs",
            cost_price=Decimal("5.00"),
            selling_price=Decimal("15.00"),
            tax=Decimal("0.00"),
            is_active=True,
        )
        self.prod_inactive = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Legacy Switch",
            sku="LS-100",
            unit="pcs",
            cost_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
            is_active=False,
        )

        # 6. Base Data for Comp2 (Tenant Isolation checks)
        self.cust2 = Customer.objects.create(
            company=self.comp2, name="Zeta Corp", email="info@zeta.com"
        )
        self.cat2 = Category.objects.create(company=self.comp2, name="Software")
        self.prod_comp2 = Product.objects.create(
            company=self.comp2,
            category=self.cat2,
            name="Cloud Suite License",
            sku="CSL-01",
            cost_price=Decimal("100.00"),
            selling_price=Decimal("200.00"),
            is_active=True,
        )

    # ------------------------------------------------------------
    # 1 & 2: Unauthenticated rejection
    # ------------------------------------------------------------
    def test_unauthenticated_quotations_rejected(self):
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_orders_rejected(self):
        url = f"/api/companies/{self.comp1.id}/sales/orders/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # ------------------------------------------------------------
    # 3 & 4: Tenant isolation
    # ------------------------------------------------------------
    def test_tenant_isolation_view_quotations(self):
        self.client.force_authenticate(user=self.user2)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_isolation_view_orders(self):
        self.client.force_authenticate(user=self.user2)
        url = f"/api/companies/{self.comp1.id}/sales/orders/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------
    # 5: Customer belongs to company validation
    # ------------------------------------------------------------
    def test_customer_belongs_to_company_validation(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        payload = {
            "customer": self.cust2.id,  # cust2 belongs to comp2!
            "notes": "Invalid quotation with Comp2 customer",
            "items": [
                {
                    "product": self.prod1.id,
                    "quantity": "1.00",
                    "unit_price": "750.00",
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("customer", res.data)

    # ------------------------------------------------------------
    # 6: Product belongs to company validation
    # ------------------------------------------------------------
    def test_product_belongs_to_company_validation(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        payload = {
            "customer": self.cust1.id,
            "notes": "Cross-company product",
            "items": [
                {
                    "product": self.prod_comp2.id,  # belongs to comp2!
                    "quantity": "2.00",
                    "unit_price": "200.00",
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", res.data)

    # ------------------------------------------------------------
    # 7: Product inactive validation
    # ------------------------------------------------------------
    def test_product_inactive_validation(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        payload = {
            "customer": self.cust1.id,
            "items": [
                {
                    "product": self.prod_inactive.id,
                    "quantity": "1.00",
                    "unit_price": "20.00",
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", res.data)

    # ------------------------------------------------------------
    # 8 & 9: Quantity and unit price validation
    # ------------------------------------------------------------
    def test_item_quantity_validation(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        payload = {
            "customer": self.cust1.id,
            "items": [
                {
                    "product": self.prod1.id,
                    "quantity": "0.00",  # Invalid
                    "unit_price": "750.00",
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_item_unit_price_validation(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        payload = {
            "customer": self.cust1.id,
            "items": [
                {
                    "product": self.prod1.id,
                    "quantity": "2.00",
                    "unit_price": "-10.00",  # Invalid
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------
    # 10: Backend financial calculation
    # ------------------------------------------------------------
    def test_backend_financial_calculations(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        # Item: 3 units @ 100.00 = 300.00 subtotal, discount = 20.00, tax = 15.00 -> line_total = 295.00
        payload = {
            "customer": self.cust1.id,
            "items": [
                {
                    "product": self.prod1.id,
                    "quantity": "3.00",
                    "unit_price": "100.00",
                    "discount": "20.00",
                    "tax": "15.00",
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data
        self.assertEqual(Decimal(data["subtotal"]), Decimal("300.00"))
        self.assertEqual(Decimal(data["discount"]), Decimal("20.00"))
        self.assertEqual(Decimal(data["tax"]), Decimal("15.00"))
        self.assertEqual(Decimal(data["total"]), Decimal("295.00"))

        item = data["items"][0]
        self.assertEqual(Decimal(item["line_total"]), Decimal("295.00"))

    # ------------------------------------------------------------
    # 11: Create Quotation with multiple items
    # ------------------------------------------------------------
    def test_quotation_create_with_multiple_items(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/quotations/"
        payload = {
            "customer": self.cust1.id,
            "valid_until": "2026-12-31",
            "notes": "Bulk server racks & cables",
            "items": [
                {
                    "product": self.prod1.id,
                    "description": "Server Rack in Gray",
                    "quantity": "2.00",
                    "unit_price": "750.00",
                    "discount": "50.00",
                    "tax": "70.00",
                },
                {
                    "product": self.prod2.id,
                    "description": "High speed fiber",
                    "quantity": "10.00",
                    "unit_price": "15.00",
                    "discount": "0.00",
                    "tax": "15.00",
                },
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data

        # Subtotal: 2*750 + 10*15 = 1500 + 150 = 1650.00
        # Discount: 50.00
        # Tax: 70.00 + 15.00 = 85.00
        # Total: (1500 - 50 + 70) + (150 - 0 + 15) = 1520 + 165 = 1685.00
        self.assertEqual(Decimal(data["subtotal"]), Decimal("1650.00"))
        self.assertEqual(Decimal(data["discount"]), Decimal("50.00"))
        self.assertEqual(Decimal(data["tax"]), Decimal("85.00"))
        self.assertEqual(Decimal(data["total"]), Decimal("1685.00"))
        self.assertEqual(len(data["items"]), 2)
        self.assertTrue(data["quotation_number"].startswith("QT-"))

    # ------------------------------------------------------------
    # 12: Quotation update
    # ------------------------------------------------------------
    def test_quotation_status_update(self):
        self.client.force_authenticate(user=self.user1)
        quote = Quotation.objects.create(
            company=self.comp1,
            customer=self.cust1,
            quotation_number=generate_quotation_number(self.comp1),
            status=Quotation.QuotationStatus.DRAFT,
        )
        url = f"/api/companies/{self.comp1.id}/sales/quotations/{quote.id}/"
        res = self.client.patch(url, {"status": "ACCEPTED", "notes": "Customer agreed over phone"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "ACCEPTED")
        self.assertEqual(res.data["notes"], "Customer agreed over phone")

    # ------------------------------------------------------------
    # 13: Atomic conversion of Quotation to Sales Order
    # ------------------------------------------------------------
    def test_atomic_quotation_conversion(self):
        self.client.force_authenticate(user=self.user1)
        quote = Quotation.objects.create(
            company=self.comp1,
            customer=self.cust1,
            quotation_number=generate_quotation_number(self.comp1),
            status=Quotation.QuotationStatus.ACCEPTED,
            notes="Ready to fulfill",
        )
        QuotationItem.objects.create(
            quotation=quote,
            product=self.prod1,
            quantity=Decimal("2.00"),
            unit_price=Decimal("750.00"),
            discount=Decimal("0.00"),
            tax=Decimal("50.00"),
        )
        quote.recalculate_totals()
        quote.save()

        convert_url = f"/api/companies/{self.comp1.id}/sales/quotations/{quote.id}/convert/"
        res = self.client.post(convert_url)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_data = res.data

        # Verify created SalesOrder
        self.assertTrue(order_data["order_number"].startswith("SO-"))
        self.assertEqual(order_data["status"], "CONFIRMED")
        self.assertEqual(order_data["quotation"], quote.id)
        self.assertEqual(Decimal(order_data["total"]), quote.total)
        self.assertEqual(len(order_data["items"]), 1)

        # Verify quotation status is now CONVERTED
        quote.refresh_from_db()
        self.assertEqual(quote.status, Quotation.QuotationStatus.CONVERTED)

    # ------------------------------------------------------------
    # 14: Duplicate quotation conversion prevention
    # ------------------------------------------------------------
    def test_duplicate_quotation_conversion_prevented(self):
        self.client.force_authenticate(user=self.user1)
        quote = Quotation.objects.create(
            company=self.comp1,
            customer=self.cust1,
            quotation_number=generate_quotation_number(self.comp1),
            status=Quotation.QuotationStatus.CONVERTED,  # already converted
        )
        QuotationItem.objects.create(
            quotation=quote,
            product=self.prod1,
            quantity=Decimal("1.00"),
            unit_price=Decimal("750.00"),
        )
        convert_url = f"/api/companies/{self.comp1.id}/sales/quotations/{quote.id}/convert/"
        res = self.client.post(convert_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been converted", res.data["detail"])

    # ------------------------------------------------------------
    # 15: Empty quotation conversion prevention
    # ------------------------------------------------------------
    def test_empty_quotation_conversion_prevented(self):
        self.client.force_authenticate(user=self.user1)
        quote = Quotation.objects.create(
            company=self.comp1,
            customer=self.cust1,
            quotation_number=generate_quotation_number(self.comp1),
            status=Quotation.QuotationStatus.ACCEPTED,
        )
        # 0 items
        convert_url = f"/api/companies/{self.comp1.id}/sales/quotations/{quote.id}/convert/"
        res = self.client.post(convert_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no line items", res.data["detail"])

    # ------------------------------------------------------------
    # 16: Sequential numbering generation
    # ------------------------------------------------------------
    def test_number_generation_sequence(self):
        q1 = generate_quotation_number(self.comp1)
        Quotation.objects.create(
            company=self.comp1,
            customer=self.cust1,
            quotation_number=q1,
        )
        q2 = generate_quotation_number(self.comp1)
        self.assertNotEqual(q1, q2)

        year = timezone.now().year
        self.assertEqual(q1, f"QT-{year}-000001")
        self.assertEqual(q2, f"QT-{year}-000002")

        # Check SalesOrder number generation
        o1 = generate_order_number(self.comp1)
        SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            order_number=o1,
        )
        o2 = generate_order_number(self.comp1)
        self.assertEqual(o1, f"SO-{year}-000001")
        self.assertEqual(o2, f"SO-{year}-000002")

    # ------------------------------------------------------------
    # 17: Sales Order CRUD and status transitions
    # ------------------------------------------------------------
    def test_sales_order_crud_and_lifecycle(self):
        self.client.force_authenticate(user=self.user1)
        url = f"/api/companies/{self.comp1.id}/sales/orders/"

        # 1. Create direct order
        payload = {
            "customer": self.cust1.id,
            "status": "DRAFT",
            "notes": "Direct order without quotation",
            "items": [
                {
                    "product": self.prod2.id,
                    "quantity": "20.00",
                    "unit_price": "15.00",
                    "discount": "0.00",
                    "tax": "0.00",
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data["id"]
        self.assertEqual(Decimal(res.data["total"]), Decimal("300.00"))

        # 2. Detail view
        detail_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/"
        res = self.client.get(detail_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["order_number"], res.data["order_number"])

        # 3. Transition status to PROCESSING then COMPLETED
        res = self.client.patch(detail_url, {"status": "PROCESSING"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "PROCESSING")

        res = self.client.patch(detail_url, {"status": "COMPLETED"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "COMPLETED")

    # ------------------------------------------------------------
    # 18: Sales Dashboard KPI metrics
    # ------------------------------------------------------------
    def test_sales_dashboard_metrics(self):
        self.client.force_authenticate(user=self.user1)

        # Create 1 draft quotation, 1 converted quotation
        quote1 = Quotation.objects.create(
            company=self.comp1,
            customer=self.cust1,
            quotation_number=generate_quotation_number(self.comp1),
            status=Quotation.QuotationStatus.DRAFT,
            total=Decimal("500.00"),
        )
        quote2 = Quotation.objects.create(
            company=self.comp1,
            customer=self.cust1,
            quotation_number=generate_quotation_number(self.comp1),
            status=Quotation.QuotationStatus.CONVERTED,
            total=Decimal("1500.00"),
        )

        # Create 1 confirmed order, 1 completed order
        order1 = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.CONFIRMED,
            total=Decimal("1500.00"),
        )
        order2 = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.COMPLETED,
            total=Decimal("2000.00"),
        )

        dash_url = f"/api/companies/{self.comp1.id}/sales/dashboard/"
        res = self.client.get(dash_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        summary = res.data["summary"]

        self.assertEqual(summary["total_quotations"], 2)
        self.assertEqual(summary["pending_quotations"], 1)
        self.assertEqual(summary["converted_quotations"], 1)
        self.assertEqual(summary["conversion_rate_percentage"], 50.0)

        self.assertEqual(summary["total_orders"], 2)
        self.assertEqual(Decimal(summary["total_sales_value"]), Decimal("3500.00"))
        self.assertEqual(summary["confirmed_orders"], 1)
        self.assertEqual(summary["completed_orders"], 1)

        self.assertEqual(len(res.data["recent_quotations"]), 2)
        self.assertEqual(len(res.data["recent_orders"]), 2)
        self.assertGreaterEqual(len(res.data["top_customers"]), 1)


class SalesInventoryReservationTests(APITestCase):
    def setUp(self):
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")

        self.user1 = User.objects.create_user(
            username="res_admin1", email="res1@alpha.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            username="res_admin2", email="res2@beta.com", password="password123"
        )

        self.comp1 = Company.objects.create(name="Alpha Logistics", email="info@alphalogistics.com", is_active=True)
        self.comp2 = Company.objects.create(name="Beta Distribution", email="info@betadistribution.com", is_active=True)

        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        self.cust1 = Customer.objects.create(
            company=self.comp1, name="Acme Aerospace", email="procurement@acme.com"
        )
        self.cat1 = Category.objects.create(company=self.comp1, name="Avionics")

        self.prod1 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Flight Computer Core",
            sku="FCC-100",
            unit="pcs",
            cost_price=Decimal("500.00"),
            selling_price=Decimal("1000.00"),
            is_active=True,
        )
        self.prod2 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Pitot Tube Sensor",
            sku="PTS-02",
            unit="pcs",
            cost_price=Decimal("50.00"),
            selling_price=Decimal("120.00"),
            is_active=True,
        )
        self.prod_inactive = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Obsolete Altimeter",
            sku="OA-01",
            unit="pcs",
            is_active=False,
        )

        # Warehouses for Comp1
        self.wh1 = Warehouse.objects.create(
            company=self.comp1, name="Alpha Central Hub", code="WH-ALPHA-MAIN", is_active=True
        )
        self.wh_inactive = Warehouse.objects.create(
            company=self.comp1, name="Decommissioned Depot", code="WH-DECOM", is_active=False
        )

        # Warehouse for Comp2 (Tenant Isolation)
        self.wh_comp2 = Warehouse.objects.create(
            company=self.comp2, name="Beta Warehouse", code="WH-BETA-MAIN", is_active=True
        )

        # Initial Stock in wh1:
        # prod1: 50.00 total, 0 reserved -> 50.00 available
        self.stock1 = Stock.objects.create(
            product=self.prod1, warehouse=self.wh1, quantity=Decimal("50.00"), reserved_quantity=Decimal("0.00")
        )
        # prod2: 10.00 total, 0 reserved -> 10.00 available
        self.stock2 = Stock.objects.create(
            product=self.prod2, warehouse=self.wh1, quantity=Decimal("10.00"), reserved_quantity=Decimal("0.00")
        )

        self.client.force_authenticate(user=self.user1)

    def _create_order(self, items_payload):
        url = f"/api/companies/{self.comp1.id}/sales/orders/"
        payload = {
            "customer": self.cust1.id,
            "status": "CONFIRMED",
            "notes": "Test Order for Reservation",
            "items": items_payload,
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        return res.data["id"]

    # 1. Reserve sufficient stock
    def test_reserve_sufficient_stock(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        res = self.client.post(url, {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "RESERVED")
        self.assertEqual(res.data["warehouse"], self.wh1.id)

    # 2. Reserved quantity increases
    def test_reserved_quantity_increases(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        self.client.post(url, {"warehouse": self.wh1.id}, format="json")
        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("10.00"))

    # 3. Available quantity decreases while physical stock remains unchanged
    def test_available_quantity_decreases(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        self.client.post(url, {"warehouse": self.wh1.id}, format="json")
        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.available_quantity, Decimal("40.00"))
        self.assertEqual(self.stock1.quantity, Decimal("50.00"))  # physical stock untouched!

    # 4. Insufficient stock rejected
    def test_insufficient_stock_rejected(self):
        # Requesting 60 units when only 50 available
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "60.00", "unit_price": "1000.00"}])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        res = self.client.post(url, {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient available stock", res.data["detail"])
        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("0.00"))

    # 5. No partial reservation (all-or-nothing rollback)
    def test_no_partial_reservation_rollback(self):
        # Order with 2 products: prod1 (qty 10, sufficient) + prod2 (qty 20, insufficient since stock is 10)
        order_id = self._create_order([
            {"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"},
            {"product": self.prod2.id, "quantity": "20.00", "unit_price": "120.00"},
        ])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        res = self.client.post(url, {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Assert complete rollback: neither product remains reserved!
        self.stock1.refresh_from_db()
        self.stock2.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("0.00"))
        self.assertEqual(self.stock2.reserved_quantity, Decimal("0.00"))

    # 6. Concurrent-safe reservation logic (cannot over-reserve)
    def test_concurrent_safe_reservation_logic(self):
        # Order 1 requests 30 of 50
        order1 = self._create_order([{"product": self.prod1.id, "quantity": "30.00", "unit_price": "1000.00"}])
        # Order 2 requests 30 of 50
        order2 = self._create_order([{"product": self.prod1.id, "quantity": "30.00", "unit_price": "1000.00"}])

        url1 = f"/api/companies/{self.comp1.id}/sales/orders/{order1}/reserve/"
        res1 = self.client.post(url1, {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Order 2 should now fail (only 20 available)
        url2 = f"/api/companies/{self.comp1.id}/sales/orders/{order2}/reserve/"
        res2 = self.client.post(url2, {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient available stock", res2.data["detail"])

    # 7. Release reservation
    def test_release_reservation(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "15.00", "unit_price": "1000.00"}])
        reserve_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        self.client.post(reserve_url, {"warehouse": self.wh1.id}, format="json")

        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("15.00"))

        release_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/release-reservation/"
        res = self.client.post(release_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "CONFIRMED")

        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("0.00"))
        self.assertEqual(self.stock1.available_quantity, Decimal("50.00"))

    # 8. Duplicate release rejected
    def test_duplicate_release_rejected(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "5.00", "unit_price": "1000.00"}])
        self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")

        release_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/release-reservation/"
        res1 = self.client.post(release_url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        res2 = self.client.post(release_url)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No active reservations found", res2.data["detail"])

    # 9. Cancellation automatically releases reservation
    def test_cancellation_releases_reservation(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "12.00", "unit_price": "1000.00"}])
        self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")

        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("12.00"))

        # Cancel order via PATCH
        patch_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/"
        res = self.client.patch(patch_url, {"status": "CANCELLED"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "CANCELLED")

        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("0.00"))

        # Check reservation status
        res_obj = SalesOrderReservation.objects.filter(sales_order_id=order_id).first()
        self.assertEqual(res_obj.status, SalesOrderReservation.ReservationStatus.CANCELLED)

    # 10. Fulfillment reduces physical stock
    def test_fulfillment_reduces_physical_stock(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")

        fulfill_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/"
        res = self.client.post(fulfill_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "COMPLETED")

        self.stock1.refresh_from_db()
        # Initial was 50, now physical is 40!
        self.assertEqual(self.stock1.quantity, Decimal("40.00"))

    # 11. Fulfillment clears reservation
    def test_fulfillment_clears_reservation(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")

        fulfill_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/"
        self.client.post(fulfill_url)

        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("0.00"))
        self.assertEqual(self.stock1.available_quantity, Decimal("40.00"))

        res_obj = SalesOrderReservation.objects.filter(sales_order_id=order_id).first()
        self.assertEqual(res_obj.status, SalesOrderReservation.ReservationStatus.FULFILLED)

    # 12. Fulfillment creates STOCK_OUT transaction
    def test_fulfillment_creates_stock_out_transaction(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")

        order = SalesOrder.objects.get(id=order_id)
        fulfill_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/"
        self.client.post(fulfill_url)

        tx = StockTransaction.objects.filter(
            company=self.comp1,
            product=self.prod1,
            warehouse=self.wh1,
            transaction_type=StockTransaction.TransactionType.STOCK_OUT,
            reference=order.order_number,
        ).first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.quantity, Decimal("10.00"))

    # 13. Duplicate fulfillment rejected
    def test_duplicate_fulfillment_rejected(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")

        fulfill_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/"
        res1 = self.client.post(fulfill_url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        res2 = self.client.post(fulfill_url)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already fulfilled", res2.data["detail"])

    # 14. Cannot fulfill unreserved order
    def test_cannot_fulfill_unreserved_order(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "10.00", "unit_price": "1000.00"}])
        fulfill_url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/"
        res = self.client.post(fulfill_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("without active stock reservations", res.data["detail"])

    # 15. Cannot reserve inactive product
    def test_cannot_reserve_inactive_product(self):
        order = SalesOrder.objects.create(
            company=self.comp1, customer=self.cust1, order_number=generate_order_number(self.comp1), status="CONFIRMED"
        )
        SalesOrderItem.objects.create(
            sales_order=order, product=self.prod_inactive, quantity=Decimal("1.00"), unit_price=Decimal("10.00")
        )
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/reserve/"
        res = self.client.post(url, {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data["detail"])

    # 16. Cannot reserve inactive warehouse
    def test_cannot_reserve_inactive_warehouse(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "5.00", "unit_price": "1000.00"}])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        res = self.client.post(url, {"warehouse": self.wh_inactive.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data["warehouse"][0])

    # 17. Cannot reserve another company's warehouse
    def test_cannot_reserve_another_company_stock(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "5.00", "unit_price": "1000.00"}])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        res = self.client.post(url, {"warehouse": self.wh_comp2.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not found in this company", res.data["warehouse"][0])

    # 18. Cannot fulfill another company's order (Tenant isolation)
    def test_cannot_fulfill_another_company_order(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "5.00", "unit_price": "1000.00"}])
        self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")

        # Authenticate as Comp 2 user
        self.client.force_authenticate(user=self.user2)
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/"
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # 19. Correct Sales Order status transitions
    def test_correct_sales_order_status_transitions(self):
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "2.00", "unit_price": "1000.00"}])

        # CONFIRMED -> RESERVED
        res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res.data["status"], "RESERVED")

        # RESERVED -> RELEASED (back to CONFIRMED)
        res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/release-reservation/")
        self.assertEqual(res.data["status"], "CONFIRMED")

        # CONFIRMED -> RESERVED again
        res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(res.data["status"], "RESERVED")

        # RESERVED -> FULFILLED (COMPLETED)
        res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/")
        self.assertEqual(res.data["status"], "COMPLETED")

    # 20. Transaction rollback on failure
    def test_transaction_rollback_on_failure(self):
        # Order with valid items, but attempt to reserve with non-existent warehouse
        order_id = self._create_order([{"product": self.prod1.id, "quantity": "5.00", "unit_price": "1000.00"}])
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/"
        res = self.client.post(url, {"warehouse": 99999}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        order = SalesOrder.objects.get(id=order_id)
        self.assertEqual(order.status, "CONFIRMED")
        self.assertEqual(SalesOrderReservation.objects.filter(sales_order_id=order_id).count(), 0)

    # 21. Unauthenticated access rejected
    def test_unauthenticated_access_rejected(self):
        self.client.force_authenticate(user=None)
        order_id = 1
        urls = [
            (f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reserve/", "POST"),
            (f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/release-reservation/", "POST"),
            (f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/fulfill/", "POST"),
            (f"/api/companies/{self.comp1.id}/sales/orders/{order_id}/reservations/", "GET"),
        ]
        for url, method in urls:
            if method == "POST":
                res = self.client.post(url)
            else:
                res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class SalesFinancialInvoicingTests(APITestCase):
    def setUp(self):
        # Users & Companies
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")

        self.user1 = User.objects.create_user(username="fin_admin1", email="fin1@corp1.com", password="password123")
        self.user2 = User.objects.create_user(username="fin_admin2", email="fin2@corp2.com", password="password123")

        self.comp1 = Company.objects.create(name="Invoicing Corp A", email="corpA@inv.com", is_active=True)
        self.comp2 = Company.objects.create(name="Invoicing Corp B", email="corpB@inv.com", is_active=True)

        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        # Customers
        self.cust1 = Customer.objects.create(company=self.comp1, name="Client One", email="client1@corp1.com")
        self.cust2 = Customer.objects.create(company=self.comp2, name="Client Two", email="client2@corp2.com")

        # Warehouse & Products
        self.wh1 = Warehouse.objects.create(company=self.comp1, name="Hub A", code="HB-A", is_active=True)
        self.cat1 = Category.objects.create(company=self.comp1, name="Hardware")
        self.prod1 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Network Switch 24P",
            sku="NET-24P",
            unit="unit",
            cost_price=Decimal("200.00"),
            selling_price=Decimal("400.00"),
            tax=Decimal("10.00"),
            is_active=True,
        )
        self.prod2 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Cat6 Cable 100m",
            sku="CAB-CAT6",
            unit="roll",
            cost_price=Decimal("20.00"),
            selling_price=Decimal("50.00"),
            tax=Decimal("5.00"),
            is_active=True,
        )

        Stock.objects.create(product=self.prod1, warehouse=self.wh1, quantity=Decimal("100.00"), reserved_quantity=Decimal("0.00"))
        Stock.objects.create(product=self.prod2, warehouse=self.wh1, quantity=Decimal("100.00"), reserved_quantity=Decimal("0.00"))

        self.client.force_authenticate(user=self.user1)

    def _create_sales_order(self, status="COMPLETED"):
        order = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            warehouse=self.wh1,
            order_number=generate_order_number(self.comp1),
            order_date=timezone.localdate(),
            status=status,
            notes="Order for invoicing test",
            created_by=self.user1,
        )
        SalesOrderItem.objects.create(
            sales_order=order,
            product=self.prod1,
            description="24 Port Switch",
            quantity=Decimal("2.00"),
            unit_price=Decimal("400.00"),
            discount=Decimal("50.00"),
            tax=Decimal("20.00"),
        )
        order.recalculate_totals()
        order.save()
        return order

    # 1. Create invoice directly
    def test_create_invoice_directly(self):
        url = f"/api/companies/{self.comp1.id}/sales/invoices/"
        payload = {
            "customer": self.cust1.id,
            "due_date": str(timezone.localdate() + timezone.timedelta(days=15)),
            "items": [
                {
                    "product": self.prod1.id,
                    "description": "Direct invoice item",
                    "quantity": "3.00",
                    "unit_price": "400.00",
                    "discount": "0.00",
                    "tax": "10.00",
                }
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["invoice_number"].startswith("INV-"))
        self.assertEqual(res.data["status"], "ISSUED")
        self.assertEqual(Decimal(res.data["total"]), Decimal("1210.00"))
        self.assertEqual(Decimal(res.data["balance_due"]), Decimal("1210.00"))
        self.assertEqual(Decimal(res.data["amount_paid"]), Decimal("0.00"))

    # 2. Create invoice from fulfilled order
    def test_create_invoice_from_fulfilled_order(self):
        order = self._create_sales_order(status="COMPLETED")
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/"
        res = self.client.post(url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["sales_order"], order.id)
        self.assertEqual(res.data["customer"], self.cust1.id)
        self.assertEqual(Decimal(res.data["total"]), order.total)
        self.assertEqual(Decimal(res.data["balance_due"]), order.total)
        self.assertEqual(len(res.data["items"]), 1)

    # 3. Cannot invoice cancelled order
    def test_cannot_invoice_cancelled_order(self):
        order = self._create_sales_order(status="CANCELLED")
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/"
        res = self.client.post(url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelled", res.data["detail"].lower())

    # 4. Cannot invoice another company's order
    def test_cannot_invoice_another_company_order(self):
        order_comp2 = SalesOrder.objects.create(
            company=self.comp2,
            customer=self.cust2,
            order_number=generate_order_number(self.comp2),
            order_date=timezone.localdate(),
            status="COMPLETED",
            created_by=self.user2,
        )
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order_comp2.id}/invoice/"
        res = self.client.post(url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # 5. Prevent duplicate invoice from same order
    def test_prevent_duplicate_invoice_from_same_order(self):
        order = self._create_sales_order(status="COMPLETED")
        url = f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/"
        res1 = self.client.post(url, {}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        res2 = self.client.post(url, {}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been generated", res2.data["detail"])

    # 6. Invoice item calculation
    def test_invoice_item_calculation(self):
        inv = Invoice.objects.create(
            company=self.comp1,
            customer=self.cust1,
            invoice_number=generate_invoice_number(self.comp1),
            due_date=timezone.localdate(),
        )
        item = InvoiceItem.objects.create(
            invoice=inv,
            product=self.prod1,
            quantity=Decimal("2.00"),
            unit_price=Decimal("1000.00"),
            discount=Decimal("100.00"),
            tax=Decimal("18.00"),
        )
        # Expected line total: (2 * 1000) - 100 + 18 = 1918.00
        self.assertEqual(item.line_total, Decimal("1918.00"))

    # 7. Invoice total calculation
    def test_invoice_total_calculation(self):
        inv = Invoice.objects.create(
            company=self.comp1,
            customer=self.cust1,
            invoice_number=generate_invoice_number(self.comp1),
            due_date=timezone.localdate(),
        )
        InvoiceItem.objects.create(
            invoice=inv, product=self.prod1, quantity=Decimal("2.00"), unit_price=Decimal("500.00"), discount=Decimal("50.00"), tax=Decimal("25.00")
        )
        InvoiceItem.objects.create(
            invoice=inv, product=self.prod2, quantity=Decimal("4.00"), unit_price=Decimal("50.00"), discount=Decimal("0.00"), tax=Decimal("10.00")
        )
        inv.recalculate_totals()
        inv.save()
        # Item 1: (2 * 500) - 50 + 25 = 975.00
        # Item 2: (4 * 50) - 0 + 10 = 210.00
        # Total: 1185.00
        self.assertEqual(inv.subtotal, Decimal("1200.00"))
        self.assertEqual(inv.discount, Decimal("50.00"))
        self.assertEqual(inv.tax, Decimal("35.00"))
        self.assertEqual(inv.total, Decimal("1185.00"))
        self.assertEqual(inv.balance_due, Decimal("1185.00"))

    # 8. Invoice number uniqueness
    def test_invoice_number_uniqueness(self):
        inv_num1 = generate_invoice_number(self.comp1)
        Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=inv_num1, due_date=timezone.localdate())
        inv_num2 = generate_invoice_number(self.comp1)
        self.assertNotEqual(inv_num1, inv_num2)

    # 9. Tenant isolation
    def test_tenant_isolation_invoices(self):
        Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate())
        Invoice.objects.create(company=self.comp2, customer=self.cust2, invoice_number=generate_invoice_number(self.comp2), due_date=timezone.localdate())

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/invoices/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        # User 1 cannot view company 2's invoices
        res2 = self.client.get(f"/api/companies/{self.comp2.id}/sales/invoices/")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

    # 10. Unauthenticated access
    def test_unauthenticated_access_invoice(self):
        self.client.force_authenticate(user=None)
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/invoices/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # 11. Full payment
    def test_full_payment(self):
        order = self._create_sales_order()
        inv_res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/", {}, format="json")
        invoice_id = inv_res.data["id"]
        total = Decimal(inv_res.data["total"])

        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{invoice_id}/payments/"
        pay_res = self.client.post(pay_url, {
            "amount": str(total),
            "payment_method": "BANK_TRANSFER",
            "reference": "TXN-FULL-001",
        }, format="json")
        self.assertEqual(pay_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(pay_res.data["amount"]), total)

        # Check invoice state
        inv = Invoice.objects.get(id=invoice_id)
        self.assertEqual(inv.amount_paid, total)
        self.assertEqual(inv.balance_due, Decimal("0.00"))
        self.assertEqual(inv.status, Invoice.InvoiceStatus.PAID)

    # 12. Partial payment
    def test_partial_payment(self):
        order = self._create_sales_order()
        inv_res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/", {}, format="json")
        invoice_id = inv_res.data["id"]
        total = Decimal(inv_res.data["total"])

        partial_amount = Decimal("300.00")
        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{invoice_id}/payments/"
        pay_res = self.client.post(pay_url, {
            "amount": str(partial_amount),
            "payment_method": "CASH",
        }, format="json")
        self.assertEqual(pay_res.status_code, status.HTTP_201_CREATED)

        inv = Invoice.objects.get(id=invoice_id)
        self.assertEqual(inv.amount_paid, partial_amount)
        self.assertEqual(inv.balance_due, total - partial_amount)
        self.assertEqual(inv.status, Invoice.InvoiceStatus.PARTIALLY_PAID)

    # 13. Multiple partial payments
    def test_multiple_partial_payments(self):
        order = self._create_sales_order()
        inv_res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/", {}, format="json")
        invoice_id = inv_res.data["id"]
        total = Decimal(inv_res.data["total"])  # 770.00

        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{invoice_id}/payments/"
        self.client.post(pay_url, {"amount": "200.00", "payment_method": "CARD"}, format="json")
        self.client.post(pay_url, {"amount": "300.00", "payment_method": "UPI"}, format="json")
        rem = total - Decimal("500.00")
        self.client.post(pay_url, {"amount": str(rem), "payment_method": "CASH"}, format="json")

        inv = Invoice.objects.get(id=invoice_id)
        self.assertEqual(inv.amount_paid, total)
        self.assertEqual(inv.balance_due, Decimal("0.00"))
        self.assertEqual(inv.status, Invoice.InvoiceStatus.PAID)
        self.assertEqual(inv.payments.count(), 3)
        self.assertEqual(inv.receipts.count(), 3)

    # 14. Balance calculation
    def test_balance_calculation(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("500.00"), amount_paid=Decimal("150.00"))
        inv.recalculate_totals()
        self.assertEqual(inv.balance_due, Decimal("350.00"))

    # 15. Overpayment rejected
    def test_overpayment_rejected(self):
        order = self._create_sales_order()
        inv_res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/", {}, format="json")
        invoice_id = inv_res.data["id"]
        total = Decimal(inv_res.data["total"])

        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{invoice_id}/payments/"
        res = self.client.post(pay_url, {"amount": str(total + Decimal("50.00")), "payment_method": "CASH"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds invoice balance due", res.data["detail"])

    # 16. Zero payment rejected
    def test_zero_payment_rejected(self):
        order = self._create_sales_order()
        inv_res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/", {}, format="json")
        invoice_id = inv_res.data["id"]

        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{invoice_id}/payments/"
        res = self.client.post(pay_url, {"amount": "0.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 17. Negative payment rejected
    def test_negative_payment_rejected(self):
        order = self._create_sales_order()
        inv_res = self.client.post(f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/invoice/", {}, format="json")
        invoice_id = inv_res.data["id"]

        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{invoice_id}/payments/"
        res = self.client.post(pay_url, {"amount": "-100.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 18. Wrong company payment rejected
    def test_wrong_company_payment_rejected(self):
        inv2 = Invoice.objects.create(company=self.comp2, customer=self.cust2, invoice_number=generate_invoice_number(self.comp2), due_date=timezone.localdate(), total=Decimal("500.00"), balance_due=Decimal("500.00"))
        # User 1 tries to record payment on Comp2 invoice via Comp1 endpoint
        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{inv2.id}/payments/"
        res = self.client.post(pay_url, {"amount": "100.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # 19. Payment number uniqueness
    def test_payment_number_uniqueness(self):
        num1 = generate_payment_number(self.comp1)
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("500.00"))
        Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=num1, amount=Decimal("10.00"))
        num2 = generate_payment_number(self.comp1)
        self.assertNotEqual(num1, num2)

    # 20. Concurrent payment protection (simulated overpayment check)
    def test_concurrent_payment_protection(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"), balance_due=Decimal("100.00"))
        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/"

        # First payment 70
        res1 = self.client.post(pay_url, {"amount": "70.00"}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second payment 70 must be rejected since balance is now 30
        res2 = self.client.post(pay_url, {"amount": "70.00"}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    # 21. Receipt created atomically with successful payment
    def test_receipt_created_with_payment(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("200.00"), balance_due=Decimal("200.00"))
        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/"
        res = self.client.post(pay_url, {"amount": "100.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        payment_id = res.data["id"]
        payment = Payment.objects.get(id=payment_id)
        self.assertIsNotNone(payment.receipt)
        self.assertTrue(payment.receipt.receipt_number.startswith("REC-"))

    # 22. Receipt amount matches payment
    def test_receipt_amount_matches_payment(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("200.00"), balance_due=Decimal("200.00"))
        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/"
        res = self.client.post(pay_url, {"amount": "125.50"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        payment = Payment.objects.get(id=res.data["id"])
        self.assertEqual(payment.receipt.amount, Decimal("125.50"))

    # 23. Receipt number uniqueness
    def test_receipt_number_uniqueness(self):
        num1 = generate_receipt_number(self.comp1)
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("200.00"))
        p = Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=generate_payment_number(self.comp1), amount=Decimal("10.00"))
        Receipt.objects.create(company=self.comp1, payment=p, invoice=inv, customer=self.cust1, receipt_number=num1, amount=Decimal("10.00"))
        num2 = generate_receipt_number(self.comp1)
        self.assertNotEqual(num1, num2)

    # 24. Failed payment does not create receipt
    def test_failed_payment_no_receipt(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"), balance_due=Decimal("100.00"))
        pay_url = f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/"
        initial_receipt_count = Receipt.objects.count()
        res = self.client.post(pay_url, {"amount": "500.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Receipt.objects.count(), initial_receipt_count)

    # 25. Tenant isolation for payments and receipts
    def test_tenant_isolation_payments_receipts(self):
        inv1 = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"))
        inv2 = Invoice.objects.create(company=self.comp2, customer=self.cust2, invoice_number=generate_invoice_number(self.comp2), due_date=timezone.localdate(), total=Decimal("100.00"))

        p1 = Payment.objects.create(company=self.comp1, invoice=inv1, customer=self.cust1, payment_number=generate_payment_number(self.comp1), amount=Decimal("50.00"))
        Receipt.objects.create(company=self.comp1, payment=p1, invoice=inv1, customer=self.cust1, receipt_number=generate_receipt_number(self.comp1), amount=Decimal("50.00"))

        p2 = Payment.objects.create(company=self.comp2, invoice=inv2, customer=self.cust2, payment_number=generate_payment_number(self.comp2), amount=Decimal("50.00"))
        Receipt.objects.create(company=self.comp2, payment=p2, invoice=inv2, customer=self.cust2, receipt_number=generate_receipt_number(self.comp2), amount=Decimal("50.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/receipts/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["receipt_number"], p1.receipt.receipt_number)

    # 26. Status transition ISSUED -> PARTIALLY_PAID
    def test_status_transition_issued_to_partially_paid(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"), balance_due=Decimal("100.00"), status=Invoice.InvoiceStatus.ISSUED)
        self.client.post(f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/", {"amount": "40.00"}, format="json")
        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.InvoiceStatus.PARTIALLY_PAID)

    # 27. Status transition PARTIALLY_PAID -> PAID
    def test_status_transition_partially_paid_to_paid(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"), amount_paid=Decimal("40.00"), balance_due=Decimal("60.00"), status=Invoice.InvoiceStatus.PARTIALLY_PAID)
        self.client.post(f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/", {"amount": "60.00"}, format="json")
        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.InvoiceStatus.PAID)

    # 28. Paid invoice cannot accept additional payment
    def test_paid_invoice_cannot_accept_payment(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"), amount_paid=Decimal("100.00"), balance_due=Decimal("0.00"), status=Invoice.InvoiceStatus.PAID)
        res = self.client.post(f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/", {"amount": "10.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already fully paid", res.data["detail"])

    # 29. Cancelled invoice cannot accept payment
    def test_cancelled_invoice_cannot_accept_payment(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"), balance_due=Decimal("100.00"), status=Invoice.InvoiceStatus.CANCELLED)
        res = self.client.post(f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/", {"amount": "10.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelled", res.data["detail"])

    # 30. Overdue calculation
    def test_overdue_calculation(self):
        yesterday = timezone.localdate() - timezone.timedelta(days=1)
        inv = Invoice.objects.create(
            company=self.comp1,
            customer=self.cust1,
            invoice_number=generate_invoice_number(self.comp1),
            due_date=yesterday,
            total=Decimal("100.00"),
            balance_due=Decimal("100.00"),
            status=Invoice.InvoiceStatus.ISSUED,
        )
        self.assertTrue(inv.is_overdue)
        self.assertEqual(inv.effective_status, "OVERDUE")

        # Paid invoice is NOT overdue
        inv.status = Invoice.InvoiceStatus.PAID
        inv.balance_due = Decimal("0.00")
        inv.save()
        self.assertFalse(inv.is_overdue)
        self.assertEqual(inv.effective_status, "PAID")

    # 31. Payment + receipt atomicity
    def test_payment_receipt_atomicity(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("100.00"), balance_due=Decimal("100.00"))
        # Check initial counts
        p_count = Payment.objects.count()
        r_count = Receipt.objects.count()
        # Trigger an invalid payment method
        res = self.client.post(f"/api/companies/{self.comp1.id}/sales/invoices/{inv.id}/payments/", {"amount": "50.00", "payment_method": "INVALID_METHOD"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Payment.objects.count(), p_count)
        self.assertEqual(Receipt.objects.count(), r_count)

    # 32. Financial summary calculations
    def test_financial_summary_endpoint(self):
        inv1 = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("1000.00"), amount_paid=Decimal("400.00"), balance_due=Decimal("600.00"), status=Invoice.InvoiceStatus.PARTIALLY_PAID)
        p1 = Payment.objects.create(company=self.comp1, invoice=inv1, customer=self.cust1, payment_number=generate_payment_number(self.comp1), amount=Decimal("400.00"))
        Receipt.objects.create(company=self.comp1, payment=p1, invoice=inv1, customer=self.cust1, receipt_number=generate_receipt_number(self.comp1), amount=Decimal("400.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/financial-summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_invoices_count"], 1)
        self.assertEqual(res.data["partially_paid_invoices_count"], 1)
        self.assertEqual(Decimal(res.data["total_invoiced_amount"]), Decimal("1000.00"))
        self.assertEqual(Decimal(res.data["total_paid_amount"]), Decimal("400.00"))
        self.assertEqual(Decimal(res.data["total_outstanding_amount"]), Decimal("600.00"))


# ============================================================
# PHASE 4D: SALES FINALIZATION, REPORTING & INTEGRATION TESTS
# ============================================================

class SalesFinalizationAndReportingTests(APITestCase):
    def setUp(self):
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")

        self.user1 = User.objects.create_user(
            username="p4d_admin1", email="p4d_admin1@alpha.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            username="p4d_admin2", email="p4d_admin2@beta.com", password="password123"
        )

        self.comp1 = Company.objects.create(name="Phase4D Corp Alpha", email="alpha@p4d.com", is_active=True)
        self.comp2 = Company.objects.create(name="Phase4D Corp Beta", email="beta@p4d.com", is_active=True)

        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        self.cust1 = Customer.objects.create(
            company=self.comp1, name="Apex Solutions", email="apex@p4d.com", phone="1112223333"
        )
        self.cust2 = Customer.objects.create(
            company=self.comp1, name="Beacon Global", email="beacon@p4d.com", phone="4445556666"
        )
        self.cust_comp2 = Customer.objects.create(
            company=self.comp2, name="Beta Customer", email="beta@cust.com"
        )

        self.cat1 = Category.objects.create(company=self.comp1, name="Hardware")
        self.prod1 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Industrial Server",
            sku="IND-SRV-01",
            unit="unit",
            selling_price=Decimal("1500.00"),
            is_active=True,
        )
        self.prod2 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Network Switch 24P",
            sku="NSW-24P",
            unit="unit",
            selling_price=Decimal("300.00"),
            is_active=True,
        )
        self.wh1 = Warehouse.objects.create(
            company=self.comp1,
            name="Central Hub",
            code="WH-CENTRAL",
            is_active=True,
        )
        self.stock1 = Stock.objects.create(
            product=self.prod1,
            warehouse=self.wh1,
            quantity=Decimal("50.00"),
            reserved_quantity=Decimal("0.00"),
        )
        self.stock2 = Stock.objects.create(
            product=self.prod2,
            warehouse=self.wh1,
            quantity=Decimal("100.00"),
            reserved_quantity=Decimal("0.00"),
        )

        self.client.force_authenticate(user=self.user1)

    # 1. Enhanced Dashboard Metrics
    def test_enhanced_dashboard_metrics(self):
        # Create quote
        q = Quotation.objects.create(company=self.comp1, customer=self.cust1, quotation_number=generate_quotation_number(self.comp1), status=Quotation.QuotationStatus.CONVERTED, subtotal=Decimal("1500.00"), total=Decimal("1500.00"))
        # Create order
        o = SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.COMPLETED, subtotal=Decimal("1500.00"), total=Decimal("1500.00"))
        # Create invoice
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, sales_order=o, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), subtotal=Decimal("1500.00"), total=Decimal("1500.00"), amount_paid=Decimal("500.00"), balance_due=Decimal("1000.00"), status=Invoice.InvoiceStatus.PARTIALLY_PAID)
        # Create payment
        p = Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=generate_payment_number(self.comp1), amount=Decimal("500.00"))
        Receipt.objects.create(company=self.comp1, payment=p, invoice=inv, customer=self.cust1, receipt_number=generate_receipt_number(self.comp1), amount=Decimal("500.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("summary", res.data)
        self.assertIn("comparisons", res.data)
        self.assertEqual(res.data["summary"]["total_quotations"], 1)
        self.assertEqual(res.data["summary"]["converted_quotations"], 1)
        self.assertEqual(res.data["summary"]["conversion_rate_percentage"], 100.0)
        self.assertEqual(res.data["summary"]["total_orders"], 1)
        self.assertEqual(res.data["summary"]["completed_orders"], 1)
        self.assertEqual(Decimal(res.data["summary"]["total_sales_value"]), Decimal("1500.00"))
        self.assertEqual(res.data["summary"]["total_invoices_count"], 1)
        self.assertEqual(res.data["summary"]["partially_paid_invoices_count"], 1)
        self.assertEqual(Decimal(res.data["summary"]["total_invoiced_amount"]), Decimal("1500.00"))
        self.assertEqual(Decimal(res.data["summary"]["total_paid_amount"]), Decimal("500.00"))
        self.assertEqual(Decimal(res.data["summary"]["total_outstanding_amount"]), Decimal("1000.00"))

    # 2. Dashboard Monthly Comparisons
    def test_dashboard_monthly_comparison(self):
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        comps = res.data["comparisons"]
        self.assertIn("current_month_sales", comps)
        self.assertIn("previous_month_sales", comps)
        self.assertIn("current_month_orders_count", comps)
        self.assertIn("previous_month_orders_count", comps)
        self.assertIn("current_month_invoiced", comps)
        self.assertIn("current_month_collected", comps)

    # 3. Dashboard Recent Records & Top Customers
    def test_dashboard_recent_records(self):
        SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, subtotal=Decimal("800.00"), total=Decimal("800.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("recent_quotations", res.data)
        self.assertIn("recent_orders", res.data)
        self.assertIn("recent_invoices", res.data)
        self.assertIn("recent_payments", res.data)
        self.assertIn("top_customers", res.data)
        self.assertEqual(len(res.data["recent_orders"]), 1)

    # 4. Sales Analytics - Monthly Trends
    def test_sales_analytics_monthly_trends(self):
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        trends = res.data.get("monthly_trends", [])
        self.assertEqual(len(trends), 12)
        for entry in trends:
            self.assertIn("month", entry)
            self.assertIn("orders_count", entry)
            self.assertIn("sales_total", entry)
            self.assertIn("invoiced_total", entry)
            self.assertIn("collected_total", entry)

    # 5. Sales Analytics - Order Status Distribution
    def test_sales_analytics_order_status_distribution(self):
        SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, total=Decimal("500.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        dist = res.data.get("order_status_distribution", [])
        confirmed_entry = next((item for item in dist if item["status"] == "CONFIRMED"), None)
        self.assertIsNotNone(confirmed_entry)
        self.assertEqual(confirmed_entry["count"], 1)
        self.assertEqual(Decimal(confirmed_entry["total_amount"]), Decimal("500.00"))

    # 6. Sales Analytics - Invoice Status Distribution
    def test_sales_analytics_invoice_status_distribution(self):
        Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), status=Invoice.InvoiceStatus.ISSUED, total=Decimal("1200.00"), balance_due=Decimal("1200.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        dist = res.data.get("invoice_status_distribution", [])
        issued_entry = next((item for item in dist if item["status"] == "ISSUED"), None)
        self.assertIsNotNone(issued_entry)
        self.assertEqual(issued_entry["count"], 1)

    # 7. Sales Analytics - Payment Method Distribution
    def test_sales_analytics_payment_method_distribution(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("300.00"), balance_due=Decimal("0.00"), status=Invoice.InvoiceStatus.PAID)
        Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=generate_payment_number(self.comp1), payment_method=Payment.PaymentMethod.UPI, amount=Decimal("300.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        dist = res.data.get("payment_method_distribution", [])
        upi_entry = next((item for item in dist if item["method"] == "UPI"), None)
        self.assertIsNotNone(upi_entry)
        self.assertEqual(upi_entry["count"], 1)
        self.assertEqual(Decimal(upi_entry["total_amount"]), Decimal("300.00"))

    # 8. Sales Analytics - Top Customers
    def test_sales_analytics_top_customers(self):
        SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, total=Decimal("2000.00"))
        SalesOrder.objects.create(company=self.comp1, customer=self.cust2, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, total=Decimal("1000.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        top_custs = res.data.get("top_customers", [])
        self.assertGreaterEqual(len(top_custs), 2)
        self.assertEqual(top_custs[0]["customer_name"], "Apex Solutions")

    # 9. Sales Analytics - Top Products
    def test_sales_analytics_top_products(self):
        o = SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, total=Decimal("3000.00"))
        SalesOrderItem.objects.create(sales_order=o, product=self.prod1, quantity=Decimal("2.00"), unit_price=Decimal("1500.00"), line_total=Decimal("3000.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        top_prods = res.data.get("top_products", [])
        self.assertGreaterEqual(len(top_prods), 1)
        self.assertEqual(top_prods[0]["product_name"], "Industrial Server")
        self.assertEqual(Decimal(top_prods[0]["quantity_sold"]), Decimal("2.00"))

    # 10. Sales Analytics - Warehouse Distribution
    def test_sales_analytics_warehouse_distribution(self):
        SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, total=Decimal("1500.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        wh_dist = res.data.get("warehouse_distribution", [])
        self.assertEqual(len(wh_dist), 1)
        self.assertEqual(wh_dist[0]["warehouse_code"], "WH-CENTRAL")

    # 11. Sales Analytics - Quotation Conversion
    def test_sales_analytics_quotation_conversion(self):
        Quotation.objects.create(company=self.comp1, customer=self.cust1, quotation_number=generate_quotation_number(self.comp1), status=Quotation.QuotationStatus.CONVERTED, total=Decimal("1000.00"))
        Quotation.objects.create(company=self.comp1, customer=self.cust2, quotation_number=generate_quotation_number(self.comp1), status=Quotation.QuotationStatus.DRAFT, total=Decimal("500.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        qc = res.data.get("quotation_conversion", {})
        self.assertEqual(qc["total_quotations"], 2)
        self.assertEqual(qc["converted_quotations"], 1)
        self.assertEqual(qc["conversion_rate_percentage"], 50.0)

    # 12. Sales Report - Summary Report
    def test_sales_report_summary(self):
        o = SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.COMPLETED, total=Decimal("1500.00"))
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, sales_order=o, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("1500.00"), amount_paid=Decimal("1500.00"), balance_due=Decimal("0.00"), status=Invoice.InvoiceStatus.PAID)
        Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=generate_payment_number(self.comp1), amount=Decimal("1500.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=summary")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["report_type"], "summary")
        data = res.data["data"]
        self.assertEqual(data["total_orders"], 1)
        self.assertEqual(Decimal(data["total_sales_value"]), Decimal("1500.00"))
        self.assertEqual(Decimal(data["total_invoiced"]), Decimal("1500.00"))
        self.assertEqual(Decimal(data["total_collected"]), Decimal("1500.00"))
        self.assertEqual(data["collection_rate_percentage"], 100.0)

    # 13. Sales Report - Customer Performance
    def test_sales_report_customer(self):
        SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, total=Decimal("750.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=customer")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["report_type"], "customer")
        rows = res.data.get("rows", [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["customer_name"], "Apex Solutions")
        self.assertEqual(Decimal(rows[0]["total_sales"]), Decimal("750.00"))

    # 14. Sales Report - Product Sales Performance
    def test_sales_report_product(self):
        o = SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.CONFIRMED, total=Decimal("600.00"))
        SalesOrderItem.objects.create(sales_order=o, product=self.prod2, quantity=Decimal("2.00"), unit_price=Decimal("300.00"), line_total=Decimal("600.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=product")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["report_type"], "product")
        rows = res.data.get("rows", [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["product_sku"], "NSW-24P")
        self.assertEqual(Decimal(rows[0]["units_sold"]), Decimal("2.00"))

    # 15. Sales Report - Invoice Aging Analysis
    def test_sales_report_invoice_aging(self):
        yesterday = timezone.localdate() - timezone.timedelta(days=15)
        Invoice.objects.create(
            company=self.comp1,
            customer=self.cust1,
            invoice_number=generate_invoice_number(self.comp1),
            due_date=yesterday,
            total=Decimal("1000.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("1000.00"),
            status=Invoice.InvoiceStatus.ISSUED,
        )
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=invoice")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["report_type"], "invoice")
        self.assertIn("summary", res.data)
        rows = res.data.get("rows", [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["aging_bucket"], "1-30_DAYS")
        self.assertEqual(Decimal(res.data["summary"]["days_1_30_amount"]), Decimal("1000.00"))

    # 16. Sales Report - Payment Transactions
    def test_sales_report_payment(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("400.00"), balance_due=Decimal("0.00"), status=Invoice.InvoiceStatus.PAID)
        Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=generate_payment_number(self.comp1), payment_method=Payment.PaymentMethod.BANK_TRANSFER, amount=Decimal("400.00"), reference="TXN-999")
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=payment")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["report_type"], "payment")
        rows = res.data.get("rows", [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["reference"], "TXN-999")
        self.assertEqual(Decimal(res.data["total_collected"]), Decimal("400.00"))

    # 17. Sales Report - Date Range and Entity Filtering
    def test_sales_report_filters(self):
        past_date = timezone.localdate() - timezone.timedelta(days=60)
        SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), order_date=past_date, total=Decimal("500.00"), status=SalesOrder.SalesOrderStatus.CONFIRMED)
        today = timezone.localdate()
        SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number=generate_order_number(self.comp1), order_date=today, total=Decimal("1000.00"), status=SalesOrder.SalesOrderStatus.CONFIRMED)

        # Filter for today only
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=summary&date_from={today}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["total_orders"], 1)
        self.assertEqual(Decimal(res.data["data"]["total_sales_value"]), Decimal("1000.00"))

    # 18. Sales Report - Invalid Report Type Rejection
    def test_sales_report_invalid_type(self):
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=non_existent")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 19. Customer Sales History - Lifetime Summary and Related Entities
    def test_customer_sales_history_success(self):
        q = Quotation.objects.create(company=self.comp1, customer=self.cust1, quotation_number=generate_quotation_number(self.comp1), status=Quotation.QuotationStatus.CONVERTED, total=Decimal("1500.00"))
        o = SalesOrder.objects.create(company=self.comp1, customer=self.cust1, quotation=q, warehouse=self.wh1, order_number=generate_order_number(self.comp1), status=SalesOrder.SalesOrderStatus.COMPLETED, total=Decimal("1500.00"))
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, sales_order=o, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("1500.00"), amount_paid=Decimal("500.00"), balance_due=Decimal("1000.00"), status=Invoice.InvoiceStatus.PARTIALLY_PAID)
        p = Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=generate_payment_number(self.comp1), amount=Decimal("500.00"))
        r = Receipt.objects.create(company=self.comp1, payment=p, invoice=inv, customer=self.cust1, receipt_number=generate_receipt_number(self.comp1), amount=Decimal("500.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/customers/{self.cust1.id}/history/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["customer"]["name"], "Apex Solutions")
        metrics = res.data["metrics"]
        self.assertEqual(metrics["total_orders"], 1)
        self.assertEqual(metrics["completed_orders"], 1)
        self.assertEqual(Decimal(metrics["total_sales_amount"]), Decimal("1500.00"))
        self.assertEqual(Decimal(metrics["total_invoiced_amount"]), Decimal("1500.00"))
        self.assertEqual(Decimal(metrics["total_paid_amount"]), Decimal("500.00"))
        self.assertEqual(Decimal(metrics["total_balance_due"]), Decimal("1000.00"))
        self.assertEqual(len(res.data["quotations"]), 1)
        self.assertEqual(len(res.data["orders"]), 1)
        self.assertEqual(len(res.data["invoices"]), 1)
        self.assertEqual(len(res.data["payments"]), 1)
        self.assertEqual(len(res.data["receipts"]), 1)

    # 20. Customer Sales History - Cross-Tenant Access Rejected (404)
    def test_customer_sales_history_cross_company_returns_404(self):
        # Accessing customer of Company 2 through Company 1 endpoint
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/customers/{self.cust_comp2.id}/history/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # 21. Company-wide Payments List
    def test_company_payments_list(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("200.00"), balance_due=Decimal("0.00"), status=Invoice.InvoiceStatus.PAID)
        p = Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number=generate_payment_number(self.comp1), amount=Decimal("200.00"))
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/payments/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["payment_number"], p.payment_number)

    # 22. Company-wide Payments Filtering
    def test_company_payments_list_filters(self):
        inv = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number=generate_invoice_number(self.comp1), due_date=timezone.localdate(), total=Decimal("500.00"), balance_due=Decimal("0.00"))
        p1 = Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number="PAY-CASH-01", payment_method=Payment.PaymentMethod.CASH, amount=Decimal("200.00"))
        p2 = Payment.objects.create(company=self.comp1, invoice=inv, customer=self.cust1, payment_number="PAY-CARD-02", payment_method=Payment.PaymentMethod.CARD, amount=Decimal("300.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/payments/?payment_method=CASH")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["payment_number"], "PAY-CASH-01")

    # 23. Quotation Filters (Customer and Date)
    def test_quotation_filters(self):
        today = timezone.localdate()
        past = today - timezone.timedelta(days=10)
        q1 = Quotation.objects.create(company=self.comp1, customer=self.cust1, quotation_number=generate_quotation_number(self.comp1), quotation_date=past, total=Decimal("100.00"))
        q2 = Quotation.objects.create(company=self.comp1, customer=self.cust2, quotation_number=generate_quotation_number(self.comp1), quotation_date=today, total=Decimal("200.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/quotations/?customer={self.cust1.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["quotation_number"], q1.quotation_number)

    # 24. Sales Order Filters (Warehouse and Order Number)
    def test_order_filters(self):
        o1 = SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=self.wh1, order_number="SO-ALPHA-001", total=Decimal("500.00"))
        o2 = SalesOrder.objects.create(company=self.comp1, customer=self.cust1, warehouse=None, order_number="SO-ALPHA-002", total=Decimal("600.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/orders/?warehouse={self.wh1.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["order_number"], "SO-ALPHA-001")

    # 25. Invoice Filters (Customer and Number)
    def test_invoice_filters(self):
        inv1 = Invoice.objects.create(company=self.comp1, customer=self.cust1, invoice_number="INV-SEARCH-01", due_date=timezone.localdate(), total=Decimal("300.00"))
        inv2 = Invoice.objects.create(company=self.comp1, customer=self.cust2, invoice_number="INV-OTHER-02", due_date=timezone.localdate(), total=Decimal("400.00"))

        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/invoices/?invoice_number=SEARCH")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["invoice_number"], "INV-SEARCH-01")

    # 26. Cancel Completed Order Rejected
    def test_cancel_completed_order_rejected(self):
        order = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            warehouse=self.wh1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.COMPLETED,
            total=Decimal("1000.00"),
        )
        res = self.client.patch(
            f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/",
            {"status": "CANCELLED"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Completed orders cannot be cancelled directly", res.data["detail"])

    # 27. Cancel Order Auto-releases Active Reservations
    def test_cancel_order_with_active_reservation(self):
        order = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            warehouse=self.wh1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.RESERVED,
            total=Decimal("1500.00"),
        )
        item = SalesOrderItem.objects.create(
            sales_order=order, product=self.prod1, quantity=Decimal("5.00"), unit_price=Decimal("300.00"), line_total=Decimal("1500.00")
        )
        # Manually reserve
        self.stock1.reserved_quantity = Decimal("5.00")
        self.stock1.save()
        res_record = SalesOrderReservation.objects.create(
            company=self.comp1,
            sales_order=order,
            sales_order_item=item,
            product=self.prod1,
            warehouse=self.wh1,
            quantity=Decimal("5.00"),
            status=SalesOrderReservation.ReservationStatus.ACTIVE,
        )

        res = self.client.patch(
            f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/",
            {"status": "CANCELLED"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, SalesOrder.SalesOrderStatus.CANCELLED)

        # Check reservation released
        res_record.refresh_from_db()
        self.assertEqual(res_record.status, SalesOrderReservation.ReservationStatus.CANCELLED)

        # Check stock restored
        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.reserved_quantity, Decimal("0.00"))

    # 28. Sales Order Return Flow with Stock Restoration
    def test_sales_order_return_success(self):
        # Order fulfilled
        order = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            warehouse=self.wh1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.COMPLETED,
            total=Decimal("3000.00"),
        )
        item = SalesOrderItem.objects.create(
            sales_order=order, product=self.prod1, quantity=Decimal("2.00"), unit_price=Decimal("1500.00"), line_total=Decimal("3000.00")
        )

        init_qty = self.stock1.quantity
        init_avail = self.stock1.available_quantity

        payload = {
            "reason": "Defective item return",
            "items": [
                {
                    "sales_order_item": item.id,
                    "product": self.prod1.id,
                    "quantity": "1.00",
                }
            ]
        }
        res = self.client.post(
            f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/return/",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["reason"], "Defective item return")
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("1500.00"))

        # Check database
        ret = SalesReturn.objects.get(id=res.data["id"])
        self.assertEqual(ret.status, SalesReturn.ReturnStatus.COMPLETED)
        self.assertEqual(ret.items.count(), 1)

        # Check stock restored by 1.00
        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.quantity, init_qty + Decimal("1.00"))
        self.assertEqual(self.stock1.available_quantity, init_avail + Decimal("1.00"))

        # Check StockTransaction created
        st = StockTransaction.objects.filter(company=self.comp1, product=self.prod1, warehouse=self.wh1, transaction_type="STOCK_IN").latest("created_at")
        self.assertEqual(st.quantity, Decimal("1.00"))
        self.assertIn("Sales Return", st.notes)

    # 29. Sales Order Return on Non-Completed Order Rejected
    def test_sales_order_return_non_completed_order_rejected(self):
        order = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            warehouse=self.wh1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.DRAFT,
            total=Decimal("1000.00"),
        )
        res = self.client.post(
            f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/return/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only completed orders can be returned", res.data["detail"])

    # 30. Sales Order Return Exceeding Quantity Rejected
    def test_sales_order_return_exceeding_quantity_rejected(self):
        order = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            warehouse=self.wh1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.COMPLETED,
            total=Decimal("1500.00"),
        )
        item = SalesOrderItem.objects.create(
            sales_order=order, product=self.prod1, quantity=Decimal("1.00"), unit_price=Decimal("1500.00"), line_total=Decimal("1500.00")
        )
        payload = {
            "items": [
                {
                    "sales_order_item": item.id,
                    "quantity": "5.00",
                }
            ]
        }
        res = self.client.post(
            f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/return/",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds ordered quantity", res.data["detail"])

    # 31. List Returns Endpoints
    def test_sales_order_returns_list(self):
        order = SalesOrder.objects.create(
            company=self.comp1,
            customer=self.cust1,
            warehouse=self.wh1,
            order_number=generate_order_number(self.comp1),
            status=SalesOrder.SalesOrderStatus.COMPLETED,
            total=Decimal("1500.00"),
        )
        ret = SalesReturn.objects.create(
            company=self.comp1,
            sales_order=order,
            customer=self.cust1,
            warehouse=self.wh1,
            return_number=generate_return_number(self.comp1),
            total_amount=Decimal("1500.00"),
        )

        res_order = self.client.get(f"/api/companies/{self.comp1.id}/sales/orders/{order.id}/returns/")
        self.assertEqual(res_order.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_order.data), 1)

        res_comp = self.client.get(f"/api/companies/{self.comp1.id}/sales/returns/")
        self.assertEqual(res_comp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_comp.data), 1)

    # 32. Multi-Tenant Isolation - Sales Analytics
    def test_sales_analytics_tenant_isolation(self):
        self.client.force_authenticate(user=self.user2)
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/analytics/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # 33. Multi-Tenant Isolation - Sales Reports
    def test_sales_reports_tenant_isolation(self):
        self.client.force_authenticate(user=self.user2)
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/reports/?report_type=summary")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # 34. Multi-Tenant Isolation - Company Payments
    def test_sales_payments_tenant_isolation(self):
        self.client.force_authenticate(user=self.user2)
        res = self.client.get(f"/api/companies/{self.comp1.id}/sales/payments/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)



