# Phase 6: Finance & Accounting Module & Docker Containerization Walkthrough

## Executive Summary

Phase 6 introduces the central **Finance & Accounting** module for transt and fully containerizes the enterprise platform using **Docker** and **Docker Compose**.

Key deliverables:
1. **Double-Entry Accounting Engine**: Concurrency-safe journal entry posting (`JE-YYYY-XXXXXX`), database transactions (`transaction.atomic()`), and mathematical debit/credit balancing verification using Python `Decimal`.
2. **Company-Scoped Chart of Accounts (CoA)**: Support for Assets, Liabilities, Equity, Revenue, and Expenses with idempotent seeding of standard corporate accounts (`1010` Cash, `1020` Bank, `1100` A/R, `1200` Inventory, `2000` A/P, `2100` Tax Payable, `3000` Capital, `3100` Retained Earnings, `4000` Sales Revenue, `5000` COGS, `6000` Operating Expenses).
3. **Fiscal Period Governance**: Closed fiscal period protection preventing backdated journal tampering.
4. **General Ledger & Financial Statements**: Real database-calculated General Ledger (running balance), Trial Balance (verifying Debits == Credits), Income Statement (Profit & Loss), and Balance Sheet (Assets = Liabilities + Equity).
5. **Operational Subledger Integration**: Automatic journal posting from Sales Invoices, Customer Receipts, Vendor Bills (Purchase Invoices), and Vendor Payments.
6. **Cash & Bank Management**: Multi-account management for corporate bank accounts and cash registers with live balance calculation from the ledger.
7. **Strict Multi-Tenant Isolation**: Zero cross-tenant data leakage between companies enforced at the database and view layers.
8. **Production-Grade Docker Containerization**: Orchestration of PostgreSQL 16, Django REST Framework, and React/Vite services with health checks, persistent volumes, and non-colliding host port mapping.

---

## 1. Accounting Architecture & Mathematical Rules

### Double-Entry Invariants
All financial mutations write to `finance.JournalEntryLine` within a database transaction:
- $\text{Total Debits} = \sum \text{debits}$
- $\text{Total Credits} = \sum \text{credits}$
- $\text{Invariant: } \text{Total Debits} = \text{Total Credits}$
- Line constraint: $\text{debit} \ge 0, \text{credit} \ge 0$, and $\neg(\text{debit} > 0 \land \text{credit} > 0)$.
- Minimum line count: At least two line items per journal entry.
- Immutability: Posted entries cannot be silently modified or deleted. Cancellation creates a permanent audit record.

### Account Balance Formulas
- **Debit Normal Accounts (Assets & Expenses)**:
  $$\text{Balance} = \text{Opening Balance} + \sum \text{Debits} - \sum \text{Credits}$$
- **Credit Normal Accounts (Liabilities, Equity & Revenue)**:
  $$\text{Balance} = \text{Opening Balance} + \sum \text{Credits} - \sum \text{Debits}$$

### Financial Equation Validation
- **Trial Balance**: Proves $\sum \text{Debit Balances} = \sum \text{Credit Balances}$.
- **Profit & Loss**:
  $$\text{Gross Profit} = \text{Revenue} - \text{COGS}$$
  $$\text{Net Income} = \text{Gross Profit} - \text{Operating Expenses}$$
- **Balance Sheet**:
  $$\text{Assets} = \text{Liabilities} + \text{Equity Direct} + \text{Net Income}$$

---

## 2. Model Structure

