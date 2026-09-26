const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, 'ICORP_ERP_COMPLETE_TECHNICAL_DOCUMENTATION.md');

const part2 = `
---

# 4. AI ASSISTANT — DETAILED DOCUMENTATION

## AI Architecture
The AI Assistant acts as a conversational retrieval and analysis layer on top of the ERP datastore.
- **AI Provider:** Configurable (Defaults to Google Gemini or OpenAI if keys are provided in \`.env\`).
- **Offline/Deterministic Mode:** If no API keys are provided, the system falls back to a deterministic parsing engine that returns hard-coded, highly precise system statistics without hitting an external LLM.
- **Backend App:** \`backend/ai\`
- **API Endpoint:** \`POST /api/ai/ask/\`

## Request Flow
1. **User Prompt:** The user types a query in the React \`AIAssistantPage\` (e.g., "Give me a summary of my active leads").
2. **Authentication:** Request is sent with JWT Bearer Token.
3. **Authorization & Grounding:** Django extracts \`request.user.active_company_id\`. The backend queries the \`Lead\`, \`Invoice\`, and \`Employee\` models specifically filtered by this \`company_id\` to build a "Context String".
4. **LLM Formatting (If Configured):** The backend constructs a prompt: *"You are an ERP assistant. The user asked: [PROMPT]. Here is their current company data: [CONTEXT STRING]. Answer concisely."*
5. **Response:** The text is returned to the frontend and rendered in the chat bubble.

## Security & Constraints
- **WHAT AI DOES:** Analyzes and summarizes data explicitly handed to it by the Django backend.
- **WHAT AI DOES NOT DO:** Execute raw SQL, modify database records, or access data outside the \`request.user\`'s company membership.
- **Rate-Limiting:** Configured at the Django level to prevent API abuse.

---

# 5. API DOCUMENTATION
*(Inventory of major REST Endpoints verified in \`urls.py\`)*

### Authentication (\`accounts\`)
- \`POST /api/token/\`: Exchange credentials for JWT.
- \`POST /api/token/refresh/\`: Renew JWT.

### Company (\`company\`)
- \`GET /api/companies/\`: List all companies the user is a member of.
- \`POST /api/companies/\`: Create a new company (sets user as Owner).

### CRM (\`crm\`)
- \`GET /api/companies/<id>/leads/\`: Fetch leads for a tenant.
- \`POST /api/companies/<id>/customers/\`: Convert/Create customer.

### Inventory (\`inventory\`)
- \`GET /api/companies/<id>/products/\`: List products.
- \`POST /api/companies/<id>/stock-movements/\`: Adjust stock (requires Admin/Inventory role).

### Finance (\`finance\`)
- \`GET /api/companies/<id>/journal-entries/\`: View balanced double-entry logs.
- \`GET /api/companies/<id>/accounts/\`: Fetch Chart of Accounts.

---

# 6. DATABASE DOCUMENTATION
*Database: PostgreSQL 16*

## Important Constraints & Relationships
- **Multi-Tenant Foreign Keys:** Almost every table (e.g., \`crm_lead\`, \`inventory_product\`) contains a \`company_id\` foreign key linked to \`company_company(id)\` with \`ON DELETE CASCADE\`.
- **Double Entry Constraint:** \`finance_journalentryline\` records must sum to 0 (Total Debits = Total Credits) within a single \`journal_entry_id\`. Validated at the Django model \`clean()\` level before save.
- **Audit Logging:** \`audit_auditlog\` is append-only. It has no foreign key constraint to \`User\` (\`SET_NULL\` on delete) to preserve historical integrity even if an employee is deleted.

\`\`\`mermaid
erDiagram
    COMPANY ||--o{ EMPLOYEE : employs
    COMPANY ||--o{ CUSTOMER : serves
    COMPANY ||--o{ PRODUCT : stocks
    COMPANY ||--o{ JOURNAL_ENTRY : records
    CUSTOMER ||--o{ INVOICE : receives
    INVOICE ||--o{ JOURNAL_ENTRY : generates
\`\`\`

---

# 7. FINANCE ACCOUNTING FLOW

ICORP ERP strictly enforces double-entry accounting.

## Example: Sales Invoice Payment
1. **User Action:** Marks an Invoice of $5,000 as "PAID" in the Sales UI.
2. **Backend API:** \`POST /api/companies/<id>/invoices/<inv_id>/pay/\`
3. **Automated Journal Entry Trigger:** 
   - *Debit:* Bank Account / Cash (Asset) -> +$5,000
   - *Credit:* Accounts Receivable (Asset) -> -$5,000
4. **Validation:** System checks \`sum(debits) == sum(credits)\`. If true, the \`JournalEntry\` is saved and the Fiscal Period ledger is updated.

---

# 8. COMPLETE BUSINESS WORKFLOWS

## Workflow A: Onboarding & CRM
\`UI Action: HR adds employee -> Frontend POST /employees/ -> DB saves Employee record -> UI updates.\`
\`UI Action: Sales adds Lead -> Frontend POST /leads/ -> Lead is Contacted -> Converted to Customer -> DB saves Customer -> Ready for Sales Order.\`

---

# 10. DOCKER DOCUMENTATION

## Architecture
- \`icorp_backend\`: Builds from \`backend/Dockerfile\`. Runs Django WSGI/Gunicorn. Maps port 8000.
- \`icorp_frontend\`: Builds from \`frontend/Dockerfile\`. Serves React via Nginx/Vite. Maps port 3000.
- \`icorp_db\`: Uses \`postgres:16-alpine\`. Maps port 5433 (host) to 5432 (container).

## Usage
\`\`\`bash
# Build the images
docker compose build

# Start the environment detached
docker compose up -d

# Apply migrations inside the container
docker compose exec backend python manage.py migrate
\`\`\`
`;

fs.appendFileSync(docPath, part2, 'utf8');
console.log("Part 2 written.");
