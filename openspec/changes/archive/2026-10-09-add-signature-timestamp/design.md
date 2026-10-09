## Context

See `proposal.md` for the motivation. The relevant current state:

- `packages/api/src/v1/document/pades/` signs in three steps: `addPlaceholder` (`@cantoo/pdf-lib`, incremental update, a fixed 16 KiB `/Contents`), `@signpdf/signpdf` filling the byte range, and `PadesSigner` (`pkijs`) building a detached CAdES `SignedData` with content-type, message-digest and signing-certificate-v2 signed attributes and no unsigned attributes.
- `documentHandler.sign` reads the current version, signs, seals the bytes, `putObject`s them and then inserts the version and the `document_signatures` row in one transaction (`storeThenCommit`).
- The stamp's "Fecha:" line is drawn in the placeholder, before the CMS exists, from the server's `signingTime`.
- Unit tests are hermetic (`references/testing.md`): no network, the object store and the database are fakes installed in `packages/api/tests/setup.ts`.
- Migrations are the user's job: this design proposes the schema, the user generates and applies the migration.

## Goals / Non-Goals

**Goals:**
- PAdES B-T signatures that standard validators (Adobe, `pdfsig`, the EU DSS demo) recognize, when a TSA is configured.
- A configured TSA is a promise: a signature either carries a checked timestamp or is not stored.
- Zero change in behavior when `TSA_URL` is unset.
- The timestamp client is testable without network.

**Non-Goals:**
- B-LT / B-LTA (embedding OCSP/CRL responses in a DSS, archive timestamps).
- Checking the TSA certificate's revocation or its trust chain at signing time; validation is the `add-signature-validation` change.
- Authenticated TSAs (HTTP basic auth, client certificates) and per-request policy OIDs.
- Timestamping documents without signing them (document timestamps, `ETSI.RFC3161`).
- Re-timestamping existing B-B signatures.

## Decisions

### 1. Timestamp the signature value inside `PadesSigner`

PAdES B-T is B-B plus the CAdES `signature-time-stamp` attribute (`id-aa-signatureTimeStampToken`, `1.2.840.113549.1.9.16.2.14`) in the `SignerInfo`'s unsigned attributes, over the SHA-256 of the `SignerInfo.signature` octets.

- `PadesSigner` takes an optional `timestamp: (imprint: Uint8Array) => Promise<TimestampToken>`.
- After `signedData.sign(...)`, when it is set, the signer hashes `signerInfos[0].signature.valueBlock.valueHexView`, calls it, and adds the token's `ContentInfo` as the unsigned attribute before serializing.
- `signPdf` passes it through `SignPdfOptions` and returns the token's time and authority next to the bytes.

Alternative considered: a document timestamp (a second `/Sig` with SubFilter `ETSI.RFC3161`). That is what B-LTA layers on top, it doubles the incremental updates and is not what B-T means. Rejected.

### 2. A small RFC 3161 client: `#v1/document/pades/timestamp`

- `requestTimestamp(url, imprint, { fetch, timeoutMs })`:
  1. Builds a `pkijs.TimeStampReq` (version 1, SHA-256 `MessageImprint`, 8-byte random `nonce`, `certReq: true`).
  2. POSTs it with `Content-Type: application/timestamp-query`, aborting after 10 s.
  3. Parses the `TimeStampResp`.
  4. Checks the status is granted (0 or 1), and that the `TSTInfo`'s message imprint and nonce equal the request's.
  5. Verifies the token's `SignedData` signature with the certificate the token carries.
- It returns `{ token: ContentInfo, time: Date, authority: string }`. `authority` is the TSA certificate's subject CN, falling back to the `TSTInfo.tsa` name, then to the URL host.
- Failures throw a `TimestampError` with a `kind`: `unreachable`, `http`, `rejected` or `mismatch`. The handler maps `unreachable` to `errors.SERVICE_UNAVAILABLE` and the others to `errors.BAD_GATEWAY`, each with the Spanish message "No se pudo obtener el sello de tiempo de la autoridad configurada". The cause is kept, so the request log shows the TSA's answer.
- `fetch` is injected, defaulting to the global one, so tests pass a fake TSA. It keeps the module free of env reads; the handler reads `env.TSA_URL` and passes the bound function only when it is set.

Alternative considered: an npm RFC 3161 client. The ones available wrap `node-forge` or shell out to `openssl ts`. `pkijs` already has `TimeStampReq`/`TimeStampResp` and is what the signer uses. Rejected.

### 3. Placeholder size: 32 KiB, always

A token with the TSA's certificate chain adds roughly 4–8 KiB to the CMS; long signer chains already use a good part of the 16 KiB.

- `SIGNATURE_BYTES` becomes 32 KiB for every signature, B-B included. The cost is 32 KiB of zero padding per signature.
- One size keeps the placeholder independent of configuration and avoids a retry path.
- `@signpdf` already throws when the CMS does not fit. The handler maps that to `INTERNAL_SERVER_ERROR` and logs it, as today.

### 4. Record the TSA time and authority

`document_signatures` gains:
- `timestamped_at timestamp` (nullable): the `TSTInfo.genTime`.
- `timestamp_authority text` (nullable).

Both stay null for B-B signatures and for every existing row, so no backfill is needed. The API outputs (`sign`, `signatures`, `signatureLog`) add `timestampedAt: string | null` and `timestampAuthority: string | null`.

Alternative considered: re-parse the stored PDF to show the timestamp. Every list and log row would then need decrypting the version. Rejected.

### 5. The stamp keeps the server's time

The visible stamp is drawn before the CMS (and so before the token) exists, so its "Fecha:" line keeps the server time, which is seconds away from the TSA's. Embedding the TSA time in the stamp would need a second placeholder pass, and the authoritative time lives in the signature anyway. The UI labels the TSA time as "Sello de tiempo" and keeps "Firmado" for the claimed time.

### 6. Env: optional `TSA_URL`

- `packages/env/src/server.ts` adds `TSA_URL: z.url().optional()`.
- `.env.example` documents it under the Certificates section, commented out, with FreeTSA (`https://freetsa.org/tsr`) as the example and a note that a production TSA should be one the user trusts (FNMT, a qualified provider).
- `references/env.md` lists it.
- The compose files need nothing: they pass the root `.env` through.

## Risks / Trade-offs

- **[A public TSA is slow or down]** → Signing waits up to 10 s, then fails with a clear message. The user can unset `TSA_URL` to fall back to B-B deliberately.
- **[FreeTSA's root is not on the EU trusted list]** → Validators show the timestamp as valid but not qualified. Documented in `.env.example`; picking a qualified TSA is a deployment decision.
- **[Outbound request leaks metadata]** → The TSA only receives a SHA-256 of the signature value and a nonce, never the document or the signer's identity.
- **[The placeholder grows]** → +16 KiB per signature. Negligible next to the 20 MiB document limit.
- **[A token passes our checks but a validator rejects it]** → An integration check with `pdfsig` / the DSS demo is part of the tasks (manual, outside the hermetic suite), as it was for B-B.

## Migration Plan

1. The user generates and applies the migration adding the two nullable columns.
2. Deploy. Without `TSA_URL`, behavior is unchanged.
3. Set `TSA_URL` and restart the backend to enable B-T.

Rollback: unset `TSA_URL`. The columns can stay.

## Open Questions

- Which TSA should the production deployment use? FreeTSA works without registration; FNMT and the qualified providers need an agreement. This only affects `.env`, not code.
