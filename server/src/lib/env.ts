/**
 * Minimal .env loader (no dependency).
 *
 * The Prisma CLI loads `.env` for its own commands, but plain Node entrypoints
 * — the API server and the seed script — do not. Import this module *first* so
 * DATABASE_URL, PORT, and friends are populated before anything reads them.
 *
 * Real environment variables always win, so container and CI configuration is
 * never overridden by a stray local file.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function findEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  if (!key) return null;
  let value = trimmed.slice(eq + 1).trim();
  // Strip a single layer of matching quotes
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function loadEnv(): void {
  const envPath = findEnvFile(dirname(fileURLToPath(import.meta.url)));
  if (!envPath) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const entry = parseLine(line);
    if (!entry) continue;
    const [key, value] = entry;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();