### Core Entities (`backend/finance/models.py`)
1. **`Account`**:
   - `company`: ForeignKey to `Company`
   - `account_code`: Unique within `company`
   - `account_name`: String description
   - `category`: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`
   - `opening_balance`: `DecimalField(max_digits=14, decimal_places=2)`
   - `is_system`: Protects foundational default accounts from accidental deletion
2. **`FiscalPeriod`**:
   - `company`, `period_name`, `start_date`, `end_date`, `status` (`OPEN` / `CLOSED`)
3. **`JournalEntry`**:
   - `company`, `entry_number` (`JE-YYYY-XXXXXX`), `entry_date`, `description`, `reference_type`, `reference_id`, `status` (`POSTED` / `CANCELLED`)
4. **`JournalEntryLine`**:
   - `journal_entry`, `account`, `debit`, `credit`, `description`
5. **`BankAccount`**:
   - OneToOne with `Account`, `bank_name`, `account_number`, `branch_name`, `currency`
6. **`CashAccount`**:
   - OneToOne with `Account`, `account_name`, `opening_balance`

---

## 3. Operational Integration (Sales & Purchase â†’ Finance)

### Sales Invoicing & Receipts
- When a `sales.Invoice` is issued:
  - **DR** Accounts Receivable (`1100`): Invoice Total
  - **CR** Sales Revenue (`4000`): Subtotal - Discount
  - **CR** Sales Tax Payable (`2100`): Tax Amount (if tax > 0)
- When a `sales.Payment` is recorded:
  - **DR** Operating Bank Account (`1020`) or Cash (`1010`): Payment Amount
  - **CR** Accounts Receivable (`1100`): Payment Amount

### Purchase Procurement & Vendor Payments
- When a `purchase.PurchaseInvoice` (Bill) is issued:
  - **DR** Cost of Goods Sold (`5000`): Bill Total
  - **CR** Accounts Payable (`2000`): Bill Total
- When a `purchase.PurchasePayment` is disbursed:
  - **DR** Accounts Payable (`2000`): Payment Amount
  - **CR** Operating Bank Account (`1020`) or Cash (`1010`): Payment Amount

---

## 4. API Endpoints Reference

All endpoints are company-scoped under `/api/companies/<company_id>/finance/`:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `dashboard/` | GET | Real-time database KPIs and 6-month monthly trend analysis |
| `accounts/` | GET, POST | List and create Chart of Accounts entities |
| `accounts/<id>/` | GET, PATCH, DELETE | Retrieve, update, or deactivate account |
| `default-accounts/` | POST | Idempotently seed standard corporate Chart of Accounts |
| `fiscal-periods/` | GET, POST | Manage accounting periods and close periods |
| `fiscal-periods/<id>/` | GET, PATCH, DELETE | Update or delete fiscal periods |
| `journal-entries/` | GET, POST | List and atomically post balanced double-entry transactions |
| `journal-entries/<id>/` | GET, PATCH, DELETE | View lines or cancel entry |
| `general-ledger/` | GET | Running balance ledger filtered by account and date range |
| `trial-balance/` | GET | Mathematical verification of debit and credit equality |
| `profit-loss/` | GET | Income statement computing Gross and Net Profit |
| `balance-sheet/` | GET | Balance Sheet verifying Assets = Liabilities + Equity |
| `accounts-receivable/` | GET | AR summary, collection metrics, and customer aging table |
| `accounts-payable/` | GET | AP summary, disbursement metrics, and vendor aging table |
| `bank/` | GET, POST | Manage corporate bank accounts and view live balances |
| `cash/` | GET, POST | Manage petty cash registers and view live balances |
| `sync-records/` | POST | 1-click backfill of all Sales & Purchase events to journals |

---

## 5. Docker Infrastructure Architecture

- **`docker-compose.yml`**:
  - `db`: `postgres:16-alpine`, persistent volume `transt_postgres_data`, healthcheck `pg_isready`, host port `5433:5432`.
  - `backend`: `python:3.12-slim`, reads DB configuration from environment variables, depends on `db (service_healthy)`, port `8000:8000`.
  - `frontend`: `node:20-alpine`, Vite dev server with host binding `0.0.0.0:3000`, proxying `/api` and `/media` to `http://backend:8000`.
- **Validation**:
  - Verified with `docker compose config` (Passed with 0 errors).

---

## 6. Verification Results

1. **Django System Integrity**:
   - `python manage.py check`: Passed (0 issues identified).
2. **Finance Test Suite**:
   - `python manage.py test finance`: **42 / 42 PASSED (100%)**.
3. **Full Regression Test Suite**:
   - `python manage.py test`: **265 / 265 PASSED (100%)**.
4. **Live Verification Script**:
   - `python test_phase6_live.py`: **15 / 15 CHECKS PASSED (100%)**.
5. **Frontend Production Build**:
   - `npm run build`: Passed (1093 modules transformed, 0 errors).
6. **Docker Configuration Check**:
   - `docker compose config`: Validated cleanly.
