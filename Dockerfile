FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS frontend
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vite.config.mjs index.html ./
COPY frontend ./frontend
COPY gateway ./gateway
COPY workers/javascript ./workers/javascript
RUN npm run build && npm test

FROM golang:1.25-bookworm@sha256:3b4a11519ad929d1e1d261a12cff056f0c85b735253d7d861346b9c6f8b36437 AS go-worker
WORKDIR /src
COPY workers/go/ ./
RUN gofmt -w . && go test ./... && CGO_ENABLED=0 go build -trimpath -o /go-worker .

FROM rust:1.98-bookworm@sha256:9a73a5088750b4c95158ab26629c854c3d6fc4b173cb7bc8079ad252d8ed7bfa AS rust-worker
WORKDIR /src
COPY workers/rust/ ./
RUN cargo test && cargo build --release

FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 openjdk-17-jdk-headless ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=frontend /src/dist ./dist
COPY --from=go-worker /go-worker ./.build/go-worker
COPY --from=rust-worker /src/target/release/interval-worker ./.build/rust-worker
COPY backend ./backend
COPY workers ./workers
COPY gateway ./gateway
COPY scripts ./scripts
COPY package.json ./
RUN mkdir -p .build/java .data && javac -d .build/java workers/java/*.java \
    && java -cp .build/java WorkerTest \
    && REQUIRE_ALL_WORKERS=1 python3 -m unittest discover -s backend/tests -v \
    && node --test gateway/server.test.mjs \
    && chown -R node:node /app/.data
ENV HOST=0.0.0.0 PORT=4173 PYTHON=python3 PYTHONDONTWRITEBYTECODE=1
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start.mjs"]
