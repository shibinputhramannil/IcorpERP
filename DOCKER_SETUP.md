# Docker Setup & Operations Guide for ICORP ERP

This document outlines the containerized deployment architecture for ICORP ERP using Docker and Docker Compose.

---

## Architecture Overview

ICORP ERP containerization consists of three orchestrated microservices:

```
    ┌──────────────────────────────────────────────┐
    │          React / Vite Frontend               │
    │          Container: icorp_frontend           │
    │          Port: 3000                          │
    └──────────────────────┬───────────────────────┘
                           │
                 Internal Docker Network
              (VITE_BACKEND_URL: http://backend:8000)
                           │
                           ▼
    ┌──────────────────────────────────────────────┐
    │       Django REST Framework Backend          │
    │          Container: icorp_backend            │
    │          Port: 8000                          │
    └──────────────────────┬───────────────────────┘
                           │
                 Internal Docker Network
                 (DB_HOST: db, Port: 5432)
                           │
                           ▼
    ┌──────────────────────────────────────────────┐
    │          PostgreSQL 16 Database              │
    │          Container: icorp_db                 │
    │          Internal: 5432 | Host: 5433         │
    │          Volume: icorp_postgres_data         │
    └──────────────────────────────────────────────┘
```

---

## 1. Prerequisites

1. **Docker Desktop**: Version 20.10+ (or Docker Engine 24+ on Linux).
2. **Docker Compose**: Version v2+ (or Compose v5+).
3. If running on Windows: WSL2 backend or Hyper-V enabled.

---

## 2. Environment Configuration

Copy `.env.example` to create your local `.env` file (do NOT commit secrets to Git):

```bash
cp .env.example .env
```

Default variables:
- `POSTGRES_DB`: Name of PostgreSQL database (`icorp_erp`).
- `POSTGRES_USER`: Database superuser (`postgres`).
- `POSTGRES_PASSWORD`: Database password (`postgres_secure_password`).
- `HOST_DB_PORT`: Host port mapping (`5433` avoids collision with local Postgres).
- `SECRET_KEY`: Django cryptographic secret key.
- `DEBUG`: Django debug flag (`True` for development, `False` for production).

---

## 3. Starting the Containers

Build and launch all services in detached mode:

```bash
docker compose up --build -d
```

Check the status of running containers:

```bash
docker compose ps
```

Verify service readiness:
- **Frontend**: Accessible at `http://localhost:3000`
- **Backend API**: Accessible at `http://localhost:8000/api/`
- **Database**: Accessible via host port `5433` (or internally at `db:5432`)

---

## 4. Viewing Logs

Stream unified logs across all containers:

```bash
docker compose logs -f
```

Stream logs for a specific service:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

---

## 5. Running Database Migrations

Apply database schema migrations inside the backend container:

```bash
docker compose exec backend python manage.py migrate
```

Verify database and system integrity:

```bash
docker compose exec backend python manage.py check
```

---

## 6. Creating a Superuser

To create an administrative user account:

```bash
docker compose exec -it backend python manage.py createsuperuser
```

---

## 7. Running Test Suites Inside Docker

Run Finance test suite:

```bash
docker compose exec backend python manage.py test finance
```

Run full test suite:

```bash
docker compose exec backend python manage.py test
```

Run Phase 6 live end-to-end verification script:

```bash
docker compose exec backend python test_phase6_live.py
```

---

## 8. Stopping the Containers & Data Persistence

To safely stop all containers while **preserving your database volume**:

```bash
docker compose down
```

Restart containers with persisted database data:

```bash
docker compose up -d
```

> [!CAUTION]
> **DO NOT USE `docker compose down -v`** in normal operations.
> The `-v` flag removes the named volume `icorp_postgres_data` and permanently deletes all stored enterprise database records.

---

## 9. Rebuilding After Code Changes

When packages in `requirements.txt` or `package.json` change:

```bash
docker compose up --build -d
```

---

## 10. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `port is already allocated: 5432` | Local PostgreSQL service running on host | The Compose configuration maps host port to `5433:5432` to avoid this. Ensure `HOST_DB_PORT=5433` is set. |
| `backend waiting for db` | Postgres container initializing | The backend container uses `condition: service_healthy` and will start automatically as soon as Postgres responds to healthchecks. |
| `Vite proxy error ECONNREFUSED` | Backend container starting up | Wait a few seconds for Django to initialize or inspect `docker compose logs backend`. |
