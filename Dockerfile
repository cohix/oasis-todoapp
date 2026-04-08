# ---------------------------------------------------------------------------
# Stage 1: Build the React frontend (static production build)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

COPY frontend/ .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Build the Rust backend binary
# ---------------------------------------------------------------------------
FROM rust:latest AS backend-builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/Cargo.toml backend/Cargo.lock* ./

# Pre-fetch dependencies using stub sources so this layer is cached separately
RUN mkdir src \
    && echo 'fn main(){}' > src/main.rs \
    && printf 'pub mod bundles;\npub mod db;\npub mod models;\npub mod routes;\npub mod todos;\npub mod work_areas;\n' > src/lib.rs \
    && touch src/bundles.rs src/db.rs src/models.rs src/routes.rs src/todos.rs src/work_areas.rs \
    && cargo build --release \
    && rm -rf src

COPY backend/src ./src
RUN touch src/*.rs && cargo build --release

# ---------------------------------------------------------------------------
# Stage 3: Final monolithic image — nginx + s6-overlay + Rust backend
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim

ARG S6_VERSION=3.2.0.2

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    ca-certificates \
    libssl3 \
    curl \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install s6-overlay (detects build architecture automatically)
RUN ARCH=$(uname -m) \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_VERSION}/s6-overlay-noarch.tar.xz" \
       -o /tmp/s6-noarch.tar.xz \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_VERSION}/s6-overlay-${ARCH}.tar.xz" \
       -o /tmp/s6-arch.tar.xz \
    && tar -C / -Jxpf /tmp/s6-noarch.tar.xz \
    && tar -C / -Jxpf /tmp/s6-arch.tar.xz \
    && rm /tmp/s6-*.tar.xz

# Copy static frontend build
COPY --from=frontend-builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy Rust backend binary
COPY --from=backend-builder /app/target/release/backend /usr/local/bin/backend

# ---------------------------------------------------------------------------
# S6-overlay service: backend (Rust API on port 8080)
# ---------------------------------------------------------------------------
RUN mkdir -p /etc/s6-overlay/s6-rc.d/backend \
    && echo "longrun" > /etc/s6-overlay/s6-rc.d/backend/type \
    && printf '#!/bin/sh\nexec /usr/local/bin/backend\n' \
       > /etc/s6-overlay/s6-rc.d/backend/run \
    && chmod +x /etc/s6-overlay/s6-rc.d/backend/run

# ---------------------------------------------------------------------------
# S6-overlay service: nginx (static files + API proxy on port 80)
# ---------------------------------------------------------------------------
RUN mkdir -p /etc/s6-overlay/s6-rc.d/nginx \
    && echo "longrun" > /etc/s6-overlay/s6-rc.d/nginx/type \
    && printf '#!/bin/sh\nexec nginx -g "daemon off;"\n' \
       > /etc/s6-overlay/s6-rc.d/nginx/run \
    && chmod +x /etc/s6-overlay/s6-rc.d/nginx/run

# ---------------------------------------------------------------------------
# User bundle: activate both services at container startup
# ---------------------------------------------------------------------------
RUN mkdir -p /etc/s6-overlay/s6-rc.d/user/contents.d \
    && touch /etc/s6-overlay/s6-rc.d/user/contents.d/backend \
    && touch /etc/s6-overlay/s6-rc.d/user/contents.d/nginx

EXPOSE 80

ENTRYPOINT ["/init"]
