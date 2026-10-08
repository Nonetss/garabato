import { fileURLToPath } from "node:url"
import node from "@astrojs/node"
import react from "@astrojs/react"
// @ts-check
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, envField, svgoOptimizer } from "astro/config"
import { config } from "dotenv"

// The repo is configured from the root `.env`. Vite loads it for `astro:env`
// through `vite.envDir`; this config runs before that, so it loads the file
// itself for the values it reads below. Already-set variables win.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url))
config({ path: `${repoRoot}/.env`, quiet: true })

// Where the backend is reached: SSR session lookups (`astro:env` below) and
// the dev server's proxy for /rpc, /api, /scalar and /openapi.json.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000"

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  experimental: {
    svgOptimizer: svgoOptimizer({
      multipass: true,
      plugins: [
        {
          name: "preset-default",
          params: {
            overrides: {
              inlineStyles: false,
            },
          },
        },
        "removeXMLNS",
      ],
    }),
  },
  prefetch: {
    // Without `prefetchAll`, `defaultStrategy` only applies to links that
    // opt in with `data-astro-prefetch` — and nothing in this app does, so
    // the strategy below was inert and every navigation paid full TTFB
    // (SSR render + the backend session round-trip in `src/middleware.ts`).
    // `hover` keeps it intent-driven, and `src/middleware.ts` already skips
    // page-view logging for requests tagged `Sec-Purpose: prefetch`.
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  devToolbar: {
    enabled: false,
  },
  env: {
    schema: {
      BACKEND_URL: envField.string({
        access: "secret",
        context: "server",
        default: "http://localhost:3000",
      }),
      // Loki push endpoint (e.g. http://loki:3100) for the activity-log
      // feature. Optional — page-view logging silently stays local-only
      // (console) without it.
      LOKI_URL: envField.string({
        access: "secret",
        context: "server",
        optional: true,
      }),
    },
  },

  vite: {
    envDir: repoRoot,
    optimizeDeps: {
      include: ["@base-ui/react/**"],
    },
    ssr: {
      // Runtime image ships no node_modules, so every dependency must be
      // bundled into dist/server, not just @nonete/* workspace packages.
      noExternal: process.argv.includes("dev") ? undefined : true,
    },
    server: {
      // The dev gateway proxies https://localhost:4321 to this port (the
      // `dev` script's --port 4320); never drift to another one silently.
      strictPort: true,
      // Transform at dev startup what the first visit would otherwise wait
      // for. A `client:only` island hydrates from the module its page
      // imported it from — the feature barrel — so warming the barrels
      // covers each island's whole client graph.
      warmup: {
        clientFiles: [
          "./src/features/**/index.ts",
          "./src/components/shared/layout/*.tsx",
          "./src/components/ui/sonner.tsx",
        ],
        ssrFiles: ["./src/pages/**/*.astro", "./src/middleware.ts"],
      },
      proxy: {
        "/rpc": {
          target: backendUrl,
          changeOrigin: true,
        },
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
        "/scalar": {
          target: backendUrl,
          changeOrigin: true,
        },
        "/openapi.json": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },

  integrations: [react()],
})
