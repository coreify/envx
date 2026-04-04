import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const cliBin = resolve(packageRoot, "bin/coreify-env.js");
const distEntry = resolve(packageRoot, "dist/index.js");
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("CLI", () => {
  it("checks environment configuration successfully", () => {
    const cwd = createProject();
    writeConfig(
      cwd,
      `export default defineConfig({
  schema: {
    DATABASE_URL: string(),
    PORT: number().default(3000)
  }
});`
    );
    writeFileSync(join(cwd, ".env"), "DATABASE_URL=postgres://db.example.com/app\n");

    const result = runCli(cwd, ["check"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Environment check passed.");
  });

  it("generates and syncs example files", () => {
    const cwd = createProject();
    writeConfig(
      cwd,
      `export default defineConfig({
  schema: {
    DATABASE_URL: string(),
    PUBLIC_API_URL: string().optional()
  }
});`
    );
    writeFileSync(join(cwd, ".env.example"), "DATABASE_URL=\nOLD_KEY=\n");

    const syncResult = runCli(cwd, ["example:sync"]);

    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain("Removed keys: OLD_KEY");
    expect(readFileSync(join(cwd, ".env.example"), "utf8")).toContain("PUBLIC_API_URL=");

    const generateResult = runCli(cwd, ["example:generate", "--dry-run"]);
    expect(generateResult.status).toBe(0);
    expect(generateResult.stdout).toContain("Generated preview");
  });

  it("runs doctor mode and reports duplicate env keys", () => {
    const cwd = createProject();
    writeConfig(
      cwd,
      `export default defineConfig({
  schema: {
    server: {
      DATABASE_URL: string()
    },
    client: {
      PUBLIC_API_URL: string()
    }
  }
});`
    );
    writeFileSync(join(cwd, ".env"), "DATABASE_URL=postgres://db.example.com/app\nPUBLIC_API_URL=https://api.example.com\n");
    writeFileSync(join(cwd, ".env.local"), "PUBLIC_API_URL=https://override.example.com\n");

    const result = runCli(cwd, ["doctor"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Warnings:");
    expect(result.stdout).toContain("PUBLIC_API_URL is defined in multiple env files");
  });

  it("fails doctor when no config file is present", () => {
    const cwd = createProject();

    const result = runCli(cwd, ["doctor"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not find a Coreify env config.");
  });

  it("forwards validateExample and runtimeEnv from config options", () => {
    const cwd = createProject();
    writeConfig(
      cwd,
      `export default defineConfig({
  schema: {
    DATABASE_URL: string()
  },
  options: {
    validateExample: "required",
    runtimeEnv: {
      DATABASE_URL: "postgres://db.example.com/app"
    }
  }
});`
    );

    const result = runCli(cwd, ["check"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".env.example file is missing");
    expect(result.stderr).not.toContain("\n- DATABASE_URL is missing\n");
    expect(result.stderr).toContain("DATABASE_URL is missing from .env.example");
  });
});

function createProject(): string {
  const directory = mkdtempSync(join(tmpdir(), "coreify-env-cli-"));
  tempDirectories.push(directory);
  return directory;
}

function writeConfig(cwd: string, configBody: string): void {
  writeFileSync(
    join(cwd, "coreify-env.config.mjs"),
    `import { defineConfig, number, string } from ${JSON.stringify(pathToFileURL(distEntry).href)};
${configBody}
`,
    "utf8"
  );
}

function runCli(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [cliBin, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env
    }
  });
}
