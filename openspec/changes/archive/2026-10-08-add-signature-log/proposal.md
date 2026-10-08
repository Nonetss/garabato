## Why

Every signature already leaves a record (document, version, certificate, time, hashes, IP…), but it can only be read piecemeal: per document on `/documents/[id]` and per certificate in the "Ver firmas" sheet of `/certificates`. There is no single place to answer "what have I signed, when and with which certificate", nor to see the full evidence of one signature (hashes, NIF, issuer, serial number, fingerprint of the certificate).

## What Changes

- New "Firmas" section at `/signatures`, in the navbar next to Documentos and Certificados: the caller's signature log across every document and certificate, newest first, with infinite scroll and the total count.
- Filters: by certificate (including deleted certificates the caller has signed with), free text over the document name, and a date range (from / to, whole days).
- Each row opens a detail sheet with everything the record holds: document and version (linked when the document still exists), signing time, visible/invisible and pages, reason and location, SHA-256 before and after, client IP, and the certificate's alias, holder, NIF, issuer, serial number, SHA-256 fingerprint and validity, marking deleted documents and certificates.
- Two new read procedures on the `document` API feature: a paginated, filtered signature log and the list of certificates that appear in it. The existing `document.signatures` procedure and the per-document and per-certificate histories stay as they are.
- No schema change and no migration: the data is already in `document_signatures`, `document_documents` and `certificate_certificates`.
- Not in scope: CSV export, linking the `/certificates` sheet to the new section, filtering by visible/invisible.

## Capabilities

### New Capabilities

- `signature-log`: the caller's cross-document signature log — the paginated, filtered API listing, the certificate options for its filter, and the `/signatures` page with its filters and the per-record detail.

### Modified Capabilities

- `list-filter-experience`: the scroll-to-top requirement names the pages that opt in; the signatures page joins them.

## Impact

- `packages/api/src/v1/document/` (`input.ts`, `output.ts`, `handler.ts`, `router.ts`): two new procedures, reusing the existing signature join and record mapping; tests in `packages/api/tests/v1/document/`.
- `apps/frontend/src/features/signatures/` (new feature with an `overview` slice), `apps/frontend/src/pages/signatures/index.astro`, a `signatures` surface in `apps/frontend/src/lib/app-surfaces.ts` and a navigation icon in `apps/frontend/src/lib/icon-registry.ts`; tests in `apps/frontend/tests/features/signatures/`.
- `PRODUCT.md` (capability list) and `.agents/skills/stack/references/workspaces.md` only if they enumerate frontend features or pages.
- No new dependencies, no database or migration changes.
