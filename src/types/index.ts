import type { BaseSchema } from "../core/schema";

export type AnySchema = BaseSchema<unknown, boolean>;

export type FlatEnvSchema = Record<string, AnySchema>;
export type SplitEnvSchema = {
  client?: FlatEnvSchema;
  server?: FlatEnvSchema;
};
export type EnvSchemaInput = FlatEnvSchema | SplitEnvSchema;

export type InferSchema<TSchema> = TSchema extends BaseSchema<
  infer TValue,
  infer TOptional
>
  ? TOptional extends true
    ? TValue | undefined
    : TValue
  : never;

export type InferFlatEnv<TSchema extends FlatEnvSchema | undefined> = TSchema extends FlatEnvSchema
  ? {
  [TKey in keyof TSchema]: InferSchema<TSchema[TKey]>;
}
  : Record<never, never>;

type Expand<TValue> = TValue extends infer TObject
  ? { [TKey in keyof TObject]: TObject[TKey] }
  : never;

export type InferEnv<TSchema extends EnvSchemaInput> = TSchema extends SplitEnvSchema
  ? Expand<
      (TSchema extends { server: infer TServer extends FlatEnvSchema }
        ? { server: InferFlatEnv<TServer> }
        : Record<never, never>) &
        (TSchema extends { client: infer TClient extends FlatEnvSchema }
          ? { client: InferFlatEnv<TClient> }
          : Record<never, never>)
    >
  : InferFlatEnv<Extract<TSchema, FlatEnvSchema>>;
