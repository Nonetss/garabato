## Why

Users upload PDFs that others already signed (contracts, certificates from an administration) and sign them again, but garabato cannot tell them whether those signatures are valid. It only knows the signatures it made itself, so an externally signed upload even shows "Sin firmar". A signing app has to answer "is this signature valid, who made it, and was the document changed afterwards?" for every signature in the file.

## What Changes

- New read-only procedure that checks every signature embedded in one version of a document (the current one by default), whoever made it. For each signature it reports:
  - the signer (holder, tax identifier, issuer, serial and validity);
  - the claimed signing time and, when present, the timestamp's time and authority;
  - the signature type and PAdES level;
  - integrity (the signed bytes match the digest), cryptographic validity (the CMS signature verifies);
  - coverage (the whole document, or a revision followed only by other signatures or by other changes);
  - whether the certificate was within its validity at signing time;
  - whether its chain reaches a trusted root.
- An overall verdict per signature: "Válida", "Válida, emisor no reconocido", "No válida" or "No comprobable", with the reasons.
- Trust anchors: the Mozilla root store shipped with the runtime plus a small bundled set of Spanish roots (FNMT-RCM, DNIe) that issue personal signing certificates.
- The document page gets a "Validez de las firmas" section that checks the current version and lists each signature with its verdict and details, in Spanish.
- Revocation (OCSP/CRL) is not checked. The page says so explicitly instead of implying it.

## Capabilities

### New Capabilities

- `signature-validation`: extracting and checking the signatures embedded in a document version (integrity, CMS signature, coverage, certificate validity at signing time, chain to a trusted root, timestamp), the verdicts, the trust anchors, and the section on the document page that shows them.

### Modified Capabilities

_None._ The existing signing, records and history requirements are unchanged; validation reads the stored PDF and adds no state.

## Impact

- **API** (`packages/api`): a new `src/v1/document/validation/` module (extraction, verification, trust store, bundled root PEMs) and a `document.verifySignatures` `GET` procedure. The signature parser already used by the tests (`tests/fixtures/pdf-signatures.ts`) moves into it, and the tests reuse it.
- **Frontend**: a new section on `/documents/[id]` with its query hook and status presentation.
- **Database**: none, and no migration.
- **Dependencies**: none new (`pkijs`, `asn1js`, `@cantoo/pdf-lib` and `node:tls` root certificates are already available).
- **Performance**: each check decrypts and hashes the version (up to 20 MiB) on request. Results are not stored.
