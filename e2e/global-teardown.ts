import { existsSync, readFileSync, rmSync } from "node:fs";
import { STATE_FILE } from "./global-setup";

export default function globalTeardown(): void {
  if (!existsSync(STATE_FILE)) return;
  const { pid, workDir } = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { pid: number; workDir: string };
  try {
    process.kill(pid);
  } catch {
    // already gone
  }
  rmSync(workDir, { recursive: true, force: true });
  rmSync(STATE_FILE, { force: true });
}
