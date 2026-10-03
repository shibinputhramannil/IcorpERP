# transt

## Project Description
transt is a comprehensive, multi-tenant Enterprise Resource Planning system built to manage complex business operations. It unites human resources, CRM pipelines, advanced inventory logistics, full lifecycle sales and purchasing, strict double-entry finance, interactive workspace collaboration tools, and an integrated AI Assistant into a single seamless platform.

## Version
Version 1.1.0 - **Production Ready** (Phase 11 Completed)

## Tech Stack
*   **Frontend:** React (Vite), Material-UI (MUI), React Router
*   **Backend:** Django 6.1, Django REST Framework
*   **Database:** PostgreSQL 16
*   **Containerization:** Docker & Docker Compose

## Core Modules Completed
*   **Core Management:** Multi-Company Architecture, Employee & Department Management, CRM & Lead Tracking
*   **Operations & Workflows:** Dynamic Inventory Control, Sales Orders & Invoicing, Purchase Orders
*   **System & Intelligence:** Double-entry Accounting, Global Search, AI Operational Assistant, Audit Logging, Dark Mode UI
*   **Workspace Collaboration:** Real-time Notes, Email Management, Document Center, Interactive Calendar, Push Notifications

## Setup & Deployment (Docker)
1.  Copy `.env.example` to `.env` and configure your database passwords and API keys.
2.  Ensure Docker Engine is running.
3.  Run `docker compose build` to build the application containers.
4.  Run `docker compose up -d` to launch the multi-container orchestrated environment.
5.  Access the frontend at `http://localhost:3000` and the API at `http://localhost:8000`.

## Testing
The application features rigorous automated testing ensuring multi-tenant security and logic integrity.
To run tests locally:
```bash
cd backend
venv\Scripts\python.exe manage.py test
```
