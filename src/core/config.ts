import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CreateEnvOptions } from "./create-env";
import type { EnvSchemaInput } from "../types";
import { isFlatEnvSchema } from "./schema-utils";
import { resolveCwd } from "./shared";

const DEFAULT_CONFIG_FILES = [
  "coreenv.config.mjs",
  "coreenv.config.js",
  "coreenv.config.cjs",
  "coreify-env.config.mjs",
  "coreify-env.config.js",
  "coreify-env.config.cjs"
] as const;

export type CoreifyEnvConfig<TSchema extends EnvSchemaInput = EnvSchemaInput> = {
  options?: Omit<CreateEnvOptions, "exitOnError" | "logger">;
  schema: TSchema;
};

export type LoadedEnvConfig<TSchema extends EnvSchemaInput = EnvSchemaInput> = {
  config: CoreifyEnvConfig<TSchema>;
  path: string;
};

export type LoadEnvConfigOptions = {
  configPath?: string;
  cwd?: string;
  optional?: boolean;
};

export function defineConfig<TSchema extends EnvSchemaInput>(
  config: CoreifyEnvConfig<TSchema>
): CoreifyEnvConfig<TSchema> {
  return config;
}

export async function loadEnvConfig(
  options: LoadEnvConfigOptions = {}
): Promise<LoadedEnvConfig | null> {
  const cwd = resolveCwd(options.cwd);
  const path = resolveConfigPath(cwd, options.configPath);

  if (!path) {
    if (options.optional) {
      return null;
    }

    throw new Error(
      `Could not find a Coreify env config. Tried: ${DEFAULT_CONFIG_FILES.join(", ")}`
    );
  }

  const imported = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
  const config = extractConfig(imported);

  if (!config || typeof config !== "object" || !("schema" in config)) {
    throw new Error(`Invalid Coreify env config at ${path}`);
  }

  return {
    config: config as CoreifyEnvConfig,
    path
  };
}

function resolveConfigPath(cwd: string, configPath?: string): string | null {
  if (configPath) {
    const absolutePath = resolve(cwd, configPath);
    return existsSync(absolutePath) ? absolutePath : null;
  }

  for (const candidate of DEFAULT_CONFIG_FILES) {
    const absolutePath = join(cwd, candidate);

    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

function extractConfig(
  moduleValue: Record<string, unknown>
): CoreifyEnvConfig | null {
  if (isConfig(moduleValue.default)) {
    return moduleValue.default;
  }

  if (isConfig(moduleValue)) {
    return moduleValue;
  }

  if ("schema" in moduleValue && isSchemaContainer(moduleValue.schema)) {
    const config: CoreifyEnvConfig = {
      schema: moduleValue.schema
    };

    if (isCreateEnvOptions(moduleValue.options)) {
      config.options = moduleValue.options;
    }

    return config;
  }

  return null;
}

function isConfig(value: unknown): value is CoreifyEnvConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "schema" in value &&
    isSchemaContainer((value as { schema?: unknown }).schema)
  );
}

function isSchemaContainer(value: unknown): value is EnvSchemaInput {
  if (isFlatEnvSchema(value)) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { client?: unknown; server?: unknown };

  if (!("server" in candidate || "client" in candidate)) {
    return false;
  }

  return (
    (candidate.server === undefined || isFlatEnvSchema(candidate.server)) &&
    (candidate.client === undefined || isFlatEnvSchema(candidate.client))
  );
}

function isCreateEnvOptions(value: unknown): value is CreateEnvOptions {
  return typeof value === "object" && value !== null;
}
