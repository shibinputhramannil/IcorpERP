# ICORP ERP — Phase 9: AI Assistant & Business Insights

## Executive Summary
Phase 9 expands ICORP ERP with a high-performance, lightweight business intelligence and AI assistant layer. The system aggregates real-time telemetry across all 6 core ERP dimensions—**Sales, Purchases, Inventory, CRM, Finance, and HR**—generating executive narrative digests, multi-tier operational alerts, performance trends, and an interactive Q&A assistant with safe, deterministic fallbacks and strict read-only guarantees.

---

## 1. System Architecture

```
                                    User / Frontend Application
                                                │
                                                ▼
                     ┌───────────────────────────────────────────────────────┐
                     │          REST API & Multi-Tenant Gateway              │
                     │                 (AIBaseView)                          │
                     │   Enforces CompanyMembership verification (HTTP 403)  │
                     └──────────────────────────┬────────────────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      /ai/dashboard/                       /ai/summary/                     /ai/ask/
  Structured Cross-Module            Executive Narrative Digest         Natural Language
  Telemetry & KPI Aggregation       Strengths, Risks & Actions          Question Processing
                 │                              │                              │
                 └──────────────────────────────┼──────────────────────────────┘
                                                ▼
                               ┌─────────────────────────────────┐
                               │  ERP Read-Only Extraction Layer │
                               │        (ai/services.py)         │
                               └────────────────┬────────────────┘
                                                │
                  ┌───────────────┬─────────────┼───────────────┬───────────────┐
                  ▼               ▼             ▼               ▼               ▼
                Sales         Purchases     Inventory          CRM           Finance & HR
              Invoices,        Bills,       Catalog,       Customers,        P&L Ledger,
              Orders,          POs,         Valuation,     Leads, Deals,     Liquidity,
              Collections      Payables     Reorder Alerts Pipeline          Headcount
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │     AI Synthesis & Fallback     │
                               └────────────────┬────────────────┘
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
             [External AI API Key Configured]               [No AI Key / Fallback Mode]
           Gemini / OpenAI (via urllib REST API)          Deterministic ERP Synthesis
           Strictly ground prompt with live data          100% accurate mathematical output
                        │                                               │
                        └───────────────────────┬───────────────────────┘
                                                ▼
                                    JSON Response Payload
                               (ai/serializers.py Validation)
```

---

## 2. API Endpoints Reference

All endpoints are company-scoped, requiring JWT Bearer token authentication and valid active company membership.

### Primary Phase 9 Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/companies/<company_id>/ai/dashboard/` | Structured cross-module business insights (Sales, Purchases, Inventory, CRM, Finance, HR), dynamic alerts, key trends, low-stock warnings, and recommendations. |
| `GET` | `/api/companies/<company_id>/ai/summary/` | Executive business narrative summary, key performance metrics, operational strengths, risk factors, and recommended action steps. |
| `POST` | `/api/companies/<company_id>/ai/ask/` | Ask business questions. Accepts `{"question": "..."}` or `{"query": "..."}`. Returns answer, intent, data, and fallback status. |

### Preserved Compatibility Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/api/companies/<company_id>/ai/chat/` | Conversational NLP query interface supporting multi-turn chat history. |
| `GET` | `/api/companies/<company_id>/ai/insights/` | Module-filterable insights digest (`?module=sales\|purchases\|inventory\|finance\|crm\|hr`). |
| `GET` | `/api/companies/<company_id>/ai/customer-lookup/?q=<query>` | Deep customer profile intelligence: order history, invoiced totals, payments, and balance due. |
| `GET` | `/api/companies/<company_id>/ai/vendor-lookup/?q=<query>` | Deep vendor profile intelligence: PO counts, billing history, disbursements, and unpaid bills. |

---

## 3. Environment Variables & AI Provider Configuration

The AI layer is configured exclusively via environment variables in `backend/.env`. No secrets or keys are ever hardcoded in the codebase or transmitted to the frontend.

```env
# Optional External AI API Configuration (if omitted, Safe Fallback activates automatically)
AI_API_KEY=your_gemini_or_openai_api_key_here

# Alternatively, provider-specific keys are supported:
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-...
```

