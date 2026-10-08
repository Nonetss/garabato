#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# STACK — bootstrap
#
# Generates a `.env` file with random secrets (openssl), prompts for the
# initial admin credentials, and optionally starts the stack with docker
# compose (compose.prod.yml).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/scripts/bootstrap.sh | bash
#
# Requirements: docker, openssl, curl.
#
# Can be run standalone (curl | bash) or from a cloned repo. In both cases it
# writes `.env` (and downloads compose.prod.yml if missing) in the CURRENT
# DIRECTORY.
# ─────────────────────────────────────────────────────────────────────────────

set -Eeuo pipefail

# The stack is generated/started in the directory where you run the script,
# not where the script file lives. Works the same via `curl | bash` or cloned.
TARGET_DIR="$(pwd -P)"
ENV_FILE="$TARGET_DIR/.env"

# Branch or tag used to download compose.prod.yml. Override: PB_REF=v0.1.0 ...
# This only pins compose.prod.yml: the images it references stay on `:main`.
PB_REF="${PB_REF:-main}"
RAW_REPO="https://raw.githubusercontent.com/Nonetss/garabato"

# ── Output helpers ───────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_CYAN=$'\033[1;36m'; C_GREEN=$'\033[1;32m'; C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_CYAN=""; C_GREEN=""; C_RED=""; C_DIM=""
fi
log()  { printf '%s==>%s %s\n' "$C_CYAN"  "$C_RESET" "$*"; }
ok()   { printf '%s[OK]%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
err()  { printf '%s[ERROR]%s %s\n' "$C_RED"  "$C_RESET" "$*" >&2; }
note() { printf '%s%s%s\n'     "$C_DIM"   "$*" "$C_RESET"; }

# ── Dependency check ─────────────────────────────────────────────────────────
for cmd in docker openssl curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Missing required command: $cmd"
    exit 1
  fi
done
# `docker` alone is not enough: the stack is started with the compose plugin,
# and finding out it is missing only after .env is written is too late.
if ! docker compose version >/dev/null 2>&1; then
  err "Missing the docker compose plugin (\`docker compose version\` failed)"
  exit 1
fi

# This script is interactive (asks for admin/password). With `curl | bash`, stdin
# is the script itself, so we read from the real terminal (/dev/tty).
if [[ ! -r /dev/tty ]]; then
  err "No interactive terminal (/dev/tty). Run this script from a shell."
  exit 1
fi

# Checked before any prompt so nobody answers everything just to be told the
# file cannot be written.
if [[ -f "$ENV_FILE" ]]; then
  err "$ENV_FILE already exists — delete it manually if you want to regenerate"
  exit 1
fi

# ── Banner ───────────────────────────────────────────────────────────────────
printf '%s' "$C_CYAN"
cat <<'BANNER'

  ██████╗ ███████╗████████╗████████╗███████╗██████╗
  ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
  ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
  ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
  ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
  ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

BANNER
printf '%s' "$C_RESET"
printf '  %s────────────────────────────────────────────────────────────%s\n' "$C_CYAN" "$C_RESET"
printf '  %s  Bootstrap · generates .env and starts the stack%s\n' "$C_DIM" "$C_RESET"
printf '  %s────────────────────────────────────────────────────────────%s\n\n' "$C_CYAN" "$C_RESET"
note "This script generates .env with random secrets."
note "If .env already exists, abort (delete it manually and run again)."
echo

# ── Prompt helpers ───────────────────────────────────────────────────────────
prompt() {
  local label="$1" default="${2:-}" value
  if [[ -n "$default" ]]; then
    read -r -p "$(printf '%s [%s]: ' "$label" "$default")" value </dev/tty
    value="${value:-$default}"
  else
    read -r -p "$(printf '%s: ' "$label")" value </dev/tty
  fi
  printf '%s' "$value"
}

prompt_secret() {
  local label="$1" value=""
  while [[ -z "$value" ]]; do
    read -r -s -p "$(printf '%s: ' "$label")" value </dev/tty
    # Newline goes to /dev/tty, not stdout: if it went to stdout, the $(...)
    # wrapping this function would capture it and leak it into the password.
    echo >/dev/tty
    # Extra guard: no CR/LF inside the value.
    value="${value//[$'\r\n']/}"
  done
  printf '%s' "$value"
}

prompt_confirm() {
  local label="$1" default="${2:-y}" yn
  local hint
  if [[ "$default" =~ ^[Yy]$ ]]; then hint="Y/n"; else hint="y/N"; fi
  read -r -p "$(printf '%s [%s]: ' "$label" "$hint")" yn </dev/tty
  yn="${yn:-$default}"
  [[ "$yn" =~ ^[Yy]$ ]]
}

is_email() {
  [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]
}

# Every .env value is written single-quoted: docker compose then takes it
# literally, with no `$VAR` interpolation and no ` #` inline comment. A single
# quote cannot be escaped inside such a value, so inputs containing one are
# rejected at the prompt.
has_single_quote() {
  [[ "$1" == *"'"* ]]
}

env_quote() {
  printf "'%s'" "$1"
}

gen_secret() {
  openssl rand -base64 48 | tr -d '\n'
}

# Password embedded in a URL (DATABASE_URL): no characters that need escaping
# (/, +, =). Hex is always URL-safe.
gen_password() {
  openssl rand -hex 32
}

# Enables the bundled MinIO in compose.prod.yml; empty for an external store.
compose_profiles_line() {
  if [[ "$STORAGE_MODE" == "bundled" ]]; then
    printf "COMPOSE_PROFILES=%s" "$(env_quote minio)"
  fi
}

# AES-256 master key for the certificate vault: exactly 32 bytes in base64.
gen_encryption_key() {
  openssl rand -base64 32 | tr -d '\n'
}

# ── Inputs ───────────────────────────────────────────────────────────────────
log "Configuration — answer the prompts."
echo

# Asked before the public URL so the URL default can follow the chosen port.
# compose.prod.yml publishes "${FRONTEND_PORT:-4444}:80" on the gateway, the
# only service reachable from outside.
FRONTEND_PORT=$(prompt "Frontend port on the host" "4444")
# `10#` forces base 10: bash arithmetic would otherwise read "08" as octal and
# abort under `set -e` instead of reporting an invalid port.
if ! [[ "$FRONTEND_PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$FRONTEND_PORT < 1 || 10#$FRONTEND_PORT > 65535 )); then
  err "Invalid port"
  exit 1
fi
FRONTEND_PORT=$(( 10#$FRONTEND_PORT ))

PUBLIC_URL=$(prompt "Public URL (what the browser will see)" "http://localhost:$FRONTEND_PORT")
if [[ ! "$PUBLIC_URL" =~ ^https?://[^[:space:]\']+$ ]]; then
  err "Invalid URL (must start with http:// or https://, no spaces or quotes)"
  exit 1
fi
PUBLIC_URL="${PUBLIC_URL%/}"

# Session cookies are `Secure` (packages/auth): browsers drop them over plain
# http except on localhost, so sign-in silently fails anywhere else.
if [[ "$PUBLIC_URL" =~ ^http://([^/:]+) ]]; then
  public_host="${BASH_REMATCH[1]}"
  if [[ "$public_host" != "localhost" && "$public_host" != "127.0.0.1" ]]; then
    err "Session cookies are Secure: over plain http they only work on localhost."
    err "Signing in at $PUBLIC_URL will fail — put the stack behind https."
    if ! prompt_confirm "Continue anyway?" "n"; then
      note "Aborted. Nothing was written."
      exit 1
    fi
  fi
fi

ADMIN_NAME=$(prompt "Admin name" "Admin")
[[ -n "$ADMIN_NAME" ]] || { err "Name cannot be empty"; exit 1; }
has_single_quote "$ADMIN_NAME" && { err "Name cannot contain a single quote (')"; exit 1; }

ADMIN_EMAIL=""
until is_email "$ADMIN_EMAIL"; do
  ADMIN_EMAIL=$(prompt "Admin email" "admin@stack.local")
  is_email "$ADMIN_EMAIL" || err "Invalid email, try again"
done

ADMIN_PASSWORD=""
until [[ ${#ADMIN_PASSWORD} -ge 8 ]] && ! has_single_quote "$ADMIN_PASSWORD"; do
  ADMIN_PASSWORD=$(prompt_secret "Admin password (min 8 characters, no single quotes)")
  if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
    err "Too short, minimum 8 characters"
  elif has_single_quote "$ADMIN_PASSWORD"; then
    err "The password cannot contain a single quote ('), try again"
  fi
done
printf '\n'

# ── Object storage ───────────────────────────────────────────────────────────
# Documents are stored, encrypted, in an S3-compatible store: the bundled
# MinIO (compose profile `minio`, credentials generated below) or an external
# service whose bucket already exists.
S3_REGION="us-east-1"
S3_BUCKET="documents"
if prompt_confirm "Store documents in the bundled MinIO? (n = external S3-compatible store)" "y"; then
  STORAGE_MODE="bundled"
  S3_ENDPOINT="http://minio:9000"
else
  STORAGE_MODE="external"
  S3_ENDPOINT=$(prompt "S3 endpoint URL (e.g. https://s3.eu-west-1.amazonaws.com)")
  if [[ ! "$S3_ENDPOINT" =~ ^https?://[^[:space:]\']+$ ]]; then
    err "Invalid URL (must start with http:// or https://, no spaces or quotes)"
    exit 1
  fi
  S3_BUCKET=$(prompt "Bucket (it must already exist)" "$S3_BUCKET")
  S3_REGION=$(prompt "Region" "$S3_REGION")
  S3_ACCESS_KEY_ID=$(prompt "Access key id")
  for value in "$S3_BUCKET" "$S3_REGION" "$S3_ACCESS_KEY_ID"; do
    if [[ -z "$value" ]] || has_single_quote "$value"; then
      err "Bucket, region and access key id cannot be empty or contain a single quote (')"
      exit 1
    fi
  done
  S3_SECRET_ACCESS_KEY=""
  until [[ ${#S3_SECRET_ACCESS_KEY} -ge 8 ]] && ! has_single_quote "$S3_SECRET_ACCESS_KEY"; do
    S3_SECRET_ACCESS_KEY=$(prompt_secret "Secret access key (min 8 characters, no single quotes)")
    if [[ ${#S3_SECRET_ACCESS_KEY} -lt 8 ]] || has_single_quote "$S3_SECRET_ACCESS_KEY"; then
      err "Invalid secret, try again"
    fi
  done
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo
log "Configuration summary:"
echo "  Public URL:        $PUBLIC_URL"
echo "  Frontend port:     $FRONTEND_PORT"
echo "  Admin:             $ADMIN_NAME <$ADMIN_EMAIL>"
if [[ "$STORAGE_MODE" == "bundled" ]]; then
  echo "  Document storage:  bundled MinIO (bucket $S3_BUCKET)"
else
  echo "  Document storage:  $S3_ENDPOINT (bucket $S3_BUCKET)"
fi
echo

if ! prompt_confirm "Generate .env and continue?"; then
  note "Aborted. Nothing was written."
  exit 0
fi

# ── Generate secrets ─────────────────────────────────────────────────────────
log "Generating secrets with openssl..."
POSTGRES_PASSWORD=$(gen_password)
BETTER_AUTH_SECRET=$(gen_secret)
CERTIFICATE_ENCRYPTION_KEY=$(gen_encryption_key)
if [[ "$STORAGE_MODE" == "bundled" ]]; then
  # MinIO's root user and password, also the backend's S3 credentials.
  S3_ACCESS_KEY_ID="stack"
  S3_SECRET_ACCESS_KEY=$(gen_password)
  ok "Secrets generated (POSTGRES_PASSWORD, BETTER_AUTH_SECRET, CERTIFICATE_ENCRYPTION_KEY, S3_SECRET_ACCESS_KEY)"
else
  ok "Secrets generated (POSTGRES_PASSWORD, BETTER_AUTH_SECRET, CERTIFICATE_ENCRYPTION_KEY)"
fi

# ── Write .env ───────────────────────────────────────────────────────────────
# umask 077 so the file is created 600: creating it with the default umask
# and chmod-ing afterwards leaves the secrets world-readable in between.
umask 077
cat > "$ENV_FILE" <<EOF
# Generated by scripts/bootstrap.sh on $(date -u +%FT%TZ)
# Do not commit — contains secrets.
#
# Values are single-quoted so docker compose reads them literally: no \$VAR
# interpolation and no inline # comments. Keep the quotes if you edit them.

# ── Public host ──────────────────────────────────────────────────────────────
FRONTEND_PORT=$(env_quote "$FRONTEND_PORT")
# Public URL of the site (served by the gateway): the origin the backend
# allows.
CORS_ORIGIN=$(env_quote "$PUBLIC_URL")

# ── PostgreSQL (db service in compose.prod.yml) ──────────────────────────────
POSTGRES_PASSWORD=$(env_quote "$POSTGRES_PASSWORD")

# ── Backend ──────────────────────────────────────────────────────────────────
# Written with resolved values rather than referencing POSTGRES_PASSWORD. For
# an external DB (RDS, Cloud SQL, …) replace this line and remove the db
# service from compose.prod.yml.
DATABASE_URL=$(env_quote "postgresql://postgres:$POSTGRES_PASSWORD@db:5432/stack")

BETTER_AUTH_SECRET=$(env_quote "$BETTER_AUTH_SECRET")

# Master key of the certificate vault. Back it up together with the database:
# without it the stored certificates cannot be decrypted.
CERTIFICATE_ENCRYPTION_KEY=$(env_quote "$CERTIFICATE_ENCRYPTION_KEY")

# ── Object storage ───────────────────────────────────────────────────────────
# Encrypted documents. Bundled: MinIO from compose.prod.yml's \`minio\` profile,
# with these as its root credentials. Back up the minio_data volume too.
S3_ENDPOINT=$(env_quote "$S3_ENDPOINT")
S3_BUCKET=$(env_quote "$S3_BUCKET")
S3_REGION=$(env_quote "$S3_REGION")
S3_ACCESS_KEY_ID=$(env_quote "$S3_ACCESS_KEY_ID")
S3_SECRET_ACCESS_KEY=$(env_quote "$S3_SECRET_ACCESS_KEY")
$(compose_profiles_line)

# ── Seed admin ───────────────────────────────────────────────────────────────
# Created on first backend boot (idempotent by email). Leave blank to skip.
ADMIN_NAME=$(env_quote "$ADMIN_NAME")
ADMIN_EMAIL=$(env_quote "$ADMIN_EMAIL")
ADMIN_PASSWORD=$(env_quote "$ADMIN_PASSWORD")

EOF

chmod 600 "$ENV_FILE"
ok ".env written to $ENV_FILE (mode 600)"
note "Back up CERTIFICATE_ENCRYPTION_KEY with your database backups: losing it"
note "makes every stored certificate unrecoverable."

# ── compose.prod.yml ─────────────────────────────────────────────────────────
# Kept as compose.prod.yml (not renamed to compose.yml) so a clone of this repo
# does not overwrite the local-dev compose.yml. When run standalone (curl | bash)
# we download it from the repo if missing.
COMPOSE_FILE="$TARGET_DIR/compose.prod.yml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  log "Downloading compose.prod.yml ($PB_REF)..."
  # compose.prod.yml holds no secrets; restore the usual permissions for it.
  umask 022
  if ! curl -fsSL "$RAW_REPO/$PB_REF/compose.prod.yml" -o "$COMPOSE_FILE"; then
    rm -f "$COMPOSE_FILE"
    err "Could not download compose.prod.yml for '$PB_REF' (no such branch or tag)."
    err ".env is already written; fix PB_REF and download compose.prod.yml by hand."
    exit 1
  fi
  ok "compose.prod.yml downloaded to $COMPOSE_FILE"
fi

# ── Start stack ──────────────────────────────────────────────────────────────
# On startup the backend applies pending database migrations and seeds the
# admin, so no manual database step is needed.
echo
if prompt_confirm "Start the stack now with docker compose?"; then
  log "docker compose pull..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

  log "docker compose up -d..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

  ok "Done. The backend migrates the database and seeds the admin on startup."
  ok "In ~1-2 min go to $PUBLIC_URL and sign in with $ADMIN_EMAIL"
else
  note "When you're ready to start (from this folder):"
  note "  docker compose -f compose.prod.yml --env-file .env up -d"
fi
