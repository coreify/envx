export { createEnv, type CreateEnvOptions } from "./core/create-env";
export {
  loadEnvFiles,
  parseEnvFile,
  parseEnvFileDetails,
  type EnvFileDuplicate,
  type EnvFileLoadOptions,
  type EnvFileLoadResult
} from "./core/env-files";
export { EnvValidationError, formatValidationIssues } from "./core/errors";
export {
  generateExampleFile,
  renderExampleFile,
  syncExampleFile,
  validateExampleFile,
  type ExampleFileMutationOptions,
  type ExampleFileMutationResult,
  type ExampleValidationMode,
  type ExampleValidationResult,
  type ValidateExampleFileOptions
} from "./core/example";
export {
  defineConfig,
  loadEnvConfig,
  type CoreifyEnvConfig,
  type LoadEnvConfigOptions,
  type LoadedEnvConfig
} from "./core/config";
export {
  collectSchemaIssues,
  diagnoseEnv,
  type DiagnoseEnvOptions,
  type EnvDiagnosticReport
} from "./core/doctor";
export {
  BaseSchema,
  BooleanSchema,
  EnumSchema,
  NumberSchema,
  StringSchema,
  boolean,
  enumType,
  number,
  string,
  type ParseResult,
  type SchemaMetadata
} from "./core/schema";
export type {
  AnySchema,
  EnvSchemaInput,
  FlatEnvSchema,
  InferEnv,
  InferFlatEnv,
  InferSchema,
  SplitEnvSchema
} from "./types";
