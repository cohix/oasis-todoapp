# todoapp — Local Dev Setup

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- `make`

## Starting the app

```bash
make up
```

This builds both containers and starts:

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000        |
| Backend  | http://localhost:8080        |
| Health   | http://localhost:8080/api/v1/health |

The SQLite database is persisted at `$HOME/.todoapp/db.sqlite` on your host machine.

## Running tests

```bash
make test
```

Runs `cargo test` in the backend and `npm test` in the frontend (non-interactive).

## Architecture

```
frontend (React/TypeScript)  →  REST /api/v1/...  →  backend (Rust/Warp)  →  SQLite
```

- No login required — just `make up` and open your browser.
- All state lives in the backend; the UI stores nothing locally.
