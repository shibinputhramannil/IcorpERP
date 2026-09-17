# ICORP ERP - Phase 4A: Sales Foundation Walkthrough & Verification Report

## 1. Executive Summary

Phase 4A establishes the core **Sales Foundation** for ICORP ERP. It introduces formal Sales Quotation estimation and Sales Order fulfillment records with cross-module integration across CRM (Customers) and Inventory (Products). All operations enforce strict multi-tenant isolation, precise financial calculations using Python's `Decimal` type, atomic conversion workflows, and a modern Material UI workspace.

---

## 2. Architecture & Data Model

The `sales` Django app was created under `backend/sales/` and registered in `settings.py`.

```
                  ┌──────────────────────┐
                  │    Company (Tenant)  │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │ crm.Customer    │               │inventory.Product│
   └────────┬────────┘               └────────┬────────┘
            │                                 │
            ├──────────────────────┐          │
            ▼                      ▼          │
   ┌─────────────────┐    ┌─────────────────┐ │
   │    Quotation    │───►│   SalesOrder    │ │
   │ (Status Machine)│    │ (Status Machine)│ │
   └────────┬────────┘    └────────┬────────┘ │
            │                      │          │
            ▼                      ▼          │
   ┌─────────────────┐    ┌─────────────────┐ │
   │  QuotationItem  │    │ SalesOrderItem  │◄┘
   │ (Product Link)  │    │ (Product Link)  │
   └─────────────────┘    └─────────────────┘
```

### 2.1 Database Models

1. **`Quotation`**
   - **Company Scoping**: `ForeignKey(Company, on_delete=CASCADE, related_name="quotations")`
   - **Customer Link**: Reuses `crm.Customer` (`on_delete=CASCADE`)
   - **Quotation Number**: Unique per company and year, format `QT-YYYY-NNNNNN`
   - **Dates**: `quotation_date` (default `timezone.localdate`), `valid_until`
   - **Lifecycle Statuses**: `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CONVERTED`
   - **Financial Totals**: `subtotal`, `discount`, `tax`, `total` (`DecimalField(max_digits=12, decimal_places=2)`)
   - **Audit**: `created_by` (User), `created_at`, `updated_at`

2. **`QuotationItem`**
   - **Quotation Link**: `ForeignKey(Quotation, on_delete=CASCADE, related_name="items")`
   - **Product Link**: Reuses `inventory.Product` (`on_delete=PROTECT`)
   - **Fields**: `description`, `quantity`, `unit_price`, `discount`, `tax`, `line_total`
   - **Calculation**: Automatic enforcement in `save()`: `line_total = max(0, (qty * price) - disc + tax)`

3. **`SalesOrder`**
   - **Company Scoping**: `ForeignKey(Company, on_delete=CASCADE, related_name="sales_orders")`
   - **Customer Link**: Reuses `crm.Customer`
   - **Quotation Link**: `ForeignKey(Quotation, on_delete=SET_NULL, null=True, blank=True)`
   - **Order Number**: Unique per company and year, format `SO-YYYY-NNNNNN`
   - **Dates**: `order_date` (default `timezone.localdate`)
   - **Lifecycle Statuses**: `DRAFT`, `CONFIRMED`, `PROCESSING`, `COMPLETED`, `CANCELLED`
   - **Financial Totals**: `subtotal`, `discount`, `tax`, `total`

4. **`SalesOrderItem`**
   - **Order Link**: `ForeignKey(SalesOrder, on_delete=CASCADE, related_name="items")`
   - **Product Link**: Reuses `inventory.Product` (`on_delete=PROTECT`)
   - **Fields**: `description`, `quantity`, `unit_price`, `discount`, `tax`, `line_total`

---

## 3. Atomic Quotation &rarr; Sales Order Conversion

Endpoint: `POST /api/companies/<company_id>/sales/quotations/<id>/convert/`

The conversion workflow is wrapped in `@transaction.atomic()`:
1. Locks the `Quotation` record via `Quotation.objects.select_for_update()`.
2. Validates company ownership (`quotation.company_id == company.id`).
3. Rejects duplicate conversions (`quotation.status == CONVERTED` &rarr; HTTP 400).
4. Validates that the quotation contains at least 1 line item.
5. Generates the next sequential order number `SO-YYYY-NNNNNN`.
6. Creates a new `SalesOrder` with `status="CONFIRMED"`.
7. Clones each `QuotationItem` into a `SalesOrderItem`.
8. Updates the `Quotation` status to `CONVERTED`.
9. Returns the created `SalesOrder` representation with HTTP 201 Created.

---

## 4. REST API Endpoints

All endpoints are prefixed with `/api/companies/<company_id>/sales/`:

