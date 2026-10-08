## MODIFIED Requirements

### Requirement: Internal services are never exposed

In `compose.prod.yml` the gateway SHALL be the only service with `ports` on a public interface; the frontend, backend and Loki SHALL use `expose` only, the `db` service SHALL publish no port, and the bundled MinIO SHALL never publish its S3 API (`9000`) and SHALL publish its console only on the host's loopback interface (`127.0.0.1:9001`). Nothing outside the host SHALL reach the backend, the frontend, Postgres, Loki or MinIO except through the gateway's HTTP site; documents are stored and served only through the backend.

#### Scenario: Published ports in production

- **WHEN** `compose.prod.yml` is inspected
- **THEN** only the `gateway` service SHALL declare `ports` on a public interface, mapping the public port to the gateway's HTTP site, no service SHALL publish `3000`, `4321`, `5432`, `3100` or `9000`, and MinIO's console SHALL be bound to `127.0.0.1:9001` only

#### Scenario: Backend from the host in production

- **WHEN** the production stack runs and a client outside the Docker network connects to the backend's port `3000`
- **THEN** the connection SHALL fail, because that port is not published

#### Scenario: MinIO console from another machine

- **WHEN** the production stack runs with the bundled MinIO and a client on another machine connects to the host's port `9001`
- **THEN** the connection SHALL fail, because the console listens on the loopback interface only
