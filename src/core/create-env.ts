import { EnvValidationError } from "./errors";
import { loadEnvFiles, type EnvFileLoadOptions } from "./env-files";
import {
  validateExampleFile,
  type ExampleValidationMode,
  type ValidateExampleFileOptions
} from "./example";
import type { EnvSchemaInput, InferEnv } from "../types";
import { collectSchemaIssues } from "./doctor";
import { normalizeSchema } from "./schema-utils";
import { getProcessEnv, relativeExampleLabel } from "./shared";

export type CreateEnvOptions = EnvFileLoadOptions &
  Omit<ValidateExampleFileOptions, "mode"> & {
    env?: Record<string, string | undefined>;
    envFile?: boolean | EnvFileLoadOptions;
    exitOnError?: boolean;
    logger?: (message: string) => void;
    prefix?: string;
    runtimeEnv?: Record<string, string | undefined>;
    strict?: boolean;
    validateExample?: ExampleValidationMode;
  };

export function createEnv<TSchema extends EnvSchemaInput>(
  schema: TSchema,
  options: CreateEnvOptions = {}
): InferEnv<TSchema> {
  const issues: string[] = [];
  const normalized = normalizeSchema(schema);
  const fileEnv =
    options.envFile === false
      ? { duplicates: [], files: [], searchedPaths: [], values: {} }
      : loadEnvFiles(buildEnvFileLoadOptions(options));
  const runtimeEnv = options.runtimeEnv ?? options.env ?? getProcessEnv();
  const strict = options.strict ?? true;
  const prefix = options.prefix ?? "PUBLIC_";

  const mergedEnv = {
    ...fileEnv.values,
    ...runtimeEnv
  };

  issues.push(...collectSchemaIssues(normalized, mergedEnv, prefix, strict));

  const exampleResult = validateExampleFile(
    schema,
    buildExampleValidationOptions(options)
  );

  if (!exampleResult.exists && (options.validateExample ?? "if-present") === "required") {
    issues.push(`${relativeExampleLabel(options.file)} file is missing`);
  }

  issues.push(
    ...exampleResult.missingKeys.map(
      (key) => `${key} is missing from ${relativeExampleLabel(options.file)}`
    )
  );

  const output =
    normalized.kind === "split"
      ? ({
          ...(normalized.hasServer ? { server: {} } : {}),
          ...(normalized.hasClient ? { client: {} } : {})
        } as InferEnv<TSchema>)
      : ({} as InferEnv<TSchema>);

  for (const { key, section, validator } of normalized.entries) {
    const result = validator.parse(key, mergedEnv[key]);

    if (!result.ok) {
      issues.push(result.issue);
      continue;
    }

    if (normalized.kind === "split" && section) {
      const target = output[section as keyof InferEnv<TSchema>] as Record<string, unknown>;
      target[key] = result.value;
      continue;
    }

    (output as Record<string, unknown>)[key] = result.value;
  }

  if (issues.length > 0) {
    const error = new EnvValidationError(issues);

    if (options.exitOnError) {
      const logger = options.logger ?? console.error;
      logger(error.message);
      process.exit(1);
    }

    throw error;
  }

  return output;
}

function buildEnvFileLoadOptions(options: CreateEnvOptions): EnvFileLoadOptions {
  if (typeof options.envFile === "object") {
    const envFileOptions: EnvFileLoadOptions = {};

    assignIfDefined(envFileOptions, "ci", options.envFile.ci ?? options.ci);
    assignIfDefined(envFileOptions, "cwd", options.envFile.cwd ?? options.cwd);
    assignIfDefined(envFileOptions, "files", options.envFile.files ?? options.files);
    assignIfDefined(envFileOptions, "mode", options.envFile.mode ?? options.mode);

    return envFileOptions;
  }

  const loadOptions: EnvFileLoadOptions = {};

  if (options.ci !== undefined) {
    loadOptions.ci = options.ci;
  }

  if (options.cwd !== undefined) {
    loadOptions.cwd = options.cwd;
  }

  if (options.files !== undefined) {
    loadOptions.files = options.files;
  }

  if (options.mode !== undefined) {
    loadOptions.mode = options.mode;
  }

  return loadOptions;
}

function buildExampleValidationOptions(
  options: CreateEnvOptions
): ValidateExampleFileOptions {
  const mode = options.validateExample ?? "if-present";
  const validationOptions: ValidateExampleFileOptions = {
    mode
  };

  if (options.cwd !== undefined) {
    validationOptions.cwd = options.cwd;
  }

  if (options.file !== undefined) {
    validationOptions.file = options.file;
  }

  return validationOptions;
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
