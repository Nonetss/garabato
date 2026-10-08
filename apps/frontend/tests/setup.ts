import { mock } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

/**
 * Preloaded before every test file (`bunfig.toml`). Registers a happy-dom
 * window, served from the dev origin so `history`/`location` behave like the
 * app's, so hooks and components render with `@testing-library/react`, and
 * pins the timezone so date formatting doesn't depend on the machine (it is
 * already `bun test`'s default; this guards against a `TZ` from the shell).
 */
process.env.TZ = "UTC"
GlobalRegistrator.register({ url: "https://localhost:4321/" })

// Astro's virtual module only exists under Vite; components that navigate
// (`AppLink` through `@/lib/navigate`) get a no-op instead.
mock.module("astro:transitions/client", () => ({
  navigate: async () => {},
}))
