# ICORP ERP - Phase 5B: Purchase + Inventory Integration Walkthrough
## Goods Receiving, Partial Receiving, Stock IN Ledger & Automated Order Fulfillment

---

## Executive Summary

Phase 5B establishes the critical integration bridge between the **Purchase Order Management System** (built in Phase 5A) and the **Inventory Management System** (built in Phase 3). All physical stock updates are performed strictly against PostgreSQL using database transactions with row-level locking (`select_for_update()`), ensuring complete data integrity, zero race conditions, and an immutable audit trail (`StockTransaction`).

---

## Architecture & Lifecycle Overview

### Procurement-to-Inventory State Progression
```
Purchase Order (CONFIRMED / PROCESSING)
       │
       ▼
Goods Receiving (POST /api/companies/<id>/purchases/orders/<id>/receive/)
       │
       ├─► Sequential GRN Assignment (GRN-YYYY-######)
       │
       ├─► Validation & Over-Receiving Prevention (qty <= remaining)
       │
       ├─► Row-locked Stock Increment: Stock.quantity += received_quantity
       │
       ├─► Immutable Ledger Audit: StockTransaction (STOCK_IN, reference="PO / GRN")
       │
       └─► PO Fulfillment Recalculation:
             ├─ All items remaining == 0 ──► status = COMPLETED
             └─ Any item received > 0 ─────► status = PARTIALLY_RECEIVED
```

---

## Key Data Models & Relations

### 1. `PurchaseReceipt`
- **Table**: `purchase_purchasereceipt`
- **Purpose**: Represents an immutable Goods Received Note (GRN) for stock received into a warehouse against a Purchase Order.
- **Key Fields**:
  - `company`: ForeignKey to `Company` (multi-tenant partition).
  - `purchase_order`: ForeignKey to `PurchaseOrder` (cascade).
  - `receipt_number`: CharField unique, format `GRN-YYYY-######` (e.g. `GRN-2026-000001`).
  - `receipt_date`: DateField (default: current date).
  - `warehouse`: ForeignKey to `Warehouse` (target storage location).
  - `status`: Choices `DRAFT`, `RECEIVED`, `CANCELLED` (default: `RECEIVED`).
  - `notes`: Delivery challan, carrier reference, package count.
  - `received_by`: User ForeignKey.
  - `created_at` / `updated_at`: Timestamps.

### 2. `PurchaseReceiptItem`
- **Table**: `purchase_purchasereceiptitem`
- **Purpose**: Line item breakdown of quantities received per product in a specific GRN.
- **Key Fields**:
  - `receipt`: ForeignKey to `PurchaseReceipt`.
  - `purchase_order_item`: ForeignKey to `PurchaseOrderItem`.
  - `product`: ForeignKey to `Product`.
  - `ordered_quantity`: Original ordered quantity from PO.
  - `previously_received_quantity`: Prior received quantity before this GRN.
  - `received_quantity`: Quantity received in this specific GRN.
  - `notes`: Item condition, batch or inspection notes.

### 3. Computed PO Fulfillment Fields
- `PurchaseOrderItem.received_quantity`: Sum of `received_quantity` across active GRNs (`status='RECEIVED'`).
- `PurchaseOrderItem.remaining_quantity`: `max(0, quantity - received_quantity)`.
- `PurchaseOrder.total_ordered_quantity`: Total units ordered across all lines.
- `PurchaseOrder.total_received_quantity`: Total units fulfilled.
- `PurchaseOrder.total_remaining_quantity`: Unfulfilled balance.
- `PurchaseOrder.receiving_percentage`: `(total_received / total_ordered) * 100` (capped at 100%).

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/companies/<id>/purchases/orders/<id>/receive/` | Post goods receipt: increments stock, creates `StockTransaction`, updates PO status |
| `GET` | `/api/companies/<id>/purchases/orders/<id>/receipts/` | List all Goods Received Notes (GRNs) for a specific order |
| `GET` | `/api/companies/<id>/purchases/receipts/` | List all GRNs for the company (filterable by warehouse, receipt_number, date) |
| `GET` | `/api/companies/<id>/purchases/receipts/<id>/` | Detailed view of a single Goods Receipt with line items |
| `GET` | `/api/companies/<id>/purchases/dashboard/` | KPI metrics including `total_goods_receipts`, `total_units_received`, `pending_receiving_orders` |

---

## Test Verification Summary

### 1. Automated Django Tests
Ran 55 tests in `purchase` app and 194 tests across the entire project suite:
- **`purchase` app**: **55 / 55 PASSED** (28 Phase 5A + 27 Phase 5B).
- **Entire ERP suite**: **194 / 194 PASSED** (Auth, Company, CRM, Inventory, Sales, Purchases).

### 2. Live API Verification Script (`test_phase5b_live.py`)
Executed against running Django server on `http://127.0.0.1:8000`:
- **Scenarios verified**: 17 end-to-end scenarios covering PO creation, partial receive step 1 (40 units), over-receiving rejection (HTTP 400), partial receive step 2 (80 units), final receive step 3 (30 units), automatic transition to `COMPLETED`, rejection of receives on completed orders, sequential GRN numbering (`GRN-2026-000002` through `000004`), and cross-tenant isolation (HTTP 403).
- **Result**: **17 / 17 PASSED**.

### 3. Frontend Build Verification
- Vite production build (`npm run build`): **0 errors, clean build**.
