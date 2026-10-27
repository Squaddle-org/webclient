import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RELAY_HOST = "localhost:18080";
const STATE_FILE = join(tmpdir(), "squaddle-webclient-e2e-relay.json");

/** Builds and starts the *real* relay binary from `../relay` (or `$SQUADDLE_RELAY_DIR`) - same
 * discipline as every other real-relay test in this org, not a mock. CORS is scoped to the
 * Playwright preview server's own origin (`playwright.config.ts`'s `PREVIEW_PORT`) since the
 * relay now actually enforces it (relay's own cors.go). */
export default async function globalSetup(): Promise<void> {
  const relayDir = process.env.SQUADDLE_RELAY_DIR ?? "../relay";
  const workDir = mkdtempSync(join(tmpdir(), "squaddle-webclient-e2e-"));
  const binPath = join(workDir, "relay");
  const dbPath = join(workDir, "relay.db");

  execFileSync("go", ["build", "-o", binPath, "./cmd/relay"], { cwd: relayDir, stdio: "inherit" });

  const proc = spawn(
    binPath,
    ["-db", dbPath, "-listen", `:${RELAY_HOST.split(":")[1]}`, "-metrics", ":19090", "-limits", "none", "-cors-allowed-origins", "http://localhost:4173"],
    { stdio: "inherit", detached: true },
  );
  writeFileSync(STATE_FILE, JSON.stringify({ pid: proc.pid, workDir }));

  await waitForHealthz("http://localhost:19090/healthz", 10_000);
}

async function waitForHealthz(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`relay did not become healthy within ${timeoutMs}ms`);
}

export { RELAY_HOST, STATE_FILE };
