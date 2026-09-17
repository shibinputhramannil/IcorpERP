# ICORP ERP - Phase 5A: Purchase Management Foundation Walkthrough

## 1. Executive Summary

Phase 5A establishes the **Purchase Management Foundation** for ICORP ERP. It delivers a comprehensive procurement lifecycle—from vendor quotations through confirmed purchase orders—strictly integrated with the existing tenant architecture, authentication, user roles, inventory vendor registry, product master catalog, and warehouse facilities.

> [!IMPORTANT]
> - **Zero Model Duplication**: Strictly reuses existing `inventory.Vendor`, `inventory.Product`, and `inventory.Warehouse` models.
> - **Physical Stock Remains Untouched**: Actual goods receiving and `STOCK_IN` inventory transactions belong to Phase 5B.
> - **Tenant Scoping & Security**: All records, line items, and metrics are strictly validated and scoped to the active `Company`. Cross-company access attempts return `HTTP 403 Forbidden` or `HTTP 404 Not Found`.

---

## 2. Models & Data Architecture

The new `purchase` Django application (`backend/purchase/`) provides:

### 2.1 Number Generators
- **`generate_purchase_quotation_number(company)`**: Automatically formats and increments sequence numbers: `PQT-YYYY-######` (e.g. `PQT-2026-000001`). Enforces system-wide uniqueness.
- **`generate_purchase_order_number(company)`**: Automatically formats and increments sequence numbers: `PO-YYYY-######` (e.g. `PO-2026-000001`). Enforces system-wide uniqueness.

### 2.2 PurchaseQuotation & PurchaseQuotationItem
- **`PurchaseQuotation`**:
  - `company`: ForeignKey to `company.Company`
  - `vendor`: ForeignKey to `inventory.Vendor`
  - `quotation_number`: `CharField(max_length=50, unique=True)`
  - `quotation_date`: `DateField(default=timezone.localdate)`
  - `valid_until`: `DateField(null=True, blank=True)`
  - `status`: `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CONVERTED` (default: `DRAFT`)
  - `notes`: `TextField(blank=True)`
  - `subtotal`, `discount`, `tax`, `total`: `DecimalField(max_digits=12, decimal_places=2, default=0.00)`
  - `created_by`: ForeignKey to `auth.User`
  - `recalculate_totals()`: Calculates totals directly from line items.
- **`PurchaseQuotationItem`**:
  - `quotation`: ForeignKey to `PurchaseQuotation` (`related_name='items'`)
  - `product`: ForeignKey to `inventory.Product` (`on_delete=models.PROTECT`)
  - `quantity`: DecimalField (`> 0`)
  - `unit_price`: DecimalField (`>= 0`)
  - `discount`: DecimalField (`>= 0`)
  - `tax`: DecimalField (`>= 0`)
  - `line_total`: `max(0, (qty * price) - discount + tax)` enforced by backend on save.

### 2.3 PurchaseOrder & PurchaseOrderItem
- **`PurchaseOrder`**:
  - `company`: ForeignKey to `company.Company`
  - `vendor`: ForeignKey to `inventory.Vendor`
  - `quotation`: ForeignKey to `PurchaseQuotation` (nullable)
  - `warehouse`: ForeignKey to `inventory.Warehouse` (nullable)
  - `order_number`: `CharField(max_length=50, unique=True)`
  - `order_date`: `DateField(default=timezone.localdate)`
  - `expected_date`: `DateField(null=True, blank=True)`
  - `status`: `DRAFT`, `CONFIRMED`, `PROCESSING`, `PARTIALLY_RECEIVED`, `COMPLETED`, `CANCELLED` (default: `CONFIRMED`)
  - `subtotal`, `discount`, `tax`, `total`: `DecimalField(max_digits=12, decimal_places=2, default=0.00)`
  - `recalculate_totals()`: Computes totals directly from line items.
- **`PurchaseOrderItem`**:
  - `purchase_order`: ForeignKey to `PurchaseOrder` (`related_name='items'`)
  - `product`: ForeignKey to `inventory.Product` (`on_delete=models.PROTECT`)
  - `quantity`, `unit_price`, `discount`, `tax`, `line_total`

---

## 3. Quotation to Purchase Order Conversion

1. **Endpoint**: `POST /api/companies/<company_id>/purchases/quotations/<id>/convert-to-order/`
2. **Duplicate Conversion Protection**:
   - If `quotation.status == 'CONVERTED'` or `quotation.orders.exists()`, rejects with `HTTP 400 Bad Request` ("This purchase quotation has already been converted to a purchase order.").
