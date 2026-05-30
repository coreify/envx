import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEnv, loadEnvFiles, string } from "../src";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("env file loading", () => {
  it("loads .env files in priority order", () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, ".env"), "APP_NAME=base\n");
    writeFileSync(join(cwd, ".env.production"), "APP_NAME=production\n");
    writeFileSync(join(cwd, ".env.local"), "APP_NAME=local\n");

    const env = createEnv(
      {
        APP_NAME: string()
      },
      {
        cwd,
        env: {},
        mode: "production",
        validateExample: "off"
      }
    );

    expect(env.APP_NAME).toBe("local");
  });

  it("supports manual file overrides", () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, ".env"), "APP_NAME=base\n");
    writeFileSync(join(cwd, ".custom.env"), "APP_NAME=custom\n");

    const result = loadEnvFiles({
      cwd,
      files: [".env", ".custom.env"]
    });

    expect(result.values.APP_NAME).toBe("custom");
    expect(result.files).toHaveLength(2);
  });

  it("accepts absolute file paths in manual overrides", () => {
    const cwd = createTempDir();
    const absoluteFile = join(cwd, ".absolute.env");
    writeFileSync(absoluteFile, "APP_NAME=absolute\n");

    const result = loadEnvFiles({
      cwd: join(cwd, "nested"),
      files: [absoluteFile]
    });

    expect(result.values.APP_NAME).toBe("absolute");
    expect(result.files[0]?.path).toBe(absoluteFile);
  });
});

function createTempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "coreify-envx-"));
  tempDirectories.push(directory);
  return directory;
}
