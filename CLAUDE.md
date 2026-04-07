# todoapp

A SaaS web application for tracking todo items across work areas, built for an architect.

## Project Overview

- **Frontend**: TypeScript / React (create-react-app)
- **Backend**: Rust / Warp — single binary, port 8080, SQLite at `$HOME/.todoapp/db.sqlite`
- **Architecture**: Monolith — UI talks to backend via REST over HTTP
- **Infrastructure**: Docker / docker-compose on developer laptop

## Spec Source of Truth

All decisions about features, architecture, and workflows are defined in `aspec/`.

| Path | Contents |
|------|----------|
| `aspec/foundation.md` | Project purpose, languages, frameworks, personas |
| `aspec/architecture/design.md` | Architecture pattern, components, security |
| `aspec/architecture/apis.md` | REST API conventions and guidance |
| `aspec/devops/localdev.md` | Developer loop, build tools, version control, docs |
| `aspec/devops/infrastructure.md` | Docker/docker-compose setup |
| `aspec/devops/cicd.md` | CI/CD pipelines (TBD) |
| `aspec/genai/agents.md` | AI agents (TBD) |
| `aspec/uxui/interface.md` | Visual design, colors, responsiveness, accessibility |
| `aspec/uxui/experience.md` | UX behaviour — auto-save, auto-load |
| `aspec/uxui/setup.md` | Setup — `make up`, no login required |
| `aspec/work-items/` | Individual feature/bug/task specs |

## Rules

- `.claude/rules/coding.md` — language-specific standards, testing, component structure
- `.claude/rules/architecture.md` — component boundaries, REST API rules, data storage
- `.claude/rules/devops.md` — developer loop, Docker, version control, documentation
- `.claude/rules/uxui.md` — visual design, UX behaviour, accessibility, responsiveness
- `.claude/rules/work-items.md` — how to implement work items from `aspec/work-items/`
