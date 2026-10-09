import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetKvForTests } from "@/lib/store";

export function useTempStore(): () => void {
  const dir = mkdtempSync(path.join(tmpdir(), "josias-"));
  process.env.DASHBOARD_DATA_DIR = dir;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  resetKvForTests();
  return () => {
    resetKvForTests();
    rmSync(dir, { recursive: true, force: true });
  };
}
