# transt ERP - Commercial Audit & Strategy Report

## 1. Modules Audit
### KEEP
- **CRM** (Leads, Deals, Activities, Customers, Contacts) - Critical for business growth. Needs upgrade.
- **Sales** (Quotes, Orders, Invoices) - Essential.
- **Purchase** (Vendors, Orders, Receipts) - Essential.
- **Inventory** (Products, Stock) - Core operations.
- **Finance** (GL, Journal, Reports) - Core backoffice.
- **Workspace** (Notes, Calendar, Documents) - Added value.
- **Settings & Permissions** - Necessary for multi-tenant.
- **AI Assistant** - Retain as simple/provider-ready feature.

### IMPROVE
- **CRM Module**: Need proper Kanban pipeline for Deals, Customer 360 views, advanced lead fields (location, industry, probability).
- **Dashboard**: Remove any remaining mock data, implement real metrics.
- **UI/UX**: Consolidate spacing, remove unnecessary colors, ensure clean typography.
- **Global Search**: Ensure permissions are respected.

### MERGE
- Combine various generic lists into reusable `DataTable` components where applicable.
- Consolidate settings into a unified Settings UI.

### REMOVE
- `AIPage.jsx` (Deprecated by `AIAssistantPage.jsx`)
- `ModulePlaceholderPage.jsx` (Development artifact)
- Dummy mock services from frontend.
- Extraneous prints/logs.

## 2. Dependencies & Infrastructure
- Backend: Django 6.x, PostgreSQL. Safe to keep.
- Frontend: React + Vite. Good performance.

## 3. Product Vision Alignment
Product correctly renamed to **transt**. All ICORP references removed from UI and routing.
The AI is completely decoupled and relies on `g4f` / free providers or configuration, ensuring the core ERP works seamlessly without requiring paid APIs.
