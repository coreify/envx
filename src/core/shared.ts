export function getProcessEnv(): Record<string, string | undefined> {
  if (typeof process === "undefined" || !process.env) {
    return {};
  }

  return process.env as Record<string, string | undefined>;
}

export function resolveCwd(cwd?: string): string {
  if (cwd) {
    return cwd;
  }

  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    return process.cwd();
  }

  return ".";
}

export function relativeExampleLabel(file?: string): string {
  return file ?? ".env.example";
}
