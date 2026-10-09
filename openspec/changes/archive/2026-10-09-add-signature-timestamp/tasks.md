## 1. Database schema (user generates and applies the migration)

- [x] 1.1 Confirm with the user before touching the schema, then add nullable `timestampedAt` (`timestamped_at`, timestamp) and `timestampAuthority` (`timestamp_authority`, text) to `documentSignatures` in `packages/db/src/schema/document/document.ts`; verify `bun run --filter @nonete/db check-types`
- [x] 1.2 Add both columns (default `null`) to `documentSignatureRow` in `packages/db/testing/rows.ts`; verify `check-types`
- [x] 1.3 Stop and ask the user to run `bun run db:generate` and apply the migration; do not continue with tasks that write or read the new columns until they confirm it exists

## 2. Env

- [x] 2.1 Add `TSA_URL: z.url().optional()` to `packages/env/src/server.ts` with a comment, and document it commented out in `.env.example` (Certificates section: what B-T adds, FreeTSA `https://freetsa.org/tsr` as an example, a note that production should use a trusted or qualified TSA)
- [x] 2.2 List `TSA_URL` in the stack skill's `references/env.md`; verify `check-types`

## 3. API: RFC 3161 client

- [x] 3.1 Add `packages/api/src/v1/document/pades/timestamp.ts` with `requestTimestamp(url, imprint, { fetch, timeoutMs })` building a `pkijs.TimeStampReq` (SHA-256 imprint, random 8-byte nonce, `certReq: true`), POSTing `application/timestamp-query` with a 10 s abort, parsing the `TimeStampResp`, and checking granted status, message imprint, nonce and the token's `SignedData` signature; return `{ token, time, authority }` and throw `TimestampError` with kinds `unreachable`, `http`, `rejected` and `mismatch`, keeping the cause
- [x] 3.2 Add a fake TSA to `packages/api/tests/fixtures/` that answers a `TimeStampReq` with a token signed by a generated test certificate, with switches for a rejected status, a wrong imprint, a wrong nonce, an HTTP error and a timeout
- [x] 3.3 Write `packages/api/tests/v1/document/timestamp.test.ts` covering the granted path (time and authority read from the token) and every `TimestampError` kind, then run `bun run test`

## 4. API: B-T signatures

- [x] 4.1 Give `PadesSigner` an optional `timestamp` callback. After `signedData.sign`, hash the `SignerInfo` signature value, call it, and add the token as the `id-aa-signatureTimeStampToken` unsigned attribute. Thread it through `SignPdfOptions`, and make `signPdf` return `{ bytes, pages, timestamp }` (`timestamp` null without a callback)
- [x] 4.2 Raise `SIGNATURE_BYTES` in `placeholder.ts` to 32 KiB and update its comment
- [x] 4.3 In `documentHandler.sign`, pass a bound `requestTimestamp` only when `env.TSA_URL` is set. Map `TimestampError` (`unreachable` → `SERVICE_UNAVAILABLE`, the rest → `BAD_GATEWAY`, the Spanish message from the design) before anything is stored, and insert `timestampedAt`/`timestampAuthority` in the signature row
- [x] 4.4 Add `timestampedAt` and `timestampAuthority` (nullable ISO string and string, with `.describe()`) to the record outputs of `sign`, `signatures` and `signatureLog` in `output.ts`, and map them in `toRecord` and the log query
- [x] 4.5 Extend `packages/api/tests/v1/document/pades.test.ts`: a B-T signature carries the unsigned attribute, its imprint matches the signature value, and a B-B signature has no unsigned attributes. Extend `handler.test.ts`: with the fake TSA the record stores the time and authority; with the TSA failing nothing is stored and the right error code is thrown; without `TSA_URL` no request is made. Then run `bun run test`
- [x] 4.6 Manually sign a test PDF against FreeTSA and check it with `pdfsig` (and, if available, the EU DSS demo) for a valid B-T signature; record the result in the task
  - Result (2026-10-09): `signPdf` with the `rsa` fixture and `https://freetsa.org/tsr` produced a 69,796-byte PDF; FreeTSA's token passed the client's checks (authority `www.freetsa.org`, genTime 06:53:27 UTC).
  - `pdfsig` was not installed, so the check used `openssl` and pyHanko 0.29.1 instead:
    - `openssl cms -verify` verified the CMS over the byte range, which covers the whole file;
    - `openssl ts -verify` against FreeTSA's CA certificate checked the token over the SHA-256 of the signature value: OK;
    - pyHanko (`sign validate --no-revocation-check`) reports the signature and the timestamp token cryptographically sound, the TSA trusted and the whole file covered. It judges the signature VALID once the self-signed test signer is added as a trust anchor.

## 5. Frontend

- [x] 5.1 Add `timestampedAt` and `timestampAuthority` to the frontend signature record types in `features/documents/shared/model/types.ts` and in the signature log's types
- [x] 5.2 Show "Sello de tiempo" with the TSA's time in the document page's `signature-history.tsx`, using the `Text` roles
- [x] 5.3 Show the timestamp in the `/signatures` detail sheet: "Sello de tiempo" with the time (with seconds) and the authority, or "Sin sello de tiempo". Add a compact marker on the log row if it fits the row definition
- [x] 5.4 Update the frontend tests touched by the new fields (record factories, any formatter added under `src/lib`), then run `bun run test`

## 6. Docs and validation

- [x] 6.1 Mention B-T and `TSA_URL` where `PRODUCT.md` and `README.md` describe signing
- [x] 6.2 Run `check-types`, Biome (`bun run check`), `bun run tailwind:check` and `bun run test`
