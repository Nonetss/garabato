## Context

See `proposal.md` for the motivation. The relevant current state:

- `certificate-management` is in place. `packages/api/src/v1/certificate/` holds `pkcs12.ts` (forge unwrap plus `node:crypto` metadata) and `vault.ts` (envelope AES-256-GCM, AAD `certificate:<id>:<purpose>`, a version byte). The certificates table is `certificate_certificates`: the user's naming is `<module>_<table>`.
- A proof of concept (outside the repo) already signs under Bun:
  - `@cantoo/pdf-lib` loaded with `forIncrementalUpdate` adds the signature field and stamp as an incremental update.
  - `@signpdf/signpdf` fills the byte range.
  - A ~100-line `PadesSigner` built on `pkijs` produces `ETSI.CAdES.detached` with signing-certificate-v2.
  - `pdfsig` validated invisible, one-page, all-pages and double signatures.

  It did not handle page rotation or crop-box offsets.
- The repo has no object storage. Bun ships an S3 client (`Bun.S3Client`: `write`, `file().arrayBuffer()`, `delete`, `exists`) but it cannot create buckets.
- `/rpc` and `/api` reject bodies over 1 MiB through oRPC's `RequestLimitHandlerPlugin`, whose limit is one number per handler. The code comment there already expects an upload feature to raise it on purpose.
- Migrations are the user's job: this design proposes the schema, the user generates and applies the migration.

## Goals / Non-Goals

**Goals:**
- The object store never sees plaintext, and the database never points at an object that was not written.
- One storage abstraction in the API, the same whether MinIO is bundled or the store is external.
- Signing never breaks a signature already in the document, and two concurrent signatures can never fork a document's history.
- The visible stamp lands where the user drew it on any page geometry: rotation, crop box, different page sizes.

**Non-Goals:**
- Validating signatures, TSA timestamps, LTV.
- Streaming or resumable uploads: 20 MiB fits a single multipart request.
- Server-side PDF rendering or thumbnails: the browser renders with pdf.js.
- Presigned URLs: they would hand out ciphertext, useless to the browser, so every download goes through the API.
- Navbar search over documents.

## Decisions

### 1. Shared security modules

The `document` feature needs both the vault and the PKCS#12 reader, so they move to `packages/api/src/shared/`, as the layering rules require when a second feature uses a helper. Their tests move to `tests/shared/`.

**Vault (`#shared/vault`):**
- Takes a scope instead of hard-coding certificates: `seal(dataKey, scope, purpose, plaintext)`, where `scope` is `{ kind: "certificate" | "document"; id }`.
- The AAD stays `<kind>:<id>:<purpose>`, so every certificate already sealed opens unchanged. A test pins the exact AAD bytes for certificates.
- Documents use purposes `dek` and `v<number>`, so an object is bound to its document and version.
- `wrapDataKey` and `unwrapDataKey` take the same scope.

