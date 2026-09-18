import json
import os
import sys
from decimal import Decimal

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 75)
    print("PHASE 5D: PURCHASE FINALIZATION, REPORTING & INTEGRATION LIVE VERIFICATION")
    print("=" * 75)

    # Check if server is running or fallback to Django Test Client
    use_http = False
    try:
        import urllib.request
        with urllib.request.urlopen(f"{BASE_URL}/api/", timeout=2) as resp:
            if resp.status in [200, 404, 401, 403]:
                use_http = True
    except Exception:
        use_http = False

    if use_http:
        print("[MODE] Running in live HTTP mode against http://127.0.0.1:8000")
        return run_http_tests()
    else:
        print("[MODE] Live server not listening on 8000, running in Django test client mode")
        return run_django_tests()


def run_http_tests():
    import urllib.request
    import urllib.error

    def request(method, path, data=None, token=None):
        url = f"{BASE_URL}{path}"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                content = resp.read().decode("utf-8")
                return resp.status, json.loads(content) if content else {}
        except urllib.error.HTTPError as e:
            err_content = e.read().decode("utf-8")
            try:
                parsed = json.loads(err_content)
            except Exception:
                parsed = {"error": err_content}
            return e.code, parsed

    # 1. Login
    print("\n[1] Authenticating as admin...")
    status, res = request("POST", "/api/auth/login/", {"username": "admin", "password": "admin"})
    assert status == 200, f"Login failed: {status}, {res}"
    token = res.get("access") or res.get("tokens", {}).get("access")
    assert token, "No access token received"
    print("  [PASS] Logged in successfully. JWT Token acquired.")

    # 2. Tenant Selection
    status, companies = request("GET", "/api/companies/", token=token)
    assert status == 200 and len(companies) > 0, "No companies found"
    target_company = next((c for c in companies if "Nexus" in c["name"] or c["id"] == 1), companies[0])
    company_id = target_company["id"]
    print(f"  [PASS] Active Tenant: ID {company_id} ({target_company['name']})")

    # Fetch reference vendor, product, and warehouse
    status, vendors = request("GET", f"/api/companies/{company_id}/inventory/vendors/", token=token)
    assert status == 200 and len(vendors) > 0, f"No vendors found for tenant: {status}, {vendors}"
    vendor_id = vendors[0]["id"]
    vendor_name = vendors[0]["name"]

    status, products = request("GET", f"/api/companies/{company_id}/inventory/products/", token=token)
    assert status == 200 and len(products) > 0, f"No products found for tenant: {status}, {products}"
    prod1 = products[0]

    status, warehouses = request("GET", f"/api/companies/{company_id}/inventory/warehouses/", token=token)
    assert status == 200 and len(warehouses) > 0, f"No warehouses found for tenant: {status}, {warehouses}"
    warehouse_id = warehouses[0]["id"]

    _execute_workflow(request, token, company_id, vendor_id, vendor_name, prod1, warehouse_id)


def run_django_tests():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django
    django.setup()

    from rest_framework.test import APIClient
    from django.contrib.auth.models import User
    from company.models import Company
    from inventory.models import Vendor, Product, Warehouse

    client = APIClient()
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser("admin", "admin@example.com", "admin")
    client.force_authenticate(user=user)

    company = Company.objects.filter(is_active=True).first()
    if not company:
        company = Company.objects.create(name="Live Test Corp", is_active=True)
    company_id = company.id

    vendor = Vendor.objects.filter(company=company, is_active=True).first()
    if not vendor:
        vendor = Vendor.objects.create(company=company, name="Apex Supplies Ltd", is_active=True)
    vendor_id = vendor.id
    vendor_name = vendor.name

    prod = Product.objects.filter(company=company).first()
    if not prod:
        from inventory.models import Category
        cat = Category.objects.create(company=company, name="General")
        prod = Product.objects.create(
            company=company, category=cat, name="Industrial Bearing", sku="BRG-01",
            cost_price=Decimal("100.00"), selling_price=Decimal("150.00")
        )

    wh = Warehouse.objects.filter(company=company, is_active=True).first()
    if not wh:
        wh = Warehouse.objects.create(company=company, name="Central Warehouse", code="WH-01", is_active=True)
    warehouse_id = wh.id

    def request(method, path, data=None, token=None):
        if method == "GET":
            resp = client.get(path, format="json")
        elif method == "POST":
            resp = client.post(path, data or {}, format="json")
        elif method == "PATCH":
            resp = client.patch(path, data or {}, format="json")
        elif method == "DELETE":
            resp = client.delete(path, format="json")
        else:
            raise ValueError(f"Unknown method {method}")
        return resp.status_code, resp.data if hasattr(resp, "data") else {}

    _execute_workflow(request, None, company_id, vendor_id, vendor_name, {"id": prod.id, "name": prod.name}, warehouse_id)


