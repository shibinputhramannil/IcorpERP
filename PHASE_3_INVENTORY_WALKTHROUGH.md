# ICORP ERP: Phase 3 - Inventory Module Walkthrough

## Executive Summary
Phase 3 establishes a production-grade, multi-tenant Inventory Management Module for ICORP ERP.
All inventory models, atomic stock workflows, audit transaction ledgers, supplier directories, and real-time dashboard calculations are backed by PostgreSQL (`icorp_erp`) and integrated with React 18, Vite, and Material UI.

Zero mock data is used; every mutation directly validates business rules and persists to the database.

---

## 1. Data Models & Database Relationships

Located in [`backend/inventory/models.py`](file:///C:/Assignment/erp/IcorpERP/backend/inventory/models.py):

### Relationships Diagram:
```
Company (Tenant Root)
  ├── Category (Products taxonomy)
  ├── Warehouse (Facility / storage site)
  ├── Product (SKU catalogue & pricing)
  │     ├── Stock (Product @ Warehouse balance)
  │     └── StockTransaction (Immutable audit movement ledger)
  └── Vendor (Suppliers registry)
```

1. **`Category`**:
   - `id`, `company` (`ForeignKey(Company, CASCADE)`), `name`, `description`, `is_active`, timestamps.
   - Constraint: `unique_together = [("company", "name")]`.
2. **`Product` / Item**:
   - `id`, `company` (`ForeignKey(Company, CASCADE)`), `category` (`ForeignKey(Category, SET_NULL)`), `name`, `sku`, `unit` (`pcs`, `roll`, `kg`, etc.), `cost_price`, `selling_price`, `tax`, `reorder_level`, `is_active`, timestamps.
   - Constraint: `unique_together = [("company", "sku")]`.
   - Properties: `total_stock` and `total_available_stock` computed across all warehouses.
3. **`Warehouse`**:
   - `id`, `company` (`ForeignKey(Company, CASCADE)`), `name`, `code`, `address`, `is_active`, timestamps.
   - Constraint: `unique_together = [("company", "code")]`.
4. **`Stock`**:
   - `id`, `product` (`ForeignKey(Product, CASCADE)`), `warehouse` (`ForeignKey(Warehouse, CASCADE)`), `quantity`, `reserved_quantity`, `reorder_level`, timestamps.
   - Constraint: `unique_together = [("product", "warehouse")]`.
   - Safe Availability Calculation: `available_quantity = max(0, quantity - reserved_quantity)`.
   - Reorder Detection: `is_low_stock = quantity <= reorder_level`.
5. **`StockTransaction` (Audit Ledger)**:
   - `id`, `company`, `product`, `warehouse` (source), `destination_warehouse` (optional, for transfers), `transaction_type` (`STOCK_IN`, `STOCK_OUT`, `ADJUSTMENT`, `TRANSFER`), `quantity`, `reference`, `notes`, `created_by`, `created_at`.
   - Immutable audit trail preserving every movement.
6. **`Vendor`**:
   - `id`, `company`, `name`, `email`, `phone`, `address`, `tax_id`, `is_active`, timestamps.

---

## 2. Atomic Stock & Transaction Workflows

All stock updates are executed inside database transactions (`with transaction.atomic()`) with row-level locks (`select_for_update()`):

1. **`STOCK_IN` (Delivery / Receipt)**:
   - Locks or provisions the `Stock` row for `(product, warehouse)`.
   - Increments `quantity += qty`.
   - Logs `StockTransaction` with type `STOCK_IN`.
2. **`STOCK_OUT` (Dispatch / Consumption)**:
   - Locks the `Stock` row.
   - Validates `available_quantity >= qty`. If insufficient, raises a `400 Bad Request` with an exact error detail.
   - Decrements `quantity -= qty`.
   - Logs `StockTransaction` with type `STOCK_OUT`.
3. **`ADJUSTMENT` (Audit Count Correction)**:
   - Locks or provisions the `Stock` row.
   - Updates `quantity = qty`.
   - Logs `StockTransaction` with type `ADJUSTMENT`.
4. **`TRANSFER` (Inter-Warehouse Movement)**:
   - Validates that source and destination warehouses are different and belong to the same active company.
   - Locks both source and destination `Stock` rows.
   - Validates that source `available_quantity >= qty`.
   - Atomically decrements source stock and increments destination stock.
   - Logs `StockTransaction` recording both `warehouse` and `destination_warehouse`.

---

## 3. API Endpoints

All endpoints are scoped under `/api/companies/<company_id>/inventory/` and enforce multi-tenant authorization:

| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/companies/<id>/inventory/products/` | List products / Create product with SKU validation |
| `GET` / `PATCH` / `DELETE` | `/api/companies/<id>/inventory/products/<pk>/` | Product detail / update / soft deactivation |
| `GET` / `POST` | `/api/companies/<id>/inventory/categories/` | List categories / Create category |
| `GET` / `PATCH` / `DELETE` | `/api/companies/<id>/inventory/categories/<pk>/` | Category detail / update / deactivation |
| `GET` / `POST` | `/api/companies/<id>/inventory/warehouses/` | List warehouses / Create warehouse with code uniqueness |
| `GET` / `PATCH` / `DELETE` | `/api/companies/<id>/inventory/warehouses/<pk>/` | Warehouse detail / update / deactivation |
| `GET` | `/api/companies/<id>/inventory/stock/` | Warehouse-level stock levels (with `low_stock=true` filter) |
| `GET` / `POST` | `/api/companies/<id>/inventory/transactions/` | Movement audit history / Record atomic stock movement |
| `GET` / `POST` | `/api/companies/<id>/inventory/vendors/` | List vendors / Create vendor |
| `GET` / `PATCH` / `DELETE` | `/api/companies/<id>/inventory/vendors/<pk>/` | Vendor detail / update / deactivation |
| `GET` | `/api/companies/<id>/inventory/dashboard/` | Real PostgreSQL calculated KPIs and metrics |

---

## 4. Multi-Tenant Security & Isolation

- **Base Class**: All inventory views inherit from `InventoryBaseView`.
- **Tenant Scope Enforcement**:
  - Superusers maintain global visibility across tenants.
  - Standard users are validated against active `CompanyMembership` for the requested company ID. Requests targeting foreign company IDs immediately return `403 Forbidden`.
  - All database queries filter by `company=company` or `product__company=company`.
  - Warehouse transfers verify that both source and destination facilities belong to the authorized company.

---

## 5. Frontend Architecture & Pages

- **Service Layer** in [`frontend/src/services/inventoryService.js`](file:///C:/Assignment/erp/IcorpERP/frontend/src/services/inventoryService.js):
  - Provides Axios methods for Products, Categories, Warehouses, Stock, Transactions, Vendors, and Dashboard statistics.
- **Sidebar Integration** in [`frontend/src/layouts/Sidebar.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/layouts/Sidebar.jsx):
  - `Inventory` navigation is marked `live` with `Inventory2OutlinedIcon`.
