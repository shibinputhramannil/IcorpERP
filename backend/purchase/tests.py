from decimal import Decimal
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from inventory.models import Category, Product, Warehouse, Vendor
from purchase.models import (
    PurchaseQuotation,
    PurchaseQuotationItem,
    PurchaseOrder,
    PurchaseOrderItem,
    generate_purchase_quotation_number,
    generate_purchase_order_number,
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