def _execute_workflow(request, token, company_id, vendor_id, vendor_name, prod1, warehouse_id):
    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 1: CREATE PURCHASE QUOTATION (PQT)")
    print("=" * 70)
    q_payload = {
        "vendor": vendor_id,
        "quotation_date": "2026-09-18",
        "valid_until": "2026-10-18",
        "notes": "Phase 5D End-to-End Live Verification",
        "items": [
            {
                "product": prod1["id"],
                "description": f"{prod1['name']} - Live Batch",
                "quantity": "10.00",
                "unit_price": "200.00",
                "discount": "0.00",
                "tax": "0.00",
            }
        ],
    }
    s, quote = request("POST", f"/api/companies/{company_id}/purchases/quotations/", q_payload, token)
    assert s == 201, f"Quotation creation failed: {s}, {quote}"
    quote_id = quote["id"]
    print(f"  [PASS] Quotation Created: {quote['quotation_number']} (ID: {quote_id}, Total: ${quote['total']})")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 2: ACCEPT AND CONVERT QUOTATION TO PURCHASE ORDER (PO)")
    print("=" * 70)
    s, _ = request("PATCH", f"/api/companies/{company_id}/purchases/quotations/{quote_id}/", {"status": "ACCEPTED"}, token)
    assert s == 200, f"Accept quotation failed: {s}"

    s, order = request("POST", f"/api/companies/{company_id}/purchases/quotations/{quote_id}/convert-to-order/", {"warehouse": warehouse_id}, token)
    assert s == 201, f"Convert to PO failed: {s}, {order}"
    order_id = order["id"]
    po_item_id = order["items"][0]["id"]
    print(f"  [PASS] Converted to PO: {order['order_number']} (ID: {order_id}, Status: {order['status']})")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 3: CONFIRM PURCHASE ORDER")
    print("=" * 70)
    s, confirmed_order = request("PATCH", f"/api/companies/{company_id}/purchases/orders/{order_id}/", {"status": "CONFIRMED"}, token)
    assert s == 200 and confirmed_order["status"] == "CONFIRMED", f"Confirm order failed: {s}"
    print(f"  [PASS] Purchase Order Confirmed: {confirmed_order['order_number']}")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 4: GOODS RECEIVING (GRN) & INVENTORY STOCK IN")
    print("=" * 70)
    # Receive partial (6 units)
    rcv1_payload = {"items": [{"purchase_order_item": po_item_id, "received_quantity": "6.00"}]}
    s, grn1 = request("POST", f"/api/companies/{company_id}/purchases/orders/{order_id}/receive/", rcv1_payload, token)
    assert s == 201, f"Partial GRN failed: {s}, {grn1}"
    print(f"  [PASS] Partial GRN Created: {grn1['receipt_number']} (Received 6 units)")

    # Receive remaining (4 units)
    rcv2_payload = {"items": [{"purchase_order_item": po_item_id, "received_quantity": "4.00"}]}
    s, grn2 = request("POST", f"/api/companies/{company_id}/purchases/orders/{order_id}/receive/", rcv2_payload, token)
    assert s == 201, f"Remaining GRN failed: {s}, {grn2}"
    print(f"  [PASS] Remaining GRN Created: {grn2['receipt_number']} (Received 4 units, PO Completed)")

    s, comp_order = request("GET", f"/api/companies/{company_id}/purchases/orders/{order_id}/", token=token)
    assert s == 200 and comp_order["status"] == "COMPLETED", f"Order not completed: {comp_order}"
    print(f"  [PASS] Purchase Order State: {comp_order['status']}, Fulfillment: {comp_order['receiving_percentage']}%")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 5: GENERATE PURCHASE INVOICE FROM PURCHASE ORDER")
    print("=" * 70)
    inv_payload = {
        "vendor_invoice_number": "VEND-BILL-LIVE-5D",
        "invoice_date": "2026-09-18",
        "notes": "Net 30 procurement invoice",
    }
    s, invoice = request("POST", f"/api/companies/{company_id}/purchases/orders/{order_id}/invoice/", inv_payload, token)
    assert s == 201, f"Invoice creation failed: {s}, {invoice}"
    inv_id = invoice["id"]
    assert invoice["vendor_invoice_number"] == "VEND-BILL-LIVE-5D", "Vendor invoice number not set"
    assert Decimal(str(invoice["balance_due"])) == Decimal("2000.00"), f"Expected 2000.00 balance: {invoice['balance_due']}"
    print(f"  [PASS] Purchase Invoice Created: {invoice['invoice_number']} (Total: ${invoice['total']}, Balance Due: ${invoice['balance_due']})")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 6: RECORD PARTIAL PAYMENT & VERIFY STATUS")
    print("=" * 70)
    p1_payload = {
        "amount": "1200.00",
        "payment_method": "BANK_TRANSFER",
        "payment_date": "2026-09-18",
        "reference": "WIRE-TXN-001",
    }
    s, pay1 = request("POST", f"/api/companies/{company_id}/purchases/invoices/{inv_id}/payments/", p1_payload, token)
    assert s == 201, f"Partial payment failed: {s}, {pay1}"
    print(f"  [PASS] Partial Payment Recorded: {pay1['payment_number']} ($1200.00)")

    s, upd_inv = request("GET", f"/api/companies/{company_id}/purchases/invoices/{inv_id}/", token=token)
    assert s == 200 and upd_inv["status"] == "PARTIALLY_PAID" and Decimal(str(upd_inv["balance_due"])) == Decimal("800.00"), f"Invoice status incorrect: {upd_inv}"
    print(f"  [PASS] Invoice State: {upd_inv['status']}, Remaining Balance: ${upd_inv['balance_due']}")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 7: OVERPAYMENT REJECTION SAFETY TEST")
    print("=" * 70)
    # Remaining balance is $800.00. Attempting to pay $1000.00 must be rejected with HTTP 400
    s, err = request("POST", f"/api/companies/{company_id}/purchases/invoices/{inv_id}/payments/", {"amount": "1000.00", "payment_method": "CASH"}, token)
    assert s == 400, f"Expected 400 for overpayment: {s}, {err}"
    print(f"  [PASS] Overpayment correctly rejected: {err.get('detail') or err}")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 8: FINAL SETTLEMENT PAYMENT (PAID)")
    print("=" * 70)
    p2_payload = {
        "amount": "800.00",
        "payment_method": "BANK_TRANSFER",
        "payment_date": "2026-09-18",
        "reference": "WIRE-TXN-002",
    }
    s, pay2 = request("POST", f"/api/companies/{company_id}/purchases/invoices/{inv_id}/payments/", p2_payload, token)
    assert s == 201, f"Final payment failed: {s}, {pay2}"
    print(f"  [PASS] Final Payment Recorded: {pay2['payment_number']} ($800.00)")

    s, settled_inv = request("GET", f"/api/companies/{company_id}/purchases/invoices/{inv_id}/", token=token)
    assert s == 200 and settled_inv["status"] == "PAID" and Decimal(str(settled_inv["balance_due"])) == Decimal("0.00"), f"Settled invoice not PAID: {settled_inv}"
    print(f"  [PASS] Invoice Fully Settled: Status {settled_inv['status']}, Balance: ${settled_inv['balance_due']}")

    s, settled_po = request("GET", f"/api/companies/{company_id}/purchases/orders/{order_id}/", token=token)
    assert s == 200 and settled_po["payment_status"] == "PAID", f"PO payment_status not PAID: {settled_po['payment_status']}"
    print(f"  [PASS] Linked Purchase Order Payment Status: {settled_po['payment_status']}")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 9: VENDOR PURCHASE HISTORY AUDIT")
    print("=" * 70)
    s, v_hist = request("GET", f"/api/companies/{company_id}/purchases/vendors/{vendor_id}/history/", token=token)
    assert s == 200, f"Vendor history failed: {s}"
    assert len(v_hist["orders"]) >= 1, "Vendor history missing orders"
    assert len(v_hist["receipts"]) >= 1, "Vendor history missing receipts"
    assert len(v_hist["invoices"]) >= 1, "Vendor history missing invoices"
    assert len(v_hist["payments"]) >= 1, "Vendor history missing payments"
    print(f"  [PASS] Vendor History Verified: {len(v_hist['orders'])} orders, {len(v_hist['receipts'])} receipts, {len(v_hist['invoices'])} invoices, {len(v_hist['payments'])} payments")
    print(f"         Total Invoiced: ${v_hist['metrics']['total_invoiced_amount']}, Total Paid: ${v_hist['metrics']['total_paid_amount']}")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 10: PURCHASE DASHBOARD FINANCIAL KPIS")
    print("=" * 70)
    s, dash = request("GET", f"/api/companies/{company_id}/purchases/dashboard/", token=token)
    assert s == 200, f"Dashboard failed: {s}"
    m = dash["metrics"]
    assert Decimal(str(m["total_purchase_value"])) > Decimal("0.00")
    assert Decimal(str(m["total_invoiced_amount"])) > Decimal("0.00")
    assert Decimal(str(m["total_paid_amount"])) > Decimal("0.00")
    print(f"  [PASS] Dashboard Verified: Total PO: ${m['total_purchase_value']}, Invoiced: ${m['total_invoiced_amount']}, Paid: ${m['total_paid_amount']}")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 11: PURCHASE ANALYTICS (12-MONTH TRENDS & DISTRIBUTIONS)")
    print("=" * 70)
    s, an = request("GET", f"/api/companies/{company_id}/purchases/analytics/", token=token)
    assert s == 200, f"Analytics failed: {s}"
    assert len(an["monthly_trends"]) == 12, "Monthly trends not 12 months"
    assert an["ordered_vs_received"]["fulfillment_rate_percentage"] > 0
    assert an["financial_overview"]["payment_rate_percentage"] > 0
    print(f"  [PASS] Analytics Verified: Fulfillment: {an['ordered_vs_received']['fulfillment_rate_percentage']}%, Payment Rate: {an['financial_overview']['payment_rate_percentage']}%")

    print("\n" + "=" * 70)
    print("LIFECYCLE STEP 12: PURCHASE REPORTS SUITE (ALL 5 REPORT TYPES)")
    print("=" * 70)
    for rtype in ["summary", "orders", "vendors", "receiving", "financial"]:
        s, rep = request("GET", f"/api/companies/{company_id}/purchases/reports/{rtype}/", token=token)
        assert s == 200 and rep["report_type"] == rtype, f"Report {rtype} failed: {s}, {rep}"
        print(f"  [PASS] Report '{rtype}' generated successfully.")

    print("\n" + "=" * 75)
    print(">>> ALL PHASE 5D LIVE VERIFICATION CHECKS COMPLETED SUCCESSFULLY! <<<")
    print("=" * 75)


if __name__ == "__main__":
    run_tests()
