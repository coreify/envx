import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EnvValidationError,
  createEnv,
  generateExampleFile,
  string,
  syncExampleFile,
  validateExampleFile
} from "../src";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe(".env.example validation", () => {
  it("reports missing required keys", () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, ".env.example"), "OPTIONAL_KEY=\n");

    const result = validateExampleFile(
      {
        DATABASE_URL: string(),
        OPTIONAL_KEY: string().optional()
      },
      { cwd }
    );

    expect(result.exists).toBe(true);
    expect(result.missingKeys).toEqual(["DATABASE_URL"]);
  });

  it("adds .env.example issues to createEnv output", () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, ".env.example"), "OPTIONAL_KEY=\n");

    expect(() =>
      createEnv(
        {
          DATABASE_URL: string(),
          OPTIONAL_KEY: string().optional()
        },
        {
          cwd,
          env: {
            DATABASE_URL: "postgres://db.example.com/app"
          }
        }
      )
    ).toThrowError(EnvValidationError);
  });

  it("generates example files from the schema", () => {
    const cwd = createTempDir();
    const result = generateExampleFile(
      {
        server: {
          DATABASE_URL: string(),
          NODE_ENV: string().default("development")
        },
        client: {
          PUBLIC_API_URL: string()
        }
      },
      { cwd }
    );

    expect(result.written).toBe(true);
    expect(readFileSync(join(cwd, ".env.example"), "utf8")).toContain(
      "NODE_ENV=development"
    );
    expect(readFileSync(join(cwd, ".env.example"), "utf8")).toContain(
      "# Client variables"
    );
  });

  it("syncs example files to the current schema", () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, ".env.example"), "DATABASE_URL=\nOLD_KEY=\n");

    const result = syncExampleFile(
      {
        DATABASE_URL: string(),
        PUBLIC_API_URL: string().optional()
      },
      { cwd }
    );

    expect(result.addedKeys).toEqual(["PUBLIC_API_URL"]);
    expect(result.removedKeys).toEqual(["OLD_KEY"]);
    expect(readFileSync(join(cwd, ".env.example"), "utf8")).toContain(
      "PUBLIC_API_URL="
    );
  });

  it("escapes generated example values that require quoting", () => {
    const cwd = createTempDir();

    generateExampleFile(
      {
        MESSAGE: string().default('hello #world "quoted"'),
        MULTILINE: string().default("line1\nline2")
      },
      { cwd }
    );

    const content = readFileSync(join(cwd, ".env.example"), "utf8");

    expect(content).toContain('MESSAGE="hello #world \\"quoted\\""');
    expect(content).toContain('MULTILINE="line1\\nline2"');
  });

  it("supports absolute example file paths", () => {
    const cwd = createTempDir();
    const absoluteFile = join(cwd, "custom.env.example");

    generateExampleFile(
      {
        DATABASE_URL: string()
      },
      { cwd: join(cwd, "nested"), file: absoluteFile }
    );

    const result = validateExampleFile(
      {
        DATABASE_URL: string()
      },
      { cwd: join(cwd, "other"), file: absoluteFile }
    );

    expect(result.exists).toBe(true);
    expect(result.path).toBe(absoluteFile);
  });
});

function createTempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "coreify-env-example-"));
  tempDirectories.push(directory);
  return directory;
}