**PKCS#12 reader (`#shared/pkcs12`):**
- Keeps `readPkcs12` (metadata only).
- Gains `openSigningKey(bytes, password)`, which returns the metadata plus the private key as a WebCrypto `CryptoKey` (exported from the `KeyObject` as PKCS#8 and imported for `RSASSA-PKCS1-v1_5`/SHA-256 or `ECDSA`/SHA-256), the signer certificate DER and the chain DERs.
- Same `Pkcs12Error` kinds.

### 2. Object storage: `#shared/object-storage` over Bun's S3 client

- **API:** a module with `putObject(key, bytes)`, `getObject(key)` and `deleteObject(key)`, built on one `S3Client` from `env` (`S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).
- **Errors:** connection failures map to `errors.SERVICE_UNAVAILABLE`, and error answers from the store to `errors.BAD_GATEWAY`, both with a Spanish message. Handlers never touch `S3Client` directly.
- **Object keys:** `documents/<documentId>/v<number>`. Objects hold only `vault` sealed bytes.
- **Ordering:**
  1. Seal and `putObject`.
  2. Insert the rows in one database transaction.
  3. If the transaction fails, `deleteObject` best-effort and rethrow.

  A crash between steps 1 and 2 leaves at worst an orphan ciphertext object, never a row pointing at nothing.
- **Testing:** `tests/setup.ts` replaces `#shared/object-storage` with an in-memory fake (`tests/fixtures/object-storage.ts`), the same way it installs the fake database, so unit tests stay hermetic.

*Alternatives:* `@aws-sdk/client-s3` is heavy and duplicates what Bun ships. MinIO's own SDK would tie us to MinIO when external stores must work too.

### 3. Bundled or external store, chosen by deployment

**MinIO service:**
- Image `pgsty/silo:latest`, as the user asked. A pinned digest would be safer.
- Runs `server /data --console-address ":9001"`, with data in the named volume `minio_data`.
- Root credentials: `MINIO_ROOT_USER: ${S3_ACCESS_KEY_ID}` and `MINIO_ROOT_PASSWORD: ${S3_SECRET_ACCESS_KEY}`. There is one name per credential, so no `MINIO_ROOT_*` variables live in `.env`.

**Bucket creation:** Bun's client cannot create buckets, so a one-shot `minio-init` service runs:
- `mc alias set local http://minio:9000 …`
- `mc mb --ignore-existing local/$S3_BUCKET`

It uses the same image when it ships `mc`, otherwise the matching `mc` client image; this is checked during implementation and reported. External stores need the bucket created by the operator, as the docs say.

**Per compose file:**

| File | MinIO | `S3_ENDPOINT` | Ports |
|---|---|---|---|
| `compose.prod.yml` | `minio` and `minio-init` under `profiles: ["minio"]`. `bootstrap.sh` writes `COMPOSE_PROFILES=minio` for the bundled option, which compose reads from `.env` | From `.env` (`http://minio:9000` when bundled), not overridden, since it may be external | Console on `127.0.0.1:9001`, API unpublished |
| `compose.yml` | Always runs `minio` and `minio-init` | Overridden to `http://minio:9000` | Same as `compose.prod.yml` |
| `compose.dev.yml` | `minio` and `minio-init` always. `minio-native` and `minio-native-init` under the existing `native` profile, as `loki-native` does | Overridden to `http://minio:9000` for the dev backend | Dev stack MinIO private. `minio-native` on `127.0.0.1:9000/9001`, for `bun run dev:local` with `S3_ENDPOINT=http://localhost:9000` |

**Startup:**
- The backend does not `depends_on` MinIO in production files, so an external store works without the profile.
- In `compose.dev.yml` the backend waits for `minio-init` to complete, to avoid first-upload races in dev.
- MinIO's healthcheck uses its liveness endpoint, through whatever client the image ships (checked during implementation).

**Root scripts:** `minio:start` and `minio:stop` mirror `loki:start` and `loki:stop`.

### 4. Request body limit per route

- The oRPC `RequestLimitHandlerPlugin` limit rises to 21 MiB (`MAX_UPLOAD_BODY_BYTES`).
- A Hono middleware on `/rpc/*` and `/api/*` in `apps/backend` applies `hono/body-limit` at 1 MiB to every path except `/rpc/v1/document/upload` and `/api/v1/document/upload`. It answers `413` with the standard API error body.
- Every other procedure keeps today's protection.

*Alternative:* raising the global limit to 21 MiB is simpler but lets any procedure receive 21 MiB.

### 5. Schema (proposed; the user generates the migration)

New module `packages/db/src/schema/document/`, with tables named `<module>_<table>` like `certificate_certificates`:

**`document_documents`**

| Column | Notes |
|---|---|
| `id` uuid PK | Set by the handler, because the AAD needs it |
| `user_id` | FK `user`, cascade |
| `name` text | |
| `page_count` int | |
| `encrypted_data_key` bytea | Nullable after deletion |
| `deleted_at`, `created_at`, `updated_at` | |

Index on `user_id`.

**`document_versions`**

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `document_id` | FK, cascade |
| `number` int | |
| `object_key` text | |
| `size_bytes` int | |
| `sha256` text | |
| `created_by` | FK `user` |
| `created_at` | |

Unique index on `(document_id, number)`: the second guard against forked histories.

**`document_signatures`**

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `document_id` | FK, no cascade (documents are only soft-deleted) |
| `version_id` | FK to the version produced |
| `certificate_id` | FK `certificate_certificates` |
| `user_id` | FK `user`, cascade |
| `signed_at` | |
| `visible` bool | |
| `pages` int[] | 0-based, empty when invisible |
| `rect` jsonb | Nullable; normalized `{ x, y, width, height }` |
| `reason`, `location` | Nullable text |
| `sha256_before`, `sha256_after` | text |
| `ip_address` | Nullable text |

Indexes on `document_id`, `certificate_id` and `user_id`.

Counts in `document.list` (versions, signatures, last signature) come from aggregate subqueries rather than stored counters.

### 6. API: feature `document` under `src/v1/document/`

All procedures use `protectedProcedure` and filter by owner, then `assertFound`.

| Procedure | Method | Notes |
|---|---|---|
| `upload` | `POST` + `201` | `{ file: z.file().max(20 MiB) }`. Parses with `@cantoo/pdf-lib` (`PDFDocument.load`, without `ignoreEncryption`, so an encrypted PDF throws and becomes a Spanish `BAD_REQUEST`), records the page count, sanitizes the name (basename, no control characters, at most 200 characters, `.pdf` ensured), seals version 1 and stores it |
| `list` | `GET` | Summaries with the aggregates |
| `get` | `GET` | Document plus versions plus signature records |
| `download` | `GET` | `{ id, versionNumber? }`. Returns `z.file()`, a `File` named `<name>` or `<name sin .pdf> (v<n>).pdf`, `application/pdf`. oRPC sets `Content-Disposition`. The frontend gets it with a read `.call()` for pdf.js and saves it for downloads |
| `delete` | `DELETE` | Nulls `encrypted_data_key`, sets `deleted_at`, then `deleteObject` for each version best-effort, logging failures |
| `sign` | `POST` + `201` | Creates a version and a record every call |
| `signatures` | `GET` | `{ documentId } \| { certificateId }`, exactly one of them. Joins document name, version number and certificate alias and holder, including soft-deleted rows |

**`sign` input:**

```
{ documentId, baseVersionId, certificateId, password?,
  reason?, location?,
  appearance: { visible: false }
            | { visible: true, page, pages: "one" | "all",
                rect: { x, y, width, height } }   // fractions 0..1 of the displayed page
}
```

**`sign` flow:**
1. Load the owned document and its latest version. If `baseVersionId` differs, answer `CONFLICT`.
2. Load the owned, active certificate. Expired answers `CONFLICT`.
3. Resolve the password: use the input's, otherwise the remembered one, otherwise answer `BAD_REQUEST`.
4. `openSigningKey`.
5. Fetch and open the version.
6. Build the placeholder and sign (Decision 7).
7. Seal and put the object.
8. In a transaction, insert the version (`number + 1`) and the record, and touch the document's `updated_at`.

A unique violation on `(document_id, number)` is also answered with `CONFLICT`. The client IP is the first `X-Forwarded-For` entry from `context.headers`; Caddy replaces any client-sent value when no trusted proxies are configured.

### 7. PAdES module: `src/v1/document/pades/`

Ported from the proof of concept, typed to the repo's code style:

- **`placeholder.ts`:**
  - Loads with `forIncrementalUpdate` and takes a snapshot.
  - Registers the signature dictionary (`ETSI.CAdES.detached`, `/M`, `/Name`, `/Reason`, `/Location`, a 16 KiB `/Contents`) as a `PDFInvalidObject`, so it is never compressed.
  - Creates one field: invisible (one zero-rect widget), or one widget per page sharing an appearance stream.
  - Marks the touched objects and returns `previous bytes ‖ saveIncremental()`.
- **`signer.ts`:** the `PadesSigner` (`@signpdf/utils` `Signer`), with signed attributes contentType, messageDigest and signing-certificate-v2, signed through WebCrypto. RSA and EC.
- **`appearance.ts`:** stamp text and layout (wrap and shrink to fit, Helvetica WinAnsi, Europe/Madrid date). It also places the stamp on the page geometry:
  - The user's rectangle is in fractions of the page as displayed, which is what pdf.js shows.
  - For each target page, take its crop box (falling back to the media box) and `/Rotate`.
  - Map the displayed rectangle to unrotated user space for the widget `/Rect`.
  - Give the appearance XObject a `/Matrix` that rotates by the page rotation, so its text reads upright as displayed.
  - "All pages" applies the same fractions to each page's own box, so different page sizes work.
  - A rectangle outside `[0,1]`, with no area or on a missing page is a `BAD_REQUEST`.

`@signpdf/signpdf` only fills the byte range. Its `P12Signer` is not used, because it is RSA-only and not PAdES.

### 8. Frontend: `features/documents` with `overview` and `detail` slices

- **Routes:**
  - `/documents`: `Layout.astro`; registered surface with nav and search.
  - `/documents/[id]`: `Detail.astro`, back to Documentos; a dynamic surface with no search source.
- **Overview:**
  - List through `EntityList` (name, pages, size, signatures, last signed, status "Sin firmar"/"Firmado").
  - Upload dialog with a `.pdf` `Input type="file"` and an inline API error; the size is pre-checked client-side.
  - Download and delete actions.
- **Detail:**
  - A `PdfViewer` renders pages lazily with `pdfjs-dist` (worker through Vite's `?url` import) from the bytes of `document.download`.
  - The "Firmar" panel follows the `document-signing` spec.
  - In placement mode the user drags a rectangle over a page. The overlay records it as fractions of the rendered page box, which is already in displayed orientation, so it matches Decision 7 without any coordinate math in the browser.
  - The versions list with download links, and the signature history.
  - After signing, the `get` and `download` queries are invalidated.
- **Certificates page:** each row gains a "Ver firmas" action that opens a `Sheet` listing `document.signatures({ certificateId })`, linking to documents that still exist. It calls the API directly and imports nothing from `features/documents`.
- **Reuse:** search `components/ui` and `components/shared` first. `Sheet`, `EntityList`, `FormDialog`, `ConfirmDialog`, `Select` and the mutation hooks exist; only the PDF viewer and the placement overlay are new, and both stay in the `detail` slice.

### 9. Tests

- **Moved modules:** vault and pkcs12 tests move to `tests/shared/`, plus a test pinning the certificate AAD.
- **`tests/v1/document/pades.test.ts`:** signs generated fixture PDFs with the certificate fixtures and checks:
  - the CMS with `pkijs` (signature valid, `ETSI.CAdES.detached`, signing-certificate-v2 present, byte range covering the whole file);
  - the incremental prefix;
  - a second signature keeping the first valid;
  - one widget per page for "all";
  - the `/Rect` and `/Matrix` for 0°, 90° and 270° pages and a page with an offset crop box;
  - EC and RSA.
- **`tests/v1/document/handler.test.ts`:** every procedure with the fake database and the fake object store: ownership, encrypted objects, upload rejections (non-PDF, encrypted, empty), the `baseVersionId` conflict, unique-violation mapping, password resolution, expired certificate, records written, delete shredding and best-effort object removal.
- **Fixtures:** test PDFs (plain, rotated 90°, offset crop box, encrypted) generated by a script beside the existing certificate fixtures, with `@cantoo/pdf-lib`, or with `qpdf` for the encrypted one.
- **`apps/backend`:** has no unit suite. The per-route body limit is checked with `check-types` and by reasoning; the user is asked to try a large upload.

## Risks / Trade-offs

- [`pgsty/silo:latest` is unpinned and its contents (`mc`, healthcheck client) are unknown until pulled] → Implementation checks the image and reports. If `mc` is missing, `minio-init` uses the separate client image. Recommend pinning a digest.
- [The bundled MinIO uses root credentials for the backend] → Acceptable for a single-tenant deployment. The docs note that a dedicated access key with a bucket policy is better for external stores.
- [The 20 MiB body is fully buffered in memory per upload and signature] → Bounded by the limit. Concurrent uploads multiply it, which is acceptable at this scale.
- [Signing runs synchronously in the request (key decryption, PDF parse, CMS)] → Measured at tens of milliseconds in the proof of concept for small PDFs. Large PDFs are bounded by 20 MiB.
- [An orphan ciphertext object can remain after a crash between put and commit] → Harmless (ciphertext, data key kept) and rare. A cleanup cron is possible later.
- [`@cantoo/pdf-lib` may fail to parse some malformed PDFs that viewers tolerate] → Those uploads are rejected with a clear message rather than signed badly.
- [Appearance for rotated pages is the least proven part] → Covered by `/Rect`/`/Matrix` unit tests. The user is asked to open a signed rotated PDF in Adobe or AutoFirma.

## Migration Plan

1. The user generates and applies the migration for the `document` module.
2. Add the `S3_*` variables to every `.env`. For an existing dev `.env`, set them by hand to the native MinIO defaults from `.env.example`; existing deployments choose bundled (`COMPOSE_PROFILES=minio` plus `S3_ENDPOINT=http://minio:9000`) or external.
3. Start MinIO: `bun run minio:start` for native dev, or simply `bun run dev`.
4. Deploy backend and frontend together.

Rollback: revert the code. The new tables and the bucket are independent.
