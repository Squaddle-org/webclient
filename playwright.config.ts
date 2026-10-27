import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // the two specs share one relay process/db via global-setup
  retries: 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // `preview`, not `dev`: exercises the real production build (incl. the sql.js WASM asset
  // import and the `ws` CSP-relevant externalization) the way `Dockerfile`/`nginx.conf` actually
  // serve it, not Vite's dev-server transform pipeline.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PREVIEW_PORT}`,
    url: `http://localhost:${PREVIEW_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
