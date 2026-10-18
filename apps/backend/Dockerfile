# Keep in sync with "packageManager" in the root package.json.
ARG BUN_VERSION=1.4.2
# Toolchain for the browser token module (native/pkcs11, edition 2024).
ARG RUST_VERSION=1.98

# ── Browser token module ─────────────────────────────────────────────────────
# Builds the PKCS#11 module the install scripts hand to browsers, for x86_64
# and ARM64 Linux and x86_64 Windows (MinGW, static runtime: the DLL needs
# nothing beside it). Bookworm's glibc (2.36) keeps the Linux builds loadable
# on current desktop distributions. Only native/pkcs11 is copied, so app changes reuse
# this stage from cache; the Rust toolchain never reaches the runtime image.
FROM rust:${RUST_VERSION}-slim-bookworm AS module
RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc-aarch64-linux-gnu libc6-dev-arm64-cross \
    gcc-mingw-w64-x86-64 \
  && rm -rf /var/lib/apt/lists/* \
  && rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu x86_64-pc-windows-gnu
ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
  CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc \
  AR_aarch64_unknown_linux_gnu=aarch64-linux-gnu-ar \
  CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc \
  CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS="-C target-feature=+crt-static" \
  CC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-gcc \
  AR_x86_64_pc_windows_gnu=x86_64-w64-mingw32-ar
WORKDIR /src
COPY native/pkcs11/Cargo.toml native/pkcs11/Cargo.lock ./
COPY native/pkcs11/src ./src
COPY native/pkcs11/vendor ./vendor
# target/ lives in a cache mount, so the files are copied out in the same step.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/src/target \
  cargo build --release --locked --lib \
    --target x86_64-unknown-linux-gnu --target aarch64-unknown-linux-gnu \
    --target x86_64-pc-windows-gnu \
  && mkdir -p /dist/x86_64 /dist/aarch64 /dist/windows-x86_64 \
  && cp target/x86_64-unknown-linux-gnu/release/libgarabato_pkcs11.so /dist/x86_64/ \
  && cp target/aarch64-unknown-linux-gnu/release/libgarabato_pkcs11.so /dist/aarch64/ \
  && cp target/x86_64-pc-windows-gnu/release/garabato_pkcs11.dll /dist/windows-x86_64/

# ── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS build
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

# Manifests first: the install layer below stays cached until a
# package.json or the lockfile changes. Every workspace package.json
# must be present or --frozen-lockfile rejects the install.
COPY package.json bun.lock bunfig.toml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY apps/site/package.json apps/site/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/cron/package.json packages/cron/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/logger/package.json packages/logger/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
# tsdown bundles the workspace packages AND every npm dependency into
# dist/ (see tsdown.config.ts), so the runtime stage needs no node_modules.
RUN cd apps/backend && bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Bun is the only runtime (the app uses Bun.cron and Bun's `export default`
# serving); the compose healthchecks use `bun -e` too, so no Node is needed.
FROM oven/bun:${BUN_VERSION}-slim AS runtime
ENV NODE_ENV=production

# runMigrations() runs from the bundle's cwd (WORKDIR = apps/backend/) and
# resolves the migrations folder as ../../packages/db/src/migrations, so the
# repo layout below must match what the path expects at runtime.
COPY --from=build /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build /app/packages/db/src/migrations /app/packages/db/src/migrations
# The browser token: the backend serves these from ../../native/pkcs11, the
# same relative layout as the migrations.
COPY --from=module /dist /app/native/pkcs11/dist
COPY native/pkcs11/install /app/native/pkcs11/install

EXPOSE 3000

WORKDIR /app/apps/backend
CMD ["bun", "dist/index.mjs"]
