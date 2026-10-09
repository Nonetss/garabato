## MODIFIED Requirements

### Requirement: Signed documents cannot be rewritten

Editing pages and merging SHALL refuse any document that has signature records on a live version in the platform or whose current version embeds a signature field holding a signature, with a conflict error whose Spanish message explains that rewriting the document would invalidate its signatures. Signature records whose version has been deleted SHALL NOT count. For a merge, the message SHALL name the first signed document.

#### Scenario: Edit a signed document

- **WHEN** the owner tries to edit the pages of a document they signed
- **THEN** the system SHALL reject the request with a conflict error and SHALL store nothing

#### Scenario: Merge an externally signed upload

- **WHEN** a merge includes a document uploaded with a signature made elsewhere
- **THEN** the system SHALL reject the request with a conflict error naming that document and SHALL store nothing

#### Scenario: Signature undone by deleting its version

- **WHEN** the owner signed a document, deleted the signed version, and the current version embeds no signature
- **THEN** editing its pages SHALL be allowed and "Editar páginas" SHALL be enabled
