import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 4173,
  },
  build: {
    rollupOptions: {
      // ktor-client-js's WebSocket engine dynamically `import('ws')` as its Node fallback,
      // guarded by a runtime `PlatformUtils.isBrowser` check (ktor-ktor-client-core.mjs) -
      // `new WebSocket(...)` (browser-native) is always the branch actually taken here, but
      // Rollup still needs to resolve the import *statically* to bundle it, and "ws" isn't
      // installed (nor should it be - it's Node-only). Externalizing leaves the dynamic import
      // as a literal `import('ws')` at runtime, which is fine: that branch is provably
      // unreachable in a browser bundle.
      external: ["ws"],
    },
  },
  resolve: {
    // `core` is a `file:` dependency, symlinked from node_modules/core into ../core/build/....
    // Without this, Vite/Rollup resolve bare imports inside core's own .mjs files relative to
    // that REAL (symlink target) path, which sits outside webclient/node_modules entirely - so
    // core's own npm dependencies (libsodium-wrappers-sumo, etc.) are never found by the normal
    // node_modules walk-up. Preserving the symlink keeps resolution anchored inside webclient's
    // own tree instead.
    preserveSymlinks: true,
    alias: [
      // ADR-0009 crypto-bridge fix - see vite-shims/libsodium-sumo-shim.mjs. Exact match only
      // (RegExp with ^$ anchors) - a plain string key would also match the shim's own subpath
      // import of the real package, redirecting it right back onto itself.
      {
        find: /^libsodium-sumo$/,
        replacement: fileURLToPath(new URL("./vite-shims/libsodium-sumo-shim.mjs", import.meta.url)),
      },
      // Same reasoning, for libsodium-wrappers-sumo - see vite-shims/libsodium-wrappers-sumo-shim.mjs.
      // Applies to every importer of the bare specifier, main.ts's own default import included -
      // harmless there (the shim's own default export is still the real module), and actually
      // stronger: the shim's top-level `await ready` means it's already ready by the time any
      // importer's import resolves, not just by the time main.ts's own await completes.
      {
        find: /^libsodium-wrappers-sumo$/,
        replacement: fileURLToPath(new URL("./vite-shims/libsodium-wrappers-sumo-shim.mjs", import.meta.url)),
      },
    ],
  },
});