| Method | Endpoint | Description | Auth / Scope |
|---|---|---|---|
| `GET` | `dashboard/` | Real-time calculated KPI metrics & recent activity | CompanyMember |
| `GET` | `quotations/` | List quotations (supports `status`, `search`) | CompanyMember |
| `POST` | `quotations/` | Create quotation with nested line items | CompanyMember |
| `GET` | `quotations/<id>/` | Retrieve quotation details with item lines | CompanyMember |
| `PATCH` | `quotations/<id>/` | Partial update quotation (status, items, notes) | CompanyMember |
| `DELETE` | `quotations/<id>/` | Delete draft/rejected quotation | CompanyMember |
| `POST` | `quotations/<id>/convert/` | Atomic conversion to confirmed Sales Order | CompanyMember |
| `GET` | `orders/` | List sales orders (supports `status`, `search`) | CompanyMember |
| `POST` | `orders/` | Create direct sales order with nested items | CompanyMember |
| `GET` | `orders/<id>/` | Retrieve sales order details with item lines | CompanyMember |
| `PATCH` | `orders/<id>/` | Update order status (`PROCESSING`, `COMPLETED`, etc.) | CompanyMember |
| `DELETE` | `orders/<id>/` | Delete sales order | CompanyMember |

---

## 5. Automated Testing & Verification

### 5.1 Sales Foundation Test Suite (`backend/sales/tests.py`)
18 dedicated test cases were executed and passed:

1. `test_unauthenticated_quotations_rejected` &rarr; HTTP 401
2. `test_unauthenticated_orders_rejected` &rarr; HTTP 401
3. `test_tenant_isolation_view_quotations` &rarr; User of Comp 2 blocked with HTTP 403
4. `test_tenant_isolation_view_orders` &rarr; User of Comp 2 blocked with HTTP 403
5. `test_customer_belongs_to_company_validation` &rarr; Cross-company customer rejected with HTTP 400
6. `test_product_belongs_to_company_validation` &rarr; Cross-company product rejected with HTTP 400
7. `test_product_inactive_validation` &rarr; Inactive product rejected with HTTP 400
8. `test_item_quantity_validation` &rarr; Quantity &le; 0 rejected with HTTP 400
9. `test_item_unit_price_validation` &rarr; Unit price &lt; 0 rejected with HTTP 400
10. `test_backend_financial_calculations` &rarr; Correct `Decimal` arithmetic for subtotal, discount, tax, total
11. `test_quotation_create_with_multiple_items` &rarr; Successful multi-item quotation creation
12. `test_quotation_status_update` &rarr; Status transition (`DRAFT` &rarr; `ACCEPTED`)
13. `test_atomic_quotation_conversion` &rarr; Quotation &rarr; `SalesOrder` with `CONFIRMED` status & cloned items
14. `test_duplicate_quotation_conversion_prevented` &rarr; Re-conversion attempt returns HTTP 400
15. `test_empty_quotation_conversion_prevented` &rarr; Conversion with 0 items returns HTTP 400
16. `test_number_generation_sequence` &rarr; Incremental generation of `QT-2026-000001` and `SO-2026-000001`
17. `test_sales_order_crud_and_lifecycle` &rarr; Direct order creation and status updates to `PROCESSING` & `COMPLETED`
18. `test_sales_dashboard_metrics` &rarr; Verifies live aggregated KPI values

### 5.2 Full System Test Suite
Ran all test suites across the application:
```bash
manage.py test accounts company apps.employee crm inventory sales
```
**Result**: **59/59 tests passed cleanly in 71.2s** (0 failures, 0 errors).

---

## 6. Frontend Integration

1. **Service (`frontend/src/services/salesService.js`)**:
   - Axios client wrappers for all 12 sales endpoints.

2. **Sidebar Navigation (`frontend/src/layouts/Sidebar.jsx`)**:
   - Updated `Sales` entry status from `upcoming` to `live`.

3. **Workspace (`frontend/src/pages/SalesPage.jsx`)**:
   - **Tab 0: Sales Dashboard**: Top KPI stat cards, pipeline status chips, recent quotations, recent sales orders, top customers by sales volume.
   - **Tab 1: Quotations**: Status filtering, search, full table view, dynamic itemized quotation creator with live totals summary, conversion button, delete action.
   - **Tab 2: Sales Orders**: Status filtering, search, direct sales order creator, live inline status changer (`DRAFT`, `CONFIRMED`, `PROCESSING`, `COMPLETED`, `CANCELLED`), item details modal.

4. **Router (`frontend/src/routes/AppRoutes.jsx`)**:
   - Replaced `ModulePlaceholderPage` route with `<Route path="/sales" element={<SalesPage />} />`.

5. **Production Build Verification**:
   - `npm run build` executed cleanly in **725ms** with zero errors.

---

## 7. Deliverables & Artifacts

- **Backend App**: `backend/sales/`
- **Migrations**: `0001_initial.py`, `0002_alter_quotation_quotation_date_and_more.py`
- **Automated Tests**: `backend/sales/tests.py` (18 tests)
- **Demo Data Seed Command**: `backend/accounts/management/commands/seed_demo_data.py` (Section 17)
- **Postman Collection**: `backend/postman/ICORP_ERP_Phase4A.postman_collection.json`
- **Frontend Service**: `frontend/src/services/salesService.js`
- **Frontend Workspace**: `frontend/src/pages/SalesPage.jsx`
- **Frontend Routing & Sidebar**: `AppRoutes.jsx`, `Sidebar.jsx`
