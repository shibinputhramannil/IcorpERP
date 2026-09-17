# ICORP ERP - Phase 4C: Sales Invoicing, Payments & Receipts Walkthrough

## Executive Summary
Phase 4C successfully delivers the end-to-end financial transaction pipeline for the Sales module of ICORP ERP. Customers and orders seamlessly progress from quotation and inventory fulfillment to billing, row-locked payment collection, atomic payment receipt issuance, and real-time financial tracking.

---

## 1. Architecture Overview

### Backend Models (`backend/sales/models.py`)
1. **Invoice (`sales_invoice`)**:
   - Sequential numbering: `INV-YYYY-XXXXXX`.
   - Multi-tenant with company isolation.
   - Statuses: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`.
   - Linked to `crm.Customer` and optionally `sales.SalesOrder` (supports both direct invoicing and order conversion).
   - Financial ledger fields: `subtotal`, `discount`, `tax`, `total`, `amount_paid`, `balance_due`.
   - Dynamic properties: `is_overdue` (safely parses ISO dates) and `effective_status`.
   - Server-side atomic method: `recalculate_totals()`.

2. **InvoiceItem (`sales_invoiceitem`)**:
   - Itemized line products linked to `inventory.Product`.
   - Server-enforced calculation on save: `line_total = max(0, (qty * price) - disc + tax)`.

3. **Payment (`sales_payment`)**:
   - Sequential numbering: `PAY-YYYY-XXXXXX`.
   - Payment methods: `CASH`, `BANK_TRANSFER`, `CARD`, `UPI`, `CHEQUE`, `OTHER`.
   - Linked to `Invoice` and `Customer`.
   - Row-level lock (`select_for_update()`) during balance deduction.
   - Overpayment protection: Strictly rejects if `payment_amount > balance_due`.

4. **Receipt (`sales_receipt`)**:
   - Sequential numbering: `REC-YYYY-XXXXXX`.
   - One-to-one atomic relationship with `Payment`.
   - Created in the exact same `@transaction.atomic` database transaction block.

---

## 2. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/companies/<id>/sales/invoices/` | List invoices with status & search filters |
| `POST` | `/api/companies/<id>/sales/invoices/` | Create a direct invoice |
| `GET` | `/api/companies/<id>/sales/invoices/<id>/` | Retrieve invoice details with items, payments, receipts |
| `PATCH` | `/api/companies/<id>/sales/invoices/<id>/` | Update invoice or cancel invoice |
| `POST` | `/api/companies/<id>/sales/orders/<id>/invoice/` | Generate invoice from sales order (prevents duplicates) |
| `GET` | `/api/companies/<id>/sales/invoices/<id>/payments/` | List payments for an invoice |
| `POST` | `/api/companies/<id>/sales/invoices/<id>/payments/` | Record payment, update balance, generate receipt |
| `GET` | `/api/companies/<id>/sales/invoices/<id>/receipts/` | List receipts for an invoice |
| `GET` | `/api/companies/<id>/sales/receipts/` | List all receipts across company |
| `GET` | `/api/companies/<id>/sales/financial-summary/` | Company sales financial KPI metrics |

---

## 3. Frontend Architecture (`frontend/src/`)

### Service Client (`salesService.js`)
Exposes 10 typed client methods matching all Phase 4C endpoints.

### UI Workspace (`SalesPage.jsx`)
- **5-Tab Navigation**:
  - **Tab 0: Sales Dashboard**: Top financial KPI stat cards (Total Invoiced, Total Collected, Outstanding Balance, Overdue Invoices).
  - **Tab 1: Quotations**: Quote management and conversion.
  - **Tab 2: Sales Orders & Fulfillment**: Added "Generate Invoice" action button on orders.
  - **Tab 3: Invoices**: Comprehensive table with search, status filters, overdue flags, "Record Payment" button, and cancel action.
  - **Tab 4: Payments & Receipts**: Auditable ledger of payment receipts with "View / Print Receipt" modal.
- **Interactive Modals**:
  - Direct Invoice Creation modal with live calculation summary.
  - Order-to-Invoice conversion modal with due date selector.
  - Record Payment modal with amount validation and receipt notice.
  - Printable Payment Receipt voucher with browser print trigger (`window.print()`).
  - Invoice Details modal with item lines, payments history sub-table, and payment action.

---

## 4. Verification & Testing

### Automated Test Suite (`backend/sales/tests.py`)
- **32 tests** dedicated to invoicing and payments in `SalesFinancialInvoicingTests`.
- **112 / 112 tests passing** across the entire project (`accounts`, `company`, `apps.employee`, `crm`, `inventory`, `sales`).

### Live End-to-End HTTP API Verification (`scratch/test_phase4c_live.py`)
All 13 live scenarios verified against the running Django backend on `http://127.0.0.1:8000`:
1. Authentication & JWT token issuance.
2. Tenant company isolation.
3. Live sales financial summary retrieval.
4. Listing existing invoices and receipts.
5. Direct invoice creation with automatic total recalculation ($475.00).
6. Partial payment ($200.00) recorded, status updated to `PARTIALLY_PAID`, and atomic receipt generated.
7. Overpayment attempt ($300.00 vs $275.00 balance) strictly rejected with HTTP 400.
8. Final payment ($275.00) settling invoice to `PAID` with balance $0.00 and 2nd atomic receipt.
9. Quotation -> Order -> Invoice full lifecycle conversion.
10. Duplicate invoice prevention returning HTTP 400.
11. Invoice payments querying.
12. Invoice receipts querying.
13. Updated company financial summary reflect accurately.

### Frontend Compilation
- `npm run build` completed with 0 errors (1065 modules transformed).

### Demo Seed Data
- `python manage.py seed_demo_data` populated demo invoices, payments, and receipts.

### Postman Collection
- Created `backend/postman/ICORP_ERP_Phase4C.postman_collection.json`.
