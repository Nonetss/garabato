## REMOVED Requirements

### Requirement: Signatures page

**Reason**: The "Firmas" page at `/signatures` is replaced by the "Trazas" page at `/traces` (`activity-traces` capability), which lists signatures together with every other traced action on documents and certificates.

**Migration**: Open `/traces`; `/signatures` answers 404. Signature rows on the traces page show the same document, certificate, date, version and placement data, and the page hero counts the matching traces.

### Requirement: Signatures page filters

**Reason**: The filters move to the traces page, which adds an event type filter and matches its text against the document name or the certificate alias.

**Migration**: Use the "Trazas" page filters (`activity-traces`, "Traces page filters"); filtering by the type "Documento firmado" reproduces the old page.

### Requirement: Signature detail

**Reason**: The signature detail panel moves unchanged to the traces page, where it opens for "Documento firmado" rows.

**Migration**: Choose a signature row on `/traces` (`activity-traces`, "Trace detail").
