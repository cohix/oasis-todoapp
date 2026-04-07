# Architecture Rules

> Source of truth: `aspec/architecture/design.md`, `aspec/architecture/apis.md`

## Pattern

Monolith with two components:

| Component | Purpose | Scope |
|-----------|---------|-------|
| **backend** | Rust binary — REST API on port 8080, SQLite at `$HOME/.todoapp/db.sqlite` | All data storage and manipulation; no UI rendering |
| **UI** | React webapp | UI rendering only; no locally stored state; all data via REST API |

## REST API

- Convention: REST over HTTP
- Base path: `/api/v1/...`
- Resources: work areas, todos, bundles — using standard CRUD actions
- Version the API so breaking changes can coexist with older versions
- All API calls must be idempotent
- All API calls must complete synchronously — no async background work or eventual consistency

## Data Storage

- All persistent data stored in the backend's SQLite database
- No data stored locally in the browser (no localStorage, no cookies for state)

## Security

- No transport security (no TLS/mTLS required for local dev)
- No authentication or login required
- No RBAC — the single user has full access to all data