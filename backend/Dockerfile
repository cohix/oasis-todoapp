# --- builder ---
FROM rust:latest AS builder

# System deps for sqlx / native-tls
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./

# Pre-fetch dependencies (layer cache)
RUN mkdir src \
    && echo 'fn main(){}' > src/main.rs \
    && printf 'pub mod bundles;\npub mod db;\npub mod models;\npub mod routes;\npub mod todos;\npub mod work_areas;\n' > src/lib.rs \
    && touch src/bundles.rs src/db.rs src/models.rs src/routes.rs src/todos.rs src/work_areas.rs \
    && cargo build --release \
    && rm -rf src

COPY src ./src
# Touch all source files so cargo rebuilds both the library and the binary
RUN touch src/*.rs && cargo build --release

# --- runtime ---
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/backend /usr/local/bin/backend

EXPOSE 8080
CMD ["backend"]
