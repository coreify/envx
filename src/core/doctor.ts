import type { EnvSchemaInput } from "../types";
import { loadEnvFiles, type EnvFileLoadOptions } from "./env-files";
import {
  validateExampleFile,
  type ExampleValidationMode,
  type ValidateExampleFileOptions
} from "./example";
import { getSchemaKeys, normalizeSchema } from "./schema-utils";
import { getProcessEnv } from "./shared";

export type DiagnoseEnvOptions = EnvFileLoadOptions &
  Omit<ValidateExampleFileOptions, "mode"> & {
    envFile?: boolean | EnvFileLoadOptions;
    prefix?: string;
    runtimeEnv?: Record<string, string | undefined>;
    strict?: boolean;
    validateExample?: ExampleValidationMode;
  };

export type EnvDiagnosticReport = {
  envFiles: ReturnType<typeof loadEnvFiles>;
  example: ReturnType<typeof validateExampleFile> | null;
  hasSchema: boolean;
  issues: string[];
  prefix: string;
  schemaKeys: string[];
  schemaKind: "flat" | "split" | "none";
  warnings: string[];
};

export function diagnoseEnv(
  schema?: EnvSchemaInput,
  options: DiagnoseEnvOptions = {}
): EnvDiagnosticReport {
  const prefix = options.prefix ?? "PUBLIC_";
  const strict = options.strict ?? true;
  const envFiles =
    options.envFile === false
      ? {
          duplicates: [],
          files: [],
          searchedPaths: [],
          values: {}
        }
      : loadEnvFiles(resolveEnvFileOptions(options));
  const warnings: string[] = envFiles.duplicates.map(
    (duplicate) =>
      `${duplicate.key} is defined in multiple env files: ${duplicate.paths.join(" -> ")}`
  );
  warnings.push(
    ...envFiles.files.flatMap((file) =>
      file.duplicateKeys.map(
        (key) => `${key} is defined multiple times in ${file.path}`
      )
    )
  );

  if (!schema) {
    return {
      envFiles,
      example: null,
      hasSchema: false,
      issues: [],
      warnings,
      prefix,
      schemaKind: "none",
      schemaKeys: []
    };
  }

  const normalized = normalizeSchema(schema);
  const runtimeEnv = options.runtimeEnv ?? getProcessEnv();
  const mergedEnv = {
    ...envFiles.values,
    ...runtimeEnv
  };
  const issues = collectSchemaIssues(normalized, mergedEnv, prefix, strict);
  const example =
    (options.validateExample ?? "if-present") === "off"
      ? null
      : validateExampleFile(schema, {
          ...buildExampleOptions(options),
          mode: options.validateExample ?? "if-present"
        });

  if (example?.missingKeys.length) {
    issues.push(
      ...example.missingKeys.map(
        (key) => `${key} is missing from ${options.file ?? ".env.example"}`
      )
    );
  }

  return {
    envFiles,
    example,
    hasSchema: true,
    issues,
    warnings,
    prefix,
    schemaKind: normalized.kind,
    schemaKeys: getSchemaKeys(schema)
  };
}

export function collectSchemaIssues(
  normalized: ReturnType<typeof normalizeSchema>,
  env: Record<string, string | undefined>,
  prefix: string,
  strict: boolean
): string[] {
  const issues: string[] = [];

  if (normalized.kind !== "split") {
    return issues;
  }

  const clientKeys = new Set(Object.keys(normalized.client));
  const serverKeys = new Set(Object.keys(normalized.server));

  for (const key of clientKeys) {
    if (!key.startsWith(prefix)) {
      issues.push(`Client environment variable ${key} must start with prefix "${prefix}"`);
    }
  }

  if (!strict) {
    return issues;
  }

  for (const key of serverKeys) {
    if (key.startsWith(prefix)) {
      issues.push(`Server environment variable ${key} must not use the public prefix "${prefix}"`);
    }
  }

  for (const key of Object.keys(env)) {
    if (key.startsWith(prefix) && !clientKeys.has(key)) {
      issues.push(`Unknown client environment variable ${key}`);
    }
  }

  for (const key of clientKeys) {
    if (serverKeys.has(key)) {
      issues.push(`Environment variable ${key} is declared in both server and client schemas`);
    }
  }

  return issues;
}

function resolveEnvFileOptions(options: DiagnoseEnvOptions): EnvFileLoadOptions {
  if (typeof options.envFile === "object") {
    const envFileOptions: EnvFileLoadOptions = {};
    assignIfDefined(envFileOptions, "ci", options.envFile.ci ?? options.ci);
    assignIfDefined(envFileOptions, "cwd", options.envFile.cwd ?? options.cwd);
    assignIfDefined(envFileOptions, "files", options.envFile.files ?? options.files);
    assignIfDefined(envFileOptions, "mode", options.envFile.mode ?? options.mode);
    return envFileOptions;
  }

  const envFileOptions: EnvFileLoadOptions = {};
  assignIfDefined(envFileOptions, "ci", options.ci);
  assignIfDefined(envFileOptions, "cwd", options.cwd);
  assignIfDefined(envFileOptions, "files", options.files);
  assignIfDefined(envFileOptions, "mode", options.mode);
  return envFileOptions;
}

function buildExampleOptions(options: DiagnoseEnvOptions): Omit<
  ValidateExampleFileOptions,
  "mode"
> {
  const exampleOptions: Omit<ValidateExampleFileOptions, "mode"> = {};

  if (options.cwd !== undefined) {
    exampleOptions.cwd = options.cwd;
  }

  if (options.file !== undefined) {
    exampleOptions.file = options.file;
  }

  return exampleOptions;
}

function assignIfDefined<TKey extends keyof EnvFileLoadOptions>(
  target: EnvFileLoadOptions,
  key: TKey,
  value: EnvFileLoadOptions[TKey] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
