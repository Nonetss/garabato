## Why

If a vulnerability turns up in the browser token module or its installers, today the only lever is disconnecting browsers one by one from each user's certificates page. Vulnerable modules keep signing and the install command keeps handing them out. An administrator needs an emergency brake, from the web, that takes effect at once without editing files or restarting the server.

## What Changes

- Three **switches** an administrator sets from a new admin page, **Token del navegador** (`/admin/browser-token`), stored in the database and applied on the next request:
  - **Token enabled**: off refuses every token request (listing, unlocking, signing) and every install.
  - **Installs enabled**: off stops new installs (start connection, install script, module download, redeem) while installed modules keep working.
  - **Minimum module version**: modules older than it are refused until the browser is connected again, which installs the module Garabato currently serves.
- The **module reports its version and platform** in every request (`x-garabato-module: 0.2.0 linux-x86_64`). Modules installed before this change send nothing and count as `0.1.0`, so a minimum version can block them too. The module version becomes `0.2.0`.
- Refusals use their own status codes, so a module never mistakes them for a closed signing window: **503** while the token is off, **412** for an outdated module. The new module logs which one it got and shows an empty token; older modules already show an empty token on any error.
- Garabato **remembers each browser's last reported module version**, so the admin page shows how many connected browsers run each version, and the certificates page marks an outdated browser with "vuelve a conectarlo".
- Changing a switch is recorded in the activity log with the administrator who did it.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `browser-certificate-token`: new requirements for the switches, their admin page, module version reporting, and how the certificates page reflects them.

## Impact

- **Database (the user generates the migration):** new table `browser_token_settings` (one row: `token_enabled`, `installs_enabled`, `min_module_version`, `updated_at`, `updated_by`) in `packages/db/src/schema/`. A missing row means everything enabled with no minimum, so the app works before the first save. The browser's last module version lives in the existing `apikey.metadata` column: no column added there.
- `packages/api`: settings read/update procedures (admin), the checks in `tokenProcedure` and in the install procedures, version tracking on token requests.
- `native/pkcs11`: version header, handling of 503/412, version bump to 0.2.0.
- `apps/frontend`: the admin page and its surface in `app-surfaces.ts`; the certificates page shows disabled installs and outdated browsers.
- No new environment variable.
