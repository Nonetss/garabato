## Why

Garabato signs with PAdES B-B: the signing time is the one the server claims in the signature dictionary, so nothing proves when a document was signed, and the signature loses its evidential value once the certificate expires or is revoked. A timestamp from a trusted time-stamping authority (TSA) raises the signature to PAdES B-T, the baseline level courts and administrations expect, at little cost over the current signer.

## What Changes

- When `TSA_URL` is set, every new signature asks that RFC 3161 TSA for a timestamp over the signature value and embeds the token as the CMS signature-time-stamp attribute, producing a PAdES B-T signature. When it is unset, signing stays B-B exactly as today.
- If the TSA cannot be reached, answers an error or returns a token that does not match the request, the signature fails with a clear Spanish error and nothing is stored: a configured TSA never silently degrades to B-B.
- Each signature record keeps the time asserted by the TSA and the authority's name (both empty for B-B signatures).
- The document's signature history, the `/signatures` log and its detail panel show whether a signature carries a timestamp, with the authority's time and name.
- The signature placeholder grows so the token and the TSA's certificate chain fit.
- New optional env var `TSA_URL`, documented in `.env.example`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `document-signing`: the PAdES requirement adds the B-T level when a TSA is configured, a new requirement covers obtaining and checking the timestamp and its failures, signature records keep the TSA time and authority, and the document's signature history shows them.
- `signature-log`: log records carry the TSA time and authority, and the detail panel shows them.

## Impact

- **API** (`packages/api`): `src/v1/document/pades/` gains an RFC 3161 client and adds the token to `PadesSigner`'s unsigned attributes; `document.sign`, `signatures` and `signatureLog` return the new fields.
- **Database** (`packages/db`): two nullable columns on `document_signatures` (`timestamped_at`, `timestamp_authority`). The user generates and applies the migration.
- **Env** (`packages/env`, `.env.example`, stack `references/env.md`): optional `TSA_URL`.
- **Frontend**: signature history on the document page, the `/signatures` rows and the detail sheet.
- **Network**: the backend makes one outbound HTTP request per signature to the TSA when configured.
- No new dependencies: `pkijs` already implements the RFC 3161 structures.
