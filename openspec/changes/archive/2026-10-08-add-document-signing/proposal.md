## Why

Users can already keep their signing certificates in the platform (`certificate-management`), but they cannot do the one thing the product exists for: sign a PDF with them, the way AutoFirma does. The proof of concept validated every hard part under Bun (PAdES signatures with `ETSI.CAdES.detached`, a visible stamp on one or every page, incremental updates that keep earlier signatures valid), so the remaining work is turning it into a document library with storage, signing and an audit trail.

## What Changes

- **Document library**:
  - Signed-in users upload PDFs (at most 20 MiB, not password-protected) into a personal list of documents.
  - They can open, download and delete them.
  - Each document keeps its versions: the original upload and one new version per signature.
- **Signing**:
  - From a document's page the user picks one of their valid certificates and either an invisible signature or a visible one.
  - For a visible signature they draw its rectangle on a page and choose that page or every page.
  - They can add a reason and a location, and type the certificate password unless it is remembered.
  - The platform produces a PAdES baseline (B-B) signature, appended as an incremental update, so earlier signatures stay valid and the same document can be signed again.
  - The visible stamp follows Adobe's default layout: the signer's name large on the left, "Firmado por" and the date small on the right.
- **Signature records**:
  - Every signature is recorded: document, resulting version, certificate, signer, time, pages, position and visibility, the document hashes before and after signing, and the client IP when known.
  - The record is shown on the document page and, per certificate, on the certificates page.
  - Records survive the deletion of the document or the certificate.
- **Encrypted object storage**:
  - PDFs are stored in an S3-compatible object store, encrypted with the same envelope vault as certificates, under a data key per document. The bucket only ever holds ciphertext.
  - The store is either a bundled MinIO, run from the `pgsty/silo` image under a compose profile, or any external S3-compatible service configured through variables. Whoever deploys chooses.
- **Request body limit** (**BREAKING** for the documented 1 MiB rule): the document upload procedure accepts up to 20 MiB. Every other `/rpc` and `/api` procedure keeps the 1 MiB limit.
- **Ports**: the bundled MinIO console is published only on the host's loopback interface (`127.0.0.1:9001`). Its S3 API is never published in production-like compose files, and native dev gets a loopback-only MinIO the same way it gets Loki.
- **Out of scope**, for later changes:
  - Validating signatures of uploaded PDFs.
  - Timestamps from a TSA (B-T) and long-term validation (B-LT/B-LTA).
  - Multi-party signing flows and organization-owned documents.
  - Renaming documents.
  - A navbar search source for document records.

## Capabilities

### New Capabilities
- `document-management`: uploading PDFs into a per-user document library, versioning, encrypted object storage of every version, listing, downloading and deleting documents.
- `document-signing`: signing a document version with a stored certificate (visible or invisible, one page or all pages, reason and location), PAdES B-B as an incremental update, concurrency protection, the signature records and their history per document and per certificate.

### Modified Capabilities
- `http-server`: the 1 MiB request body limit gains an exception: the document upload accepts up to 20 MiB.
- `environment-configuration`: new S3 variables (`S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) are validated, documented and generated; compose files may override `S3_ENDPOINT` as a container address and pass the S3 credentials to the bundled MinIO; `bootstrap.sh` asks whether to use the bundled MinIO or an external store.
- `docker-dev-environment`: the dev stack runs a MinIO with a bucket bootstrap on its private network, and native dev gets a loopback-only `minio-native` with `minio:start`/`minio:stop` scripts.
- `docker-production-deployment`: `compose.prod.yml` gains an optional MinIO under the `minio` profile, `compose.yml` always runs one, and the "only the gateway publishes ports" rule allows the loopback-only MinIO console.
- `http-gateway`: "internal services are never exposed" now covers MinIO and allows only its loopback console binding.

## Impact

- **Database** (`packages/db`): new `document` schema module with documents, versions and signature records. The agent proposes it; the user generates and applies the migration.
- **API** (`packages/api`):
  - New `document` feature (upload, list, get, download, delete, sign, signature listing).
  - `vault.ts` and `pkcs12.ts` move from `src/v1/certificate/` to `src/shared/`, now that two features use them. The vault's data format and its AAD for certificates stay byte-for-byte compatible.
  - A small object-storage helper over Bun's built-in S3 client.
- **Dependencies**:
  - API: `@cantoo/pdf-lib`, `@signpdf/signpdf`, `@signpdf/utils`, `pkijs` and `asn1js`.
  - Frontend: `pdfjs-dist`, for rendering pages and placing the signature.
- **Backend** (`apps/backend`): the per-route request body limit.
- **Docker and scripts**:
  - `compose.yml`, `compose.prod.yml` and `compose.dev.yml` gain MinIO services and the bucket bootstrap.
  - Root scripts `minio:start` and `minio:stop`.
  - `setup-dev.sh` and `bootstrap.sh` handle the storage settings.
  - `.env.example` documents them.
- **Frontend** (`apps/frontend`):
  - New `features/documents` domain with the `/documents` and `/documents/[id]` routes.
  - The certificates page gains a per-certificate signature history.
- **Security**:
  - Documents are personal data, so the bucket holds only ciphertext and downloads go through the backend.
  - The bundled MinIO's root credentials are the backend's S3 credentials, so `S3_SECRET_ACCESS_KEY` becomes a critical secret.
  - The image tag `pgsty/silo:latest` is not pinned, as requested. A pinned digest would make deployments reproducible.
