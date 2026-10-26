import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same reasoning as vite.config.ts - `core` is a `file:` dependency.
    preserveSymlinks: true,
    alias: [
      {
        find: /^libsodium-sumo$/,
        replacement: fileURLToPath(new URL("./vite-shims/libsodium-sumo-shim.mjs", import.meta.url)),
      },
    ],
  },
  test: {
    setupFiles: ["./src/test-setup.ts"],
    // `core` lives in node_modules (via its `file:` dependency symlink) and is externalized from
    // Vite's transform pipeline by default, bypassing the alias above entirely. Inlining it
    // routes its imports back through Vite's resolver, where the alias applies.
    server: {
      deps: {
        inline: ["core"],
      },
    },
  },
});
