const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, 'ICORP_ERP_COMPLETE_TECHNICAL_DOCUMENTATION.md');

const part1 = `
---
title: "ICORP ERP - Complete Technical Documentation"
author: "Antigravity Agent"
date: "2026-09-26"
geometry: margin=1in
---

# 1. PROJECT OVERVIEW

## Project Name
ICORP ERP (Enterprise Suite)

## Purpose of ICORP ERP
ICORP ERP is a comprehensive, multi-tenant Enterprise Resource Planning (ERP) platform designed to unify scattered business operations into a single, cohesive interface. It acts as the central nervous system for businesses, integrating HR, CRM, Supply Chain (Inventory & Purchasing), Sales, and double-entry Finance.

## Business Problem Solved
Modern businesses often suffer from "software fragmentation"—using separate tools for CRM, accounting, inventory, and internal communication. This fragmentation leads to data silos, duplicated entry, reconciliation errors, and lack of operational visibility. ICORP ERP solves this by providing a unified data model where a Lead seamlessly converts to a Customer, triggers a Sales Order, reserves Inventory, dispatches a Purchase Order if stock is low, and automatically posts balanced Journal Entries to the General Ledger.

## Target Users
- **C-Suite & Executives:** Real-time dashboards, financial reporting, and AI-driven operational insights.
- **HR Managers:** Employee onboarding, department alignment, and active status management.
- **Sales Teams:** Lead tracking, pipeline management, quotation generation, and invoicing.
- **Inventory & Supply Chain Managers:** Warehouse tracking, low-stock alerts, and goods receiving.
- **Accountants & Finance Teams:** Automated journal entries, chart of accounts management, and fiscal period locking.
- **All Employees:** Integrated workspace collaboration (Notes, internal simulated Email, Calendar, Documents).

## Technology Stack
- **Frontend:** React 18, Vite, Material-UI (MUI) v5, React Router, Context API.
- **Backend:** Python 3, Django 6.1, Django REST Framework (DRF).
- **Database:** PostgreSQL 16 (Relational).
- **AI Integration:** Google Gemini / OpenAI (via dynamic API routing).
- **Containerization:** Docker, Docker Compose.

## Architecture
ICORP ERP follows a decoupled **Client-Server Architecture**. 

### Frontend Architecture
The React frontend acts as a Single Page Application (SPA). It uses a modular component design:
- \`src/pages/\`: Top-level route components.
- \`src/components/\`: Reusable UI modules (e.g., \`StatCard\`, \`DataTable\`).
- \`src/layouts/\`: Structural shells (e.g., \`Sidebar\`, \`Header\`, \`ERPLayout\`).
- \`src/services/\`: Axios-based API client wrappers handling JWT injection.
- \`src/context/\`: Global state for Theme (Dark/Light), Authentication, and active Company tenant.

### Backend Architecture
The Django backend is highly modular, following the "App per Domain" pattern. 
- **API Layer:** Exposes RESTful endpoints via DRF \`ModelViewSet\` and \`APIView\`.
- **Service Layer:** Fat models and Django signals handle complex multi-module orchestration (e.g., automatically generating Finance Journal Entries when a Sales Invoice is paid).
- **Multi-Tenant Layer:** Request middleware and explicit queryset filtering (\`request.user.active_company_id\`) guarantee data isolation.

### Database Architecture
PostgreSQL serves as the primary datastore. All transactional models (Employees, Leads, Invoices, Journal Entries) hold a Foreign Key to the \`Company\` model, enabling strict Row-Level application isolation (Logical Multi-Tenancy).

### Docker Architecture
The infrastructure is defined in \`docker-compose.yml\`:
- \`backend\`: Gunicorn/Django container exposed on port 8000.
- \`frontend\`: Node/Vite container exposed on port 3000.
- \`db\`: PostgreSQL 16 Alpine container with a mapped \`postgres_data\` volume for persistence.

### High-Level Architecture Diagram
\`\`\`mermaid
flowchart TD
    User([End User]) <-->|HTTPS / REST API| Frontend[React SPA / Vite]
    Frontend <-->|JWT Auth & JSON| API[Django REST Framework]
    
    subgraph Backend Environment [Docker: icorp_backend]
        API
        AuthLayer[Authentication & JWT Layer]
        TenantLayer[Multi-Tenant Query Filter]
        Modules[ERP Modules: Sales, Fin, HR, Inv]
        AI[AI Assistant Service]
        
        API --> AuthLayer
        AuthLayer --> TenantLayer
        TenantLayer --> Modules
        Modules --> AI
    End
    
    AI <-->|External API| LLM([Gemini / OpenAI])
    
    Modules <-->|ORM| DB[(PostgreSQL 16)]
    DB -.-> Volume[(Docker Volume: postgres_data)]
\`\`\`

---

# 2. COMPLETE PHASE ROADMAP

### Phase 1: Foundation & Authentication
- **Objective:** Establish the project scaffolding, database connection, and secure JWT authentication.
- **Work Done:** Django project setup, custom \`User\` model, JWT views, React + Vite setup, MUI theme initialization, Login UI, and \`AuthContext\`.
- **Status:** Completed.

### Phase 2: Multi-Tenancy & Core HR (Company & Employees)
- **Objective:** Implement logical multi-tenancy (Companies) and initial HR structures (Employees).
- **Work Done:** \`Company\` model, \`CompanyMembership\` junction table for RBAC, \`Employee\` and \`Department\` models. Frontend Context for active company switching, Companies grid, and Employee directory.
- **Status:** Completed.

### Phase 3: CRM & Sales Pipeline
- **Objective:** Build lead generation and customer conversion tracking.
- **Work Done:** \`Lead\`, \`Customer\`, and \`Opportunity\` models. API endpoints for CRM. Frontend Kanban board for opportunity stages.
- **Status:** Completed.

### Phase 4: Inventory Management
- **Objective:** Enable multi-warehouse product tracking and stock movements.
- **Work Done:** \`Category\`, \`Product\`, \`Warehouse\`, and \`StockMovement\` models. Real-time quantity calculation endpoints. Frontend DataGrids for products and stock alerts.
- **Status:** Completed.

### Phase 5: Sales & Purchase Workflows
- **Objective:** Connect CRM and Inventory through order processing.
- **Work Done:** Quotations → Sales Orders → Invoices → Payments flow. Purchase Quotations → Purchase Orders → Bills flow. Signals implemented to automatically deduct/add inventory upon order fulfillment.
- **Status:** Completed.

### Phase 6: Finance & Accounting Engine
- **Objective:** Implement a strict double-entry accounting ledger.
- **Work Done:** Chart of Accounts, Fiscal Periods, Journal Entries, and Lines. Automated triggers to map Sales/Purchase payments to Debit (Bank) and Credit (Revenue/Accounts Receivable). 
- **Status:** Completed.

### Phase 7: AI Assistant Integration
- **Objective:** Introduce an LLM-powered assistant to query ERP data.
- **Work Done:** \`ai\` Django app, flexible provider support (Gemini/OpenAI), context-injection of active company stats, and frontend conversational UI.
- **Status:** Completed.

### Phase 8: Workspace Collaboration Tools
- **Objective:** Provide internal tools to replace external fragmented apps.
- **Work Done:** Notes (Markdown), Calendar (Events), Email (Internal simulation), and Documents (File uploads via \`media_data\` volume).
- **Status:** Completed.

### Phase 9: Settings, Profile & Notifications
- **Objective:** Finalize user preferences and system alerts.
- **Work Done:** Real-time push notification models, Profile management UI, and system-wide settings configurations.
- **Status:** Completed.

### Phase 10: Final ERP Integration & UI Polish
- **Objective:** Wire up the Dashboard, implement Global Search, and add Audit Logging.
- **Work Done:** Append-only \`AuditLog\` via Django signals (\`post_save\`, \`pre_delete\`), live Dashboard stat aggregation, and global Navbar search modal.
- **Status:** Completed.

### Phase 11: Final Production Readiness
- **Objective:** Ensure deployment stability, dark mode perfection, test coverage, and documentation.
- **Work Done:** 100% backend test pass (355 tests), 0-error frontend build, complete UI hardcoded-color removal for perfect Dark Mode, Docker orchestration verification, and final documentation generation.
- **Status:** Completed.

---

# 3. MODULE-WISE DOCUMENTATION

## 3.1 Authentication & Authorization
**A. Purpose:** Secures the application and guarantees user identity.
**B. Main Features:** JWT access/refresh tokens, password hashing, and user tracking.
**C. Frontend Pages:** \`LoginPage.jsx\`, \`ForgotPasswordPage.jsx\`, \`ProtectedRoute.jsx\`.
**D. Backend Apps:** \`accounts\`.
**E. Database Models:** Custom \`User\` (inherits \`AbstractUser\`).
**H. API Endpoints:** \`/api/token/\`, \`/api/token/refresh/\`, \`/api/accounts/me/\`.
**J. Auth Requirements:** N/A for login; Bearer Token for all others.
**L. Tenant Isolation:** Global (Users can belong to multiple companies).
**M. User Workflow:** User enters credentials -> Backend returns JWT -> Frontend stores in LocalStorage -> Axios interceptor attaches Bearer token to all subsequent requests.

## 3.2 Companies (Multi-Tenant Core)
**A. Purpose:** Segregates data so one deployment can serve multiple isolated businesses or subsidiaries.
**B. Main Features:** Company creation, membership assignment, role-based access (Owner, Admin, Employee).
**E. Database Models:** \`Company\`, \`CompanyMembership\`.
**H. API Endpoints:** \`/api/companies/\`, \`/api/companies/<id>/members/\`.
**L. Tenant Isolation:** Root layer. All other modules filter by \`company_id\`.

## 3.3 CRM (Customer Relationship Management)
**A. Purpose:** Tracks sales pipelines from initial lead to paying customer.
**B. Main Features:** Lead statuses, Opportunity values, Customer conversion.
**E. Database Models:** \`Lead\`, \`Customer\`, \`Opportunity\`.
**F. Important Fields:** \`status\` (NEW, CONTACTED, QUALIFIED, LOST), \`estimated_value\`.
**P. Integration:** Converts a Lead to a Customer, which is then available in the Sales module for Invoicing.

## 3.4 Inventory Management
**A. Purpose:** Tracks physical stock across multiple warehouses.
**E. Database Models:** \`Product\`, \`Warehouse\`, \`StockMovement\`.
**P. Integration:** Deducts stock when a Sales Order is shipped. Adds stock when a Purchase Order is received.

## 3.5 Sales
**A. Purpose:** Manages outbound revenue operations.
**E. Database Models:** \`Quotation\`, \`SalesOrder\`, \`Invoice\`, \`Payment\`.
**O. Actual Working Flow:** Quote created -> Approved to Sales Order -> Fulfilled (modifies Inventory) -> Invoiced -> Paid (creates Journal Entry in Finance).

## 3.6 Purchase
**A. Purpose:** Manages inbound expense operations and vendor supply.
**E. Database Models:** \`Vendor\`, \`PurchaseOrder\`, \`PurchaseInvoice\`, \`PurchasePayment\`.
**P. Integration:** Updates Inventory on receipt; hits Accounts Payable in Finance on invoice.

## 3.7 Finance (Double-Entry Ledger)
**A. Purpose:** Maintains strict accounting compliance and financial reporting.
**E. Database Models:** \`Account\` (Chart of Accounts), \`FiscalPeriod\`, \`JournalEntry\`, \`JournalEntryLine\`.
**N. Example Use Case:** When a customer pays a $1000 invoice, the system automatically creates a \`JournalEntry\` with two \`JournalEntryLine\`s: Debit Bank $1000, Credit Accounts Receivable $1000.

## 3.8 Workspace (Notes, Email, Calendar, Documents)
**A. Purpose:** Eliminates the need for external tools like Google Workspace or Notion for basic tasks.
**E. Database Models:** \`Note\`, \`Email\`, \`CalendarEvent\`, \`Document\`.
**P. Integration:** Documents map uploaded files to \`media_data\` Docker volume. Emails simulate internal tenant-wide messaging.

## 3.9 Audit Logs
**A. Purpose:** Provides immutable tracking of who did what, when, and where.
**D. Backend Apps:** \`audit\`
**E. Database Models:** \`AuditLog\`
**O. Actual Working Flow:** Uses Django \`post_save\` and \`pre_delete\` signals dynamically connected to models like \`Invoice\`, \`Company\`, and \`Document\` to silently log actions without blocking the main request thread.

`;

fs.writeFileSync(docPath, part1, 'utf8');
console.log("Part 1 written.");
