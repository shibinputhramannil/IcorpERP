from decimal import Decimal
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from inventory.models import Category, Product, Warehouse, Vendor, Stock, StockTransaction
from purchase.models import (
    PurchaseQuotation,
    PurchaseQuotationItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseInvoice,
    PurchaseInvoiceItem,
    PurchasePayment,
    generate_purchase_quotation_number,
    generate_purchase_order_number,
    generate_purchase_receipt_number,
    generate_purchase_invoice_number,
    generate_purchase_payment_number,
)


class PurchaseFoundationTests(APITestCase):
    def setUp(self):
        # 1. User roles
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")

        # 2. Users
        self.user1 = User.objects.create_user(
            username="purchase_admin1", email="pur1@corp1.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            username="purchase_admin2", email="pur2@corp2.com", password="password123"
        )
        self.superuser = User.objects.create_superuser(
            username="super_admin", email="super@corp.com", password="password123"
        )

        # 3. Companies
        self.comp1 = Company.objects.create(name="Alpha Corp", email="contact@alphacorp.com", is_active=True)
        self.comp2 = Company.objects.create(name="Beta Industries", email="info@betaindustries.com", is_active=True)

        # 4. Memberships
        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        # 5. Base Data for Comp1
        self.cat1 = Category.objects.create(company=self.comp1, name="Hardware")
        self.prod1 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="Motherboard Pro",
            sku="MB-PRO-01",
            cost_price=Decimal("150.00"),
            selling_price=Decimal("250.00"),
        )
        self.prod2 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="CPU Cooler",
            sku="CLR-02",
            cost_price=Decimal("40.00"),
            selling_price=Decimal("70.00"),
        )
        self.wh1 = Warehouse.objects.create(company=self.comp1, name="Main Depot", code="DEP-01", is_active=True)
        self.vendor1 = Vendor.objects.create(
            company=self.comp1,
            name="Apex Components Ltd",
            email="sales@apexcomponents.com",
            phone="555-1234",
            is_active=True,
        )

        # 6. Base Data for Comp2
        self.cat2 = Category.objects.create(company=self.comp2, name="Raw Materials")
        self.prod_comp2 = Product.objects.create(
            company=self.comp2,
            category=self.cat2,
            name="Steel Plate",
            sku="STL-01",
            cost_price=Decimal("50.00"),
            selling_price=Decimal("90.00"),
        )
        self.wh_comp2 = Warehouse.objects.create(company=self.comp2, name="Beta Depot", code="DEP-02", is_active=True)
        self.vendor_comp2 = Vendor.objects.create(
            company=self.comp2,
            name="Beta Supplier Inc",
            email="orders@betasupplier.com",
            phone="555-9876",
            is_active=True,
        )

        # Authenticate user1 by default
        self.client.force_authenticate(user=self.user1)

    # ------------------------------------------------------------
    # 1. Purchase Quotation Creation & Calculations
    # ------------------------------------------------------------
    def test_create_purchase_quotation_success(self):
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/"
        payload = {
            "vendor": self.vendor1.id,
            "quotation_date": "2026-09-17",
            "valid_until": "2026-10-17",
            "notes": "Urgent procurement quote",
            "items": [
                {
                    "product": self.prod1.id,
                    "description": "Batch A",
                    "quantity": "10.00",
                    "unit_price": "140.00",
                    "discount": "50.00",
                    "tax": "20.00",
                },
                {
                    "product": self.prod2.id,
                    "description": "Batch B",
                    "quantity": "5.00",
                    "unit_price": "35.00",
                    "discount": "0.00",
                    "tax": "10.00",
                },
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["quotation_number"].startswith("PQT-"))
        self.assertEqual(resp.data["status"], "DRAFT")
        self.assertEqual(resp.data["items_count"], 2)

        # Totals check:
        # Item 1: (10 * 140) - 50 + 20 = 1370
        # Item 2: (5 * 35) - 0 + 10 = 185
        # Subtotal: 1400 + 175 = 1575
        # Discount: 50
        # Tax: 30
        # Total: 1555
        self.assertEqual(Decimal(str(resp.data["subtotal"])), Decimal("1575.00"))
        self.assertEqual(Decimal(str(resp.data["discount"])), Decimal("50.00"))
        self.assertEqual(Decimal(str(resp.data["tax"])), Decimal("30.00"))
        self.assertEqual(Decimal(str(resp.data["total"])), Decimal("1555.00"))

    def test_quotation_numbering_incremental_and_unique(self):
        q1_num = generate_purchase_quotation_number(self.comp1)
        q1 = PurchaseQuotation.objects.create(
            company=self.comp1, vendor=self.vendor1, quotation_number=q1_num
        )
        q2_num = generate_purchase_quotation_number(self.comp1)
        self.assertNotEqual(q1_num, q2_num)
        self.assertTrue(q2_num.startswith("PQT-"))
        seq1 = int(q1_num.split("-")[-1])
        seq2 = int(q2_num.split("-")[-1])
        self.assertEqual(seq2, seq1 + 1)

    def test_quotation_item_validation_zero_or_negative_quantity(self):
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/"
        payload = {
            "vendor": self.vendor1.id,
            "items": [
                {"product": self.prod1.id, "quantity": "0.00", "unit_price": "100.00"}
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        payload["items"][0]["quantity"] = "-5.00"
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quotation_item_validation_negative_unit_price(self):
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/"
        payload = {
            "vendor": self.vendor1.id,
            "items": [
                {"product": self.prod1.id, "quantity": "2.00", "unit_price": "-10.00"}
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quotation_item_validation_negative_discount_or_tax(self):
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/"
        payload = {
            "vendor": self.vendor1.id,
            "items": [
                {"product": self.prod1.id, "quantity": "2.00", "unit_price": "10.00", "discount": "-5.00"}
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quotation_rejects_cross_company_vendor(self):
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/"
        payload = {
            "vendor": self.vendor_comp2.id,  # belongs to comp2
            "items": [
                {"product": self.prod1.id, "quantity": "2.00", "unit_price": "100.00"}
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quotation_rejects_cross_company_product(self):
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/"
        payload = {
            "vendor": self.vendor1.id,
            "items": [
                {"product": self.prod_comp2.id, "quantity": "2.00", "unit_price": "100.00"}  # belongs to comp2
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------
    # 2. Quotation to Purchase Order Conversion
    # ------------------------------------------------------------
    def test_quotation_convert_to_order_success(self):
        quote = PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-000100",
            status=PurchaseQuotation.QuotationStatus.ACCEPTED,
        )
        PurchaseQuotationItem.objects.create(
            quotation=quote,
            product=self.prod1,
            quantity=Decimal("10.00"),
            unit_price=Decimal("120.00"),
        )
        quote.recalculate_totals()
        quote.save()

        url = f"/api/companies/{self.comp1.id}/purchases/quotations/{quote.id}/convert-to-order/"
        resp = self.client.post(url, {"warehouse": self.wh1.id}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["order_number"].startswith("PO-"))
        self.assertEqual(resp.data["status"], "CONFIRMED")
        self.assertEqual(resp.data["quotation"], quote.id)
        self.assertEqual(resp.data["warehouse"], self.wh1.id)
        self.assertEqual(Decimal(str(resp.data["total"])), Decimal("1200.00"))

        # Verify quotation status updated to CONVERTED
        quote.refresh_from_db()
        self.assertEqual(quote.status, PurchaseQuotation.QuotationStatus.CONVERTED)

    def test_quotation_convert_to_order_duplicate_prevention(self):
        quote = PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-000101",
            status=PurchaseQuotation.QuotationStatus.CONVERTED,
        )
        PurchaseQuotationItem.objects.create(
            quotation=quote,
            product=self.prod1,
            quantity=Decimal("5.00"),
            unit_price=Decimal("100.00"),
        )
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/{quote.id}/convert-to-order/"
        resp = self.client.post(url, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been converted", resp.data["detail"])

    def test_quotation_convert_rejects_cross_company_warehouse(self):
        quote = PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-000102",
            status=PurchaseQuotation.QuotationStatus.ACCEPTED,
        )
        PurchaseQuotationItem.objects.create(
            quotation=quote,
            product=self.prod1,
            quantity=Decimal("5.00"),
            unit_price=Decimal("100.00"),
        )
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/{quote.id}/convert-to-order/"
        resp = self.client.post(url, {"warehouse": self.wh_comp2.id}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------
    # 3. Direct Purchase Order Creation & Validation
    # ------------------------------------------------------------
    def test_create_purchase_order_directly_success(self):
        url = f"/api/companies/{self.comp1.id}/purchases/orders/"
        payload = {
            "vendor": self.vendor1.id,
            "warehouse": self.wh1.id,
            "order_date": "2026-09-17",
            "expected_date": "2026-09-25",
            "notes": "Direct supplier order",
            "items": [
                {
                    "product": self.prod1.id,
                    "quantity": "20.00",
                    "unit_price": "135.00",
                    "discount": "100.00",
                    "tax": "50.00",
                }
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["order_number"].startswith("PO-"))
        self.assertEqual(resp.data["status"], "CONFIRMED")
        # (20 * 135) - 100 + 50 = 2700 - 100 + 50 = 2650
        self.assertEqual(Decimal(str(resp.data["total"])), Decimal("2650.00"))

    def test_order_numbering_incremental_and_unique(self):
        o1_num = generate_purchase_order_number(self.comp1)
        o1 = PurchaseOrder.objects.create(
            company=self.comp1, vendor=self.vendor1, order_number=o1_num
        )
        o2_num = generate_purchase_order_number(self.comp1)
        self.assertNotEqual(o1_num, o2_num)
        self.assertTrue(o2_num.startswith("PO-"))

    def test_order_rejects_cross_company_vendor(self):
        url = f"/api/companies/{self.comp1.id}/purchases/orders/"
        payload = {
            "vendor": self.vendor_comp2.id,
            "warehouse": self.wh1.id,
            "items": [{"product": self.prod1.id, "quantity": "1.00", "unit_price": "10.00"}],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_rejects_cross_company_warehouse(self):
        url = f"/api/companies/{self.comp1.id}/purchases/orders/"
        payload = {
            "vendor": self.vendor1.id,
            "warehouse": self.wh_comp2.id,
            "items": [{"product": self.prod1.id, "quantity": "1.00", "unit_price": "10.00"}],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_rejects_cross_company_product(self):
        url = f"/api/companies/{self.comp1.id}/purchases/orders/"
        payload = {
            "vendor": self.vendor1.id,
            "warehouse": self.wh1.id,
            "items": [{"product": self.prod_comp2.id, "quantity": "1.00", "unit_price": "10.00"}],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_status_update_and_cancellation(self):
        order = PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            order_number="PO-2026-000201",
            status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
        )
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/"
        resp = self.client.patch(url, {"status": "PROCESSING"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "PROCESSING")

        resp = self.client.patch(url, {"status": "CANCELLED"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "CANCELLED")

    def test_completed_order_deletion_protection(self):
        order = PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            order_number="PO-2026-000202",
            status=PurchaseOrder.PurchaseOrderStatus.COMPLETED,
        )
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/"
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quotation_deletion_and_protection_when_converted(self):
        quote = PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-000301",
            status=PurchaseQuotation.QuotationStatus.DRAFT,
        )
        url = f"/api/companies/{self.comp1.id}/purchases/quotations/{quote.id}/"
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        # Converted quote
        conv_quote = PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-000302",
            status=PurchaseQuotation.QuotationStatus.CONVERTED,
        )
        url2 = f"/api/companies/{self.comp1.id}/purchases/quotations/{conv_quote.id}/"
        resp2 = self.client.delete(url2)
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------
    # 4. Multi-Tenant Isolation
    # ------------------------------------------------------------
    def test_company_tenant_isolation_quotations(self):
        PurchaseQuotation.objects.create(
            company=self.comp1, vendor=self.vendor1, quotation_number="PQT-2026-000401"
        )
        PurchaseQuotation.objects.create(
            company=self.comp2, vendor=self.vendor_comp2, quotation_number="PQT-2026-000402"
        )

        # User1 (Comp1) should only see Comp1 quotation
        resp1 = self.client.get(f"/api/companies/{self.comp1.id}/purchases/quotations/")
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        numbers1 = [q["quotation_number"] for q in resp1.data]
        self.assertIn("PQT-2026-000401", numbers1)
        self.assertNotIn("PQT-2026-000402", numbers1)

        # User2 (Comp2) should only see Comp2 quotation
        self.client.force_authenticate(user=self.user2)
        resp2 = self.client.get(f"/api/companies/{self.comp2.id}/purchases/quotations/")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        numbers2 = [q["quotation_number"] for q in resp2.data]
        self.assertIn("PQT-2026-000402", numbers2)
        self.assertNotIn("PQT-2026-000401", numbers2)

    def test_cross_company_quotation_detail_rejected(self):
        quote1 = PurchaseQuotation.objects.create(
            company=self.comp1, vendor=self.vendor1, quotation_number="PQT-2026-000403"
        )
        self.client.force_authenticate(user=self.user2)

        # Trying to access Comp1 quote under Comp1 URL with User2 -> 403 Forbidden
        resp1 = self.client.get(f"/api/companies/{self.comp1.id}/purchases/quotations/{quote1.id}/")
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        # Trying to access Comp1 quote under Comp2 URL -> 404 Not Found
        resp2 = self.client.get(f"/api/companies/{self.comp2.id}/purchases/quotations/{quote1.id}/")
        self.assertEqual(resp2.status_code, status.HTTP_404_NOT_FOUND)

    def test_company_tenant_isolation_orders(self):
        PurchaseOrder.objects.create(
            company=self.comp1, vendor=self.vendor1, order_number="PO-2026-000501"
        )
        PurchaseOrder.objects.create(
            company=self.comp2, vendor=self.vendor_comp2, order_number="PO-2026-000502"
        )

        resp1 = self.client.get(f"/api/companies/{self.comp1.id}/purchases/orders/")
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        orders1 = [o["order_number"] for o in resp1.data]
        self.assertIn("PO-2026-000501", orders1)
        self.assertNotIn("PO-2026-000502", orders1)

    def test_cross_company_order_detail_rejected(self):
        order1 = PurchaseOrder.objects.create(
            company=self.comp1, vendor=self.vendor1, order_number="PO-2026-000503"
        )
        self.client.force_authenticate(user=self.user2)

        resp1 = self.client.get(f"/api/companies/{self.comp1.id}/purchases/orders/{order1.id}/")
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        resp2 = self.client.get(f"/api/companies/{self.comp2.id}/purchases/orders/{order1.id}/")
        self.assertEqual(resp2.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------
    # 5. Purchase Dashboard & Tenant Isolation
    # ------------------------------------------------------------
    def test_purchase_dashboard_metrics_and_tenant_isolation(self):
        # Create records for Comp1
        q1 = PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-D001",
            status=PurchaseQuotation.QuotationStatus.ACCEPTED,
        )
        o1 = PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            order_number="PO-2026-D001",
            status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
            total=Decimal("5000.00"),
        )
        o2 = PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            order_number="PO-2026-D002",
            status=PurchaseOrder.PurchaseOrderStatus.COMPLETED,
            total=Decimal("3000.00"),
        )

        resp = self.client.get(f"/api/companies/{self.comp1.id}/purchases/dashboard/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        metrics = resp.data["metrics"]
        self.assertGreaterEqual(metrics["total_purchase_quotations"], 1)
        self.assertGreaterEqual(metrics["accepted_quotations"], 1)
        self.assertGreaterEqual(metrics["total_purchase_orders"], 2)
        self.assertGreaterEqual(metrics["confirmed_orders"], 1)
        self.assertGreaterEqual(metrics["completed_orders"], 1)
        self.assertGreaterEqual(Decimal(str(metrics["total_purchase_value"])), Decimal("8000.00"))
        self.assertGreaterEqual(Decimal(str(metrics["pending_purchase_value"])), Decimal("5000.00"))
        self.assertEqual(metrics["active_vendors"], 1)

        # Ensure Comp2 dashboard is completely isolated
        self.client.force_authenticate(user=self.user2)
        resp2 = self.client.get(f"/api/companies/{self.comp2.id}/purchases/dashboard/")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        metrics2 = resp2.data["metrics"]
        self.assertEqual(metrics2["total_purchase_orders"], 0)
        self.assertEqual(Decimal(str(metrics2["total_purchase_value"])), Decimal("0.00"))

    # ------------------------------------------------------------
    # 6. Vendor Purchase History Foundation
    # ------------------------------------------------------------
    def test_vendor_purchase_history_success_and_metrics(self):
        q = PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-VH01",
            status=PurchaseQuotation.QuotationStatus.ACCEPTED,
        )
        o = PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            order_number="PO-2026-VH01",
            status=PurchaseOrder.PurchaseOrderStatus.COMPLETED,
            total=Decimal("4500.00"),
        )

        url = f"/api/companies/{self.comp1.id}/purchases/vendors/{self.vendor1.id}/history/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["vendor"]["name"], "Apex Components Ltd")
        self.assertEqual(resp.data["metrics"]["total_quotations"], 1)
        self.assertEqual(resp.data["metrics"]["total_orders"], 1)
        self.assertEqual(resp.data["metrics"]["completed_orders"], 1)
        self.assertEqual(Decimal(str(resp.data["metrics"]["total_purchased_amount"])), Decimal("4500.00"))
        self.assertEqual(len(resp.data["quotations"]), 1)
        self.assertEqual(len(resp.data["orders"]), 1)

    def test_vendor_purchase_history_tenant_isolation(self):
        # Comp2 tries to view Comp1 vendor history -> 404
        self.client.force_authenticate(user=self.user2)
        url = f"/api/companies/{self.comp2.id}/purchases/vendors/{self.vendor1.id}/history/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------
    # 7. Quotation & Order Filtering
    # ------------------------------------------------------------
    def test_quotation_filtering(self):
        PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-FLT1",
            status=PurchaseQuotation.QuotationStatus.DRAFT,
        )
        PurchaseQuotation.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            quotation_number="PQT-2026-FLT2",
            status=PurchaseQuotation.QuotationStatus.ACCEPTED,
        )

        resp = self.client.get(f"/api/companies/{self.comp1.id}/purchases/quotations/?status=DRAFT")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        statuses = [q["status"] for q in resp.data]
        self.assertTrue(all(s == "DRAFT" for s in statuses))

    def test_order_filtering(self):
        PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            warehouse=self.wh1,
            order_number="PO-2026-FLT1",
            status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED,
        )
        PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=self.vendor1,
            warehouse=self.wh1,
            order_number="PO-2026-FLT2",
            status=PurchaseOrder.PurchaseOrderStatus.COMPLETED,
        )

        resp = self.client.get(f"/api/companies/{self.comp1.id}/purchases/orders/?status=COMPLETED")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        statuses = [o["status"] for o in resp.data]
        self.assertTrue(all(s == "COMPLETED" for s in statuses))

    # ------------------------------------------------------------
    # 8. Superuser Access
    # ------------------------------------------------------------
    def test_superuser_access(self):
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.get(f"/api/companies/{self.comp1.id}/purchases/dashboard/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ============================================================
# PHASE 5B: PURCHASE + INVENTORY INTEGRATION TESTS
# ============================================================

class PurchaseInventoryIntegrationTests(APITestCase):
    """
    Phase 5B: Comprehensive test suite for Purchase + Inventory Integration
    Covering goods receiving, partial receiving, stock IN ledger, sequential GRN numbering,
    tenant isolation, and automated status transitions.
    """
    def setUp(self):
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")

        self.user1 = User.objects.create_user(
            username="pur_mgr1", email="mgr1@alphacorp.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            username="pur_mgr2", email="mgr2@betacorp.com", password="password123"
        )
        self.superuser = User.objects.create_superuser(
            username="pur_super", email="super@erp.com", password="password123"
        )

        self.comp1 = Company.objects.create(name="Alpha Corp", email="alpha_phase5b@corp.com", is_active=True)
        self.comp2 = Company.objects.create(name="Beta Industries", email="beta_phase5b@corp.com", is_active=True)

        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        self.cat1 = Category.objects.create(company=self.comp1, name="Hardware")
        self.prod1 = Product.objects.create(
            company=self.comp1, category=self.cat1, name="Widget Alpha", sku="WGT-A",
            cost_price=Decimal("100.00"), selling_price=Decimal("150.00")
        )
        self.prod2 = Product.objects.create(
            company=self.comp1, category=self.cat1, name="Widget Beta", sku="WGT-B",
            cost_price=Decimal("50.00"), selling_price=Decimal("80.00")
        )
        self.wh1 = Warehouse.objects.create(company=self.comp1, name="Main Warehouse", code="MWH-01", is_active=True)
        self.wh1_alt = Warehouse.objects.create(company=self.comp1, name="Annex Warehouse", code="ANX-01", is_active=True)
        self.vendor1 = Vendor.objects.create(company=self.comp1, name="Supplier Co", is_active=True)

        # Comp2 base data
        self.cat2 = Category.objects.create(company=self.comp2, name="Parts")
        self.prod_comp2 = Product.objects.create(
            company=self.comp2, category=self.cat2, name="Comp2 Part", sku="CP2-01",
            cost_price=Decimal("20.00"), selling_price=Decimal("40.00")
        )
        self.wh_comp2 = Warehouse.objects.create(company=self.comp2, name="Beta Warehouse", code="BWH-01", is_active=True)
        self.vendor_comp2 = Vendor.objects.create(company=self.comp2, name="Beta Vendor", is_active=True)

        self.client.force_authenticate(user=self.user1)

    def _create_order(self, company=None, vendor=None, warehouse=None, items=None, order_status=PurchaseOrder.PurchaseOrderStatus.CONFIRMED):
        company = company or self.comp1
        vendor = vendor or self.vendor1
        warehouse = warehouse or self.wh1
        items = items or [(self.prod1, Decimal("10.00"), Decimal("100.00"))]

        order = PurchaseOrder.objects.create(
            company=company,
            vendor=vendor,
            warehouse=warehouse,
            order_number=generate_purchase_order_number(company),
            order_date=timezone.localdate(),
            status=order_status,
            created_by=self.user1,
        )
        for prod, qty, price in items:
            PurchaseOrderItem.objects.create(
                purchase_order=order,
                product=prod,
                quantity=qty,
                unit_price=price,
            )
        order.recalculate_totals()
        order.save()
        return order

    # ------------------------------------------------------------
    # 1. GRN Sequential Numbering
    # ------------------------------------------------------------
    def test_grn_number_format_and_sequence(self):
        grn1 = generate_purchase_receipt_number(self.comp1)
        self.assertTrue(grn1.startswith(f"GRN-{timezone.now().year}-"))
        
        order = self._create_order()
        receipt1 = PurchaseReceipt.objects.create(
            company=self.comp1,
            purchase_order=order,
            receipt_number=grn1,
            warehouse=self.wh1,
            received_by=self.user1,
        )

        grn2 = generate_purchase_receipt_number(self.comp1)
        seq1 = int(grn1.split("-")[-1])
        seq2 = int(grn2.split("-")[-1])
        self.assertEqual(seq2, seq1 + 1)

    # ------------------------------------------------------------
    # 2. Full Goods Receiving
    # ------------------------------------------------------------
    def test_full_receiving_single_item(self):
        order = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item = order.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        payload = {
            "warehouse": self.wh1.id,
            "items": [
                {"purchase_order_item": item.id, "received_quantity": "10.00", "notes": "Full shipment"}
            ],
            "notes": "Delivered in full",
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["receipt_number"].startswith("GRN-"))
        self.assertEqual(Decimal(str(resp.data["total_quantity"])), Decimal("10.00"))

        # Verify stock increment
        stock = Stock.objects.get(product=self.prod1, warehouse=self.wh1)
        self.assertEqual(stock.quantity, Decimal("10.00"))

        # Verify PO status update
        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.PurchaseOrderStatus.COMPLETED)
        self.assertEqual(order.total_received_quantity, Decimal("10.00"))
        self.assertEqual(order.total_remaining_quantity, Decimal("0.00"))
        self.assertEqual(order.receiving_percentage, Decimal("100.00"))

    # ------------------------------------------------------------
    # 3. Partial Goods Receiving
    # ------------------------------------------------------------
    def test_partial_receiving_single_item(self):
        order = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item = order.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        payload = {
            "warehouse": self.wh1.id,
            "items": [
                {"purchase_order_item": item.id, "received_quantity": "4.00"}
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        stock = Stock.objects.get(product=self.prod1, warehouse=self.wh1)
        self.assertEqual(stock.quantity, Decimal("4.00"))

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED)
        self.assertEqual(order.total_received_quantity, Decimal("4.00"))
        self.assertEqual(order.total_remaining_quantity, Decimal("6.00"))
        self.assertEqual(order.receiving_percentage, Decimal("40.00"))

    # ------------------------------------------------------------
    # 4. Multiple Partial Receipts Until Completion
    # ------------------------------------------------------------
    def test_second_partial_receiving_completes_order(self):
        order = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        # First partial receipt: 4 units
        resp1 = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "4.00"}]}, format="json")
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED)

        # Second partial receipt: remaining 6 units
        resp2 = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "6.00"}]}, format="json")
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        stock = Stock.objects.get(product=self.prod1, warehouse=self.wh1)
        self.assertEqual(stock.quantity, Decimal("10.00"))

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.PurchaseOrderStatus.COMPLETED)
        self.assertEqual(order.total_remaining_quantity, Decimal("0.00"))
        self.assertEqual(order.receipts.count(), 2)

    # ------------------------------------------------------------
    # 5. Multi-Item Partial Receiving
    # ------------------------------------------------------------
    def test_multi_item_partial_receiving(self):
        order = self._create_order(items=[
            (self.prod1, Decimal("10.00"), Decimal("100.00")),
            (self.prod2, Decimal("20.00"), Decimal("50.00")),
        ])
        item1, item2 = order.items.all()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        # Receive 5 of prod1 and 0 of prod2 (or omit prod2)
        resp1 = self.client.post(url, {
            "items": [
                {"purchase_order_item": item1.id, "received_quantity": "5.00"},
                {"purchase_order_item": item2.id, "received_quantity": "0.00"},
            ]
        }, format="json")
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.PurchaseOrderStatus.PARTIALLY_RECEIVED)
        self.assertEqual(order.total_received_quantity, Decimal("5.00"))
        self.assertEqual(order.total_remaining_quantity, Decimal("25.00"))

        # Fulfill the rest
        resp2 = self.client.post(url, {
            "items": [
                {"purchase_order_item": item1.id, "received_quantity": "5.00"},
                {"purchase_order_item": item2.id, "received_quantity": "20.00"},
            ]
        }, format="json")
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.PurchaseOrderStatus.COMPLETED)
        self.assertEqual(order.total_remaining_quantity, Decimal("0.00"))
        self.assertEqual(Stock.objects.get(product=self.prod1, warehouse=self.wh1).quantity, Decimal("10.00"))
        self.assertEqual(Stock.objects.get(product=self.prod2, warehouse=self.wh1).quantity, Decimal("20.00"))

    # ------------------------------------------------------------
    # 6. Immutable StockTransaction Audit Log
    # ------------------------------------------------------------
    def test_stock_in_transaction_creation(self):
        order = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item = order.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {
            "items": [{"purchase_order_item": item.id, "received_quantity": "7.00", "notes": "Pallet #1"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        grn_number = resp.data["receipt_number"]

        tx = StockTransaction.objects.filter(
            company=self.comp1,
            product=self.prod1,
            warehouse=self.wh1,
            transaction_type=StockTransaction.TransactionType.STOCK_IN,
        ).first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.quantity, Decimal("7.00"))
        self.assertIn(order.order_number, tx.reference)
        self.assertIn(grn_number, tx.reference)
        self.assertEqual(tx.created_by, self.user1)

    # ------------------------------------------------------------
    # 7. Stock Auto-Creation
    # ------------------------------------------------------------
    def test_stock_record_auto_creation(self):
        self.assertEqual(Stock.objects.filter(product=self.prod1, warehouse=self.wh1_alt).count(), 0)

        order = self._create_order(warehouse=self.wh1_alt)
        item = order.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {
            "warehouse": self.wh1_alt.id,
            "items": [{"purchase_order_item": item.id, "received_quantity": "8.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        stock = Stock.objects.get(product=self.prod1, warehouse=self.wh1_alt)
        self.assertEqual(stock.quantity, Decimal("8.00"))
        self.assertEqual(stock.reserved_quantity, Decimal("0.00"))

    # ------------------------------------------------------------
    # 8. Reserved Stock Unaltered
    # ------------------------------------------------------------
    def test_stock_reserved_quantity_unchanged(self):
        Stock.objects.create(
            product=self.prod1,
            warehouse=self.wh1,
            quantity=Decimal("15.00"),
            reserved_quantity=Decimal("5.00"),
        )
        order = self._create_order()
        item = order.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {
            "items": [{"purchase_order_item": item.id, "received_quantity": "10.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        stock = Stock.objects.get(product=self.prod1, warehouse=self.wh1)
        self.assertEqual(stock.quantity, Decimal("25.00"))
        self.assertEqual(stock.reserved_quantity, Decimal("5.00"))

    # ------------------------------------------------------------
    # 9. Over-Receiving Rejected (Single Item)
    # ------------------------------------------------------------
    def test_over_receiving_single_item_rejected(self):
        order = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item = order.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {
            "items": [{"purchase_order_item": item.id, "received_quantity": "15.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("remain to be received", resp.data["detail"])
        self.assertEqual(Stock.objects.filter(product=self.prod1).count(), 0)

    # ------------------------------------------------------------
    # 10. Over-Receiving Rejected (Second Partial)
    # ------------------------------------------------------------
    def test_over_receiving_on_second_partial_rejected(self):
        order = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        # Receive 6
        self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "6.00"}]}, format="json")

        # Attempt to receive 5 when only 4 remain
        resp = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only 4.00 units remain", resp.data["detail"])

    # ------------------------------------------------------------
    # 11. Zero or Negative Quantities Rejected
    # ------------------------------------------------------------
    def test_zero_or_negative_receiving_rejected(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        # Negative
        resp_neg = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "-5.00"}]}, format="json")
        self.assertEqual(resp_neg.status_code, status.HTTP_400_BAD_REQUEST)

        # All zero
        resp_zero = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "0.00"}]}, format="json")
        self.assertEqual(resp_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # Empty items list
        resp_empty = self.client.post(url, {"items": []}, format="json")
        self.assertEqual(resp_empty.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------
    # 12. Receiving on Draft Order Rejected
    # ------------------------------------------------------------
    def test_receiving_on_draft_order_rejected(self):
        order = self._create_order(order_status=PurchaseOrder.PurchaseOrderStatus.DRAFT)
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("draft", resp.data["detail"].lower())

    # ------------------------------------------------------------
    # 13. Receiving on Completed Order Rejected
    # ------------------------------------------------------------
    def test_receiving_on_completed_order_rejected(self):
        order = self._create_order(order_status=PurchaseOrder.PurchaseOrderStatus.COMPLETED)
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("completed", resp.data["detail"].lower())

    # ------------------------------------------------------------
    # 14. Receiving on Cancelled Order Rejected
    # ------------------------------------------------------------
    def test_receiving_on_cancelled_order_rejected(self):
        order = self._create_order(order_status=PurchaseOrder.PurchaseOrderStatus.CANCELLED)
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelled", resp.data["detail"].lower())

    # ------------------------------------------------------------
    # 15. Invalid Warehouse Rejected
    # ------------------------------------------------------------
    def test_receiving_with_inactive_or_invalid_warehouse_rejected(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        resp = self.client.post(url, {
            "warehouse": 99999,
            "items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------
    # 16. Cross-Tenant Warehouse Rejected
    # ------------------------------------------------------------
    def test_cross_tenant_warehouse_rejected(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        # Attempt to receive into Comp2's warehouse
        resp = self.client.post(url, {
            "warehouse": self.wh_comp2.id,
            "items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------
    # 17. Cross-Tenant Receiving Isolation
    # ------------------------------------------------------------
    def test_cross_tenant_receiving_rejected(self):
        order = self._create_order()
        item = order.items.first()

        # Switch to User2 (Comp2)
        self.client.force_authenticate(user=self.user2)
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {
            "items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------
    # 18. Cross-Tenant Receipt List Isolated
    # ------------------------------------------------------------
    def test_cross_tenant_receipt_list_isolated(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]}, format="json")

        # User2 lists receipts in Comp2
        self.client.force_authenticate(user=self.user2)
        resp = self.client.get(f"/api/companies/{self.comp2.id}/purchases/receipts/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 0)

    # ------------------------------------------------------------
    # 19. Cross-Tenant Receipt Detail Rejected
    # ------------------------------------------------------------
    def test_cross_tenant_receipt_detail_rejected(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]}, format="json")
        receipt_id = resp.data["id"]

        # User2 retrieves receipt from Comp2 URL -> 404
        self.client.force_authenticate(user=self.user2)
        resp_detail = self.client.get(f"/api/companies/{self.comp2.id}/purchases/receipts/{receipt_id}/")
        self.assertEqual(resp_detail.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------
    # 20. Atomic Rollback on Failure
    # ------------------------------------------------------------
    def test_atomic_rollback_on_failure(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        payload = {
            "items": [
                {"purchase_order_item": item.id, "received_quantity": "5.00"},
                {"purchase_order_item": 99999, "received_quantity": "2.00"},  # Non-existent item
            ]
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Rollback: no stock, no transactions, no receipts created
        self.assertEqual(Stock.objects.filter(product=self.prod1).count(), 0)
        self.assertEqual(StockTransaction.objects.count(), 0)
        self.assertEqual(PurchaseReceipt.objects.count(), 0)

    # ------------------------------------------------------------
    # 21. Order Receipts List Endpoint
    # ------------------------------------------------------------
    def test_order_receipts_list_endpoint(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "3.00"}]}, format="json")
        self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "4.00"}]}, format="json")

        resp = self.client.get(f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receipts/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 2)

    # ------------------------------------------------------------
    # 22. Receipt Filtering
    # ------------------------------------------------------------
    def test_receipt_list_filtering(self):
        order = self._create_order()
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"

        resp = self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]}, format="json")
        grn_num = resp.data["receipt_number"]

        # Filter by receipt number
        res_filter = self.client.get(f"/api/companies/{self.comp1.id}/purchases/receipts/?receipt_number={grn_num}")
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_filter.data), 1)

        # Filter by search
        res_search = self.client.get(f"/api/companies/{self.comp1.id}/purchases/receipts/?search={order.order_number}")
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_search.data), 1)

    # ------------------------------------------------------------
    # 23. Order Serializer Computed Fields
    # ------------------------------------------------------------
    def test_order_serializer_computed_receiving_fields(self):
        order = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item = order.items.first()
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        self.client.post(url, {"items": [{"purchase_order_item": item.id, "received_quantity": "3.00"}]}, format="json")

        resp = self.client.get(f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(resp.data["total_ordered_quantity"])), Decimal("10.00"))
        self.assertEqual(Decimal(str(resp.data["total_received_quantity"])), Decimal("3.00"))
        self.assertEqual(Decimal(str(resp.data["total_remaining_quantity"])), Decimal("7.00"))
        self.assertEqual(Decimal(str(resp.data["receiving_percentage"])), Decimal("30.00"))
        self.assertEqual(len(resp.data["receipts"]), 1)

    # ------------------------------------------------------------
    # 24. Purchase Dashboard Receiving Metrics
    # ------------------------------------------------------------
    def test_purchase_dashboard_receiving_metrics(self):
        # Order 1: Partially received
        order1 = self._create_order(items=[(self.prod1, Decimal("10.00"), Decimal("100.00"))])
        item1 = order1.items.first()
        self.client.post(f"/api/companies/{self.comp1.id}/purchases/orders/{order1.id}/receive/", {
            "items": [{"purchase_order_item": item1.id, "received_quantity": "4.00"}]
        }, format="json")

        # Order 2: Fully received (Completed)
        order2 = self._create_order(items=[(self.prod2, Decimal("5.00"), Decimal("50.00"))])
        item2 = order2.items.first()
        self.client.post(f"/api/companies/{self.comp1.id}/purchases/orders/{order2.id}/receive/", {
            "items": [{"purchase_order_item": item2.id, "received_quantity": "5.00"}]
        }, format="json")

        resp = self.client.get(f"/api/companies/{self.comp1.id}/purchases/dashboard/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        metrics = resp.data["metrics"]
        self.assertEqual(metrics["partially_received_orders"], 1)
        self.assertEqual(metrics["completed_receiving_orders"], 1)
        self.assertEqual(metrics["total_goods_receipts"], 2)
        self.assertEqual(Decimal(str(metrics["total_units_received"])), Decimal("9.00"))
        self.assertEqual(len(resp.data["recent_receipts"]), 2)

    # ------------------------------------------------------------
    # 25. Item Belonging to Another Order Rejected
    # ------------------------------------------------------------
    def test_item_belonging_to_other_order_rejected(self):
        orderA = self._create_order()
        orderB = self._create_order()
        itemB = orderB.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{orderA.id}/receive/"
        resp = self.client.post(url, {
            "items": [{"purchase_order_item": itemB.id, "received_quantity": "5.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("does not belong", resp.data["detail"])

    # ------------------------------------------------------------
    # 26. Receiving from Processing Status
    # ------------------------------------------------------------
    def test_receiving_from_processing_status(self):
        order = self._create_order(order_status=PurchaseOrder.PurchaseOrderStatus.PROCESSING)
        item = order.items.first()

        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {
            "items": [{"purchase_order_item": item.id, "received_quantity": "10.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.PurchaseOrderStatus.COMPLETED)

    # ------------------------------------------------------------
    # 27. Superuser Can Receive Goods
    # ------------------------------------------------------------
    def test_superuser_can_receive_goods(self):
        order = self._create_order()
        item = order.items.first()

        self.client.force_authenticate(user=self.superuser)
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/"
        resp = self.client.post(url, {
            "items": [{"purchase_order_item": item.id, "received_quantity": "10.00"}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


# ============================================================
# PHASE 5D: PURCHASE FINALIZATION, REPORTING & INTEGRATION TESTS
# ============================================================

class PurchaseFinalizationAndIntegrationTests(APITestCase):
    """
    29 focused tests verifying:
    - Dashboard AP financial KPIs
    - Analytics 12-month trends & distributions
    - All 5 Reports (summary, orders, vendors, receiving, financial)
    - Report multi-criteria query filters
    - Purchase Invoice creation (from PO and direct)
    - Purchase Payment recording & balance recalculation
    - Overpayment rejection
    - Purchase Order payment_status progression
    - Vendor purchase history completeness
    - Tenant isolation on invoices, payments, analytics, reports
    - End-to-end full procurement & payment lifecycle
    """
    def setUp(self):
        # 1. User roles
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")

        # 2. Users
        self.user1 = User.objects.create_user(
            username="p5d_admin1", email="p5d1@corp1.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            username="p5d_admin2", email="p5d2@corp2.com", password="password123"
        )
        self.superuser = User.objects.create_superuser(
            username="p5d_super", email="p5d_super@corp.com", password="password123"
        )

        # 3. Companies
        self.comp1 = Company.objects.create(name="Apex Enterprise", email="apex@corp.com", is_active=True)
        self.comp2 = Company.objects.create(name="Zenith Corp", email="zenith@corp.com", is_active=True)

        # 4. Memberships
        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        # 5. Base Data for Comp1
        self.cat1 = Category.objects.create(company=self.comp1, name="Electronics")
        self.prod1 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="GPU X1",
            sku="GPU-001",
            cost_price=Decimal("200.00"),
            selling_price=Decimal("350.00"),
        )
        self.prod2 = Product.objects.create(
            company=self.comp1,
            category=self.cat1,
            name="RAM 16GB",
            sku="RAM-016",
            cost_price=Decimal("50.00"),
            selling_price=Decimal("90.00"),
        )
        self.wh1 = Warehouse.objects.create(company=self.comp1, name="North Depot", code="WH-N", is_active=True)
        self.vendor1 = Vendor.objects.create(
            company=self.comp1,
            name="Silicon Tech Ltd",
            email="sales@silicon.com",
            phone="12345",
            is_active=True,
        )
        self.vendor2 = Vendor.objects.create(
            company=self.comp1,
            name="Global Micro",
            email="info@micro.com",
            phone="67890",
            is_active=True,
        )

        # 6. Base Data for Comp2
        self.cat2 = Category.objects.create(company=self.comp2, name="Raw Materials")
        self.prod_c2 = Product.objects.create(
            company=self.comp2,
            category=self.cat2,
            name="Copper Wire",
            sku="COP-01",
            cost_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
        )
        self.wh_c2 = Warehouse.objects.create(company=self.comp2, name="Zenith WH", code="Z-WH", is_active=True)
        self.vendor_c2 = Vendor.objects.create(company=self.comp2, name="Zenith Supplier", is_active=True)

        self.client.force_authenticate(user=self.user1)

    def _create_order(self, vendor=None, warehouse=None, items=None, status_val=PurchaseOrder.PurchaseOrderStatus.CONFIRMED):
        v = vendor or self.vendor1
        w = warehouse or self.wh1
        itms = items or [(self.prod1, Decimal("10.00"), Decimal("200.00"))]

        order = PurchaseOrder.objects.create(
            company=self.comp1,
            vendor=v,
            warehouse=w,
            order_number=generate_purchase_order_number(),
            order_date=timezone.localdate(),
            status=status_val,
            created_by=self.user1,
        )
        subtotal = Decimal("0.00")
        for prod, qty, price in itms:
            line_tot = qty * price
            subtotal += line_tot
            PurchaseOrderItem.objects.create(
                purchase_order=order,
                product=prod,
                quantity=qty,
                unit_price=price,
                line_total=line_tot,
            )
        order.subtotal = subtotal
        order.total = subtotal
        order.save()
        return order

    def _create_invoice(self, order=None, vendor=None, total=Decimal("2000.00"), status_val=PurchaseInvoice.InvoiceStatus.ISSUED):
        v = vendor or (order.vendor if order else self.vendor1)
        inv = PurchaseInvoice.objects.create(
            company=self.comp1,
            purchase_order=order,
            vendor=v,
            invoice_number=generate_purchase_invoice_number(),
            invoice_date=timezone.localdate(),
            subtotal=total,
            total=total,
            balance_due=total,
            amount_paid=Decimal("0.00"),
            status=status_val,
            created_by=self.user1,
        )
        return inv

    # ------------------------------------------------------------
    # 1. Dashboard AP Financial KPIs
    # ------------------------------------------------------------
    def test_01_dashboard_kpis_and_ap_financials(self):
        order1 = self._create_order()  # Total 2000
        inv1 = self._create_invoice(order=order1, total=Decimal("2000.00"))

        # Pay 800
        PurchasePayment.objects.create(
            company=self.comp1,
            invoice=inv1,
            vendor=inv1.vendor,
            payment_number=generate_purchase_payment_number(),
            payment_date=timezone.localdate(),
            amount=Decimal("800.00"),
            payment_method=PurchasePayment.PaymentMethod.BANK_TRANSFER,
            created_by=self.user1,
        )
        inv1.paid_amount = Decimal("800.00")
        inv1.balance_due = Decimal("1200.00")
        inv1.status = PurchaseInvoice.InvoiceStatus.PARTIALLY_PAID
        inv1.save()

        url = f"/api/companies/{self.comp1.id}/purchases/dashboard/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        metrics = resp.data["metrics"]

        self.assertEqual(Decimal(str(metrics["total_purchase_value"])), Decimal("2000.00"))
        self.assertEqual(Decimal(str(metrics["total_invoiced_amount"])), Decimal("2000.00"))
        self.assertEqual(Decimal(str(metrics["total_paid_amount"])), Decimal("800.00"))
        self.assertEqual(Decimal(str(metrics["total_outstanding_amount"])), Decimal("1200.00"))
        self.assertEqual(len(resp.data["recent_invoices"]), 1)
        self.assertEqual(len(resp.data["recent_payments"]), 1)
        self.assertIn("PARTIALLY_PAID", resp.data["invoices_by_status"])

    # ------------------------------------------------------------
    # 2. Analytics Monthly Trends
    # ------------------------------------------------------------
    def test_02_analytics_monthly_trends(self):
        self._create_order()
        inv = self._create_invoice()
        PurchasePayment.objects.create(
            company=self.comp1,
            invoice=inv,
            vendor=inv.vendor,
            payment_number=generate_purchase_payment_number(),
            payment_date=timezone.localdate(),
            amount=Decimal("500.00"),
            payment_method=PurchasePayment.PaymentMethod.BANK_TRANSFER,
            created_by=self.user1,
        )

        url = f"/api/companies/{self.comp1.id}/purchases/analytics/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        trends = resp.data["monthly_trends"]
        self.assertEqual(len(trends), 12)
        current_m = trends[-1]
        self.assertGreaterEqual(Decimal(str(current_m["purchase_total"])), Decimal("2000.00"))
        self.assertGreaterEqual(Decimal(str(current_m["paid_total"])), Decimal("500.00"))

    # ------------------------------------------------------------
    # 3. Analytics Order and Invoice Distributions
    # ------------------------------------------------------------
    def test_03_analytics_order_and_invoice_distributions(self):
        self._create_order(status_val=PurchaseOrder.PurchaseOrderStatus.CONFIRMED)
        self._create_invoice(status_val=PurchaseInvoice.InvoiceStatus.ISSUED)

        url = f"/api/companies/{self.comp1.id}/purchases/analytics/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        order_dist = {d["status"]: d["count"] for d in resp.data["order_status_distribution"]}
        self.assertGreaterEqual(order_dist.get("CONFIRMED", 0), 1)

        inv_dist = {d["status"]: d["count"] for d in resp.data["invoice_status_distribution"]}
        self.assertGreaterEqual(inv_dist.get("ISSUED", 0), 1)

    # ------------------------------------------------------------
    # 4. Analytics Top Vendors and Top Products
    # ------------------------------------------------------------
    def test_04_analytics_top_vendors_and_products(self):
        order = self._create_order(vendor=self.vendor1, items=[(self.prod1, Decimal("10.00"), Decimal("200.00"))])
        self._create_invoice(order=order, total=Decimal("2000.00"))

        url = f"/api/companies/{self.comp1.id}/purchases/analytics/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        vendors = resp.data["top_vendors"]
        self.assertTrue(any(v["vendor_name"] == "Silicon Tech Ltd" for v in vendors))

        products = resp.data["top_products"]
        self.assertTrue(any(p["product_name"] == "GPU X1" for p in products))

    # ------------------------------------------------------------
    # 5. Analytics Rates & Empty Company Safety
    # ------------------------------------------------------------
    def test_05_analytics_rates_and_empty_company(self):
        # Empty company check (Comp 2)
        self.client.force_authenticate(user=self.user2)
        url = f"/api/companies/{self.comp2.id}/purchases/analytics/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["ordered_vs_received"]["fulfillment_rate_percentage"], 0.0)
        self.assertEqual(resp.data["financial_overview"]["payment_rate_percentage"], 0.0)
        self.assertEqual(resp.data["quotation_conversion"]["conversion_rate_percentage"], 0.0)

    # ------------------------------------------------------------
    # 6. Reports Summary Endpoint
    # ------------------------------------------------------------
    def test_06_reports_summary_endpoint(self):
        self._create_order()
        self._create_invoice()

        # Test both query param and dedicated subview
        url1 = f"/api/companies/{self.comp1.id}/purchases/reports/?report_type=summary"
        url2 = f"/api/companies/{self.comp1.id}/purchases/reports/summary/"
        for u in [url1, url2]:
            resp = self.client.get(u)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertEqual(resp.data["report_type"], "summary")
            self.assertIn("summary", resp.data)
            self.assertGreaterEqual(resp.data["summary"]["total_orders"], 1)

    # ------------------------------------------------------------
    # 7. Reports Orders Endpoint
    # ------------------------------------------------------------
    def test_07_reports_orders_endpoint(self):
        order = self._create_order()
        url = f"/api/companies/{self.comp1.id}/purchases/reports/orders/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["report_type"], "orders")
        self.assertGreaterEqual(len(resp.data["data"]), 1)
        row = resp.data["data"][0]
        self.assertEqual(row["order_number"], order.order_number)
        self.assertIn("receiving_percentage", row)

    # ------------------------------------------------------------
    # 8. Reports Vendors Endpoint
    # ------------------------------------------------------------
    def test_08_reports_vendors_endpoint(self):
        self._create_order(vendor=self.vendor1)
        url = f"/api/companies/{self.comp1.id}/purchases/reports/vendors/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["report_type"], "vendors")
        self.assertGreaterEqual(len(resp.data["data"]), 1)
        v_entry = next((item for item in resp.data["data"] if item["vendor_id"] == self.vendor1.id), None)
        self.assertIsNotNone(v_entry)
        self.assertGreaterEqual(v_entry["order_count"], 1)

    # ------------------------------------------------------------
    # 9. Reports Receiving Endpoint
    # ------------------------------------------------------------
    def test_09_reports_receiving_endpoint(self):
        order = self._create_order()
        item = order.items.first()
        # Post GRN
        self.client.post(f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/receive/", {
            "items": [{"purchase_order_item": item.id, "received_quantity": "5.00"}]
        }, format="json")

        url = f"/api/companies/{self.comp1.id}/purchases/reports/receiving/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["report_type"], "receiving")
        self.assertGreaterEqual(len(resp.data["data"]), 1)
        self.assertEqual(Decimal(str(resp.data["data"][0]["total_quantity"])), Decimal("5.00"))

    # ------------------------------------------------------------
    # 10. Reports Financial Endpoint
    # ------------------------------------------------------------
    def test_10_reports_financial_endpoint(self):
        inv = self._create_invoice()
        PurchasePayment.objects.create(
            company=self.comp1,
            invoice=inv,
            vendor=inv.vendor,
            payment_number=generate_purchase_payment_number(),
            payment_date=timezone.localdate(),
            amount=Decimal("400.00"),
            payment_method=PurchasePayment.PaymentMethod.BANK_TRANSFER,
            created_by=self.user1,
        )

        url = f"/api/companies/{self.comp1.id}/purchases/reports/financial/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["report_type"], "financial")
        self.assertIn("invoices", resp.data)
        self.assertIn("payments", resp.data)
        self.assertGreaterEqual(len(resp.data["invoices"]), 1)
        self.assertGreaterEqual(len(resp.data["payments"]), 1)

    # ------------------------------------------------------------
    # 11. Reports Date Filtering
    # ------------------------------------------------------------
    def test_11_reports_date_filtering(self):
        self._create_order()
        # Querying date in year 2099 should yield 0 results
        url = f"/api/companies/{self.comp1.id}/purchases/reports/orders/?date_from=2099-01-01"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["data"]), 0)

    # ------------------------------------------------------------
    # 12. Reports Vendor Filtering
    # ------------------------------------------------------------
    def test_12_reports_vendor_filtering(self):
        order1 = self._create_order(vendor=self.vendor1)
        self._create_order(vendor=self.vendor2)

        url = f"/api/companies/{self.comp1.id}/purchases/reports/orders/?vendor={self.vendor1.id}"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["data"]), 1)
        self.assertEqual(resp.data["data"][0]["order_number"], order1.order_number)

    # ------------------------------------------------------------
    # 13. Reports Warehouse Filtering
    # ------------------------------------------------------------
    def test_13_reports_warehouse_filtering(self):
        order = self._create_order(warehouse=self.wh1)
        url = f"/api/companies/{self.comp1.id}/purchases/reports/orders/?warehouse={self.wh1.id}"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["data"]), 1)
        self.assertEqual(resp.data["data"][0]["order_number"], order.order_number)

    # ------------------------------------------------------------
    # 14. Reports Status Filtering
    # ------------------------------------------------------------
    def test_14_reports_status_filtering(self):
        self._create_order(status_val=PurchaseOrder.PurchaseOrderStatus.CONFIRMED)
        self._create_order(status_val=PurchaseOrder.PurchaseOrderStatus.CANCELLED)

        url = f"/api/companies/{self.comp1.id}/purchases/reports/orders/?status=CONFIRMED"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(all(o["status"] == "CONFIRMED" for o in resp.data["data"]))

    # ------------------------------------------------------------
    # 15. Reports Product Filtering
    # ------------------------------------------------------------
    def test_15_reports_product_filtering(self):
        self._create_order(items=[(self.prod1, Decimal("2.00"), Decimal("200.00"))])
        self._create_order(items=[(self.prod2, Decimal("5.00"), Decimal("50.00"))])

        url = f"/api/companies/{self.comp1.id}/purchases/reports/orders/?product={self.prod1.id}"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["data"]), 1)

    # ------------------------------------------------------------
    # 16. Create Invoice from Purchase Order
    # ------------------------------------------------------------
    def test_16_create_invoice_from_purchase_order(self):
        order = self._create_order(items=[
            (self.prod1, Decimal("5.00"), Decimal("200.00")),
            (self.prod2, Decimal("10.00"), Decimal("50.00")),
        ])
        url = f"/api/companies/{self.comp1.id}/purchases/orders/{order.id}/invoice/"
        payload = {
            "invoice_date": "2026-09-18",
            "vendor_invoice_number": "VEND-BILL-101",
            "notes": "Net 30 terms",
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["invoice_number"].startswith("PINV-"))
        self.assertEqual(resp.data["vendor_invoice_number"], "VEND-BILL-101")
        self.assertEqual(Decimal(str(resp.data["total"])), Decimal("1500.00"))
        self.assertEqual(Decimal(str(resp.data["balance_due"])), Decimal("1500.00"))
        self.assertEqual(len(resp.data["items"]), 2)

    # ------------------------------------------------------------
    # 17. Create Direct Purchase Invoice
    # ------------------------------------------------------------
    def test_17_create_direct_purchase_invoice(self):
        url = f"/api/companies/{self.comp1.id}/purchases/invoices/"
        payload = {
            "vendor": self.vendor1.id,
            "invoice_date": "2026-09-18",
            "vendor_invoice_number": "DIRECT-BILL-01",
            "items": [
                {
                    "product": self.prod1.id,
                    "description": "Direct Procurement",
                    "quantity": "4.00",
                    "unit_price": "200.00",
                    "discount": "50.00",
                    "tax": "25.00",
                }
            ],
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(resp.data["subtotal"])), Decimal("800.00"))
        self.assertEqual(Decimal(str(resp.data["discount"])), Decimal("50.00"))
        self.assertEqual(Decimal(str(resp.data["tax"])), Decimal("25.00"))
        self.assertEqual(Decimal(str(resp.data["total"])), Decimal("775.00"))
        self.assertEqual(Decimal(str(resp.data["balance_due"])), Decimal("775.00"))

    # ------------------------------------------------------------
    # 18. Purchase Invoice Detail & Cancellation
    # ------------------------------------------------------------
    def test_18_purchase_invoice_detail_and_cancel(self):
        inv = self._create_invoice()
        url = f"/api/companies/{self.comp1.id}/purchases/invoices/{inv.id}/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["invoice_number"], inv.invoice_number)

        del_resp = self.client.delete(url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, PurchaseInvoice.InvoiceStatus.CANCELLED)

    # ------------------------------------------------------------
    # 19. Cannot Cancel Paid Invoice
    # ------------------------------------------------------------
    def test_19_cannot_cancel_paid_invoice(self):
        inv = self._create_invoice(status_val=PurchaseInvoice.InvoiceStatus.PAID)
        url = f"/api/companies/{self.comp1.id}/purchases/invoices/{inv.id}/"
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("paid", resp.data["detail"].lower())

    # ------------------------------------------------------------
    # 20. Record Partial Payment
    # ------------------------------------------------------------
    def test_20_record_partial_payment(self):
        inv = self._create_invoice(total=Decimal("1000.00"))
        url = f"/api/companies/{self.comp1.id}/purchases/invoices/{inv.id}/payments/"
        payload = {
            "amount": "400.00",
            "payment_method": "BANK_TRANSFER",
            "payment_date": "2026-09-18",
            "reference": "WIRE-992",
        }
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["payment_number"].startswith("PPAY-"))

        inv.refresh_from_db()
        self.assertEqual(inv.status, PurchaseInvoice.InvoiceStatus.PARTIALLY_PAID)
        self.assertEqual(inv.paid_amount, Decimal("400.00"))
        self.assertEqual(inv.balance_due, Decimal("600.00"))

    # ------------------------------------------------------------
    # 21. Record Full Payment (Completes Invoice)
    # ------------------------------------------------------------
    def test_21_record_full_payment(self):
        inv = self._create_invoice(total=Decimal("1000.00"))
        url = f"/api/companies/{self.comp1.id}/purchases/invoices/{inv.id}/payments/"

        # First payment: 400
        self.client.post(url, {"amount": "400.00", "payment_method": "CASH"}, format="json")
        # Second payment: 600
        resp = self.client.post(url, {"amount": "600.00", "payment_method": "BANK_TRANSFER"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        inv.refresh_from_db()
        self.assertEqual(inv.status, PurchaseInvoice.InvoiceStatus.PAID)
        self.assertEqual(inv.paid_amount, Decimal("1000.00"))
        self.assertEqual(inv.balance_due, Decimal("0.00"))

    # ------------------------------------------------------------
    # 22. Overpayment Rejected
    # ------------------------------------------------------------
    def test_22_overpayment_rejected(self):
        inv = self._create_invoice(total=Decimal("500.00"))
        url = f"/api/companies/{self.comp1.id}/purchases/invoices/{inv.id}/payments/"
        resp = self.client.post(url, {"amount": "600.00", "payment_method": "CASH"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        detail_msg = resp.data.get("detail")
        if isinstance(detail_msg, list):
            detail_msg = detail_msg[0]
        self.assertIn("cannot exceed balance due", str(detail_msg).lower())

    # ------------------------------------------------------------
    # 23. Purchase Order Payment Status Progression
    # ------------------------------------------------------------
    def test_23_purchase_order_payment_status_progression(self):
        order = self._create_order(items=[(self.prod1, Decimal("5.00"), Decimal("200.00"))])
        self.assertEqual(order.payment_status, "UNINVOICED")

        # Create invoice
        inv = self._create_invoice(order=order, total=Decimal("1000.00"))
        self.assertEqual(order.payment_status, "UNPAID")

        # Partial payment
        url = f"/api/companies/{self.comp1.id}/purchases/invoices/{inv.id}/payments/"
        self.client.post(url, {"amount": "400.00", "payment_method": "CASH"}, format="json")
        self.assertEqual(order.payment_status, "PARTIALLY_PAID")

        # Full payment
        self.client.post(url, {"amount": "600.00", "payment_method": "BANK_TRANSFER"}, format="json")
        self.assertEqual(order.payment_status, "PAID")

    # ------------------------------------------------------------
    # 24. Payments List & Filtering
    # ------------------------------------------------------------
    def test_24_payments_list_and_filters(self):
        inv1 = self._create_invoice(vendor=self.vendor1, total=Decimal("500.00"))
        inv2 = self._create_invoice(vendor=self.vendor2, total=Decimal("300.00"))

        p1 = PurchasePayment.objects.create(
            company=self.comp1,
            invoice=inv1,
            vendor=self.vendor1,
            payment_number=generate_purchase_payment_number(),
            payment_date=timezone.localdate(),
            amount=Decimal("500.00"),
            payment_method=PurchasePayment.PaymentMethod.BANK_TRANSFER,
            created_by=self.user1,
        )
        p2 = PurchasePayment.objects.create(
            company=self.comp1,
            invoice=inv2,
            vendor=self.vendor2,
            payment_number=generate_purchase_payment_number(),
            payment_date=timezone.localdate(),
            amount=Decimal("300.00"),
            payment_method=PurchasePayment.PaymentMethod.CASH,
            created_by=self.user1,
        )

        # Filter by vendor
        res_v = self.client.get(f"/api/companies/{self.comp1.id}/purchases/payments/?vendor={self.vendor1.id}")
        self.assertEqual(res_v.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_v.data), 1)
        self.assertEqual(res_v.data[0]["payment_number"], p1.payment_number)

        # Filter by payment method
        res_m = self.client.get(f"/api/companies/{self.comp1.id}/purchases/payments/?payment_method=CASH")
        self.assertEqual(res_m.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_m.data), 1)
        self.assertEqual(res_m.data[0]["payment_number"], p2.payment_number)

    # ------------------------------------------------------------
    # 25. Vendor Purchase History Includes Invoices and Payments
    # ------------------------------------------------------------
    def test_25_vendor_purchase_history_includes_all_modules(self):
        order = self._create_order(vendor=self.vendor1)
        inv = self._create_invoice(order=order, vendor=self.vendor1, total=Decimal("2000.00"))
        PurchasePayment.objects.create(
            company=self.comp1,
            invoice=inv,
            vendor=self.vendor1,
            payment_number=generate_purchase_payment_number(),
            payment_date=timezone.localdate(),
            amount=Decimal("1000.00"),
            payment_method=PurchasePayment.PaymentMethod.BANK_TRANSFER,
            created_by=self.user1,
        )

        url = f"/api/companies/{self.comp1.id}/purchases/vendors/{self.vendor1.id}/history/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("invoices", resp.data)
        self.assertIn("payments", resp.data)
        self.assertEqual(len(resp.data["invoices"]), 1)
        self.assertEqual(len(resp.data["payments"]), 1)
        metrics = resp.data["metrics"]
        self.assertEqual(Decimal(str(metrics["total_invoiced_amount"])), Decimal("2000.00"))
        self.assertEqual(Decimal(str(metrics["total_paid_amount"])), Decimal("1000.00"))

    # ------------------------------------------------------------
    # 26. Tenant Isolation: Invoices
    # ------------------------------------------------------------
    def test_26_tenant_isolation_invoices(self):
        inv1 = self._create_invoice()
        # User 2 cannot access Comp 1 invoice
        self.client.force_authenticate(user=self.user2)

        # 403 trying to access comp1 endpoint
        resp_comp1 = self.client.get(f"/api/companies/{self.comp1.id}/purchases/invoices/{inv1.id}/")
        self.assertEqual(resp_comp1.status_code, status.HTTP_403_FORBIDDEN)

        # 404 trying to access comp1 invoice under comp2 endpoint
        resp_comp2 = self.client.get(f"/api/companies/{self.comp2.id}/purchases/invoices/{inv1.id}/")
        self.assertEqual(resp_comp2.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------
    # 27. Tenant Isolation: Payments
    # ------------------------------------------------------------
    def test_27_tenant_isolation_payments(self):
        inv1 = self._create_invoice()
        self.client.force_authenticate(user=self.user2)

        # Attempt to pay Comp 1 invoice from Comp 2 endpoint -> 404
        pay_url = f"/api/companies/{self.comp2.id}/purchases/invoices/{inv1.id}/payments/"
        resp = self.client.post(pay_url, {"amount": "100.00", "payment_method": "CASH"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------
    # 28. Tenant Isolation: Analytics and Reports
    # ------------------------------------------------------------
    def test_28_tenant_isolation_analytics_and_reports(self):
        self._create_order()
        self._create_invoice()

        # Comp 2 user accessing Comp 2 analytics sees 0 orders and 0 spend
        self.client.force_authenticate(user=self.user2)
        an_resp = self.client.get(f"/api/companies/{self.comp2.id}/purchases/analytics/")
        self.assertEqual(an_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(an_resp.data["top_vendors"]), 0)

        rep_resp = self.client.get(f"/api/companies/{self.comp2.id}/purchases/reports/summary/")
        self.assertEqual(rep_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(rep_resp.data["summary"]["total_orders"], 0)

    # ------------------------------------------------------------
    # 29. End-to-End Complete Procurement Lifecycle
    # ------------------------------------------------------------
    def test_29_e2e_complete_procurement_lifecycle(self):
        # 1. Create Purchase Quotation
        q_resp = self.client.post(f"/api/companies/{self.comp1.id}/purchases/quotations/", {
            "vendor": self.vendor1.id,
            "quotation_date": "2026-09-18",
            "items": [
                {
                    "product": self.prod1.id,
                    "description": "E2E Procurement",
                    "quantity": "10.00",
                    "unit_price": "200.00",
                    "discount": "0.00",
                    "tax": "0.00",
                }
            ],
        }, format="json")
        self.assertEqual(q_resp.status_code, status.HTTP_201_CREATED)
        quote_id = q_resp.data["id"]

        # 2. Accept and Convert to Purchase Order
        self.client.patch(f"/api/companies/{self.comp1.id}/purchases/quotations/{quote_id}/", {
            "status": "ACCEPTED"
        }, format="json")

        conv_resp = self.client.post(
            f"/api/companies/{self.comp1.id}/purchases/quotations/{quote_id}/convert-to-order/",
            {"warehouse": self.wh1.id},
            format="json",
        )
        self.assertEqual(conv_resp.status_code, status.HTTP_201_CREATED)
        order_id = conv_resp.data["id"]
        po_item_id = conv_resp.data["items"][0]["id"]

        # 3. Confirm Purchase Order
        self.client.patch(f"/api/companies/{self.comp1.id}/purchases/orders/{order_id}/", {
            "status": "CONFIRMED"
        }, format="json")

        # 4. Partial Goods Receiving (6 units) -> Stock IN
        rcv1_resp = self.client.post(f"/api/companies/{self.comp1.id}/purchases/orders/{order_id}/receive/", {
            "items": [{"purchase_order_item": po_item_id, "received_quantity": "6.00"}]
        }, format="json")
        self.assertEqual(rcv1_resp.status_code, status.HTTP_201_CREATED)

        # Verify stock incremented by 6
        stock1 = Stock.objects.get(product=self.prod1, warehouse=self.wh1)
        self.assertEqual(stock1.quantity, Decimal("6.00"))

        # 5. Remaining Goods Receiving (4 units) -> Order completed -> Stock IN
        rcv2_resp = self.client.post(f"/api/companies/{self.comp1.id}/purchases/orders/{order_id}/receive/", {
            "items": [{"purchase_order_item": po_item_id, "received_quantity": "4.00"}]
        }, format="json")
        self.assertEqual(rcv2_resp.status_code, status.HTTP_201_CREATED)

        stock1.refresh_from_db()
        self.assertEqual(stock1.quantity, Decimal("10.00"))

        po = PurchaseOrder.objects.get(id=order_id)
        self.assertEqual(po.status, PurchaseOrder.PurchaseOrderStatus.COMPLETED)

        # 6. Generate Purchase Invoice from PO ($2000)
        inv_resp = self.client.post(f"/api/companies/{self.comp1.id}/purchases/orders/{order_id}/invoice/", {
            "invoice_date": "2026-09-18",
            "vendor_invoice_number": "E2E-INV-001",
        }, format="json")
        self.assertEqual(inv_resp.status_code, status.HTTP_201_CREATED)
        inv_id = inv_resp.data["id"]
        self.assertEqual(Decimal(str(inv_resp.data["balance_due"])), Decimal("2000.00"))

        # 7. Record Partial Payment ($1200)
        p1_resp = self.client.post(f"/api/companies/{self.comp1.id}/purchases/invoices/{inv_id}/payments/", {
            "amount": "1200.00",
            "payment_method": "BANK_TRANSFER",
        }, format="json")
        self.assertEqual(p1_resp.status_code, status.HTTP_201_CREATED)

        inv = PurchaseInvoice.objects.get(id=inv_id)
        self.assertEqual(inv.status, PurchaseInvoice.InvoiceStatus.PARTIALLY_PAID)
        self.assertEqual(inv.balance_due, Decimal("800.00"))
        po.refresh_from_db()
        self.assertEqual(po.payment_status, "PARTIALLY_PAID")

        # 8. Record Final Payment ($800) -> Invoice Settled
        p2_resp = self.client.post(f"/api/companies/{self.comp1.id}/purchases/invoices/{inv_id}/payments/", {
            "amount": "800.00",
            "payment_method": "BANK_TRANSFER",
        }, format="json")
        self.assertEqual(p2_resp.status_code, status.HTTP_201_CREATED)

        inv.refresh_from_db()
        self.assertEqual(inv.status, PurchaseInvoice.InvoiceStatus.PAID)
        self.assertEqual(inv.balance_due, Decimal("0.00"))
        po.refresh_from_db()
        self.assertEqual(po.payment_status, "PAID")