- **Route Mapping** in [`frontend/src/routes/AppRoutes.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/routes/AppRoutes.jsx):
  - `/inventory` connects directly to `InventoryPage.jsx`.
- **Interactive 7-Tab Workspace** in [`frontend/src/pages/InventoryPage.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/pages/InventoryPage.jsx):
  - **Tab 0: Dashboard**: Real-time KPI stat cards (Total Products, Warehouses, Total Units, Stock Valuation, Stock Alerts), Quick Action buttons, and Recent Movements timeline.
  - **Tab 1: Products**: Search bar, category filter, active toggle, table with prices and total available stock, "Add Product" and "Edit Product" dialogs, and soft deactivation.
  - **Tab 2: Stock Levels**: Filter by warehouse and search, available stock calculations, low-stock chips, and quick "Add Stock" / "Transfer" buttons.
  - **Tab 3: Stock Movements**: Audit history table with type badges (`STOCK_IN`, `STOCK_OUT`, `TRANSFER`, `ADJUSTMENT`), and "Record Stock Movement" dialog supporting inter-warehouse transfers.
  - **Tab 4: Warehouses**: Storage facility directory, total stock units, "Add Warehouse" and "Edit Warehouse" dialogs.
  - **Tab 5: Categories**: Product taxonomy directory with product counts, Add/Edit dialogs.
  - **Tab 6: Vendors**: Supplier directory with contact details and tax ID, Add/Edit dialogs.

---

## 6. Automated Testing & Verification

### Automated Django Test Suite
```powershell
python manage.py test accounts company apps.employee crm inventory
```
- **Total Tests**: **41 passed** (`OK`) with 0 failures and 0 errors:
  - Phase 1 (Accounts, Company, Employee): 15 tests
  - Phase 2 (CRM): 14 tests
  - Phase 3 (Inventory): 12 tests
    - `test_unauthenticated_access_denied`
    - `test_tenant_isolation_cross_company_access_blocked`
    - `test_superuser_has_global_access`
    - `test_category_crud_and_duplicate_prevention`
    - `test_product_crud_and_sku_uniqueness`
    - `test_warehouse_crud`
    - `test_stock_availability_and_stock_in`
    - `test_stock_out_and_insufficient_stock_error`
    - `test_warehouse_transfer_flow`
    - `test_cross_company_transfer_rejected`
    - `test_vendor_crud`
    - `test_inventory_dashboard_metrics`

### Live API Verification
Executed against the running Django development server on `http://127.0.0.1:8000`:
- **Auth**: Superuser token obtained.
- **Tenant**: Scoped to `Nexus Global Technologies` (ID: 1).
- **Categories**: 3 categories verified.
- **Warehouses**: 2 warehouses verified.
- **Products**: 3 products verified.
- **Stock**: 4 warehouse stock records verified.
- **Transactions**: Initial delivery and live inter-warehouse transfer verified.
- **Vendors**: 2 suppliers verified.
- **Dashboard**: Live calculated valuation of **$31,110.00** and 202 stock units verified.

### Frontend Production Build
```powershell
npm run build
```
- Built production bundle in 430ms with **0 errors and 0 warnings**.

### Postman Collection
- Created [`backend/postman/ICORP_ERP_Phase3.postman_collection.json`](file:///C:/Assignment/erp/IcorpERP/backend/postman/ICORP_ERP_Phase3.postman_collection.json) with automated `{{access_token}}` capture and requests for all inventory workflows.
