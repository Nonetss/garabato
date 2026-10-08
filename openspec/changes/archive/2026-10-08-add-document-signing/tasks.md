## 1. Shared security modules

- [x] 1.1 Move `vault.ts` and `pkcs12.ts` from `packages/api/src/v1/certificate/` to `packages/api/src/shared/` (imports via `#shared/*`), and move their tests to `tests/shared/`; verify `check-types` and `turbo run test --filter=@nonete/api` pass unchanged
- [x] 1.2 Generalize the vault to a `{ kind: "certificate" | "document"; id }` scope with the AAD `<kind>:<id>:<purpose>` (purposes `dek`, `p12`, `password`, `v<n>`) and update the certificate handler; verify a new test pins the certificate AAD bytes, so data sealed before the move still opens, plus a document-scope round trip
- [x] 1.3 Add `openSigningKey(bytes, password)` to `#shared/pkcs12` (metadata + WebCrypto `CryptoKey` + certificate and chain DER); verify tests sign and verify a probe with the RSA and the EC fixtures, and that a wrong password still maps to `wrong-password`

## 2. Configuration and object storage infrastructure

- [x] 2.1 Add `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` (default `us-east-1`), `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` (≥ 8) to `packages/env/src/server.ts`, and placeholders to `packages/api/tests/setup.ts`; verify `check-types` and the api suite pass
- [x] 2.2 Document the S3 variables and the commented `COMPOSE_PROFILES=minio` in `.env.example` (native MinIO defaults `http://localhost:9000`), and generate `S3_SECRET_ACCESS_KEY` in `scripts/setup-dev.sh`; verify by running `setup-dev.sh --force` on a temporary copy of the repo, never the real `.env`
- [x] 2.3 Pull `pgsty/silo:latest` and check whether it ships `mc` and a client usable for the healthcheck; report the result to the user and pick the `minio-init` image accordingly (same image, or the matching `mc` image)
  - Result: `pgsty/silo:latest` (silo RELEASE.2026-09-16, sha256:635197cb…) ships `mc` (`/usr/bin/mc` → `mcli`) and `curl`, not `wget`; the binary is `silo` and the entrypoint maps `server …`/`minio …` to it. `curl -fsS http://localhost:9000/minio/health/live` answers 200 and `mc mb --ignore-existing` is idempotent, so the same image runs `minio-init` and the healthcheck.
- [x] 2.4 Add `minio` and `minio-init` to `compose.dev.yml` (private network, named volume, `MINIO_ROOT_*` from the `S3_*` credentials, backend `S3_ENDPOINT=http://minio:9000` override and wait on `minio-init`) plus `minio-native` and `minio-native-init` under the `native` profile on `127.0.0.1:9000/9001`, and the root scripts `minio:start`/`minio:stop`; verify `docker compose -f compose.dev.yml config` and `--profile native config` render without starting anything
- [x] 2.5 Add `minio` and `minio-init` to `compose.yml` (always on, console `127.0.0.1:9001`, backend `S3_ENDPOINT` override) and to `compose.prod.yml` under the `minio` profile (named volume `minio_data`, healthcheck, `restart`, `stack-minio` names, no backend dependency); verify `docker compose config` for `compose.yml`, and for `compose.prod.yml` with and without `--profile minio`, against a throwaway env file
- [x] 2.6 Extend `scripts/bootstrap.sh` with the bundled/external storage prompt, generated bundled credentials, `S3_*` and `COMPOSE_PROFILES=minio`; verify `bash -n` and a dry run in a temporary directory that stops before starting the stack
- [x] 2.7 Add `#shared/object-storage` (`putObject`, `getObject`, `deleteObject` over `Bun.S3Client`, mapping connection failures to `SERVICE_UNAVAILABLE` and store errors to `BAD_GATEWAY` in Spanish), an in-memory fake in `tests/fixtures/object-storage.ts` installed by `tests/setup.ts`, and `tests/shared/object-storage.test.ts` covering the error mapping with an injected failing client; verify the api suite passes
  - Split for testability: `#shared/object-storage` holds `createObjectStorage` and the error mapping (Bun reports connection failures as `S3Error` too, so the `code` decides); `#lib/object-storage` holds the real `Bun.S3Client` instance and is what `tests/setup.ts` mocks.

## 3. Request body limit

- [x] 3.1 Raise the oRPC request limit to 21 MiB and add a Hono `body-limit` middleware at 1 MiB on `/rpc/*` and `/api/*` except `/rpc/v1/document/upload` and `/api/v1/document/upload`, answering `413` with the standard error body; verify `bun run --filter backend check-types` passes, and ask the user to confirm a >1 MiB comment is rejected and a 15 MiB PDF upload is accepted
  - Implemented without a Hono middleware so the 413 keeps oRPC's standard error body on both protocols: `/rpc` and `/api` each build two handlers (1 MiB and `MAX_UPLOAD_BODY_BYTES`) and pick one by path (`isUploadPath` in `handler-plugins.ts`).

## 4. Database schema (stop for the user's migration)

