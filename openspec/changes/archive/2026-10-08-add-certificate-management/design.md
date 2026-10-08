## Context

See `proposal.md` for the motivation. The relevant current state:

- The repo has no file upload, no binary columns and no application-level encryption yet. The `/rpc` and `/api` handlers cap bodies at 1 MiB (`hardeningPlugins()`), far above a PKCS#12 file (5 to 20 KiB in practice).
- The activity log is Loki-backed request logging (`api_call` entries carry method, path and status, never bodies). It is not a domain audit trail. A signature history table comes with the signing change, not here.
- A standalone proof of concept (outside the repo) opened OpenSSL 3, legacy (`-legacy`, 3DES/RC2) and EC PKCS#12 files under Bun with `node-forge`, and showed that Bun's `node:crypto` `X509Certificate` returns the subject fields with UTF-8 intact (`toLegacyObject()`), the validity dates, the serial, the SHA-256 fingerprint, the key type and `checkPrivateKey()` for RSA and EC. It does not expose the X.509 Key Usage extension (`keyUsage` returns the *extended* key usage OIDs).
- Migrations are the user's job: this design proposes the schema, the user generates and applies the migration.

## Goals / Non-Goals

**Goals:**

- Key material is never readable from the database, the API or the logs without the server master key.
- The storage format survives the next changes unchanged: signing (which decrypts the file and needs the password), organization-owned certificates and a future move of the master key to a KMS.
- Users never see an "internal error" for something they did wrong with the file: every user-caused failure maps to a Spanish `BAD_REQUEST` or `CONFLICT` message.

**Non-Goals:**

- Checking the certificate chain or revocation (OCSP/CRL) on import. That belongs to signature validation.
- Smart cards, DNIe or any certificate the server cannot hold as a file.
- Master-key rotation tooling. The format leaves room for it (see Decision 3).
- Organization-owned certificates. `userId` ownership now; the organization change will add its own column and rules.

## Decisions

### 1. PKCS#12 reading: `node-forge` to unwrap, `node:crypto` to understand

`node-forge` is the only pure-JS library found that decrypts every PKCS#12 flavour seen in the wild, including the legacy `pbeWithSHAAnd3-KeyTripleDES-CBC` and RC2-40 bags of Windows and Firefox exports. It is used only to verify the MAC and decrypt the bags, yielding DER blobs: the PKCS#8 private key (`bag.key` re-encoded for RSA, `bag.asn1` for keys forge cannot model, like EC) and the certificates (`bag.cert` or `bag.asn1`).

Everything else uses `node:crypto` from Bun: `createPrivateKey({ format: "der", type: "pkcs8" })`, `new X509Certificate(der)`, `checkPrivateKey()` to pick the certificate that matches the key (the others are the chain, which is kept inside the encrypted file but not stored separately), `toLegacyObject().subject` for `CN`/`GN`/`SN`/`serialNumber`, `fingerprint256`, `serialNumber`, `validFromDate`/`validToDate` and `publicKey.asymmetricKeyType`. The Key Usage check reads extension `2.5.29.15` from the certificate DER with `forge.asn1`, a few lines in the same module.

Lives in `packages/api/src/v1/certificate/pkcs12.ts` and exports one function, roughly `readPkcs12(bytes, password) → { certificate metadata, keyAlgorithm }` that throws typed failures (`wrong-password`, `invalid-file`, `no-key`, `several-keys`, `no-matching-certificate`, `not-for-signing`). The handler maps them to `errors.BAD_REQUEST({ message })` in Spanish. forge reports a wrong password as a MAC failure ("PKCS#12 MAC could not be verified") or, for files without a MAC, as a failed shrouded-key decryption. Both map to `wrong-password`.

When the signing change needs the key, it moves this module to `src/shared/` and adds the function that returns a `CryptoKey`/`KeyObject`, as the layering rules say for a helper a second feature needs.

*Alternatives:*
- `pkijs`: supports PBES2 only, so legacy exports fail.
- `@peculiar/x509`: works but needs a `reflect-metadata` polyfill, which `node:crypto` makes unnecessary.
- OpenSSL CLI: a process per import, and the password would travel on a command line.

### 2. Envelope encryption with AES-256-GCM and record-bound AAD

- **Master key (KEK):** `CERTIFICATE_ENCRYPTION_KEY`, 32 random bytes in base64, validated by `@nonete/env/server`.
- **Data key (DEK):** each certificate gets its own random 32-byte DEK, stored wrapped: AES-256-GCM under the KEK.
- **Encrypted values:** the PKCS#12 bytes and the optional password, each sealed with AES-256-GCM under the DEK.
- **Additional authenticated data (AAD):** every seal uses `certificate:<id>:<purpose>`, where `<purpose>` is `dek`, `p12` or `password`. That makes a value fail to open in another row or another column. This is the "swapped ciphertext" scenario in the spec.
- **Stored layout:** `version (1 byte) ‖ iv (12 bytes) ‖ ciphertext ‖ tag (16 bytes)`, in `bytea` columns. The version byte names the KEK generation (always `1` now), so a future rotation or KMS migration can rewrap DEKs lazily without a schema change.

