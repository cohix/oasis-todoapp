# DevOps Rules

> Source of truth: `aspec/devops/localdev.md`, `aspec/devops/infrastructure.md`

## Developer Loop

- `make all` — builds all components as local Docker images (`docker compose build`)
- `make up` — builds Docker images if source has changed, then starts the app via Docker Compose
- `make test` — builds latest Docker images, runs all unit/integration tests locally, then runs E2E tests against the Docker stack

## Infrastructure

- Deployment: developer laptop via Docker / docker-compose
- No cloud platform
- Use docker-compose to launch all components when `make up` is run
- Write simple, idiomatic Dockerfiles for each component using base images from Docker Hub

## Version Control

- For each work item, create a branch named `{feature|bug|task}-XXXX-name` based on the work item filename
  - Example: `aspec/work-items/0001-work-areas.md` → branch `feature-0001-work-areas`

## Documentation

- Generate usage documentation for each work item and place it in the `docs/` folder