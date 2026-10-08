## MODIFIED Requirements

### Requirement: Request body size limit

The `/rpc` and `/api` handlers SHALL reject a request whose body exceeds 1 MiB with HTTP `413` and the standard API error body, before any procedure runs. The document upload procedure (`v1.document.upload`, on both `/rpc` and `/api`) is the only exception: its requests SHALL be accepted up to 21 MiB, enough for a 20 MiB PDF plus the multipart envelope, and rejected with `413` above that.

#### Scenario: Oversized body

- **WHEN** a client sends a 2 MiB body to `/rpc/v1/comment/create`
- **THEN** the response SHALL be `413` and the procedure SHALL NOT run

#### Scenario: Normal body

- **WHEN** a client sends a body under 1 MiB to a procedure
- **THEN** the request SHALL be handled normally

#### Scenario: Document upload

- **WHEN** a client uploads a 15 MiB PDF to `/rpc/v1/document/upload`
- **THEN** the request SHALL reach the procedure

#### Scenario: Oversized document upload

- **WHEN** a client sends a 30 MiB body to `/rpc/v1/document/upload`
- **THEN** the response SHALL be `413` and the procedure SHALL NOT run