Because the AAD needs the record id before the insert, the handler generates the UUID itself (`crypto.randomUUID()`) instead of relying on the column default.

WebCrypto (`crypto.subtle`) is used rather than `node:crypto` ciphers: it is the same API the browser has, and AES-GCM with AAD is first-class there. The module is `packages/api/src/v1/certificate/vault.ts`, with `seal(purpose, id, plaintext)` / `open(purpose, id, sealed)` over a DEK and `wrapKey`/`unwrapKey` over the KEK.

*Alternatives:*
- Encrypting directly with the master key: rotation would mean re-encrypting every file, and there would be no per-record key to destroy.
- `pgcrypto`: keys would travel in SQL statements and could leak into Postgres logs.
- A KMS now: no infrastructure for it yet. The envelope keeps that door open: only `wrapKey`/`unwrapKey` change.

### 3. Deletion is crypto-shredding plus a soft delete

`delete` sets `encrypted_data_key`, `encrypted_p12` and `encrypted_password` to `NULL` and stamps `deleted_at` in one update. The metadata row stays, because the signing change will reference certificates from signature records. Every read filters `deleted_at IS NULL`. Uniqueness of `(user_id, fingerprint_sha256)` only applies to rows that are not deleted, so a deleted certificate can be imported again.

### 4. Schema (proposed; the user generates the migration)

New module `packages/db/src/schema/certificate/` (`certificate.ts` + `index.ts`), exported from `schema/index.ts`, following the `comments` table style:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Set by the handler (Decision 2) |
| `user_id` | `text` → `user.id`, `on delete cascade` | Owner |
| `alias` | `text` not null | 1 to 100 characters |
| `common_name` | `text` not null | Holder common name |
| `given_name`, `surname`, `tax_id` | `text` nullable | Holder given name, surname and NIF/NIE |
| `issuer_common_name` | `text` not null | |
| `serial_number` | `text` not null | Hex, as `X509Certificate` returns it |
| `fingerprint_sha256` | `text` not null | Lowercase hex without colons |
| `key_algorithm` | `text` enum `RSA` \| `EC`, not null | |
| `not_before`, `not_after` | `timestamp` not null | Certificate validity |
| `encrypted_data_key`, `encrypted_p12` | `bytea` nullable | `NULL` only after deletion |
| `encrypted_password` | `bytea` nullable | `NULL` when the password is not remembered |
| `deleted_at`, `created_at`, `updated_at` | `timestamp` | Same pattern as `comments` |

Indexes:
- `certificates_userId_idx` on `user_id`.
- Unique partial index `certificates_userId_fingerprint_active_idx` on `(user_id, fingerprint_sha256)` `WHERE deleted_at IS NULL`.

Use Drizzle's `bytea` column if the installed `drizzle-orm` 1.0 RC exports it; otherwise a small `customType<{ data: Uint8Array }>` in the schema module. `passwordRemembered` is derived (`encrypted_password IS NOT NULL`), not stored.

### 5. API: feature `certificate` under `src/v1/certificate/`

All procedures use `protectedProcedure` and filter by `userId = context.user.id` in the `where`, then `assertFound`. That gives the spec's 404 for other users' certificates without a separate check.

| Procedure | Method | Purpose |
|---|---|---|
| `list` | `GET` | The caller's certificates that are not deleted, newest first. Not paginated: a user holds a handful |
| `get` | `GET` | One certificate by `id` |
| `import` | `POST` + `201` | Multipart input `{ file, password, alias?, rememberPassword }` |
| `rename` | `PATCH` | `{ id, alias }` |
| `rememberPassword` | `PUT` | `{ id, password }`: decrypts the stored file, verifies the password with `readPkcs12`, seals it, replaces any previous one. Idempotent |
| `forgetPassword` | `DELETE` | `{ id }`: sets `encrypted_password` to `NULL` |
| `delete` | `DELETE` | `{ id }`: crypto-shredding plus soft delete, returns `{ id, success }` |

Details:
- **`import` input:** `file` is a zod 4 `z.file().max(100 * 1024)`. The MIME type is not checked: browsers send `application/x-pkcs12`, `application/octet-stream` or nothing for `.p12`, so the parse is the real check. oRPC's RPC link sends `File` values as multipart, and the OpenAPI document shows a binary field.
- **Import flow:**
  1. Parse the file.
  2. Reject an expired certificate (`not_after < now`).
  3. Check the active duplicate with a read.
  4. Insert the row.
  5. A unique-violation race on the partial index is caught and also mapped to `CONFLICT`.
