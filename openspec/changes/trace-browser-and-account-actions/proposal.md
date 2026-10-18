## Why

The traces show what a user did with certificates and documents, but nothing about how their account and their connected browsers are used. Who connected a browser, when it was unlocked, wrong TOTP codes, sign-ins and failed sign-ins, password and two-step changes: these are exactly the events a user needs to spot misuse of their identity, and today they leave no record.

## What Changes

- New trace types for the **browser token**: browser connected, disconnected, unlocked, locked; and two security failures: a TOTP code refused for a browser (wrong code or lockout) and an install command refused because it was used or expired.
- New trace types for the **account**: signed in (password or SSO, with the user agent), signed out, name changed, password changed, two-step verification on and off; and two security failures: a password sign-in refused for an existing account and a two-step code refused at sign-in.
- Refused actions stay untraced in general; only those security failures are recorded, and never with the password or the code.
- The traces page labels, icons and detail cover the new types; failures are marked like deletions.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `activity-traces`: two new recording requirements (browser token, account) and the traces page and detail for the new types.

## Impact

- `packages/db/src/schema/trace/trace.ts`: new values in `TRACE_TYPES` and new `TraceDetails` shapes (text and `jsonb` columns: **no migration**; it is a schema-folder edit that this request asks for).
- `packages/api`: traces written from the certificate-token procedures (`redeem`, `revokeKey`, `unlock`, `lock`) and the trail output for the new types.
- `packages/auth`: a Better Auth `hooks.after` middleware that records the account traces (sign-in, sign-out, user update, password change, two-factor enable/disable/verify), reusing the trace writer.
- `apps/frontend`: traces labels, icons, tone and detail rows.
