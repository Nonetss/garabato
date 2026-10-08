## MODIFIED Requirements

### Requirement: Service worker registration

Both root layouts SHALL include `src/layouts/service-worker.astro`. In production builds (`import.meta.env.PROD`) it SHALL register `/sw.js` with an inline script that runs only when `navigator.serviceWorker` exists, and only after the window `load` event, so registration never delays the first render. Because the file is served from the site root, the worker's scope SHALL be the whole app (`/`). In development it SHALL NOT register the worker. Instead it SHALL unregister every service worker registered on the origin and delete the `stack-shell-v1` cache, because a worker intercepting Vite's hundreds of unbundled modules per page makes dev slow and can fail module loads.

#### Scenario: Browser without service worker support

- **WHEN** a page is loaded in a browser without `navigator.serviceWorker`
- **THEN** no registration SHALL be attempted and the page SHALL work normally

#### Scenario: Development removes a stale worker

- **WHEN** a developer opens the dev app in a browser that registered `/sw.js` on that origin earlier
- **THEN** the page SHALL unregister that worker and delete `stack-shell-v1`, and later loads SHALL fetch Vite's modules without passing through a service worker
