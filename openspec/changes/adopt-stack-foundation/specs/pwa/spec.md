## ADDED Requirements

### Requirement: Web app manifest

The frontend SHALL ship `apps/frontend/public/manifest.webmanifest` declaring `name` and `short_name` "Better", `description` "Better", `start_url` `/`, `scope` `/`, `display` `standalone`, `background_color` and `theme_color` `#262624`, `lang` `es`, and these icons: `/pwa/icon-192.png` (192x192, PNG, purpose `any`), `/pwa/icon-512.png` (512x512, PNG, purpose `any`) and `/pwa/maskable-512.png` (512x512, PNG, purpose `maskable`). Every icon file the manifest references SHALL exist under `apps/frontend/public/pwa/` with the declared dimensions.

#### Scenario: Installing the app

- **WHEN** a supporting browser offers to install the site
- **THEN** it SHALL be installed as "Better", open at `/` in a standalone window and use the declared icons, the maskable one where the platform masks icons

### Requirement: Head tags in every layout

Both root layouts, `Layout.astro` and `Admin.astro`, SHALL emit in `<head>`: `<link rel="icon" href="/logo.svg" type="image/svg+xml">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (a 180x180 PNG in `public/`), `<link rel="manifest" href="/manifest.webmanifest">` and `<meta name="theme-color" content="#262624">`. `/logo.svg` SHALL be served by the API route `src/pages/logo.svg.ts` from `src/assets/logo.svg` with `Content-Type: image/svg+xml` and `Cache-Control: public, max-age=86400`.

#### Scenario: Admin pages are installable too

- **WHEN** a user opens any `/admin` page
- **THEN** its document SHALL reference the same manifest, icons and theme color as the rest of the app

### Requirement: Service worker registration

Both root layouts SHALL register `/sw.js` with an inline script that runs only when `navigator.serviceWorker` exists, and only after the window `load` event, so registration never delays the first render. Because the file is served from the site root, the worker's scope SHALL be the whole app (`/`).

#### Scenario: Browser without service worker support

- **WHEN** a page is loaded in a browser without `navigator.serviceWorker`
- **THEN** no registration SHALL be attempted and the page SHALL work normally

### Requirement: Network-first service worker

`apps/frontend/public/sw.js` SHALL be a minimal worker that makes the app installable and keeps a last-known copy of what it fetched for offline use, in a single versioned cache named `better-shell-v1`:

- On `install` it SHALL call `skipWaiting()`; on `activate` it SHALL delete every cache with another name and claim open clients.
- On `fetch` it SHALL ignore (leave to the browser) non-GET requests, cross-origin requests and requests whose path matches `/rpc/`, `/api/`, `/scalar` or `/openapi.json`, so API, auth and documentation responses are always fetched fresh and never cached.
- For every other request it SHALL go to the network first, store a copy of the response in the cache, and return it. Only when the network fails SHALL it answer from the cache; a navigation with no cached copy SHALL fall back to the cached `/`, and any other uncached request SHALL fail with a network error.

#### Scenario: Online navigation

- **WHEN** the network is available and the user navigates to `/crons`
- **THEN** the page SHALL come from the network and a copy SHALL be stored in `better-shell-v1`

#### Scenario: Offline navigation

- **WHEN** the network is unavailable and the user navigates to a page that was never cached
- **THEN** the worker SHALL respond with the cached `/` if present

#### Scenario: API calls are never cached

- **WHEN** the app calls `/rpc/v1/...` or `/api/auth/...`
- **THEN** the service worker SHALL NOT intercept the request and nothing SHALL be written to the cache

### Requirement: PWA assets are reachable without a session

The manifest, the service worker, the apple-touch icon and the `/pwa/*` icons SHALL be reachable without a session, because browsers fetch them without user interaction (and the manifest without credentials). These files live in `apps/frontend/public/` and SHALL be served before the Astro middleware runs: in production by the `@astrojs/node` standalone static handler, which serves files from the built client directory and only falls through to the SSR app (and therefore `src/middleware.ts`) when no file matches; in development by the Vite dev server, which serves `public/` before Astro's request handling. The middleware's `publicExactPaths` SHALL therefore list only `/logo.svg`, which is an SSR route and would otherwise be redirected to `/login`. Requests for public files SHALL NOT be logged as page views. The gateway SHALL route these paths to the frontend, since they do not match its backend paths (`/rpc/*`, `/api/*`, `/scalar*`, `/openapi.json`).

#### Scenario: Signed-out browser fetches the manifest

- **WHEN** a browser without a session requests `/manifest.webmanifest` or `/sw.js` through the gateway
- **THEN** the frontend SHALL return the file with status 200, not a redirect to `/login`

#### Scenario: Signed-out browser fetches the favicon

- **WHEN** a browser without a session requests `/logo.svg`
- **THEN** the middleware SHALL let it through as a public exact path and the SVG SHALL be returned
