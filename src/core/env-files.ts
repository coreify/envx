import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { getProcessEnv, resolveCwd } from "./shared";

export type EnvFileLoadOptions = {
  ci?: boolean;
  cwd?: string;
  files?: readonly string[];
  mode?: string;
};

export type EnvFileDuplicate = {
  key: string;
  paths: string[];
};

export type LoadedEnvFile = {
  duplicateKeys: string[];
  path: string;
  values: Record<string, string>;
};

export type EnvFileLoadResult = {
  duplicates: EnvFileDuplicate[];
  files: LoadedEnvFile[];
  searchedPaths: string[];
  values: Record<string, string>;
};

export function loadEnvFiles(options: EnvFileLoadOptions = {}): EnvFileLoadResult {
  const cwd = resolveCwd(options.cwd);
  const paths = options.files ?? defaultEnvFiles(options.mode, options.ci);
  const loadedFiles: LoadedEnvFile[] = [];
  const searchedPaths = paths.map((candidatePath) =>
    isAbsolute(candidatePath) ? candidatePath : join(cwd, candidatePath)
  );
  const values: Record<string, string> = {};
  const duplicateMap = new Map<string, string[]>();

  for (const absolutePath of searchedPaths) {

    if (!existsSync(absolutePath)) {
      continue;
    }

    const parsed = parseEnvFileDetails(readFileSync(absolutePath, "utf8"));
    const duplicateKeysForFile: string[] = [...parsed.duplicateKeys];

    for (const key of Object.keys(parsed.values)) {
      if (key in values) {
        duplicateKeysForFile.push(key);
        const existingPaths = duplicateMap.get(key) ?? findExistingPaths(key, loadedFiles);
        duplicateMap.set(key, [...new Set([...existingPaths, absolutePath])]);
      }
    }

    loadedFiles.push({
      path: absolutePath,
      values: parsed.values,
      duplicateKeys: [...new Set(duplicateKeysForFile)]
    });

    Object.assign(values, parsed.values);
  }

  return {
    duplicates: [...duplicateMap.entries()].map(([key, duplicatePaths]) => ({
      key,
      paths: duplicatePaths
    })),
    files: loadedFiles,
    searchedPaths,
    values
  };
}

export function parseEnvFile(content: string): Record<string, string> {
  return parseEnvFileDetails(content).values;
}

export function parseEnvFileDetails(content: string): {
  duplicateKeys: string[];
  keysInOrder: string[];
  values: Record<string, string>;
} {
  const result: Record<string, string> = {};
  const keysInOrder: string[] = [];
  const duplicateKeys = new Set<string>();

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length)
      : trimmed;
    const separatorIndex = normalized.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const rawValue = normalized.slice(separatorIndex + 1).trim();

    if (key === "") {
      continue;
    }

    if (key in result) {
      duplicateKeys.add(key);
    }

    keysInOrder.push(key);
    result[key] = parseEnvValue(rawValue);
  }

  return {
    duplicateKeys: [...duplicateKeys],
    keysInOrder,
    values: result
  };
}

function defaultEnvFiles(mode = detectMode(), ci = detectCiMode()): string[] {
  const files = [".env"];

  if (mode) {
    files.push(`.env.${mode}`);
  }

  if (!ci) {
    files.push(".env.local");
  }

  return files;
}

function detectMode(): string | undefined {
  const processEnv = getProcessEnv();
  return processEnv.NODE_ENV;
}

function parseEnvValue(rawValue: string): string {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1).replace(/\\n/gu, "\n").replace(/\\r/gu, "\r").replace(/\\t/gu, "\t").replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  const commentIndex = rawValue.search(/\s#/u);
  const valueWithoutComment =
    commentIndex >= 0 ? rawValue.slice(0, commentIndex) : rawValue;

  return valueWithoutComment.trim();
}

function detectCiMode(): boolean {
  const env = getProcessEnv();
  const value = env.CI?.trim().toLowerCase();
  return value === "1" || value === "true";
}

function findExistingPaths(key: string, files: LoadedEnvFile[]): string[] {
  const paths: string[] = [];

  for (const file of files) {
    if (key in file.values) {
      paths.push(file.path);
    }
  }

  return paths;
}
