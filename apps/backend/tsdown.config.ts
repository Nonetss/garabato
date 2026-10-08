import { defineConfig } from "tsdown"

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  // Deployable app, not a library: tsconfig has `declaration: true` (for
  // `tsc -b`), which tsdown ≥ 0.22 would otherwise take as a request for .d.ts.
  dts: false,
  // Runtime image ships no node_modules, so every dependency must be
  // inlined — not just @nonete/* workspace packages. Otherwise
  // deep subpaths like "better-auth/adapters/drizzle" are left as bare
  // external imports and Bun tries to auto-install them from the
  // registry at container start (wrong versions, no network in prod).
  deps: {
    alwaysBundle: () => true,
  },
})
