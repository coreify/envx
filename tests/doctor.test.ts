import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diagnoseEnv, string } from "../src";

const tempDirectories: string[] = [];
const originalEnv = { ...process.env };

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }

  process.env = { ...originalEnv };
});

beforeEach(() => {
  process.env = { ...originalEnv };
});

describe("diagnostics", () => {
  it("reports duplicate env keys across files", () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, ".env"), "PUBLIC_API_URL=https://api.example.com\n");
    writeFileSync(join(cwd, ".env.local"), "PUBLIC_API_URL=https://override.example.com\n");

    const report = diagnoseEnv(
      {
        client: {
          PUBLIC_API_URL: string()
        }
      },
      {
        cwd,
        runtimeEnv: {},
        validateExample: "off"
      }
    );

    expect(report.warnings[0]).toContain("PUBLIC_API_URL is defined in multiple env files");
  });

  it("reports strict schema issues for unknown public keys", () => {
    const report = diagnoseEnv(
      {
        server: {
          DATABASE_URL: string()
        },
        client: {
          PUBLIC_API_URL: string()
        }
      },
      {
        runtimeEnv: {
          PUBLIC_API_URL: "https://api.example.com",
          PUBLIC_UNUSED: "1"
        },
        validateExample: "off"
      }
    );

    expect(report.issues).toContain("Unknown client environment variable PUBLIC_UNUSED");
  });

  it("reports duplicate keys within a single env file", () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, ".env"), "PORT=3000\nPORT=4000\n");

    const report = diagnoseEnv(
      {
        PORT: string()
      },
      {
        cwd,
        runtimeEnv: {},
        validateExample: "off"
      }
    );

    expect(report.warnings).toContain(`PORT is defined multiple times in ${join(cwd, ".env")}`);
  });

  it("uses process.env by default when runtimeEnv is not provided", () => {
    process.env.PUBLIC_UNUSED = "1";

    const report = diagnoseEnv(
      {
        client: {
          PUBLIC_API_URL: string()
        }
      },
      {
        validateExample: "off"
      }
    );

    expect(report.issues).toContain("Unknown client environment variable PUBLIC_UNUSED");
  });
});

function createTempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "coreify-env-doctor-"));
  tempDirectories.push(directory);
  return directory;
}
