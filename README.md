# Lead CRM API

A RESTful API for a simplified Lead Management CRM built for the **Superleap Backend Engineering Intern** assessment. Supports creating, reading, updating, deleting, and transitioning leads through a defined sales pipeline — with bulk operations and a caching layer.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Running Locally](#setup--running-locally)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Status Transition Rules](#status-transition-rules)
- [HTTP Status Codes](#http-status-codes)
- [Caching Strategy](#caching-strategy)
- [Design Decisions](#design-decisions)
- [What I'd Do Differently at Scale](#what-id-do-differently-at-scale)

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Language** | Node.js (JavaScript) | Fast to write, huge ecosystem, excellent for I/O-heavy REST APIs. No compilation step keeps the dev loop tight. |
| **Framework** | Express.js | Minimal and unopinionated — gives full control over routing, middleware, and error handling without magic. Industry standard for Node APIs. |
| **Database** | PostgreSQL | Relational DB is the right fit here. Leads have a well-defined schema, the `status` field maps cleanly to a Postgres `ENUM`, and foreign key constraints + ACID transactions are useful for a CRM where data integrity matters. |
| **ORM** | Prisma | Schema-as-code makes the data model readable, migrations are versioned, and the query API is type-safe. Much less boilerplate than raw SQL for CRUD operations. |
| **Cache** | Redis (in-memory fallback) | Redis is the industry standard for low-latency key-value caching. The in-memory fallback (JS `Map`) means the app runs fine without Redis — useful for local dev or environments where Redis isn't available. |
| **Containers** | Docker + docker-compose | One command spins up the API, PostgreSQL, and Redis together. No manual installation of databases needed. |

---

## Project Structure

```
lead-crm/
├── prisma/
│   ├── schema.prisma        # Database schema and enum definitions
│   └── seed.js              # Script to populate sample leads
├── src/
│   ├── controllers/
│   │   └── leadController.js  # HTTP layer — parses requests, sends responses
│   ├── middleware/
│   │   └── errorHandler.js    # Global error handler (catches anything passed to next(err))
│   ├── routes/
│   │   └── leadRoutes.js      # Maps URLs to controller functions
│   ├── services/
│   │   └── leadService.js     # Business logic + all database queries
│   └── utils/
│       ├── cache.js           # Redis client with in-memory fallback
│       ├── stateMachine.js    # Status transition rules and validation
│       └── validators.js      # Input validation for lead fields
├── server.js                # Entry point — starts server, initialises cache
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── package.json
```

---

## Setup & Running Locally

### Option A — Docker (Recommended)

The easiest way. Spins up the API, PostgreSQL, and Redis together.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd lead-crm

# 2. Start everything
docker compose up --build
```

The API will be live at **`http://localhost:3000`**

```bash
# 3. (Optional) Seed sample data — run in a second terminal
docker compose exec api node prisma/seed.js
```

To stop:
```bash
docker compose down
```

To stop and wipe the database volume:
```bash
docker compose down -v
```

---

### Option B — Manual Setup (Without Docker)

**Prerequisites:** Node.js 20+, PostgreSQL running locally

```bash
# 1. Clone and install
git clone <your-repo-url>
cd lead-crm
npm install

# 2. Set up environment
cp .env.example .env
# Open .env and set DATABASE_URL to your local Postgres connection string
# REDIS_URL is optional — remove it to use in-memory cache

# 3. Push schema to database
npm run db:push

# 4. (Optional) Seed sample data
npm run db:seed

# 5. Start the server
npm run dev      # development mode with hot reload
# or
npm start        # production mode
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ Yes | — | PostgreSQL connection string |
| `REDIS_URL` | ❌ No | — | Redis connection string. If omitted, uses in-memory cache |
| `PORT` | ❌ No | `3000` | Port the API listens on |

Example `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leadcrm
REDIS_URL=redis://localhost:6379
PORT=3000
```

---

## API Reference

**Base URL:** `http://localhost:3000`

A full **Postman collection** is included in the repo as `LeadCRM.postman_collection.json`. Import it directly into Postman to test all 35 requests across all 3 levels — requests auto-save IDs into variables so you don't need to copy-paste anything manually.

### Endpoints Summary

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/leads` | Create a lead |
| `GET` | `/leads` | List all leads (filterable + paginated) |
| `GET` | `/leads/:id` | Get a single lead by ID |
| `PUT` | `/leads/:id` | Update lead fields |
| `DELETE` | `/leads/:id` | Delete a lead |
| `PATCH` | `/leads/:id/status` | Transition lead to a new status |
| `POST` | `/leads/bulk` | Bulk create multiple leads |
| `PUT` | `/leads/bulk` | Bulk update multiple leads |

---

### POST /leads — Create a Lead

**Request:**
```json
{
  "name": "Aman Gupta",
  "email": "aman@example.com",
  "phone": "+91-9876543210",
  "source": "website"
}
```

- `name` — required
- `email` — required, must be valid email format
- `phone` — optional
- `source` — optional (e.g. "website", "referral", "campaign")

**Response `201`:**
```json
{
  "id": "a1b2c3d4-e5f6-...",
  "name": "Aman Gupta",
  "email": "aman@example.com",
  "phone": "+91-9876543210",
  "status": "NEW",
  "source": "website",
  "createdAt": "2026-04-27T10:00:00.000Z",
  "updatedAt": "2026-04-27T10:00:00.000Z"
}
```

**Error responses:**
- `422` — missing name or invalid email format
- `409` — email already exists

---

### GET /leads — List All Leads

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status: `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `LOST` |
| `source` | string | Filter by source string |
| `page` | number | Page number (default: `1`) |
| `limit` | number | Results per page (default: `20`) |

**Example:**
```
GET /leads?status=NEW&source=website&page=1&limit=10
```

**Response `200`:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "Aman Gupta",
      "email": "aman@example.com",
      "status": "NEW",
      "source": "website",
      "createdAt": "2026-04-27T10:00:00.000Z",
      "updatedAt": "2026-04-27T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### GET /leads/:id — Get a Lead

**Response `200`:** Returns the full lead object.

**Response `404`:**
```json
{ "error": "Lead not found" }
```

> This endpoint is cached. The first call hits the database; subsequent calls for the same ID are served from cache (Redis or in-memory). Cache is invalidated on update or delete.

---

### PUT /leads/:id — Update a Lead

Send only the fields you want to change. `status` cannot be changed via this endpoint — use `PATCH /leads/:id/status` instead.

**Request:**
```json
{
  "phone": "+91-9999999999",
  "source": "referral"
}
```

**Response `200`:** Returns the updated lead object.

**Error responses:**
- `404` — lead not found
- `422` — invalid field values
- `409` — email already taken by another lead

---

### DELETE /leads/:id — Delete a Lead

**Response `204`:** No content (success).

**Response `404`:** Lead not found.

---

### PATCH /leads/:id/status — Transition Status

**Request:**
```json
{ "status": "CONTACTED" }
```

**Response `200`:** Returns the updated lead with new status.

**Response `400` (invalid transition):**
```json
{ "error": "Invalid status transition from NEW to CONVERTED" }
```

See [Status Transition Rules](#status-transition-rules) below.

---

### POST /leads/bulk — Bulk Create

Send an array of lead objects. Invalid records fail individually — the rest still get created.

**Request:**
```json
[
  { "name": "Lead A", "email": "a@example.com", "source": "website" },
  { "name": "Lead B", "email": "b@example.com" },
  { "email": "missing-name@example.com" }
]
```

**Response `207`:**
```json
{
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    { "index": 0, "success": true, "lead": { "id": "x1", "name": "Lead A", "..." : "..." } },
    { "index": 1, "success": true, "lead": { "id": "x2", "name": "Lead B", "..." : "..." } },
    { "index": 2, "success": false, "error": "name is required" }
  ]
}
```

---

### PUT /leads/bulk — Bulk Update

Send an array of objects with `id` + fields to update. Invalid records fail individually.

**Request:**
```json
[
  { "id": "uuid-1", "phone": "+91-9000000001", "source": "campaign" },
  { "id": "uuid-2", "source": "referral" }
]
```

**Response `207`:** Same structure as bulk create — per-record success/failure.

---

## Status Transition Rules

A lead always starts as `NEW`. Transitions must follow these rules:

```
NEW → CONTACTED → QUALIFIED → CONVERTED
 ↘ LOST          ↘ LOST      ↘ LOST
```

- Forward transitions must go **one step at a time** (cannot skip)
- A lead can move to `LOST` from any status **except** `CONVERTED`
- `CONVERTED` and `LOST` are **terminal** — no further transitions allowed
- Any invalid transition returns `400` with a clear message

**Valid transitions table:**

| From | Can go to |
|---|---|
| `NEW` | `CONTACTED`, `LOST` |
| `CONTACTED` | `QUALIFIED`, `LOST` |
| `QUALIFIED` | `CONVERTED`, `LOST` |
| `CONVERTED` | ❌ Terminal |
| `LOST` | ❌ Terminal |

---

## HTTP Status Codes

| Code | When it's returned |
|---|---|
| `200` | Successful read or update |
| `201` | Lead created successfully |
| `204` | Lead deleted (no response body) |
| `207` | Bulk operation — partial success |
| `400` | Invalid status transition or malformed request |
| `404` | Lead not found |
| `409` | Duplicate email address |
| `422` | Validation error (missing required fields, bad email format) |
| `500` | Unexpected server error |

---

## Caching Strategy

**What is cached:** `GET /leads/:id` responses only, keyed as `lead:{uuid}` with a 60-second TTL.

**Why only single-lead lookups?** The list endpoint (`GET /leads`) supports filters and pagination — caching it would require invalidating the cache on every single write to the leads table, which defeats the purpose. Single-lead lookups are the most repeated reads in a CRM (e.g. opening a lead profile), so they benefit most from caching.

**Invalidation:** Write-invalidation strategy — the cache key is deleted on every `PUT`, `DELETE`, and `PATCH /status` for that lead. The next read will hit the database and re-populate the cache with fresh data.

**Redis vs in-memory fallback:**
- If `REDIS_URL` is set and Redis is reachable → uses Redis (distributed, survives restarts)
- If `REDIS_URL` is not set or Redis is down → silently falls back to an in-memory JS `Map` with TTL
- Cache failures (get/set/del errors) are caught silently — they **never crash the app**

---

## Design Decisions

**Controller / Service separation** — Controllers handle only HTTP concerns (reading `req.body`, setting status codes, sending `res.json`). All business logic and database queries live in the service layer. This means the service can be tested independently of Express, and swapping frameworks later requires no changes to business logic.

**State machine as a dedicated utility** — Transition rules live in a single `VALID_TRANSITIONS` object in `src/utils/stateMachine.js`. Adding a new status or changing a rule means editing one place, not hunting through controllers.

**Bulk operations: validate-first, then insert** — Each record is validated upfront before any DB calls. Records that fail validation are immediately marked as failed; valid records are sent to the DB. DB errors (e.g. duplicate email) are caught per-record. One failure never rolls back others. `HTTP 207 Multi-Status` is used because the request as a whole is neither fully successful nor fully failed.

**Route ordering: `/bulk` before `/:id`** — Express matches routes top-to-bottom. If `/:id` was registered first, a request to `/leads/bulk` would match it with `id = "bulk"` and return a 404. The bulk routes are registered first to prevent this.

**Why PostgreSQL over MongoDB?** — Leads have a fixed, well-known schema. The `status` field is an enum with strict rules. Relationships and schema enforcement are strengths of relational databases. A document store would add flexibility we don't need and lose the schema guarantees we do need.

---

## What I'd Do Differently at Scale

**1. Fix the concurrent status transition race condition**

The current flow is: read current status → validate transition → write new status. Under high concurrency, two simultaneous requests could both read `status=NEW`, both pass validation, and both write `CONTACTED`. The fix is an atomic conditional update:

```sql
UPDATE leads SET status='CONTACTED', updated_at=NOW()
WHERE id=$id AND status='NEW'
```

If `rowCount === 0`, the transition was stale — return a `409 Conflict`. This requires no locks and scales horizontally.

**2. Cursor-based pagination**

The current `page`/`offset` pagination breaks if new leads are inserted between page requests (leads shift pages). Cursor-based pagination (`GET /leads?after=<last-id>`) is stable regardless of concurrent writes.

**3. Batch DB inserts for bulk create**

Currently bulk create runs one `INSERT` per lead in a loop. At scale, replace this with a single `prisma.lead.createMany()` or a raw `INSERT ... ON CONFLICT` statement. The difference between 100 round trips and 1 round trip matters a lot under load.

**4. Connection pooling**

Prisma opens a connection pool by default, but under heavy traffic a separate pooler like **PgBouncer** prevents connection exhaustion on the Postgres side.

**5. Structured JSON logging**

`console.log` is not parseable by log aggregators. Replacing it with **pino** (outputs newline-delimited JSON) lets tools like Datadog, CloudWatch, or Loki index and query logs properly — essential for debugging production issues.

**6. Request ID tracing**

Adding a `X-Request-ID` header to every request (generated at the middleware layer and attached to all logs) makes it trivial to trace a single request across all log lines, especially useful when debugging bulk operations where multiple DB calls happen per request.
