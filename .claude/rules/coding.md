# Coding Rules

> Source of truth: `aspec/foundation.md`

## General

- Organize code in small, simple, modular components
- Each component must have unit tests validating inputs and outputs — include both positive and negative test cases
- The codebase must have integration tests validating interactions between components
- Simplicity over conciseness — intermediate developers should feel at home in this codebase
- Only add 3rd party packages when completely necessary

## Frontend (TypeScript / React)

- Use only idiomatic TypeScript
- Build small, modular React components with an eye towards reuse
- No locally stored state — all data lives in the backend, accessed via REST API
- Comment code where appropriate

## Backend (Rust / Warp)

- Write idiomatic, async Rust code
- Keep modules and crates small and easily understood
- Prefer simplicity over concise-but-complex code

## Personas

There is one persona: **user** — the main user of the application.
- Allowed: all actions (create/manage work areas, create/manage todos, group todos into bundles)
- No RBAC restrictions apply