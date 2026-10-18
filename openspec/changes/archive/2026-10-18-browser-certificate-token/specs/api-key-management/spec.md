## MODIFIED Requirements

### Requirement: Session from API key

The system SHALL accept an API key supplied in the `x-api-key` header as a valid credential and resolve it to the owning user's session. This requires `enableSessionForAPIKeys` to be enabled on the plugin. A token key (`browser-certificate-token`) SHALL NOT resolve to a session: a request carrying one is treated as carrying no API key by every procedure except those of the browser certificate token.

#### Scenario: Request authenticated with an API key

- **WHEN** a request includes a valid `x-api-key` header and no session cookie
- **THEN** session resolution SHALL return the user that owns the API key

#### Scenario: Request with an invalid API key

- **WHEN** a request includes an `x-api-key` header that does not match any enabled key
- **THEN** session resolution SHALL NOT return a user

#### Scenario: Request authenticated with a token key

- **WHEN** a request includes a valid token key in the `x-api-key` header, no session cookie, and calls a procedure outside the browser certificate token, such as listing documents
- **THEN** session resolution SHALL NOT return a user and the procedure SHALL reject the request as `UNAUTHORIZED`