- **Output shape:** one shared `certificateSummary` zod object: `id`, `alias`, metadata, ISO dates via `#shared/dates`, `passwordRemembered`, `status`. `status` is computed in the handler from `not_after` and the current time: `expired`, then `expiring` (≤ 30 days), else `valid`. The output schemas have no field that could carry key material, so the response validation enforces the "secrets never leave" requirement too.
- **Logs:** no handler logs the input. `loggingPlugin()` logs errors, not inputs, and `api_call` entries carry no body. A handler test checks that a wrong-password error message does not contain the password.

### 6. Frontend: `features/certificates` with one `overview` slice

- **Route:** `/certificates` (`pages/certificates/index.astro`, `Layout.astro`, `client:only="react"`), mirroring `crons`.
- **Navigation:** a `certificates` entry in `lib/app-surfaces.ts` with nav and search, a key icon from `lib/icon-registry.ts` and the Spanish label "Certificados".
- **Slice files:** `certificates-page.tsx` (provider boundary only) and `certificates-content.tsx` (list plus dialogs), with components for the import, rename and remember-password dialogs and the delete confirmation.
- **Reuse:** before writing each piece, search `components/ui`, `components/shared` (list rows, status tags, metadata grids, dialogs, empty states) and `src/hooks` (dialog/form state, oRPC mutation helpers).
- **Behaviour:**
  - The import dialog sends the `File` straight from the file input through `orpc.v1.certificate.import`. On success it invalidates the `list` query.
  - API errors show their Spanish `message` inside the dialog.
  - Status tags use the existing state-tag pattern and the `Text` roles.
  - Password fields are `type="password"` and are cleared when their dialog closes.

### 7. Tests and fixtures

- **Fixtures:** small test-only PKCS#12 files under `packages/api/tests/fixtures/certificates/`, made by a committed `generate.sh` (OpenSSL) from a throwaway test CA:
  - RSA, OpenSSL 3 default encryption.
  - RSA, `-legacy`.
  - EC P-256.
  - A certificate whose key usage is key encipherment only.
  - A file with two keys.
  - A non-PKCS#12 file.

  No real certificate is ever committed. Expiry and `expiring` are tested by pinning the clock (`setSystemTime`), not with extra fixtures.
- **Test files** (`packages/api/tests/v1/certificate/`):
  - `pkcs12.test.ts`: each fixture and each failure kind.
  - `vault.test.ts`: round-trip, wrong id or purpose fails, tampered byte fails, wrong KEK fails.
  - `handler.test.ts`: every procedure with the fake database (happy path, rows written with no plaintext, `BAD_REQUEST`/`CONFLICT`/`NOT_FOUND`, ownership).
- **Env placeholder:** `tests/setup.ts` gets a fixed `CERTIFICATE_ENCRYPTION_KEY` placeholder.
- **Row factory:** a `certificateRow` factory goes into `packages/db/testing/rows.ts`.

## Risks / Trade-offs

- [Master key loss makes every stored certificate unrecoverable] → Document in `.env.example` and the README that the key must be backed up with the database. `bootstrap.sh` prints a reminder when it generates the key.
- [Master key plus a database dump exposes remembered passwords and therefore usable signing keys] → Remembering is opt-in and per certificate, off by default. The KEK lives only in the environment, never in the database. The versioned format allows moving the KEK to a KMS later.
- [Crypto-shredding does not reach database backups taken before the deletion, which still hold the wrapped DEK] → Accepted for now, and said in the delete confirmation copy only as "se elimina de forma permanente". Real shredding across backups would need per-user KEKs held outside the database. Revisit with the KMS work.
- [forge's legacy PKCS#12 support is old and slow on large iteration counts] → Files are tiny and imports rare. The 100 KiB limit bounds the work. Bun's lack of native PKCS#12 support leaves no better option short of a native module.
- [`X509Certificate` subject parsing of unusual names (multi-valued RDNs, escaped commas)] → `toLegacyObject()` handles both. Fixtures cover accented characters. Unknown shapes fall back to the full subject string as the common name rather than failing the import.
- [Users upload someone else's certificate (gestoría use case) to a personal account] → Out of scope for this change. Ownership is per user, and organization-owned certificates come later.

## Migration Plan

1. Add the schema module. The user runs `db:generate` and reviews and applies the migration.
2. Add `CERTIFICATE_ENCRYPTION_KEY` to every environment before deploying the backend, since validation makes it required. Existing `.env` files need the value added by hand (`openssl rand -base64 32`), because `setup-dev.sh` preserves existing files.
3. Deploy backend and frontend together.

Rollback: revert the code. The new table is independent and can stay or be dropped by the user.
