import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvConfig } from "../src";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("config loading", () => {
  it("rejects configs with non-schema values", async () => {
    const cwd = createTempDir();
    writeFileSync(
      join(cwd, "envx.config.mjs"),
      'export default { schema: { PORT: "3000" } };',
      "utf8"
    );

    await expect(loadEnvConfig({ cwd })).rejects.toThrow(
      `Invalid envx config at ${join(cwd, "envx.config.mjs")}`
    );
  });

  it("discovers envx config filenames", async () => {
    const cwd = createTempDir();
    writeFileSync(
      join(cwd, "envx.config.mjs"),
      'import { defineConfig, string } from "./dist-stub.mjs"; export default defineConfig({ schema: { DATABASE_URL: string() } });',
      "utf8"
    );
    writeFileSync(
      join(cwd, "dist-stub.mjs"),
      'export function string(){ return { __coreifySchema: true, parse(){ return { ok: true, value: "" }; }, isRequired(){ return true; }, describe(){ return { kind: "string", optional: false, hasDefault: false, url: false }; } }; } export function defineConfig(value){ return value; }',
      "utf8"
    );

    const result = await loadEnvConfig({ cwd });

    expect(result?.path).toBe(join(cwd, "envx.config.mjs"));
  });
});

function createTempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "coreify-envx-config-"));
  tempDirectories.push(directory);
  return directory;
}