3. **Atomic Conversion**:
   - Generates sequential `PO-YYYY-######`.
   - Clones all line items from the quotation to the new order.
   - Links the optional or default warehouse.
   - Computes backend totals.
   - Transitions `quotation.status` to `CONVERTED`.

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/companies/<id>/purchases/dashboard/` | Procurement KPIs, spend totals, active vendors, recent quotes & orders |
| `GET` | `/api/companies/<id>/purchases/quotations/` | List quotations with status, vendor, date, and search filters |
| `POST` | `/api/companies/<id>/purchases/quotations/` | Create quotation with nested line items and auto-numbering |
| `GET` | `/api/companies/<id>/purchases/quotations/<id>/` | Retrieve single quotation with item details |
| `PATCH` | `/api/companies/<id>/purchases/quotations/<id>/` | Partial update of quotation or status |
| `DELETE` | `/api/companies/<id>/purchases/quotations/<id>/` | Delete quotation (blocked if status is `CONVERTED`) |
| `POST` | `/api/companies/<id>/purchases/quotations/<id>/convert-to-order/` | Convert quotation to purchase order |
| `GET` | `/api/companies/<id>/purchases/orders/` | List purchase orders with status, warehouse, vendor filters |
| `POST` | `/api/companies/<id>/purchases/orders/` | Create direct purchase order with line items |
| `GET` | `/api/companies/<id>/purchases/orders/<id>/` | Retrieve purchase order detail |
| `PATCH` | `/api/companies/<id>/purchases/orders/<id>/` | Update purchase order (e.g. status transition to `PROCESSING` or `CANCELLED`) |
| `DELETE` | `/api/companies/<id>/purchases/orders/<id>/` | Delete purchase order (blocked if status is `COMPLETED`) |
| `GET` | `/api/companies/<id>/purchases/vendors/<id>/history/` | Lifetime procurement audit history & spend metrics for a vendor |

---

## 5. Frontend UI Implementation

- **`frontend/src/services/purchaseService.js`**: Complete Axios API client for all purchase endpoints.
- **`frontend/src/pages/PurchasePage.jsx`**:
  - **Tab 0: Dashboard**: Stat cards (Total Quotes, Accepted Quotes, Total Orders, Total Spend, Pending Value, Active Vendors), Recent Quotes and Orders tables with 1-click actions.
  - **Tab 1: Purchase Quotations**: Filter bar (Status, Search), Quotations table, Create Quotation dialog with dynamic line items, auto-filling unit prices from product catalog, detail modal, and conversion button.
  - **Tab 2: Purchase Orders**: Filter bar, Orders table with status chips (`CONFIRMED`, `PROCESSING`, `COMPLETED`, `CANCELLED`), Create Direct PO dialog, Order detail modal, and cancellation actions.
  - **Tab 3: Vendors & History**: Vendor registry list with "View History" launcher displaying lifetime procurement metrics and past order/quotation records.
- **`frontend/src/layouts/Sidebar.jsx`**: Activated Purchase link in "OPERATIONS & WORKFLOWS" navigation group with status `live`.
- **`frontend/src/routes/AppRoutes.jsx`**: Wired `/purchase` route to `<PurchasePage />`.

---

## 6. Verification & Test Results

### 6.1 Backend Automated Tests
- **`backend/purchase/tests.py`**: **28 / 28 Tests Passed (100%)**
- **Full ERP Suite**: **174 / 174 Tests Passed (100%)** across `accounts`, `apps.employee`, `company`, `crm`, `inventory`, `sales`, and `purchase`.

### 6.2 Frontend Production Build
- `npm run build` completed in **1.83s** with **0 errors**.

### 6.3 Live API Verification (`backend/test_phase5a_live.py`)
All 13 live verification scenarios passed against the live PostgreSQL-backed Django server:
- JWT authentication & tenant resolution
- Reference Vendor, Product, Warehouse extraction
- Quotation creation & backend math verification (`PQT-2026-000001`)
- Quotation listing & status filtering
- Quotation detail inspection
- Quotation-to-Order conversion (`PO-2026-000001`) & status transition to `CONVERTED`
- Duplicate conversion rejection (`HTTP 400`)
- Direct Purchase Order creation (`PO-2026-000002`)
- Purchase Order listing & filtering
- Order status update (`PROCESSING`)
- Purchase Dashboard metrics verification
- Vendor Purchase History verification
- Cross-tenant security rejection (`HTTP 403/404`)

### 6.4 Postman Collection
Saved at `backend/postman/ICORP_ERP_Phase5A.postman_collection.json` with 12 pre-configured requests and automated assertions.
