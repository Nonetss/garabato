## MODIFIED Requirements

### Requirement: Internal services are never exposed

In `compose.prod.yml` the gateway SHALL be the only service with `ports`; the frontend, backend and Loki SHALL use `expose` only, and the `db` service and the bundled MinIO SHALL publish no port, neither its S3 API (`9000`) nor its console (`9001`), not even on the host's loopback. Nothing outside the Docker network SHALL reach the backend, the frontend, Postgres, Loki or MinIO except through the gateway's HTTP site; documents are stored and served only through the backend, and MinIO is administered with `mc` inside its container.

#### Scenario: Published ports in production

- **WHEN** `compose.prod.yml` is inspected
- **THEN** only the `gateway` service SHALL declare `ports`, mapping the public port to the gateway's HTTP site, and no service SHALL publish `3000`, `4321`, `5432`, `3100`, `9000` or `9001`

#### Scenario: Backend from the host in production

- **WHEN** the production stack runs and a client outside the Docker network connects to the backend's port `3000`
- **THEN** the connection SHALL fail, because that port is not published

#### Scenario: MinIO console from the host

- **WHEN** the production stack runs with the bundled MinIO and a client on the host itself connects to `127.0.0.1:9001`
- **THEN** the connection SHALL fail, because MinIO publishes no port
