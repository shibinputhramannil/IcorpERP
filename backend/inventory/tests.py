from decimal import Decimal
from django.contrib.auth.models import User, Group
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from company.models import Company
from accounts.models import CompanyMembership
from inventory.models import Category, Product, Warehouse, Stock, StockTransaction, Vendor


class InventoryTests(APITestCase):
    def setUp(self):
        # 1. Roles
        self.admin_group, _ = Group.objects.get_or_create(name="Company Admin")
        self.employee_group, _ = Group.objects.get_or_create(name="Employee")

        # 2. Users
        self.user1 = User.objects.create_user(
            username="inventory_admin1", email="inv1@company1.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            username="inventory_admin2", email="inv2@company2.com", password="password123"
        )
        self.superuser = User.objects.create_superuser(
            username="global_admin", email="global@admin.com", password="password123"
        )

        # 3. Companies
        self.comp1 = Company.objects.create(
            name="Alpha Logistics", email="info@alphalogistics.com", is_active=True
        )
        self.comp2 = Company.objects.create(
            name="Beta Distribution", email="info@betadistribution.com", is_active=True
        )

        # 4. Memberships
        CompanyMembership.objects.create(user=self.user1, company=self.comp1, role=self.admin_group)
        CompanyMembership.objects.create(user=self.user2, company=self.comp2, role=self.admin_group)

        # 5. Base Data for Comp1
        self.cat1 = Category.objects.create(
            company=self.comp1, name="Electronics", description="Electronic goods"
        )
        self.prod1 = Product.objects.create(
            company=self.comp1,
            name="Industrial Laser Sensor",
            sku="ILS-9000",
            category=self.cat1,
            unit="pcs",
            cost_price=Decimal("150.00"),
            selling_price=Decimal("250.00"),
            reorder_level=5,
            is_active=True,
        )
        self.wh_main = Warehouse.objects.create(
            company=self.comp1, name="Main Hub Alpha", code="HUB-ALPHA", is_active=True
        )
        self.wh_remote = Warehouse.objects.create(
            company=self.comp1, name="North Annex", code="ANNEX-N", is_active=True
        )

        # Initial Stock for prod1 in wh_main: 20 pcs (2 reserved -> 18 available)
        self.stock1 = Stock.objects.create(
            product=self.prod1,
            warehouse=self.wh_main,
            quantity=Decimal("20.00"),
            reserved_quantity=Decimal("2.00"),
            reorder_level=5,
        )

        # Base Data for Comp2 (Tenant Isolation Check)
        self.cat2 = Category.objects.create(
            company=self.comp2, name="Heavy Machinery", description="Construction equipment"
        )
        self.prod2 = Product.objects.create(
            company=self.comp2,
            name="Hydraulic Valve",
            sku="HV-400",
            category=self.cat2,
            cost_price=Decimal("500.00"),
            selling_price=Decimal("800.00"),
            is_active=True,
        )
        self.wh_beta = Warehouse.objects.create(
            company=self.comp2, name="Beta Warehouse", code="BETA-1", is_active=True
        )

    # ============================================================
    # 1. AUTH & TENANT ISOLATION
    # ============================================================
    def test_unauthenticated_access_denied(self):
        url = reverse("inventory_product_list_create", kwargs={"company_id": self.comp1.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tenant_isolation_cross_company_access_blocked(self):
        # User 1 (Company 1) attempts to view Company 2's products
        self.client.force_authenticate(user=self.user1)
        url = reverse("inventory_product_list_create", kwargs={"company_id": self.comp2.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # User 1 attempts to view Company 2's warehouse
        wh_url = reverse("inventory_warehouse_detail", kwargs={"company_id": self.comp2.id, "pk": self.wh_beta.id})
        res_wh = self.client.get(wh_url)
        self.assertEqual(res_wh.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_has_global_access(self):
        self.client.force_authenticate(user=self.superuser)
        url = reverse("inventory_product_list_create", kwargs={"company_id": self.comp1.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    # ============================================================
    # 2. CATEGORY CRUD & DUPLICATE PROTECTION
    # ============================================================
    def test_category_crud_and_duplicate_prevention(self):
        self.client.force_authenticate(user=self.user1)
        list_url = reverse("inventory_category_list_create", kwargs={"company_id": self.comp1.id})

        # List
        res = self.client.get(list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        # Create Duplicate Name -> should fail
        res_dup = self.client.post(list_url, {"name": "Electronics", "description": "Duplicate"}, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Create New
        res_create = self.client.post(list_url, {"name": "Cables & Wiring", "description": "High voltage wiring"}, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        cat_id = res_create.data["id"]

        # Deactivate
        detail_url = reverse("inventory_category_detail", kwargs={"company_id": self.comp1.id, "pk": cat_id})
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(Category.objects.get(id=cat_id).is_active)

    # ============================================================
    # 3. PRODUCT CRUD & SKU VALIDATION
    # ============================================================
    def test_product_crud_and_sku_uniqueness(self):
        self.client.force_authenticate(user=self.user1)
        list_url = reverse("inventory_product_list_create", kwargs={"company_id": self.comp1.id})

        # Duplicate SKU in same company -> should fail
        dup_payload = {
            "name": "Another Sensor",
            "sku": "ILS-9000",
            "cost_price": "100.00",
            "selling_price": "180.00",
        }
        res_dup = self.client.post(list_url, dup_payload, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Same SKU in different company (Company 2) -> Allowed
        self.client.force_authenticate(user=self.user2)
        comp2_url = reverse("inventory_product_list_create", kwargs={"company_id": self.comp2.id})
        res_comp2 = self.client.post(comp2_url, dup_payload, format="json")
        self.assertEqual(res_comp2.status_code, status.HTTP_201_CREATED)

        # Create valid product in Company 1
        self.client.force_authenticate(user=self.user1)
        valid_payload = {
            "name": "Fiber Optic Transceiver",
            "sku": "FOT-200",
            "category": self.cat1.id,
            "unit": "pcs",
            "cost_price": "75.50",
            "selling_price": "120.00",
            "reorder_level": 15,
        }
        res_create = self.client.post(list_url, valid_payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        new_prod_id = res_create.data["id"]

        # Deactivate
        detail_url = reverse("inventory_product_detail", kwargs={"company_id": self.comp1.id, "pk": new_prod_id})
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(Product.objects.get(id=new_prod_id).is_active)

    # ============================================================
    # 4. WAREHOUSE CRUD & CODE VALIDATION
    # ============================================================
    def test_warehouse_crud(self):
        self.client.force_authenticate(user=self.user1)
        list_url = reverse("inventory_warehouse_list_create", kwargs={"company_id": self.comp1.id})

        # Duplicate Code -> fail
        res_dup = self.client.post(list_url, {"name": "Duplicate Code WH", "code": "HUB-ALPHA"}, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Create New
        res = self.client.post(list_url, {
            "name": "South Distribution Center",
            "code": "SDC-SOUTH",
            "address": "900 Industrial Parkway, Austin, TX",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        wh_id = res.data["id"]

        # Soft Delete
        del_url = reverse("inventory_warehouse_detail", kwargs={"company_id": self.comp1.id, "pk": wh_id})
        res_del = self.client.delete(del_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(Warehouse.objects.get(id=wh_id).is_active)

    # ============================================================
    # 5. STOCK CALCULATIONS & TRANSACTIONS ENGINE
    # ============================================================
    def test_stock_availability_and_stock_in(self):
        self.client.force_authenticate(user=self.user1)

        # Check existing stock (qty=20, reserved=2 -> available=18)
        stock_url = reverse("inventory_stock_list", kwargs={"company_id": self.comp1.id})
        res = self.client.get(stock_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        stock_data = next((s for s in res.data if s["product"] == self.prod1.id), None)
        self.assertIsNotNone(stock_data)
        self.assertEqual(Decimal(str(stock_data["available_quantity"])), Decimal("18.00"))

        # STOCK_IN: +10 pcs
        tx_url = reverse("inventory_transaction_list_create", kwargs={"company_id": self.comp1.id})
        in_payload = {
            "product": self.prod1.id,
            "warehouse": self.wh_main.id,
            "transaction_type": "STOCK_IN",
            "quantity": "10.00",
            "reference": "PO-1002",
            "notes": "Incoming supplier delivery",
        }
        res_in = self.client.post(tx_url, in_payload, format="json")
        self.assertEqual(res_in.status_code, status.HTTP_201_CREATED)

        # Stock should now be 30 (available=28)
        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.quantity, Decimal("30.00"))
        self.assertEqual(self.stock1.available_quantity, Decimal("28.00"))

    def test_stock_out_and_insufficient_stock_error(self):
        self.client.force_authenticate(user=self.user1)
        tx_url = reverse("inventory_transaction_list_create", kwargs={"company_id": self.comp1.id})

        # Attempt to STOCK_OUT 25 pcs (only 18 available) -> should fail
        fail_payload = {
            "product": self.prod1.id,
            "warehouse": self.wh_main.id,
            "transaction_type": "STOCK_OUT",
            "quantity": "25.00",
            "reference": "SO-500",
        }
        res_fail = self.client.post(tx_url, fail_payload, format="json")
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quantity", res_fail.data)

        # STOCK_OUT 8 pcs (within available 18) -> should succeed
        success_payload = {
            "product": self.prod1.id,
            "warehouse": self.wh_main.id,
            "transaction_type": "STOCK_OUT",
            "quantity": "8.00",
            "reference": "SO-501",
        }
        res_ok = self.client.post(tx_url, success_payload, format="json")
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)

        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.quantity, Decimal("12.00"))

    def test_warehouse_transfer_flow(self):
        self.client.force_authenticate(user=self.user1)
        tx_url = reverse("inventory_transaction_list_create", kwargs={"company_id": self.comp1.id})

        # Transfer 5 pcs from wh_main to wh_remote
        transfer_payload = {
            "product": self.prod1.id,
            "warehouse": self.wh_main.id,
            "destination_warehouse": self.wh_remote.id,
            "transaction_type": "TRANSFER",
            "quantity": "5.00",
            "reference": "TR-101",
            "notes": "Transfer to North Annex for fulfillment",
        }
        res = self.client.post(tx_url, transfer_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Source reduced by 5 (20 -> 15)
        self.stock1.refresh_from_db()
        self.assertEqual(self.stock1.quantity, Decimal("15.00"))

        # Destination received 5
        dest_stock = Stock.objects.get(product=self.prod1, warehouse=self.wh_remote)
        self.assertEqual(dest_stock.quantity, Decimal("5.00"))

    def test_cross_company_transfer_rejected(self):
        self.client.force_authenticate(user=self.user1)
        tx_url = reverse("inventory_transaction_list_create", kwargs={"company_id": self.comp1.id})

        # Transfer to a warehouse belonging to Company 2 -> should fail
        cross_payload = {
            "product": self.prod1.id,
            "warehouse": self.wh_main.id,
            "destination_warehouse": self.wh_beta.id,
            "transaction_type": "TRANSFER",
            "quantity": "2.00",
        }
        res = self.client.post(tx_url, cross_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ============================================================
    # 6. VENDOR CRUD
    # ============================================================
    def test_vendor_crud(self):
        self.client.force_authenticate(user=self.user1)
        list_url = reverse("inventory_vendor_list_create", kwargs={"company_id": self.comp1.id})

        # Create
        res = self.client.post(list_url, {
            "name": "Global Photonics Ltd",
            "email": "sales@globalphotonics.com",
            "phone": "+1-800-555-4321",
            "address": "400 Lightwave St, San Jose, CA",
            "tax_id": "TAX-US-998877",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        vendor_id = res.data["id"]

        # Deactivate
        del_url = reverse("inventory_vendor_detail", kwargs={"company_id": self.comp1.id, "pk": vendor_id})
        res_del = self.client.delete(del_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(Vendor.objects.get(id=vendor_id).is_active)

    # ============================================================
    # 7. INVENTORY DASHBOARD CALCULATIONS
    # ============================================================
    def test_inventory_dashboard_metrics(self):
        self.client.force_authenticate(user=self.user1)
        dash_url = reverse("inventory_dashboard", kwargs={"company_id": self.comp1.id})

        res = self.client.get(dash_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        metrics = res.data["metrics"]

        # 1 Product, 2 Warehouses
        self.assertEqual(metrics["total_products"], 1)
        self.assertEqual(metrics["active_products"], 1)
        self.assertEqual(metrics["total_warehouses"], 2)

        # 20 units of prod1 (cost_price=150.00 -> stock_valuation=3000.00)
        self.assertEqual(metrics["total_stock_quantity"], 20.0)
        self.assertEqual(metrics["stock_valuation"], 3000.0)