- [x] 4.1 Add `packages/db/src/schema/document/` with `document_documents`, `document_versions` and `document_signatures` per design.md Decision 5, exported from `schema/index.ts`; verify `bun run --filter @nonete/db check-types` passes
- [x] 4.2 Add `documentRow`, `documentVersionRow` and `documentSignatureRow` factories to `packages/db/testing/rows.ts`; verify `check-types` passes
- [x] 4.3 Stop and hand off: tell the user the schema is ready so they can run `db:generate`, review (watch for unrelated `DROP`s from the shared dev database) and apply the migration; never run any `db:*` command or touch `packages/db/src/migrations/`

## 5. PAdES signing module

- [x] 5.1 Add `@cantoo/pdf-lib`, `@signpdf/signpdf`, `@signpdf/utils`, `pkijs` and `asn1js` to `packages/api`; verify `bun install` succeeds and the lockfile changes only for them
- [x] 5.2 Add a fixture generator for test PDFs (plain 3 pages, a page rotated 90°, an offset crop box, an encrypted PDF, a non-PDF) beside the certificate fixtures and commit its output; verify the script is re-runnable and `qpdf --check` accepts the valid ones
- [x] 5.3 Port `signer.ts` (PadesSigner) and `placeholder.ts` from the proof of concept into `src/v1/document/pades/` following the code style (no casts, no fallback chains); verify `tests/v1/document/pades.test.ts` checks a valid `ETSI.CAdES.detached` CMS with signing-certificate-v2 for RSA and EC, a byte range covering the file, the incremental prefix, and two successive signatures both valid
- [x] 5.4 Implement `appearance.ts` (stamp text in Europe/Madrid, wrap and shrink, normalized rectangle → `/Rect` and rotation `/Matrix` from the crop box and `/Rotate`, one widget per page for "all", rectangle validation); verify tests for 0°, 90° and 270° pages, an offset crop box, different page sizes with "all", an invisible signature and each invalid rectangle

## 6. API feature `document`

- [x] 6.1 Add `input.ts` and `output.ts` (upload `z.file().max(20 MiB)`, sign appearance union, signatures filter by exactly one of document or certificate, `download` output `z.file()`); verify `check-types` passes
- [x] 6.2 Implement `upload`, `list`, `get` and `download` (PDF and encryption checks, name sanitizing, sealed objects, put-then-transaction with best-effort cleanup, owner filters, aggregates, versioned file names); verify handler tests for each, including encrypted and non-PDF rejections, ciphertext-only objects, cleanup after a failed transaction, `NOT_FOUND` for another user and a byte-exact original download
- [x] 6.3 Implement `sign` (base version conflict, owned active non-expired certificate, password resolution, PAdES, new version and record in one transaction, unique-violation → `CONFLICT`, client IP); verify handler tests for the happy paths with remembered and typed passwords, every error branch writing nothing, and the record's fields and hashes
- [x] 6.4 Implement `delete` (shred data key, soft delete, best-effort object removal) and `signatures` (by document or certificate, including soft-deleted names); verify handler tests for both, including records still naming deleted documents and certificates
- [x] 6.5 Add `router.ts` with the methods and statuses of design.md Decision 6 (English OpenAPI texts, `tags: ["Documents"]`) and wire `document: documentRouter`; verify `check-types`, Biome, and an in-memory OpenAPI generation showing the multipart upload and the binary download

## 7. Frontend

- [x] 7.1 Add `pdfjs-dist` to the frontend and check the worker setup works under Astro/Vite (`?url` worker import); verify `bun run --filter frontend check-types` and `astro build` succeed
- [x] 7.2 Register the `documents` surface (nav and search) and the dynamic `document-detail` surface in `lib/app-surfaces.ts` with icons in `lib/icon-registry.ts`, plus `pages/documents/index.astro` (`Layout.astro`) and `pages/documents/[id].astro` (`Detail.astro`); verify `check-types` passes
- [x] 7.3 Build `features/documents/overview` (list with `EntityList`, upload dialog with inline API error and client size pre-check, download and delete-with-confirmation); verify `check-types`, Biome and `tailwind:check` pass
- [x] 7.4 Build `features/documents/detail`: lazy `PdfViewer` from `document.download`, versions with downloads, and the signature history; verify `check-types`, Biome and `tailwind:check` pass
- [x] 7.5 Add the "Firmar" panel and the placement overlay (certificate select excluding expired ones with a link to `/certificates` when none, visible/invisible, this page/every page, drag rectangle stored as fractions, password only when not remembered, reason and location, inline error keeping choices, invalidation on success); verify `check-types`, Biome and `tailwind:check` pass
- [x] 7.6 Add the "Ver firmas" action and sheet to the certificates page using `document.signatures({ certificateId })`; verify `check-types`, Biome and `tailwind:check` pass

## 8. Documentation and final validation

- [x] 8.1 Update the `stack` skill: `references/env.md` (S3 variables, bundled vs external store, `COMPOSE_PROFILES`), `references/docker.md` and `references/commands.md` (MinIO services, `minio:start`/`minio:stop`, loopback console), `references/workspaces.md` if the routing map mentions ports, and `references/api/layering.md` (object storage helper, per-route body limit for uploads); update `AGENTS.md`/README only where they state the single-published-port rule; verify every path cited exists
- [x] 8.2 Run `bun run check-types`, `bunx biome check` on the changed paths (never `bun run check` over the whole repo, which rewrites the user's migration snapshots), and `bun run test`, and report the results as they are; ask the user to try an upload, a visible signature on one and on all pages, and to open the result in Adobe or AutoFirma, rather than probing the running app
