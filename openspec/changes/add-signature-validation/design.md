## Context

See `proposal.md` for the motivation. The relevant current state:

- Documents are stored encrypted. `documentHandler` already has `loadOwned`, `versionsOf`, `unwrapDocumentKey` and `readVersion` to get the plaintext of a version for its owner.
- `packages/api/tests/fixtures/pdf-signatures.ts` holds a test-only `verifySignatures`. It finds every `/ByteRange` with a regex over the latin1 text, verifies the CMS with `pkijs.SignedData.verify` and reports intactness and whole-file coverage. The PAdES tests and the handler tests use it.
- `add-signature-timestamp` adds signature timestamps (`id-aa-signatureTimeStampToken`) and an RFC 3161 token checker in `#v1/document/pades/timestamp`. Validation reads tokens with the same code. If this change lands first, it brings its own token parsing, which the timestamp change then reuses.
- Bun exposes `node:tls`'s `rootCertificates`: the Mozilla root store as PEM strings, 145 roots at the time of writing.
- No server-side PDF rendering. The frontend renders with pdf.js and talks to the API through `orpc.v1.*` query options.

## Goals / Non-Goals

**Goals:**
- An honest, explainable verdict per signature, with every check visible, for signatures made by garabato and by any other PAdES/PKCS#7 tool.
- Pure, hermetically testable verification code that the tests can use instead of their own regex parser.
- No new state and no migration.

**Non-Goals:**
- Revocation checking (OCSP, CRL) and LTV/DSS evaluation; they need network access at check time and are the natural next step.
- EU trusted list (LOTL/TSL) and "qualified" status.
- DocMDP/FieldMDP permission analysis (which later changes a certification signature allows).
- Validating PDFs that are not stored documents (an anonymous "drop a PDF to check it" tool).
- Storing results or showing verdicts in the library list.

## Decisions

### 1. Module layout: `#v1/document/validation/`

| File | Role |
|---|---|
| `extract.ts` | Find the signatures and their raw parts |
| `verify.ts` | Per-signature checks and verdicts |
| `trust.ts` | Trust store and chain building |
| `roots/*.pem` | Bundled Spanish roots |

- Everything is pure: it takes bytes (and, for trust, a check date) and returns plain data. No database, env or network.
- The handler method `verifySignatures` in `src/v1/document/handler.ts` only:
  1. loads the owned document and the version (current by default);
  2. decrypts it;
  3. calls `validateSignatures(bytes)`.
- The router declares a `GET` with `{ documentId, versionId? }`, `tags: ["Documents"]` and an English summary.

### 2. Extraction: structural, not regex

`@cantoo/pdf-lib` loads the document; extraction then walks the AcroForm fields (including `Kids`) whose `/FT` is `/Sig` and whose `/V` resolves to a dictionary. For each one it reads:
- `/ByteRange` (four numbers) and `/Contents` (the raw bytes of the hex string);
- `/SubFilter`, `/M`, `/Reason`, `/Location`, `/Name`;
- the field's `/T`.

Signatures are ordered by the end of their byte range, which is the order they were appended. The covered bytes are sliced from the original buffer, never from a re-serialized document.

A regex over the file also matches `/ByteRange` strings inside unrelated streams or objects. The AcroForm is what validators use.

Revision boundaries (for coverage) come from the `%%EOF` markers. A later revision is a "signature revision" when its end equals another signature's byte-range end. Any later revision that does not end at a signature is "other changes".

### 3. Checks with `pkijs`

**Integrity:**
- The byte range must be `[0, a, b, c]` with `b > a`, and must leave out exactly the `/Contents` hex string including its delimiters.
- The SHA-256 (or the digest algorithm the `SignerInfo` names: SHA-256/384/512) of the covered bytes must equal the message-digest signed attribute.
- `adbe.pkcs7.sha1` and `adbe.x509.rsa_sha1` are "No comprobable".

**Signature:**
- `SignedData.verify({ signer: 0, data, checkChain: false, extendedMode: true })`, so a cryptographic failure is separated from a chain failure.

**Signer certificate:**
- The certificate matched by the `SignerInfo`'s `sid` among the embedded certificates. Holder CN, `serialNumber` attribute (the Spanish NIF), issuer CN, serial and validity are read with the helpers `#shared/pkcs12` already uses for metadata.

