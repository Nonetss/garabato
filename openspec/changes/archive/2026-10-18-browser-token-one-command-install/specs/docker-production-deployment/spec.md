## ADDED Requirements

### Requirement: Backend image ships the browser token module

The backend production image SHALL include the browser token module (`browser-certificate-token`) built for `x86_64-unknown-linux-gnu` and `aarch64-unknown-linux-gnu` in a dedicated Rust build stage of `apps/backend/Dockerfile`, against a glibc old enough to load on current desktop distributions. The runtime image SHALL hold the two files at `/app/native/pkcs11/dist/<arch>/libgarabato_pkcs11.so` (`x86_64` and `aarch64`), where the backend, running from `/app/apps/backend`, resolves them at `../../native/pkcs11/dist`. The Rust toolchain SHALL NOT be part of the runtime image.

#### Scenario: Both architectures in the image

- **WHEN** the backend production image is inspected
- **THEN** it SHALL contain `/app/native/pkcs11/dist/x86_64/libgarabato_pkcs11.so` and `/app/native/pkcs11/dist/aarch64/libgarabato_pkcs11.so`, and no Rust toolchain

#### Scenario: Source-only change

- **WHEN** the image is rebuilt after a change under `apps/backend/src` with no change under `native/pkcs11`
- **THEN** the module build stage SHALL be reused from cache
