## 1. API: extraction

- [ ] 1.1 Add `packages/api/src/v1/document/validation/extract.ts`: load the PDF with `@cantoo/pdf-lib`, walk the AcroForm signature fields (including `Kids`) with a `/V` dictionary, read `/ByteRange`, raw `/Contents`, `/SubFilter`, `/M`, `/Reason`, `/Location`, `/Name` and `/T`, order by byte-range end, and compute revision ends from the `%%EOF` markers to classify each signature's coverage (`whole`, `followed_by_signatures`, `followed_by_changes`)
- [ ] 1.2 Write `packages/api/tests/v1/document/validation/extract.test.ts` with generated PDFs: no signatures, one, two (the first followed by signatures), and one followed by a non-signature incremental update; then run `bun run test`

## 2. API: checks, trust and verdicts

- [ ] 2.1 Add `validation/trust.ts`: lazily build anchors from `tls.rootCertificates` plus every `validation/roots/*.pem`, and expose `checkTrust(signer, embedded, checkDate)` over `pkijs.CertificateChainValidationEngine`, returning `{ passed, reason }` with the reached issuer when untrusted
- [ ] 2.2 Download `AC RAIZ FNMT-RCM` and `AC RAIZ DNIE 2` from the issuers' official pages into `validation/roots/` as PEM, noting the source URL in a comment line of each file
- [ ] 2.3 Add `validation/verify.ts` with `validateSignatures(bytes)` running per signature: byte-range shape, digest vs message-digest (SHA-256/384/512), `SignedData.verify` with `checkChain: false`, signer certificate data, timestamp token (imprint and signature, giving the check time and level B-T), validity at the check time and trust. Add a pure `verdictOf(checks)` returning `valid`, `valid_untrusted`, `invalid` or `indeterminate`, plus the `modifiedAfterSigning` warning. Every reason is in Spanish, and each signature is wrapped so one failure becomes `indeterminate`
- [ ] 2.4 Write `packages/api/tests/v1/document/validation/verify.test.ts` covering:
  - valid garabato signatures (RSA and EC);
  - a self-signed certificate → `valid_untrusted`;
  - a tampered byte → `invalid` on integrity;
  - an expired-at-signing certificate → `invalid` on validity;
  - an unsupported SubFilter → `indeterminate`;
  - a timestamped signature → B-T with the token time used as check time (use the fake TSA from `add-signature-timestamp` if present, otherwise a token built in the fixture);
  - `verdictOf`'s ordering;
  - the pinned SHA-256 fingerprints of the bundled roots.

  Then run `bun run test`
- [ ] 2.5 Replace `verifySignatures` in `packages/api/tests/fixtures/pdf-signatures.ts` with `validateSignatures` in `pades.test.ts` and `handler.test.ts`, keeping their assertions' intent; then run `bun run test`

## 3. API: procedure

- [ ] 3.1 Add `verifySignatures` input (`documentId`, optional `versionId`) and output (a list of signature reports plus `parseError`, with `.describe()` texts) to `src/v1/document/input.ts` and `output.ts`
- [ ] 3.2 Implement `documentHandler.verifySignatures`: owned document, version (current by default; not found when it is missing or belongs to another document), decrypt, `validateSignatures`. Wire a `GET` in `router.ts` (`tags: ["Documents"]`, English summary and description)
- [ ] 3.3 Extend `handler.test.ts`: signatures of the current version, of a named earlier version, an empty list, and not found for another user's document or a foreign version; then run `bun run test`

## 4. Frontend

- [ ] 4.1 Add the validation report types and a `useSignatureValidation(documentId, versionId)` hook in `features/documents/detail/hooks/` over `orpc.v1.document.verifySignatures.queryOptions`, keyed by version id
- [ ] 4.2 Add `features/documents/detail/components/signature-validation.tsx`: the "Validez de las firmas" section with a status tag per verdict ("Válida", "Válida, emisor no reconocido", "No válida", "No comprobable"), signer, time, "Sello de tiempo" line, coverage summary, the "modificado después de firmar" warning, an expandable checks list with certificate data and PAdES level, the always-visible revocation note, and the loading, error-with-retry and "Este documento no tiene firmas" states. Reuse the existing status-tag, `Text`, `Spinner` and collapsible patterns
- [ ] 4.3 Mount the section in `document-detail-content.tsx` near the signature history
- [ ] 4.4 Add unit tests for any presentation helper added (verdict → label/tone, coverage → summary) under `apps/frontend/tests/`, then run `bun run test`

## 5. Docs and validation

- [ ] 5.1 Describe signature validation in `PRODUCT.md` and `README.md`, and the section's pattern in `DESIGN.md` if it introduces a new visual element
- [ ] 5.2 Run `check-types`, Biome (`bun run check`), `bun run tailwind:check` and `bun run test`
