# Infrastructure

Deployment platform: developer laptop Docker
Cloud platform: none
Automation: single monolithic Docker image (nginx + s6-overlay + Rust backend)

## Architecture

- A single Dockerfile at the repository root builds a monolithic image in three stages:
  1. **frontend-builder** — `npm run build` produces a static production build
  2. **backend-builder** — `cargo build --release` produces the Rust binary
  3. **final** — debian:bookworm-slim with nginx, s6-overlay, the static files, and the backend binary
- **nginx** (port 80) serves the static React build at `/` and proxies `/api/*` to the local Rust backend on `127.0.0.1:8080`
- **s6-overlay** supervises both nginx and the Rust backend as long-running services within the same container
- The container is run with `docker run -p 80:80 -v $HOME/.todoapp:/root/.todoapp todoapp`
- `make up` builds the image and runs the container; `make all` (or `make docker`) builds the image only
