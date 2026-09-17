from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from company.models import Company
from accounts.models import CompanyMembership
from apps.employee.models import Employee
from crm.models import Customer, Contact, Lead, Deal, Activity
from inventory.models import Category, Product, Warehouse, Stock, StockTransaction, Vendor
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
    generate_quotation_number,
    generate_order_number,
)
from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone


class Command(BaseCommand):
    help = "Seeds repeatable, realistic development data for ICORP ERP without destroying existing data."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding ICORP ERP demo data..."))

        # 1. Ensure Default Groups exist
        admin_group, _ = Group.objects.get_or_create(name="Company Admin")
        employee_group, _ = Group.objects.get_or_create(name="Employee")
        self.stdout.write(self.style.SUCCESS("[OK] Default Groups verified."))

        # 2. Ensure Superadmin user exists
        admin_user = User.objects.filter(username="admin").first()
        if not admin_user:
            admin_user = User.objects.create_superuser(
                username="admin",
                email="admin@icorp.com",
                password="admin",
                first_name="System",
                last_name="Administrator",
            )
            self.stdout.write(self.style.SUCCESS("[OK] Created superuser 'admin' (password: admin)."))
        else:
            admin_user.set_password("admin")
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("[OK] Superuser 'admin' updated (password: admin)."))

        # Also set password for shibin if present
        shibin_user = User.objects.filter(username="shibin").first()
        if shibin_user:
            shibin_user.set_password("admin")
            shibin_user.save()
            self.stdout.write(self.style.SUCCESS("[OK] User 'shibin' password set to 'admin'."))

        # 3. Create Demo Companies
        comp1, created = Company.objects.get_or_create(
            email="contact@nexusglobal.com",
            defaults={
                "name": "Nexus Global Technologies",
                "phone": "+1-800-555-0199",
                "address": "450 Tech Boulevard, Suite 800, San Jose, CA",
                "is_active": True,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"[OK] Created company '{comp1.name}'."))

        comp2, created = Company.objects.get_or_create(
            email="info@apexindustrial.com",
            defaults={
                "name": "Apex Industrial Systems",
                "phone": "+1-888-555-0244",
                "address": "1200 Manufacturing Way, Chicago, IL",
                "is_active": True,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"[OK] Created company '{comp2.name}'."))

        # 4. Create Company Memberships
        for c in [comp1, comp2]:
            CompanyMembership.objects.get_or_create(
                user=admin_user,
                company=c,
                defaults={"role": admin_group},
            )
            if shibin_user:
                CompanyMembership.objects.get_or_create(
                    user=shibin_user,
                    company=c,
                    defaults={"role": admin_group},
                )

        # 5. Create Demo Staff / Employees
        demo_employees = [
            {
                "employee_id": "EMP-1001",
                "username": "alex.rivera",
                "email": "alex.rivera@nexusglobal.com",
                "first_name": "Alex",
                "last_name": "Rivera",
                "phone": "+1-555-0101",
                "department": "Engineering",
                "designation": "VP of Engineering",
                "joining_date": date(2024, 1, 15),
                "company": comp1,
            },
            {
                "employee_id": "EMP-1002",
                "username": "sarah.chen",
                "email": "sarah.chen@nexusglobal.com",
                "first_name": "Sarah",
                "last_name": "Chen",
                "phone": "+1-555-0102",
                "department": "Operations",
                "designation": "Director of Operations",
                "joining_date": date(2024, 3, 1),
                "company": comp1,
            },
            {
                "employee_id": "EMP-1003",
                "username": "marcus.vance",
                "email": "marcus.vance@nexusglobal.com",
                "first_name": "Marcus",
                "last_name": "Vance",
                "phone": "+1-555-0103",
                "department": "Sales",
                "designation": "Lead Sales Strategist",
                "joining_date": date(2024, 5, 20),
                "company": comp1,
            },
            {
                "employee_id": "EMP-2001",
                "username": "elena.rostova",
                "email": "elena@apexindustrial.com",
                "first_name": "Elena",
                "last_name": "Rostova",
                "phone": "+1-555-0201",
                "department": "Operations",
                "designation": "Plant Operations Manager",
                "joining_date": date(2024, 2, 10),
                "company": comp2,
            },
        ]

        for item in demo_employees:
            company = item.pop("company")
            user, _ = User.objects.get_or_create(
                username=item["username"],
                defaults={
                    "email": item["email"],
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                },
            )
            user.set_unusable_password()
            user.save()

            CompanyMembership.objects.get_or_create(
                user=user,
                company=company,
                defaults={"role": employee_group},
            )

            emp, created = Employee.objects.get_or_create(
                employee_id=item["employee_id"],
                defaults={
                    "user": user,
                    "company": company,
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "phone": item["phone"],
                    "department": item["department"],
                    "designation": item["designation"],
                    "joining_date": item["joining_date"],
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"[OK] Created employee {emp.employee_id}: {emp.first_name} {emp.last_name}"))

        # 6. Create Demo CRM Customers
        cust1, _ = Customer.objects.get_or_create(
            company=comp1,
            name="Quantum Dynamics Corp",
            defaults={
                "owner": admin_user,
                "customer_type": "Corporate",
                "industry": "Enterprise Software & AI",
                "email": "procurement@quantumdyn.com",
                "phone": "+1-415-555-0301",
                "website": "https://quantumdyn.com",
                "address": "100 Market St, San Francisco, CA",
            },
        )
        cust2, _ = Customer.objects.get_or_create(
            company=comp1,
            name="Blue Sky Logistics",
            defaults={
                "owner": admin_user,
                "customer_type": "Corporate",
                "industry": "Supply Chain & Logistics",
                "email": "info@blueskylogistics.com",
                "phone": "+1-312-555-0450",
                "website": "https://blueskylogistics.com",
                "address": "800 North Michigan Ave, Chicago, IL",
            },
        )
        cust3, _ = Customer.objects.get_or_create(
            company=comp1,
            name="Jane Doe Advisory",
            defaults={
                "owner": admin_user,
                "customer_type": "Individual",
                "industry": "Management Consulting",
                "email": "jane@doeconsulting.com",
                "phone": "+1-212-555-0811",
                "address": "742 Evergreen Terrace, New York, NY",
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Customers seeded."))

        # 7. Create Demo Contacts
        cont1, _ = Contact.objects.get_or_create(
            company=comp1,
            customer=cust1,
            email="mchang@quantumdyn.com",
            defaults={
                "owner": admin_user,
                "first_name": "Michael",
                "last_name": "Chang",
                "phone": "+1-415-555-0310",
                "designation": "Chief Technology Officer",
            },
        )
        cont2, _ = Contact.objects.get_or_create(
            company=comp1,
            customer=cust2,
            email="lisa.ray@blueskylogistics.com",
            defaults={
                "owner": admin_user,
                "first_name": "Lisa",
                "last_name": "Ray",
                "phone": "+1-312-555-0465",
                "designation": "VP of Operations",
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Contacts seeded."))

        # 8. Create Demo Leads
        Lead.objects.get_or_create(
            company=comp1,
            email="david.m@acquiredsystems.com",
            defaults={
                "owner": admin_user,
                "first_name": "David",
                "last_name": "Miller",
                "lead_company": "Acquired Systems Inc",
                "phone": "+1-650-555-0899",
                "source": "Website",
                "status": "New",
                "estimated_value": 45000.00,
                "notes": "Interested in full ERP overhaul and inventory module.",
            },
        )
        Lead.objects.get_or_create(
            company=comp1,
            email="rachel@horizoncloud.io",
            defaults={
                "owner": admin_user,
                "first_name": "Rachel",
                "last_name": "Green",
                "lead_company": "Horizon Cloud Ltd",
                "phone": "+1-206-555-0722",
                "source": "Referral",
                "status": "Qualified",
                "estimated_value": 75000.00,
                "notes": "Budget approved for Q3. Next step: Technical review.",
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Leads seeded."))

        # 9. Create Demo Deals
        Deal.objects.get_or_create(
            company=comp1,
            customer=cust1,
            title="Enterprise ERP Platform Deployment",
            defaults={
                "contact": cont1,
                "owner": admin_user,
                "value": 95000.00,
                "stage": "Negotiation",
                "probability": 75,
                "expected_close_date": date.today() + timedelta(days=30),
                "notes": "Contract under legal review.",
            },
        )
        Deal.objects.get_or_create(
            company=comp1,
            customer=cust2,
            title="Fleet Optimization & Dispatch Suite",
            defaults={
                "contact": cont2,
                "owner": admin_user,
                "value": 45000.00,
                "stage": "Proposal",
                "probability": 50,
                "expected_close_date": date.today() + timedelta(days=45),
                "notes": "Demo presented to VP of Operations.",
            },
        )
        Deal.objects.get_or_create(
            company=comp1,
            customer=cust1,
            title="Cloud Infrastructure Phase 1 Migration",
            defaults={
                "contact": cont1,
                "owner": admin_user,
                "value": 35000.00,
                "stage": "Won",
                "probability": 100,
                "expected_close_date": date.today() - timedelta(days=10),
                "notes": "Successfully closed and signed.",
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Deals seeded."))

        # 10. Create Demo Activities
        Activity.objects.get_or_create(
            company=comp1,
            title="Initial Discovery Call with Michael Chang",
            defaults={
                "user": admin_user,
                "activity_type": "Call",
                "customer": cust1,
                "contact": cont1,
                "status": "Completed",
                "description": "Discussed scalability requirements and ERP integration timeline.",
            },
        )
        Activity.objects.get_or_create(
            company=comp1,
            title="Proposal sent to Lisa Ray",
            defaults={
                "user": admin_user,
                "activity_type": "Email",
                "customer": cust2,
                "contact": cont2,
                "status": "Completed",
                "description": "Sent detailed pricing sheet and implementation milestones.\n\n[Local Log: Recorded in CRM communication history. External Gmail dispatch is optional.]",
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Activities seeded."))

        # 11. Create Demo Inventory Categories
        cat_auto, _ = Category.objects.get_or_create(
            company=comp1,
            name="Robotics & Actuators",
            defaults={"description": "High-precision industrial robotic actuators and motor systems."},
        )
        cat_sens, _ = Category.objects.get_or_create(
            company=comp1,
            name="Optics & Sensors",
            defaults={"description": "Optical sensors, LiDARs, and industrial telemetry equipment."},
        )
        cat_mat, _ = Category.objects.get_or_create(
            company=comp1,
            name="Structural Components",
            defaults={"description": "Aerospace grade alloys, brackets, and chassis fittings."},
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Inventory Categories seeded."))

        # 12. Create Demo Warehouses
        wh_sv, _ = Warehouse.objects.get_or_create(
            company=comp1,
            code="SV-WH-01",
            defaults={
                "name": "Silicon Valley Hub",
                "address": "450 Tech Blvd, Bldg 4, San Jose, CA",
                "is_active": True,
            },
        )
        wh_ec, _ = Warehouse.objects.get_or_create(
            company=comp1,
            code="EC-WH-02",
            defaults={
                "name": "East Coast Distribution Center",
                "address": "120 Logistics Highway, Newark, NJ",
                "is_active": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Warehouses seeded."))

        # 13. Create Demo Products
        prod_lidar, _ = Product.objects.get_or_create(
            company=comp1,
            sku="LIDAR-4K-01",
            defaults={
                "name": "Spatial 4K Solid-State LiDAR",
                "category": cat_sens,
                "unit": "pcs",
                "cost_price": Decimal("450.00"),
                "selling_price": Decimal("750.00"),
                "tax": Decimal("5.00"),
                "reorder_level": 10,
                "description": "High resolution solid state automotive grade LiDAR sensor.",
            },
        )
        prod_act, _ = Product.objects.get_or_create(
            company=comp1,
            sku="ACT-HT-80",
            defaults={
                "name": "Brushless Servo Actuator 80Nm",
                "category": cat_auto,
                "unit": "pcs",
                "cost_price": Decimal("180.00"),
                "selling_price": Decimal("320.00"),
                "tax": Decimal("5.00"),
                "reorder_level": 15,
                "description": "Heavy duty robotic arm servo actuator with CAN bus interface.",
            },
        )
        prod_bra, _ = Product.objects.get_or_create(
            company=comp1,
            sku="BRK-TI-12",
            defaults={
                "name": "Titanium Modular Mount Bracket",
                "category": cat_mat,
                "unit": "pcs",
                "cost_price": Decimal("35.00"),
                "selling_price": Decimal("65.00"),
                "tax": Decimal("0.00"),
                "reorder_level": 30,
                "description": "CNC machined titanium alloy mounting bracket for robotics chassis.",
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Products seeded."))

        # 14. Create Demo Stock
        stock_lidar_sv, _ = Stock.objects.get_or_create(
            product=prod_lidar,
            warehouse=wh_sv,
            defaults={
                "quantity": Decimal("45.00"),
                "reserved_quantity": Decimal("5.00"),
                "reorder_level": 10,
            },
        )
        stock_act_sv, _ = Stock.objects.get_or_create(
            product=prod_act,
            warehouse=wh_sv,
            defaults={
                "quantity": Decimal("25.00"),
                "reserved_quantity": Decimal("0.00"),
                "reorder_level": 15,
            },
        )
        stock_act_ec, _ = Stock.objects.get_or_create(
            product=prod_act,
            warehouse=wh_ec,
            defaults={
                "quantity": Decimal("12.00"),
                "reserved_quantity": Decimal("2.00"),
                "reorder_level": 15,
            },
        )
        stock_bra_sv, _ = Stock.objects.get_or_create(
            product=prod_bra,
            warehouse=wh_sv,
            defaults={
                "quantity": Decimal("120.00"),
                "reserved_quantity": Decimal("10.00"),
                "reorder_level": 30,
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Stock seeded."))

        # 15. Create Demo Transactions
        StockTransaction.objects.get_or_create(
            company=comp1,
            product=prod_lidar,
            warehouse=wh_sv,
            transaction_type="STOCK_IN",
            quantity=Decimal("50.00"),
            reference="PO-88201",
            defaults={
                "notes": "Initial inventory receipt from manufacturer",
                "created_by": admin_user,
            },
        )
        StockTransaction.objects.get_or_create(
            company=comp1,
            product=prod_act,
            warehouse=wh_sv,
            transaction_type="STOCK_IN",
            quantity=Decimal("40.00"),
            reference="PO-88202",
            defaults={
                "notes": "Bulk actuator order delivery",
                "created_by": admin_user,
            },
        )
        StockTransaction.objects.get_or_create(
            company=comp1,
            product=prod_act,
            warehouse=wh_sv,
            destination_warehouse=wh_ec,
            transaction_type="TRANSFER",
            quantity=Decimal("15.00"),
            reference="TR-0041",
            defaults={
                "notes": "Stock transfer to East Coast Hub for regional fulfillment",
                "created_by": admin_user,
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Stock Transactions seeded."))

        # 16. Create Demo Vendors
        Vendor.objects.get_or_create(
            company=comp1,
            name="AeroTech Precision Optics",
            defaults={
                "email": "procurement@aerotech-optics.com",
                "phone": "+1-408-555-8819",
                "address": "1200 Photonics Way, San Jose, CA",
                "tax_id": "US-EIN-94812345",
            },
        )
        Vendor.objects.get_or_create(
            company=comp1,
            name="Apex Dynamics Motors & Drives",
            defaults={
                "email": "orders@apexdynamics.com",
                "phone": "+1-312-555-4422",
                "address": "88 Industrial Circle, Chicago, IL",
                "tax_id": "US-EIN-36892341",
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Demo Vendors seeded."))

        # 17. Create Demo Sales Quotations & Sales Orders
        # Quotation 1 - Draft
        q1, created = Quotation.objects.get_or_create(
            company=comp1,
            quotation_number="QT-2026-000001",
            defaults={
                "customer": cust1,
                "quotation_date": timezone.localdate(),
                "valid_until": timezone.localdate() + timedelta(days=30),
                "status": Quotation.QuotationStatus.DRAFT,
                "notes": "Evaluation quote for spatial LiDAR sensors.",
                "created_by": admin_user,
            },
        )
        if created:
            QuotationItem.objects.create(
                quotation=q1,
                product=prod_lidar,
                description="Spatial LiDAR sensors for autonomous mobile robots",
                quantity=Decimal("4.00"),
                unit_price=Decimal("750.00"),
                discount=Decimal("100.00"),
                tax=Decimal("150.00"),
            )
            q1.recalculate_totals()
            q1.save()

        # Quotation 2 - Sent
        q2, created = Quotation.objects.get_or_create(
            company=comp1,
            quotation_number="QT-2026-000002",
            defaults={
                "customer": cust2,
                "quotation_date": timezone.localdate() - timedelta(days=5),
                "valid_until": timezone.localdate() + timedelta(days=25),
                "status": Quotation.QuotationStatus.SENT,
                "notes": "Industrial automation package with brackets & actuators.",
                "created_by": admin_user,
            },
        )
        if created:
            QuotationItem.objects.create(
                quotation=q2,
                product=prod_act,
                description="CAN bus servo actuators",
                quantity=Decimal("8.00"),
                unit_price=Decimal("320.00"),
                discount=Decimal("60.00"),
                tax=Decimal("120.00"),
            )
            QuotationItem.objects.create(
                quotation=q2,
                product=prod_bra,
                description="Titanium brackets 12mm",
                quantity=Decimal("20.00"),
                unit_price=Decimal("65.00"),
                discount=Decimal("0.00"),
                tax=Decimal("50.00"),
            )
            q2.recalculate_totals()
            q2.save()

        # Quotation 3 - Converted
        q3, created = Quotation.objects.get_or_create(
            company=comp1,
            quotation_number="QT-2026-000003",
            defaults={
                "customer": cust1,
                "quotation_date": timezone.localdate() - timedelta(days=12),
                "valid_until": timezone.localdate() + timedelta(days=18),
                "status": Quotation.QuotationStatus.CONVERTED,
                "notes": "Bulk fleet upgrade quote - accepted and converted.",
                "created_by": admin_user,
            },
        )
        if created:
            QuotationItem.objects.create(
                quotation=q3,
                product=prod_lidar,
                description="High resolution solid-state LiDAR sensors",
                quantity=Decimal("10.00"),
                unit_price=Decimal("750.00"),
                discount=Decimal("250.00"),
                tax=Decimal("350.00"),
            )
            q3.recalculate_totals()
            q3.save()

        # Sales Order 1 - Reserved with Active Stock Reservation (from Quotation 3)
        so1, created = SalesOrder.objects.get_or_create(
            company=comp1,
            order_number="SO-2026-000001",
            defaults={
                "customer": cust1,
                "quotation": q3,
                "warehouse": wh_sv,
                "order_date": timezone.localdate() - timedelta(days=10),
                "status": SalesOrder.SalesOrderStatus.RESERVED,
                "notes": "Converted from Quotation QT-2026-000003. Stock reserved at Silicon Valley Hub.",
                "created_by": admin_user,
            },
        )
        if created:
            item1 = SalesOrderItem.objects.create(
                sales_order=so1,
                product=prod_lidar,
                description="High resolution solid-state LiDAR sensors",
                quantity=Decimal("10.00"),
                unit_price=Decimal("750.00"),
                discount=Decimal("250.00"),
                tax=Decimal("350.00"),
            )
            so1.recalculate_totals()
            so1.save()
            SalesOrderReservation.objects.create(
                company=comp1,
                sales_order=so1,
                sales_order_item=item1,
                product=prod_lidar,
                warehouse=wh_sv,
                quantity=Decimal("10.00"),
                status=SalesOrderReservation.ReservationStatus.ACTIVE,
            )

        # Sales Order 2 - Processing (Direct Order at East Coast WH)
        so2, created = SalesOrder.objects.get_or_create(
            company=comp1,
            order_number="SO-2026-000002",
            defaults={
                "customer": cust2,
                "warehouse": wh_ec,
                "order_date": timezone.localdate() - timedelta(days=3),
                "status": SalesOrder.SalesOrderStatus.PROCESSING,
                "notes": "Direct order for robotics assembly line.",
                "created_by": admin_user,
            },
        )
        if created:
            SalesOrderItem.objects.create(
                sales_order=so2,
                product=prod_act,
                description="Heavy duty servo actuators",
                quantity=Decimal("12.00"),
                unit_price=Decimal("320.00"),
                discount=Decimal("100.00"),
                tax=Decimal("180.00"),
            )
            so2.recalculate_totals()
            so2.save()

        # Sales Order 3 - Completed & Fulfilled (Silicon Valley WH)
        so3, created = SalesOrder.objects.get_or_create(
            company=comp1,
            order_number="SO-2026-000003",
            defaults={
                "customer": cust1,
                "warehouse": wh_sv,
                "order_date": timezone.localdate() - timedelta(days=20),
                "status": SalesOrder.SalesOrderStatus.COMPLETED,
                "notes": "Completed chassis brackets consignment. Fulfilled from SV Hub.",
                "created_by": admin_user,
            },
        )
        if created:
            item3 = SalesOrderItem.objects.create(
                sales_order=so3,
                product=prod_bra,
                description="Modular mounting brackets",
                quantity=Decimal("50.00"),
                unit_price=Decimal("65.00"),
                discount=Decimal("150.00"),
                tax=Decimal("160.00"),
            )
            so3.recalculate_totals()
            so3.save()
            SalesOrderReservation.objects.create(
                company=comp1,
                sales_order=so3,
                sales_order_item=item3,
                product=prod_bra,
                warehouse=wh_sv,
                quantity=Decimal("50.00"),
                status=SalesOrderReservation.ReservationStatus.FULFILLED,
            )

        self.stdout.write(self.style.SUCCESS("[OK] Demo Sales Quotations & Orders seeded."))

        # 12. Create Demo Sales Invoices, Payments, and Receipts (Phase 4C)
        # Invoice 1: From Completed Sales Order (so3), Partially Paid
        inv1, created = Invoice.objects.get_or_create(
            company=comp1,
            invoice_number="INV-2026-000001",
            defaults={
                "customer": cust1,
                "sales_order": so3,
                "invoice_date": timezone.localdate() - timedelta(days=15),
                "due_date": timezone.localdate() + timedelta(days=15),
                "status": Invoice.InvoiceStatus.PARTIALLY_PAID,
                "subtotal": so3.subtotal,
                "discount": so3.discount,
                "tax": so3.tax,
                "total": so3.total,
                "amount_paid": Decimal("1500.00"),
                "balance_due": so3.total - Decimal("1500.00"),
                "notes": f"Invoice generated from Sales Order {so3.order_number}.",
                "created_by": admin_user,
            },
        )
        if created:
            for so_item in so3.items.all():
                InvoiceItem.objects.create(
                    invoice=inv1,
                    product=so_item.product,
                    description=so_item.description,
                    quantity=so_item.quantity,
                    unit_price=so_item.unit_price,
                    discount=so_item.discount,
                    tax=so_item.tax,
                )
            # Create payment & receipt
            pmt1 = Payment.objects.create(
                company=comp1,
                invoice=inv1,
                customer=inv1.customer,
                payment_number="PAY-2026-000001",
                payment_date=timezone.localdate() - timedelta(days=10),
                amount=Decimal("1500.00"),
                payment_method=Payment.PaymentMethod.BANK_TRANSFER,
                reference="WIRE-QD-99201",
                notes="Initial 50% deposit received via wire transfer.",
                received_by=admin_user,
            )
            Receipt.objects.create(
                company=comp1,
                payment=pmt1,
                invoice=inv1,
                customer=inv1.customer,
                receipt_number="REC-2026-000001",
                receipt_date=pmt1.payment_date,
                amount=pmt1.amount,
                notes=f"Receipt generated for Payment {pmt1.payment_number}.",
                created_by=admin_user,
            )

        # Invoice 2: Direct Invoice, Paid in Full
        inv2, created = Invoice.objects.get_or_create(
            company=comp1,
            invoice_number="INV-2026-000002",
            defaults={
                "customer": cust2,
                "invoice_date": timezone.localdate() - timedelta(days=7),
                "due_date": timezone.localdate() + timedelta(days=23),
                "status": Invoice.InvoiceStatus.PAID,
                "subtotal": Decimal("1280.00"),
                "discount": Decimal("80.00"),
                "tax": Decimal("0.00"),
                "total": Decimal("1200.00"),
                "amount_paid": Decimal("1200.00"),
                "balance_due": Decimal("0.00"),
                "notes": "Direct invoice for logistics spare parts.",
                "created_by": admin_user,
            },
        )
        if created:
            InvoiceItem.objects.create(
                invoice=inv2,
                product=prod_act,
                description="Servo actuators emergency batch",
                quantity=Decimal("4.00"),
                unit_price=Decimal("320.00"),
                discount=Decimal("80.00"),
                tax=Decimal("0.00"),
            )
            pmt2 = Payment.objects.create(
                company=comp1,
                invoice=inv2,
                customer=inv2.customer,
                payment_number="PAY-2026-000002",
                payment_date=timezone.localdate() - timedelta(days=6),
                amount=Decimal("1200.00"),
                payment_method=Payment.PaymentMethod.CARD,
                reference="VISA-AUTH-4410",
                notes="Paid in full via corporate card.",
                received_by=admin_user,
            )
            Receipt.objects.create(
                company=comp1,
                payment=pmt2,
                invoice=inv2,
                customer=inv2.customer,
                receipt_number="REC-2026-000002",
                receipt_date=pmt2.payment_date,
                amount=pmt2.amount,
                notes=f"Receipt generated for Payment {pmt2.payment_number}.",
                created_by=admin_user,
            )

        # Invoice 3: Overdue Invoice (No payment, due 15 days ago)
        inv3, created = Invoice.objects.get_or_create(
            company=comp1,
            invoice_number="INV-2026-000003",
            defaults={
                "customer": cust3,
                "invoice_date": timezone.localdate() - timedelta(days=45),
                "due_date": timezone.localdate() - timedelta(days=15),
                "status": Invoice.InvoiceStatus.ISSUED,
                "subtotal": Decimal("900.00"),
                "discount": Decimal("50.00"),
                "tax": Decimal("0.00"),
                "total": Decimal("850.00"),
                "amount_paid": Decimal("0.00"),
                "balance_due": Decimal("850.00"),
                "notes": "Advisory tech consulting hardware provision.",
                "created_by": admin_user,
            },
        )
        if created:
            InvoiceItem.objects.create(
                invoice=inv3,
                product=prod_lidar,
                description="High precision sensor demo unit",
                quantity=Decimal("1.00"),
                unit_price=Decimal("900.00"),
                discount=Decimal("50.00"),
                tax=Decimal("0.00"),
            )

        self.stdout.write(self.style.SUCCESS("[OK] Demo Invoices, Payments & Receipts seeded."))

        self.stdout.write(self.style.SUCCESS("[OK] Seed completed successfully!"))

