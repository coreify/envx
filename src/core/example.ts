import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { EnvSchemaInput } from "../types";
import { parseEnvFile } from "./env-files";
import { getRequiredSchemaKeys, normalizeSchema } from "./schema-utils";
import { relativeExampleLabel, resolveCwd } from "./shared";
import type { SchemaMetadata } from "./schema";

export type ExampleValidationMode = "off" | "if-present" | "required";

export type ValidateExampleFileOptions = {
  cwd?: string;
  file?: string;
  mode?: ExampleValidationMode;
};

export type ExampleValidationResult = {
  exists: boolean;
  missingKeys: string[];
  path: string;
};

export type ExampleFileMutationOptions = {
  cwd?: string;
  file?: string;
  write?: boolean;
};

export type ExampleFileMutationResult = {
  addedKeys: string[];
  content: string;
  path: string;
  removedKeys: string[];
  written: boolean;
};

export function validateExampleFile<TSchema extends EnvSchemaInput>(
  schema: TSchema,
  options: ValidateExampleFileOptions = {}
): ExampleValidationResult {
  const cwd = resolveCwd(options.cwd);
  const file = relativeExampleLabel(options.file);
  const absolutePath = resolveExamplePath(cwd, file);
  const mode = options.mode ?? "if-present";

  if (!existsSync(absolutePath)) {
    return {
      exists: false,
      missingKeys: mode === "required" ? getRequiredSchemaKeys(schema) : [],
      path: absolutePath
    };
  }

  const parsed = parseEnvFile(readFileSync(absolutePath, "utf8"));
  const keys = new Set(Object.keys(parsed));
  const missingKeys = getRequiredSchemaKeys(schema).filter((key) => !keys.has(key));

  return {
    exists: true,
    missingKeys,
    path: absolutePath
  };
}

export function generateExampleFile<TSchema extends EnvSchemaInput>(
  schema: TSchema,
  options: ExampleFileMutationOptions = {}
): ExampleFileMutationResult {
  const cwd = resolveCwd(options.cwd);
  const file = relativeExampleLabel(options.file);
  const path = resolveExamplePath(cwd, file);
  const content = renderExampleFile(schema);

  if (options.write !== false) {
    writeFileSync(path, content, "utf8");
  }

  return {
    path,
    content,
    addedKeys: normalizeSchema(schema).entries.map((entry) => entry.key),
    removedKeys: [],
    written: options.write !== false
  };
}

export function syncExampleFile<TSchema extends EnvSchemaInput>(
  schema: TSchema,
  options: ExampleFileMutationOptions = {}
): ExampleFileMutationResult {
  const cwd = resolveCwd(options.cwd);
  const file = relativeExampleLabel(options.file);
  const path = resolveExamplePath(cwd, file);
  const existing = existsSync(path) ? parseEnvFile(readFileSync(path, "utf8")) : {};
  const schemaKeys = normalizeSchema(schema).entries.map((entry) => entry.key);
  const existingKeys = Object.keys(existing);
  const addedKeys = schemaKeys.filter((key) => !(key in existing));
  const removedKeys = existingKeys.filter((key) => !schemaKeys.includes(key));
  const content = renderExampleFile(schema, existing);

  if (options.write !== false) {
    writeFileSync(path, content, "utf8");
  }

  return {
    path,
    content,
    addedKeys,
    removedKeys,
    written: options.write !== false
  };
}

export function renderExampleFile(
  schema: EnvSchemaInput,
  existingValues: Record<string, string> = {}
): string {
  const normalized = normalizeSchema(schema);
  const lines: string[] = [];

  if (normalized.kind === "split") {
    if (normalized.hasServer) {
      lines.push("# Server variables");
      lines.push(...renderSectionLines(normalized.server, existingValues));
    }

    if (normalized.hasServer && normalized.hasClient) {
      lines.push("");
    }

    if (normalized.hasClient) {
      lines.push("# Client variables");
      lines.push(...renderSectionLines(normalized.client, existingValues));
    }
  } else {
    lines.push(...renderSectionLines(normalized.flat, existingValues));
  }

  return `${trimTrailingBlankLines(lines).join("\n")}\n`;
}

function renderSectionLines(
  section: Record<string, { describe(): SchemaMetadata }>,
  existingValues: Record<string, string>
): string[] {
  return Object.entries(section).map(([key, validator]) => {
    const metadata = validator.describe();
    const value =
      existingValues[key] ?? (metadata.hasDefault ? serializeDefaultValue(metadata) : "");
    return `${key}=${serializeEnvValue(value)}`;
  });
}

function serializeDefaultValue(metadata: SchemaMetadata): string {
  if (!metadata.hasDefault || metadata.defaultValue === undefined) {
    return "";
  }

  return String(metadata.defaultValue);
}

function serializeEnvValue(value: string): string {
  if (value === "") {
    return "";
  }

  if (!needsQuoting(value)) {
    return value;
  }

  return `"${value
    .replace(/\\/gu, "\\\\")
    .replace(/\n/gu, "\\n")
    .replace(/\r/gu, "\\r")
    .replace(/\t/gu, "\\t")
    .replace(/"/gu, '\\"')}"`;
}

function needsQuoting(value: string): boolean {
  return /^\s|\s$/u.test(value) || /[\n\r\t "#']/u.test(value);
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const copy = [...lines];

  while (copy.length > 0 && copy[copy.length - 1] === "") {
    copy.pop();
  }

  return copy;
}

function resolveExamplePath(cwd: string, file: string): string {
  return isAbsolute(file) ? file : join(cwd, file);
}
