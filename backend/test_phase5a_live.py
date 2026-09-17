import json
import urllib.request
import urllib.error
import sys

BASE_URL = "http://127.0.0.1:8000"

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

def run_tests():
    print("=" * 70)
    print("PHASE 5A: PURCHASE MANAGEMENT FOUNDATION LIVE API VERIFICATION")
    print("=" * 70)

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

    # 3. Base Entities Retrieval (Vendor, Product, Warehouse)
    print("\n[2] Fetching existing Vendors, Products, and Warehouses...")
    status, vendors = request("GET", f"/api/companies/{company_id}/inventory/vendors/", token=token)
    assert status == 200 and len(vendors) > 0, f"No vendors found for tenant: {status}, {vendors}"
    vendor_id = vendors[0]["id"]
    vendor_name = vendors[0]["name"]

    status, products = request("GET", f"/api/companies/{company_id}/inventory/products/", token=token)
    assert status == 200 and len(products) > 0, f"No products found for tenant: {status}, {products}"
    prod1 = products[0]
    prod2 = products[1] if len(products) > 1 else products[0]

    status, warehouses = request("GET", f"/api/companies/{company_id}/inventory/warehouses/", token=token)
    assert status == 200 and len(warehouses) > 0, f"No warehouses found for tenant: {status}, {warehouses}"
    warehouse_id = warehouses[0]["id"]
    warehouse_name = warehouses[0]["name"]
    print(f"  [PASS] Using Vendor: '{vendor_name}' (ID {vendor_id})")
    print(f"  [PASS] Using Products: '{prod1['name']}', '{prod2['name']}'")
    print(f"  [PASS] Using Warehouse: '{warehouse_name}' (ID {warehouse_id})")

    # 4. Create Purchase Quotation
    print("\n[3] Testing POST /api/companies/<id>/purchases/quotations/ (Create Quotation) ...")
    quote_payload = {
        "vendor": vendor_id,
        "quotation_date": "2026-09-17",
        "valid_until": "2026-10-17",
        "notes": "Live test procurement quotation",
        "items": [
            {
                "product": prod1["id"],
                "description": "Batch Item 1",
                "quantity": "10.00",
                "unit_price": "100.00",
                "discount": "20.00",
                "tax": "10.00"
            },
            {
                "product": prod2["id"],
                "description": "Batch Item 2",
                "quantity": "5.00",
                "unit_price": "50.00",
                "discount": "10.00",
                "tax": "5.00"
            }
        ]
    }
    status, quote = request("POST", f"/api/companies/{company_id}/purchases/quotations/", quote_payload, token=token)
    assert status == 201, f"Create quotation failed: {status}, {quote}"
    quote_id = quote["id"]
    quote_number = quote["quotation_number"]
    assert quote_number.startswith("PQT-"), f"Unexpected quotation number prefix: {quote_number}"
    # Subtotal: 10*100 + 5*50 = 1000 + 250 = 1250
    # Discount: 20 + 10 = 30
    # Tax: 10 + 5 = 15
    # Total: 1250 - 30 + 15 = 1235
    assert float(quote["subtotal"]) == 1250.0, f"Expected subtotal 1250.0, got {quote['subtotal']}"
    assert float(quote["discount"]) == 30.0, f"Expected discount 30.0, got {quote['discount']}"
    assert float(quote["tax"]) == 15.0, f"Expected tax 15.0, got {quote['tax']}"
    assert float(quote["total"]) == 1235.0, f"Expected total 1235.0, got {quote['total']}"
    print(f"  [PASS] Quotation {quote_number} created with verified backend calculations: Subtotal=${quote['subtotal']}, Discount=${quote['discount']}, Tax=${quote['tax']}, Total=${quote['total']}")

    # 5. List Quotations & Filtering
    print("\n[4] Testing GET /api/companies/<id>/purchases/quotations/ (List & Filters) ...")
    status, q_list = request("GET", f"/api/companies/{company_id}/purchases/quotations/", token=token)
    assert status == 200 and len(q_list) > 0, "Failed to list quotations"
    assert any(q["id"] == quote_id for q in q_list), "Created quotation not in list"
    print(f"  [PASS] Listed {len(q_list)} quotations.")

    status, q_filtered = request("GET", f"/api/companies/{company_id}/purchases/quotations/?status=DRAFT", token=token)
    assert status == 200 and all(q["status"] == "DRAFT" for q in q_filtered), "Quotation status filter failed"
    print(f"  [PASS] Filter by status=DRAFT verified ({len(q_filtered)} returned).")

    # 6. Retrieve Single Quotation
    print(f"\n[5] Testing GET /api/companies/<id>/purchases/quotations/{quote_id}/ ...")
    status, q_detail = request("GET", f"/api/companies/{company_id}/purchases/quotations/{quote_id}/", token=token)
    assert status == 200 and q_detail["id"] == quote_id, "Failed to get quotation detail"
    assert len(q_detail["items"]) == 2, "Items count mismatch"
    print(f"  [PASS] Quotation detail retrieved with {len(q_detail['items'])} line items.")

    # 7. Convert Quotation to Purchase Order
    print(f"\n[6] Testing POST /api/companies/<id>/purchases/quotations/{quote_id}/convert-to-order/ ...")
    convert_payload = {"warehouse": warehouse_id, "notes": "Converted via live test suite"}
    status, order = request("POST", f"/api/companies/{company_id}/purchases/quotations/{quote_id}/convert-to-order/", convert_payload, token=token)
    assert status == 201, f"Conversion failed: {status}, {order}"
    order_id = order["id"]
    order_number = order["order_number"]
    assert order_number.startswith("PO-"), f"Unexpected PO prefix: {order_number}"
    assert order["quotation"] == quote_id, "Quotation reference missing in order"
    assert order["warehouse"] == warehouse_id, "Warehouse mismatch in order"
    assert float(order["total"]) == 1235.0, f"Order total mismatch: {order['total']}"
    assert order["status"] == "CONFIRMED", f"Expected CONFIRMED status, got {order['status']}"
    print(f"  [PASS] Quotation {quote_number} converted into Purchase Order {order_number} (Total=${order['total']}).")

    # Verify quotation status is now CONVERTED
    status, q_after = request("GET", f"/api/companies/{company_id}/purchases/quotations/{quote_id}/", token=token)
    assert status == 200 and q_after["status"] == "CONVERTED", f"Quotation status not CONVERTED: {q_after.get('status')}"
    print("  [PASS] Quotation status transitioned to CONVERTED.")

    # 8. Prevent Duplicate Conversion
    print(f"\n[7] Testing Duplicate Conversion Prevention on {quote_number} ...")
    status, dup_res = request("POST", f"/api/companies/{company_id}/purchases/quotations/{quote_id}/convert-to-order/", {}, token=token)
    assert status == 400, f"Expected HTTP 400 for duplicate conversion, got {status}: {dup_res}"
    print(f"  [PASS] Duplicate conversion rejected: '{dup_res.get('detail')}'.")

    # 9. Create Direct Purchase Order
    print("\n[8] Testing POST /api/companies/<id>/purchases/orders/ (Direct PO Creation) ...")
    direct_order_payload = {
        "vendor": vendor_id,
        "warehouse": warehouse_id,
        "order_date": "2026-09-17",
        "expected_date": "2026-09-30",
        "notes": "Direct PO live test",
        "items": [
            {
                "product": prod1["id"],
                "quantity": "15.00",
                "unit_price": "95.00",
                "discount": "50.00",
                "tax": "25.00"
            }
        ]
    }
    status, direct_order = request("POST", f"/api/companies/{company_id}/purchases/orders/", direct_order_payload, token=token)
    assert status == 201, f"Direct order creation failed: {status}, {direct_order}"
    direct_order_id = direct_order["id"]
    direct_order_num = direct_order["order_number"]
    assert direct_order_num.startswith("PO-"), f"Unexpected PO prefix: {direct_order_num}"
    # (15 * 95) - 50 + 25 = 1425 - 50 + 25 = 1400.0
    assert float(direct_order["total"]) == 1400.0, f"Total mismatch: {direct_order['total']}"
    print(f"  [PASS] Direct Purchase Order {direct_order_num} created (Total=${direct_order['total']}).")

    # 10. List Orders & Filtering
    print("\n[9] Testing GET /api/companies/<id>/purchases/orders/ (List & Filtering) ...")
    status, o_list = request("GET", f"/api/companies/{company_id}/purchases/orders/", token=token)
    assert status == 200 and len(o_list) > 0, "Failed to list orders"
    assert any(o["id"] == direct_order_id for o in o_list), "Direct order not found in list"
    print(f"  [PASS] Listed {len(o_list)} purchase orders.")

    # 11. Update Order Status
    print(f"\n[10] Testing PATCH /api/companies/<id>/purchases/orders/{direct_order_id}/ (Status Update) ...")
    status, patch_res = request("PATCH", f"/api/companies/{company_id}/purchases/orders/{direct_order_id}/", {"status": "PROCESSING"}, token=token)
    assert status == 200 and patch_res["status"] == "PROCESSING", f"Failed to update status: {patch_res}"
    print("  [PASS] Purchase Order status updated to PROCESSING.")

    # 12. Purchase Dashboard Foundation
    print("\n[11] Testing GET /api/companies/<id>/purchases/dashboard/ (Dashboard Metrics) ...")
    status, dash = request("GET", f"/api/companies/{company_id}/purchases/dashboard/", token=token)
    assert status == 200, f"Dashboard failed: {status}, {dash}"
    metrics = dash.get("metrics", {})
    assert "total_purchase_quotations" in metrics, "Missing total_purchase_quotations"
    assert "total_purchase_orders" in metrics, "Missing total_purchase_orders"
    assert "total_purchase_value" in metrics, "Missing total_purchase_value"
    assert "pending_purchase_value" in metrics, "Missing pending_purchase_value"
    assert "active_vendors" in metrics, "Missing active_vendors"
    assert "recent_quotations" in dash, "Missing recent_quotations"
    assert "recent_orders" in dash, "Missing recent_orders"
    print(f"  [PASS] Dashboard verified: Total Quotations={metrics['total_purchase_quotations']}, Total Orders={metrics['total_purchase_orders']}, Total Spend=${metrics['total_purchase_value']}, Active Vendors={metrics['active_vendors']}")

    # 13. Vendor Purchase History Foundation
    print(f"\n[12] Testing GET /api/companies/<id>/purchases/vendors/{vendor_id}/history/ ...")
    status, v_hist = request("GET", f"/api/companies/{company_id}/purchases/vendors/{vendor_id}/history/", token=token)
    assert status == 200, f"Vendor history failed: {status}, {v_hist}"
    assert v_hist.get("vendor", {}).get("id") == vendor_id, "Vendor ID mismatch"
    v_metrics = v_hist.get("metrics", {})
    assert "total_quotations" in v_metrics, "Missing total_quotations in metrics"
    assert "total_orders" in v_metrics, "Missing total_orders in metrics"
    assert "total_purchased_amount" in v_metrics, "Missing total_purchased_amount in metrics"
    assert "quotations" in v_hist and "orders" in v_hist, "Missing history arrays"
    print(f"  [PASS] Vendor Purchase History verified: Spend=${v_metrics['total_purchased_amount']}, Orders={v_metrics['total_orders']}, Quotes={v_metrics['total_quotations']}")

    # 14. Multi-Tenant Isolation
    print("\n[13] Testing Cross-Tenant Access Enforcement ...")
    invalid_comp_id = 99999
    status, cross_hist = request("GET", f"/api/companies/{invalid_comp_id}/purchases/vendors/{vendor_id}/history/", token=token)
    assert status in (403, 404), f"Expected 403/404 for invalid company, got {status}"
    status, cross_quote = request("GET", f"/api/companies/{invalid_comp_id}/purchases/quotations/{quote_id}/", token=token)
    assert status in (403, 404), f"Expected 403/404 for cross-company quote access, got {status}"
    print(f"  [PASS] Tenant isolation enforced (returned HTTP {status}).")

    print("\n" + "=" * 70)
    print("ALL PHASE 5A LIVE VERIFICATION SCENARIOS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
