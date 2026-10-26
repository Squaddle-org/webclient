import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 4173,
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
    ],
  },
});
