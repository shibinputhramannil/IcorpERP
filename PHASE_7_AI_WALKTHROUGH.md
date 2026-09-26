# ICORP ERP — Phase 7: Practical Read-Only AI ERP Assistant

## Executive Overview
Phase 7 introduces a company-scoped, read-only AI Assistant for the ICORP ERP ecosystem. The assistant provides real-time natural language querying, cross-module operational telemetry (Sales, Purchases, Inventory, Finance), customer and vendor intelligence lookups, and executive digests—without any external dependency requirements or state alteration risks.

---

## 1. Architectural Design & Philosophy

```
User Prompt (Web UI or API)
       │
       ▼
Authentication & Multi-Tenant Scoping (AIBaseView)
  └── Strictly verifies active company membership (HTTP 403 on mismatch)
       │
       ▼
Intent Classification & Entity Extractor (classify_query)
  └── Regex / keyword semantic matching across 13 core ERP intents
       │
       ▼
Safe Read-Only Data Aggregator (services.py)
  └── Strictly uses .filter(), .aggregate(), .select_related()
  └── Zero record creation, mutation, stock adjustments, or journal alterations
       │
       ▼
Response Synthesizer
  ├── Offline / Deterministic Mode: 100% mathematical precision with Markdown tables & bold figures
  └── Optional LLM Augmentation: Gemini or OpenAI API (if configured in .env) with safe fallback
       │
       ▼
Structured Response Payload (AIChatResponseSerializer)
  └── answer, intent, data, suggested_questions, llm_augmented
```

---

## 2. Core Capabilities & 10 Required Questions

The assistant natively processes natural language queries across all major ERP modules:

| # | User Question | Intent Code | Grounded Data Source |
|---|:---|:---|:---|
| **1** | *"What are this month's sales?"* | `MONTHLY_SALES` | Issued sales invoices in current month, counts, and top orders |
| **2** | *"Which invoices are outstanding?"* | `OUTSTANDING_INVOICES` | Unpaid/partially paid sales invoices, due dates, overdue badges |
| **3** | *"How much did we collect?"* | `COLLECTIONS` | Payments received this month and all-time, payment methods |
| **4** | *"What are our total purchases?"* | `TOTAL_PURCHASES` | Vendor bills, monthly purchases, unpaid bill balances |
| **5** | *"Which products have low stock?"* | `LOW_STOCK` | Products where `stock <= reorder_level`, out-of-stock items |
| **6** | *"Which customers owe money?"* | `CUSTOMERS_OWE` | Debtors ranking by unpaid balance due, invoice counts |
| **7** | *"Which vendors have the highest purchase value?"* | `TOP_VENDORS` | Suppliers ranked by total procurement spend |
| **8** | *"What is the current profit?"* | `CURRENT_PROFIT` | Real-time P&L Net Profit, Gross Profit, Revenue, COGS, Expenses |
| **9** | *"Show recent sales orders."* | `RECENT_SALES_ORDERS` | Chronological list of recent sales orders with status and totals |
| **10** | *"Show recent purchase orders."* | `RECENT_PURCHASE_ORDERS` | Chronological list of recent POs with vendor and status |

### Entity Intelligence Lookups
- **Customer Lookup** (`/api/companies/<company_id>/ai/customer-lookup/?q=...`):
  Search by customer name, email, or phone. Computes customer type, total orders, total invoiced, total payments disbursed, current debt, and recent invoice breakdown.
- **Vendor Lookup** (`/api/companies/<company_id>/ai/vendor-lookup/?q=...`):
  Search by supplier name, contact, or tax ID. Computes total POs, total billed, amount paid, outstanding balances, and recent bills.

---

## 3. Strict Safety & Read-Only Guarantees

- **No State Mutation**: The AI module has zero `.save()`, `.create()`, `.update()`, or `.delete()` calls.
- **Inviolable Invariants**:
  - Stock levels are never altered.
  - Invoices and bills are never modified or cancelled.
  - Payments are never recorded.
  - Journal entries and ledger balances are never tampered with.
- **Company Multi-Tenant Isolation**:
  - Every API endpoint inherits from `AIBaseView`, enforcing active `CompanyMembership`.
  - Attempts by User B to query Company A return `HTTP 403 Forbidden`.

---

## 4. Backend API Endpoints

All endpoints are company-scoped under `/api/companies/<int:company_id>/ai/`:

| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `chat/` | Submit natural-language question; returns structured Markdown answer and metadata |
| `GET` | `insights/` | Retrieve consolidated executive digest (supports `?module=sales\|purchases\|inventory\|finance`) |
| `GET` | `customer-lookup/` | Query customer profile intelligence with orders, debt, and billing history (`?q=...`) |
| `GET` | `vendor-lookup/` | Query supplier profile intelligence with POs, debt, and billing history (`?q=...`) |

---

## 5. Frontend UI Implementation

### Components Added & Updated
- **[`frontend/src/pages/AIAssistantPage.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/pages/AIAssistantPage.jsx)**:
  - **Quick Prompts Carousel**: One-click chip buttons for all 10 core questions.
  - **Chat Stream**: Clean conversation history with user bubbles, AI avatars, copy buttons, and suggested question follow-up chips.
  - **Native Markdown Formatter**: Custom zero-dependency parser for headings, bullet points, bold figures, and responsive data tables.
  - **Executive Digest Tab**: Real-time KPI cards for Month Sales, Total Purchases, Net Profit, Liquid Capital, Inventory Stock Health, and Balance Sheet summary.
  - **Entity Intelligence Tab**: Quick dual-mode search tool for customers and suppliers.
- **[`frontend/src/services/aiService.js`](file:///C:/Assignment/erp/IcorpERP/frontend/src/services/aiService.js)**:
  - Full Axios client handling chat, insights, and entity lookup endpoints.
- **Navigation & Routing**:
  - Route `/ai-assistant` and `/ai` alias configured in [`AppRoutes.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/routes/AppRoutes.jsx).
  - Navigation item marked `live` in [`Sidebar.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/layouts/Sidebar.jsx).

---

## 6. Verification Results

1. **Django System Check**:
   ```
   python manage.py check
   System check identified no issues (0 silenced).
   ```
2. **AI Unit Tests Suite** (`backend/ai/tests.py`):
   ```
   python manage.py test ai
   Ran 24 tests in 23.034s -> OK (100% Pass Rate)
   ```
3. **Live Verification Script** (`backend/test_phase7_live.py`):
   ```
   python test_phase7_live.py
   >>> ALL PHASE 7 AI ASSISTANT VERIFICATION CHECKS PASSED WITH 100% SUCCESS <<<
   ```
4. **Frontend Production Build**:
   ```
   npm run build
   ✓ 1101 modules transformed.
   ✓ built in 907ms (0 Errors)
   ```
