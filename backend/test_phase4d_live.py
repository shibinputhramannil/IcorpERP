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
    print("PHASE 4D: SALES FINALIZATION, REPORTING & INTEGRATION LIVE VERIFICATION")
    print("=" * 70)

    # 0. Login
    print("\n[SETUP] Authenticating as admin...")
    status, res = request("POST", "/api/auth/login/", {"username": "admin", "password": "admin"})
    assert status == 200, f"Login failed: {status}, {res}"
    token = res.get("access") or res.get("tokens", {}).get("access")
    assert token, "No access token received"
    print("  [PASS] Logged in successfully. JWT Token acquired.")

    # 1. Tenant Selection
    status, companies = request("GET", "/api/companies/", token=token)
    assert status == 200 and len(companies) > 0, "No companies found"
    target_company = next((c for c in companies if "Nexus" in c["name"] or c["id"] == 1), companies[0])
    company_id = target_company["id"]
    print(f"  [PASS] Active Tenant: ID {company_id} ({target_company['name']})")

    # Fetch reference customer, product, and warehouse
    status, customers = request("GET", f"/api/companies/{company_id}/customers/", token=token)
    assert status == 200 and len(customers) > 0, "No customers found for tenant"
    cust_id = customers[0]["id"]
    cust_name = customers[0]["name"]

    status, products = request("GET", f"/api/companies/{company_id}/inventory/products/", token=token)
    assert status == 200 and len(products) > 0, "No products found for tenant"
    prod_id = products[0]["id"]
    prod_name = products[0]["name"]

    status, warehouses = request("GET", f"/api/companies/{company_id}/inventory/warehouses/", token=token)
    assert status == 200 and len(warehouses) > 0, "No warehouses found for tenant"
    wh_id = warehouses[0]["id"]

    # SCENARIO 1: Enhanced Sales Dashboard
    print("\n[SCENARIO 1] Enhanced Sales Dashboard API (GET /api/companies/<id>/sales/dashboard/)")
    status, dash = request("GET", f"/api/companies/{company_id}/sales/dashboard/", token=token)
    assert status == 200, f"Dashboard failed: {status}, {dash}"
    metrics = dash.get("metrics", {})
    comparisons = dash.get("comparisons", {})
    assert "total_revenue" in metrics, "Missing total_revenue in metrics"
    assert "total_invoiced_amount" in metrics, "Missing total_invoiced_amount in metrics"
    assert "total_paid_amount" in metrics, "Missing total_paid_amount in metrics"
    assert "total_outstanding_amount" in metrics, "Missing total_outstanding_amount in metrics"
    assert "invoices_count" in metrics, "Missing invoices_count in metrics"
    assert "revenue" in comparisons, "Missing revenue comparisons"
    assert "orders" in comparisons, "Missing orders comparisons"
    assert "invoices" in comparisons, "Missing invoices comparisons"
    assert "recent_invoices" in dash, "Missing recent_invoices"
    assert "recent_payments" in dash, "Missing recent_payments"
    assert "top_customers" in dash, "Missing top_customers"
    print(f"  [PASS] Dashboard verified: Revenue=${metrics.get('total_revenue')}, Invoiced=${metrics.get('total_invoiced_amount')}, Paid=${metrics.get('total_paid_amount')}, Outstanding=${metrics.get('total_outstanding_amount')}")
    print(f"         Monthly Comparisons: Rev Growth={comparisons['revenue']['growth_rate']}%, Order Growth={comparisons['orders']['growth_rate']}%")

    # SCENARIO 2: Sales Analytics API
    print("\n[SCENARIO 2] Sales Analytics API (GET /api/companies/<id>/sales/analytics/)")
    status, analytics = request("GET", f"/api/companies/{company_id}/sales/analytics/", token=token)
    assert status == 200, f"Analytics failed: {status}, {analytics}"
    assert "monthly_trends" in analytics, "Missing monthly_trends in analytics"
    assert len(analytics["monthly_trends"]) == 12, f"Expected 12 monthly trends, got {len(analytics['monthly_trends'])}"
    assert "quotation_conversion" in analytics, "Missing quotation_conversion in analytics"
    assert "orders_by_status" in analytics, "Missing orders_by_status"
    assert "invoices_by_status" in analytics, "Missing invoices_by_status"
    assert "payment_methods" in analytics, "Missing payment_methods"
    assert "top_customers" in analytics, "Missing top_customers"
    assert "top_products" in analytics, "Missing top_products"
    assert "warehouse_sales" in analytics, "Missing warehouse_sales"
    q_conv = analytics["quotation_conversion"]
    print(f"  [PASS] Analytics verified: 12-month trends populated, Quote conversion: {q_conv['converted_quotations']}/{q_conv['total_quotations']} ({q_conv['conversion_rate']}%)")

    # SCENARIO 3: Sales Reports - Summary Report
    print("\n[SCENARIO 3] Sales Reports API - Summary KPI Report")
    status, rep_summary = request("GET", f"/api/companies/{company_id}/sales/reports/?report_type=summary", token=token)
    assert status == 200, f"Summary report failed: {status}, {rep_summary}"
    assert rep_summary.get("report_type") == "summary", "report_type mismatch"
    summary_data = rep_summary.get("summary", {})
    assert "total_orders" in summary_data, "Missing total_orders"
    assert "total_invoiced" in summary_data, "Missing total_invoiced"
    assert "total_collected" in summary_data, "Missing total_collected"
    assert "total_outstanding" in summary_data, "Missing total_outstanding"
    print(f"  [PASS] Summary Report verified: Orders={summary_data['total_orders']}, Invoiced=${summary_data['total_invoiced']}, Collected=${summary_data['total_collected']}")

    # SCENARIO 4: Sales Reports - Customer Breakdown
    print("\n[SCENARIO 4] Sales Reports API - Customer Performance Breakdown")
    status, rep_cust = request("GET", f"/api/companies/{company_id}/sales/reports/?report_type=customer", token=token)
    assert status == 200, f"Customer report failed: {status}, {rep_cust}"
    assert rep_cust.get("report_type") == "customer", "report_type mismatch"
    assert isinstance(rep_cust.get("rows"), list), "rows is not a list"
    print(f"  [PASS] Customer Report verified: {len(rep_cust['rows'])} customer records returned with sales/invoicing metrics.")

    # SCENARIO 5: Sales Reports - Product Breakdown
    print("\n[SCENARIO 5] Sales Reports API - Product Sales Breakdown")
    status, rep_prod = request("GET", f"/api/companies/{company_id}/sales/reports/?report_type=product", token=token)
    assert status == 200, f"Product report failed: {status}, {rep_prod}"
    assert rep_prod.get("report_type") == "product", "report_type mismatch"
    assert isinstance(rep_prod.get("rows"), list), "rows is not a list"
    print(f"  [PASS] Product Report verified: {len(rep_prod['rows'])} product sales records returned.")

    # SCENARIO 6: Sales Reports - Invoice & Aging Analysis
    print("\n[SCENARIO 6] Sales Reports API - Invoice & Aging Analysis")
    status, rep_inv = request("GET", f"/api/companies/{company_id}/sales/reports/?report_type=invoice", token=token)
    assert status == 200, f"Invoice report failed: {status}, {rep_inv}"
    assert rep_inv.get("report_type") == "invoice", "report_type mismatch"
    aging = rep_inv.get("aging_summary", {})
    assert "current" in aging, "Missing current in aging_summary"
    assert "1_30" in aging, "Missing 1_30 in aging_summary"
    assert "31_60" in aging, "Missing 31_60 in aging_summary"
    assert "61_90" in aging, "Missing 61_90 in aging_summary"
    assert "90_plus" in aging, "Missing 90_plus in aging_summary"
    assert "total_outstanding" in aging, "Missing total_outstanding in aging_summary"
    print(f"  [PASS] Invoice Aging Report verified: Current=${aging['current']}, 1-30d=${aging['1_30']}, Total Outstanding=${aging['total_outstanding']}")

    # SCENARIO 7: Sales Reports - Payment Ledger
    print("\n[SCENARIO 7] Sales Reports API - Payment Ledger")
    status, rep_pay = request("GET", f"/api/companies/{company_id}/sales/reports/?report_type=payment", token=token)
    assert status == 200, f"Payment report failed: {status}, {rep_pay}"
    assert rep_pay.get("report_type") == "payment", "report_type mismatch"
    assert "total_payments_count" in rep_pay, "Missing total_payments_count"
    assert "total_amount_collected" in rep_pay, "Missing total_amount_collected"
    print(f"  [PASS] Payment Ledger Report verified: Count={rep_pay['total_payments_count']}, Total Collected=${rep_pay['total_amount_collected']}")

    # SCENARIO 8: Customer Sales History
    print(f"\n[SCENARIO 8] Customer Sales History API (Customer ID: {cust_id})")
    status, cust_hist = request("GET", f"/api/companies/{company_id}/sales/customers/{cust_id}/history/", token=token)
    assert status == 200, f"Customer history failed: {status}, {cust_hist}"
    assert cust_hist.get("customer", {}).get("id") == cust_id, "Customer ID mismatch"
    c_metrics = cust_hist.get("metrics", {})
    assert "total_quoted" in c_metrics, "Missing total_quoted in metrics"
    assert "total_ordered" in c_metrics, "Missing total_ordered in metrics"
    assert "total_invoiced" in c_metrics, "Missing total_invoiced in metrics"
    assert "total_paid" in c_metrics, "Missing total_paid in metrics"
    assert "outstanding_balance" in c_metrics, "Missing outstanding_balance in metrics"
    assert "conversion_rate" in c_metrics, "Missing conversion_rate in metrics"
    assert "quotations" in cust_hist, "Missing quotations list"
    assert "orders" in cust_hist, "Missing orders list"
    assert "invoices" in cust_hist, "Missing invoices list"
    assert "payments" in cust_hist, "Missing payments list"
    assert "receipts" in cust_hist, "Missing receipts list"
    print(f"  [PASS] Customer Sales History verified: Quoted=${c_metrics['total_quoted']}, Ordered=${c_metrics['total_ordered']}, Invoiced=${c_metrics['total_invoiced']}, Balance=${c_metrics['outstanding_balance']}")

    # SCENARIO 9: Cross-Tenant Customer Sales History Isolation
    print("\n[SCENARIO 9] Cross-Tenant Isolation for Customer Sales History")
    other_company_id = 99999
    status, cross_hist = request("GET", f"/api/companies/{other_company_id}/sales/customers/{cust_id}/history/", token=token)
    assert status in (403, 404), f"Expected 403 or 404 for cross-tenant customer history, got {status}"
    print(f"  [PASS] Cross-tenant isolation enforced: Returned HTTP {status} for unauthorized tenant access.")

    # SCENARIO 10: Company-Wide Payments List
    print("\n[SCENARIO 10] Company-Wide Payments List API (GET /api/companies/<id>/sales/payments/)")
    status, payments_list = request("GET", f"/api/companies/{company_id}/sales/payments/", token=token)
    assert status == 200, f"Payments list failed: {status}, {payments_list}"
    assert isinstance(payments_list, list), "Payments list is not a list"
    print(f"  [PASS] Company Payments List verified: {len(payments_list)} payment transactions retrieved.")

    # SCENARIO 11: Quotation Filtering
    print("\n[SCENARIO 11] Quotation Status Filtering (GET /api/companies/<id>/sales/quotations/?status=DRAFT)")
    status, filtered_quotes = request("GET", f"/api/companies/{company_id}/sales/quotations/?status=DRAFT", token=token)
    assert status == 200, f"Quotation filtering failed: {status}, {filtered_quotes}"
    for q in filtered_quotes:
        assert q["status"] == "DRAFT", f"Quotation status filter violation: {q['status']}"
    print(f"  [PASS] Quotation filter verified: {len(filtered_quotes)} DRAFT quotations retrieved.")

    # SCENARIO 12: Sales Order Filtering
    print("\n[SCENARIO 12] Sales Order Status Filtering (GET /api/companies/<id>/sales/orders/?status=CONFIRMED)")
    status, filtered_orders = request("GET", f"/api/companies/{company_id}/sales/orders/?status=CONFIRMED", token=token)
    assert status == 200, f"Order filtering failed: {status}, {filtered_orders}"
    for o in filtered_orders:
        assert o["status"] == "CONFIRMED", f"Order status filter violation: {o['status']}"
    print(f"  [PASS] Sales Order filter verified: {len(filtered_orders)} CONFIRMED orders retrieved.")

    # SCENARIO 13: Order Cancellation Guard for Completed Orders
    print("\n[SCENARIO 13] Order Cancellation Guard for COMPLETED Orders")
    status, orders = request("GET", f"/api/companies/{company_id}/sales/orders/?status=COMPLETED", token=token)
    if not orders:
        order_payload = {
            "customer": cust_id,
            "warehouse": wh_id,
            "status": "CONFIRMED",
            "items": [{"product": prod_id, "quantity": "1.00", "unit_price": "100.00"}]
        }
        status, new_ord = request("POST", f"/api/companies/{company_id}/sales/orders/", order_payload, token=token)
        assert status == 201, f"Failed to create order: {new_ord}"
        ord_id = new_ord["id"]
        request("POST", f"/api/companies/{company_id}/sales/orders/{ord_id}/reserve/", {"warehouse": wh_id}, token=token)
        request("POST", f"/api/companies/{company_id}/sales/orders/{ord_id}/fulfill/", {}, token=token)
        completed_order_id = ord_id
    else:
        completed_order_id = orders[0]["id"]

    status, cancel_res = request("PATCH", f"/api/companies/{company_id}/sales/orders/{completed_order_id}/", {"status": "CANCELLED"}, token=token)
    assert status == 400, f"Expected HTTP 400 when cancelling COMPLETED order directly, got {status}: {cancel_res}"
    print(f"  [PASS] Order cancellation guard verified: Returned HTTP 400 with message: '{cancel_res.get('detail')}'")

    # SCENARIO 14: Order Cancellation Auto-Release of Reservations
    print("\n[SCENARIO 14] Order Cancellation Auto-Releases Active Reservations")
    res_ord_payload = {
        "customer": cust_id,
        "warehouse": wh_id,
        "status": "CONFIRMED",
        "items": [{"product": prod_id, "quantity": "2.00", "unit_price": "120.00"}]
    }
    status, res_ord = request("POST", f"/api/companies/{company_id}/sales/orders/", res_ord_payload, token=token)
    assert status == 201, f"Failed to create order: {res_ord}"
    res_ord_id = res_ord["id"]

    status, reserve_res = request("POST", f"/api/companies/{company_id}/sales/orders/{res_ord_id}/reserve/", {"warehouse": wh_id}, token=token)
    assert status == 200, f"Reservation failed: {reserve_res}"

    status, res_list = request("GET", f"/api/companies/{company_id}/sales/orders/{res_ord_id}/reservations/", token=token)
    assert status == 200 and len(res_list) > 0, "No reservations found"
    assert any(r["status"] == "RESERVED" for r in res_list), "No active reservation before cancel"

    status, cancel_res = request("PATCH", f"/api/companies/{company_id}/sales/orders/{res_ord_id}/", {"status": "CANCELLED"}, token=token)
    assert status == 200, f"Cancellation failed: {cancel_res}"
    assert cancel_res["status"] == "CANCELLED", "Order status is not CANCELLED"

    status, res_list_after = request("GET", f"/api/companies/{company_id}/sales/orders/{res_ord_id}/reservations/", token=token)
    assert all(r["status"] == "CANCELLED" for r in res_list_after), "Not all reservations were marked CANCELLED on order cancellation"
    print(f"  [PASS] Order cancellation auto-release verified: Order CANCELLED, {len(res_list_after)} reservation(s) cleanly released.")

    # SCENARIO 15: Sales Return and Stock Restoration (STOCK_IN)
    print("\n[SCENARIO 15] Sales Return & Stock Restoration (STOCK_IN)")
    ret_ord_payload = {
        "customer": cust_id,
        "warehouse": wh_id,
        "status": "CONFIRMED",
        "items": [{"product": prod_id, "quantity": "3.00", "unit_price": "150.00"}]
    }
    status, ret_ord = request("POST", f"/api/companies/{company_id}/sales/orders/", ret_ord_payload, token=token)
    assert status == 201, f"Failed to create order: {ret_ord}"
    ret_ord_id = ret_ord["id"]
    order_item_id = ret_ord["items"][0]["id"]

    status, _ = request("POST", f"/api/companies/{company_id}/sales/orders/{ret_ord_id}/reserve/", {"warehouse": wh_id}, token=token)
    assert status == 200
    status, _ = request("POST", f"/api/companies/{company_id}/sales/orders/{ret_ord_id}/fulfill/", {}, token=token)
    assert status == 200

    status, stock_list = request("GET", f"/api/companies/{company_id}/inventory/stock/?product={prod_id}&warehouse={wh_id}", token=token)
    assert status == 200 and len(stock_list) > 0, "Failed to retrieve stock"
    qty_before = float(stock_list[0]["quantity"])

    return_payload = {
        "reason": "Live verification customer return - defective unit",
        "items": [
            {
                "sales_order_item": order_item_id,
                "product": prod_id,
                "quantity": "2.00"
            }
        ]
    }
    status, ret_res = request("POST", f"/api/companies/{company_id}/sales/orders/{ret_ord_id}/return/", return_payload, token=token)
    assert status == 201, f"Sales return creation failed: {status}, {ret_res}"
    assert "return_number" in ret_res, "Missing return_number"
    assert ret_res["return_number"].startswith("RET-"), f"Unexpected return_number prefix: {ret_res['return_number']}"
    assert len(ret_res["items"]) == 1, "Expected 1 return item"

    status, stock_list_after = request("GET", f"/api/companies/{company_id}/inventory/stock/?product={prod_id}&warehouse={wh_id}", token=token)
    qty_after = float(stock_list_after[0]["quantity"])
    assert qty_after == qty_before + 2.0, f"Stock quantity mismatch: expected {qty_before + 2.0}, got {qty_after}"

    status, order_returns = request("GET", f"/api/companies/{company_id}/sales/orders/{ret_ord_id}/returns/", token=token)
    assert status == 200 and len(order_returns) >= 1, "Return not found in order returns list"

    status, all_returns = request("GET", f"/api/companies/{company_id}/sales/returns/", token=token)
    assert status == 200 and any(r["id"] == ret_res["id"] for r in all_returns), "Return not in company returns"

    print(f"  [PASS] Sales Return verified: Return {ret_res['return_number']} created.")
    print(f"         Stock restored: {qty_before} -> {qty_after} (+2.00 units in warehouse {wh_id}).")
    print(f"         Order returns and company returns list endpoints populated.")

    print("\n" + "=" * 70)
    print("ALL 15 PHASE 4D LIVE VERIFICATION SCENARIOS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