### Provider Resolution Order:
1. `AI_API_KEY` (Auto-detected: OpenAI if key starts with `sk-`, otherwise Google Gemini 1.5 Flash).
2. `GEMINI_API_KEY` (Direct Google Gemini 1.5 Flash REST API endpoint).
3. `OPENAI_API_KEY` (Direct OpenAI GPT-4o-mini REST API endpoint).
4. **Fallback Mode**: If none of these variables are present, or if external network requests fail or time out (5-second threshold), the system automatically operates in **Safe Fallback Mode**.

---

## 4. Fallback Behavior & Data Grounding

When no external AI key is configured (or in disconnected environments):
1. **Zero Downtime**: Every `/ai/ask/` query resolves deterministically using semantic intent classification.
2. **Mathematical Exactness**: Calculations (sales totals, bill balances, profit margins, stock valuations) are computed using Python `Decimal` and Django ORM aggregations directly from the database.
3. **Structured Response**: The API response explicitly sets `"fallback_used": true` and `"llm_augmented": false`, ensuring total transparency to client applications.
4. **Context Injection**: When an external LLM *is* used, the prompt is strictly augmented with pre-computed ERP numbers and forbidden from hallucinating figures or generating arbitrary SQL.

---

## 5. Security & Read-Only Invariants

- **Multi-Tenant Isolation**: Verified via `AIBaseView.get_company()`. Attempting to access foreign company data returns an immediate `HTTP 403 Forbidden`. Unauthenticated requests return `HTTP 401 Unauthorized`.
- **Strictly Read-Only**: The AI assistant has **zero write permissions**. It cannot create, alter, or cancel invoices, orders, journal entries, or inventory levels.
- **No Sensitive Credential Exposure**: Passwords, password hashes, JWTs, and API tokens are never queried or injected into the AI context.
- **SQL Injection Prevention**: No raw SQL is accepted or generated. All data access occurs via Django's parameterized ORM with strict company foreign-key filtering.
- **Frontend Isolation**: Client browsers never receive backend API keys. All AI interactions occur via authenticated backend proxy endpoints.

---

## 6. Frontend Implementation (`frontend/src/`)

- **Page**: [`frontend/src/pages/AIPage.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/pages/AIPage.jsx)
  - **Overview Tab**: Executive narrative card, high-level KPI StatCards, and 6 modular intelligence cards (Sales, Purchases, Inventory, Finance, CRM, HR).
  - **Alerts & Trends Tab**: Active operational alerts with severity badges, performance trend cards (Sales, Margins, Working Capital, Pipeline), and low-stock reorder warnings table.
  - **Ask AI Tab**: Conversational chat interface with quick-prompt carousel, chat history, loading indicators, and markdown formatting.
- **Service**: [`frontend/src/services/aiService.js`](file:///C:/Assignment/erp/IcorpERP/frontend/src/services/aiService.js)
  - Exports `getDashboard`, `getSummary`, `ask`, `chat`, `getInsights`, `lookupCustomer`, and `lookupVendor`.
- **Routing**: Protected `/ai` and `/ai-assistant` routes registered in [`frontend/src/routes/AppRoutes.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/routes/AppRoutes.jsx).
- **Navigation**: Sidebar link with `AutoAwesomeOutlinedIcon` live badge in [`frontend/src/layouts/Sidebar.jsx`](file:///C:/Assignment/erp/IcorpERP/frontend/src/layouts/Sidebar.jsx).

---

## 7. Testing & Verification Results

### Backend Unit & Integration Tests
- **AI App Unit Tests**: `python manage.py test ai`
  - **34 / 34 tests passed (100% OK)** in 24.04s.
  - Covered: Multi-tenant isolation (403), unauthenticated rejection (401), dashboard telemetry, executive summary, `/ask/` endpoint, fallback verification, and read-only safety invariants.
- **Phase 9 Live Database Verification**: `python test_phase9_live.py`
  - **100% Success** across all live verification checks against active PostgreSQL database.
- **Full Backend Regression Test**: `python manage.py test crm inventory sales purchase finance reports ai`
  - **300 / 300 tests passed (100% OK)** across the entire ERP test suite with 0 regressions.

### Frontend Production Build
- **Build Command**: `npm run build`
  - Built cleanly in **500ms** (0 compilation errors, 1110 modules transformed).