**Timestamp:**
- If the unsigned attribute `1.2.840.113549.1.9.16.2.14` is present, the token is parsed. Its message imprint must match the hash of the `SignerInfo` signature value, and its own signature must verify.
- A valid token gives the "check time" and level B-T. An invalid token is reported as such, and the claimed time is used.

**Certificate validity:**
- `notBefore ≤ checkTime ≤ notAfter`.

### 4. Trust store

- `trust.ts` builds the anchors once, lazily: `tls.rootCertificates` plus every `roots/*.pem`, read with `import.meta.dir` and parsed into `pkijs.Certificate`.
- `pkijs.CertificateChainValidationEngine` runs with:
  - `trustedCerts`: the anchors;
  - `certs`: the embedded certificates;
  - `checkDate`: the check time.
- When the result is not trusted, the reason names the last certificate's issuer it could reach.
- Bundled roots for now: `AC RAIZ FNMT-RCM` and `AC RAIZ DNIE 2`, downloaded from the issuers' official pages, with their SHA-256 fingerprints pinned in a test so a swapped file fails CI.
- The Mozilla store is a TLS store, so its trust means "issuer recognized", not "qualified". The UI wording follows that ("emisor no reconocido", never "no cualificado").

Alternative considered: the EU LOTL. It is the only way to say "qualified", but it means fetching and verifying a signed XML list and its national lists periodically, plus storage. Left for a future change.

### 5. Verdict computation

The verdict is a pure function over the check results, in this order:
1. unsupported or unparseable → "No comprobable";
2. integrity, signature or validity failed → "No válida";
3. trust failed → "Válida, emisor no reconocido";
4. otherwise → "Válida".

Coverage never changes the verdict. "Other changes" after a signature adds a `modifiedAfterSigning` warning, so a valid signature on an earlier revision is not mislabeled invalid, but the user is told.

The response carries machine values (`valid`, `valid_untrusted`, `invalid`, `indeterminate`), plus per-check `{ passed, reason }` objects with Spanish reasons; the frontend maps the values to Spanish labels.

### 6. Frontend: a section on the document page

- `features/documents/detail` gets:
  - a `useSignatureValidation(documentId, versionId)` hook over `orpc.v1.document.verifySignatures.queryOptions`;
  - a `signature-validation.tsx` section.
- The query key includes the version id, so a new signature (new current version) triggers a fresh check, and the sign mutation's success needs no extra invalidation.
- Each signature is a row with a status tag (the existing status tag pattern and `Text` roles), signer, time, a "Sello de tiempo" line when present and a coverage summary. Expanding it shows the checks list and certificate data.
- The note "La revocación del certificado no se comprueba" is always visible.

### 7. Tests reuse the production verifier

- `tests/fixtures/pdf-signatures.ts` drops its `verifySignatures` in favor of `validateSignatures`; the PAdES tests assert on its result. `lastSignatureWidgets` stays as a fixture.
- New fixtures cover:
  - a self-signed signature;
  - a tampered byte;
  - an incremental update after signing;
  - an expired-at-signing certificate (generated with past validity);
  - an unsupported SubFilter, crafted by rewriting the dictionary.

## Risks / Trade-offs

- **[Revisions that only add a DSS or validation data]** (Adobe's LTV) are reported as "other changes". → Acceptable for a first version, and documented in the code. Classifying DSS-only revisions as benign is a contained follow-up.
- **[A malformed or hostile PDF makes parsing slow or throw]** → Extraction runs under the existing 20 MiB limit. Each signature is checked in its own `try` and becomes "No comprobable" on failure. A document that fails to parse at all answers an empty list plus a top-level `parseError` flag the UI shows.
- **[Mozilla roots trust some issuers for TLS only]** → The wording claims recognition, not qualification.
- **[`tls.rootCertificates` changes with Bun upgrades]** → Fine: it tracks Mozilla's store; the Spanish roots are pinned files.
- **[Hashing up to 20 MiB per request]** → Comparable to a download. React Query caches per version on the client, and versions are immutable.

## Open Questions

- Should the library card stop saying "Sin firmar" for uploads that carry external signatures? That needs counting embedded signatures at upload time and storing the count (a schema change). Proposed as a follow-up once this change shows the verdicts.
- Which other Spanish or EU roots are worth bundling (ACCV, Camerfirma, Izenpe)? Adding one is a file plus its pinned fingerprint.
