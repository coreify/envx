import type { AnySchema, EnvSchemaInput, FlatEnvSchema, SplitEnvSchema } from "../types";

export type NormalizedSchemaEntry = {
  key: string;
  section: "server" | "client" | null;
  validator: AnySchema;
};

export type NormalizedSchema =
  | {
      kind: "flat";
      entries: NormalizedSchemaEntry[];
      flat: FlatEnvSchema;
    }
  | {
      client: FlatEnvSchema;
      entries: NormalizedSchemaEntry[];
      hasClient: boolean;
      hasServer: boolean;
      kind: "split";
      server: FlatEnvSchema;
    };

export function isCoreifySchema(value: unknown): value is AnySchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "__coreifySchema" in value &&
    (value as { __coreifySchema?: unknown }).__coreifySchema === true &&
    typeof (value as { parse?: unknown }).parse === "function"
  );
}

export function isFlatEnvSchema(value: unknown): value is FlatEnvSchema {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value).every((entry) => isCoreifySchema(entry));
}

export function normalizeSchema(schema: EnvSchemaInput): NormalizedSchema {
  if (isSplitEnvSchema(schema)) {
    const server = schema.server ?? {};
    const client = schema.client ?? {};

    return {
      kind: "split",
      server,
      client,
      hasServer: schema.server !== undefined,
      hasClient: schema.client !== undefined,
      entries: [
        ...Object.entries(server).map(([key, validator]) => ({
          key,
          section: "server" as const,
          validator
        })),
        ...Object.entries(client).map(([key, validator]) => ({
          key,
          section: "client" as const,
          validator
        }))
      ]
    };
  }

  return {
    kind: "flat",
    flat: schema,
    entries: Object.entries(schema).map(([key, validator]) => ({
      key,
      section: null,
      validator
    }))
  };
}

export function getRequiredSchemaKeys(schema: EnvSchemaInput): string[] {
  return normalizeSchema(schema).entries
    .filter((entry) => entry.validator.isRequired())
    .map((entry) => entry.key);
}

export function getSchemaKeys(schema: EnvSchemaInput): string[] {
  return normalizeSchema(schema).entries.map((entry) => entry.key);
}

function isSplitEnvSchema(schema: EnvSchemaInput): schema is SplitEnvSchema {
  if (!("server" in schema || "client" in schema)) {
    return false;
  }

  const candidate = schema as SplitEnvSchema;

  return (
    isSchemaSection(candidate.server) &&
    isSchemaSection(candidate.client)
  );
}

function isSchemaSection(value: unknown): value is FlatEnvSchema | undefined {
  if (value === undefined) {
    return true;
  }

  return isFlatEnvSchema(value);
}
