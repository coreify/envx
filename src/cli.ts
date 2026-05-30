import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { createEnv } from "./core/create-env";
import { loadEnvConfig } from "./core/config";
import { diagnoseEnv } from "./core/doctor";
import { EnvValidationError } from "./core/errors";
import { generateExampleFile, syncExampleFile } from "./core/example";
import type { CreateEnvOptions } from "./core/create-env";
import type { EnvFileLoadOptions } from "./core/env-files";

type CliFlags = {
  ci?: boolean;
  config?: string;
  cwd?: string;
  dryRun?: boolean;
  envFile?: boolean;
  file?: string;
  mode?: string;
  prefix?: string;
  strict?: boolean;
};

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { command, flags } = parseCliArgs(argv);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  try {
    if (command === "doctor") {
      const loaded = await loadEnvConfig(buildLoadConfigOptions(flags, true));

      if (!loaded) {
        console.error("Could not find an envx config.");
        return 1;
      }

      const report = diagnoseEnv(loaded?.config.schema, {
        ...buildCliRuntimeOptions(loaded?.config.options, flags)
      });

      printDoctorReport(report, loaded?.path);
      return report.issues.length > 0 ? 1 : 0;
    }

    const loaded = await loadEnvConfig(buildLoadConfigOptions(flags, false));

    if (!loaded) {
      throw new Error("Could not load envx config.");
    }

    const options = buildCliRuntimeOptions(loaded.config.options, flags);

    if (command === "check") {
      createEnv(loaded.config.schema, options);
      console.log("Environment check passed.");
      return 0;
    }

    if (command === "example:generate") {
      const result = generateExampleFile(loaded.config.schema, {
        ...buildExampleMutationOptions(options.cwd, options.file),
        write: !flags.dryRun
      });
      console.log(
        `${flags.dryRun ? "Generated preview for" : "Generated"} ${basename(result.path)}`
      );
      return 0;
    }

    if (command === "example:sync") {
      const result = syncExampleFile(loaded.config.schema, {
        ...buildExampleMutationOptions(options.cwd, options.file),
        write: !flags.dryRun
      });
      console.log(
        `${flags.dryRun ? "Synced preview for" : "Synced"} ${basename(result.path)}`
      );
      if (result.addedKeys.length > 0) {
        console.log(`Added keys: ${result.addedKeys.join(", ")}`);
      }
      if (result.removedKeys.length > 0) {
        console.log(`Removed keys: ${result.removedKeys.join(", ")}`);
      }
      return 0;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      return 1;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

function parseCliArgs(argv: string[]): { command?: string; flags: CliFlags } {
  const flags: CliFlags = {};
  const [command, ...rest] = argv;

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];

    if (argument === undefined) {
      continue;
    }

    if (!argument.startsWith("--")) {
      continue;
    }

    if (argument === "--dry-run") {
      flags.dryRun = true;
      continue;
    }

    if (argument === "--ci") {
      flags.ci = true;
      continue;
    }

    if (argument === "--no-env-file") {
      flags.envFile = false;
      continue;
    }

    if (argument === "--loose") {
      flags.strict = false;
      continue;
    }

    const nextValue = rest[index + 1];

    if (!nextValue) {
      continue;
    }

    if (argument === "--config") {
      flags.config = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--cwd") {
      flags.cwd = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--file") {
      flags.file = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--mode") {
      flags.mode = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--prefix") {
      flags.prefix = nextValue;
      index += 1;
      continue;
    }
  }

  if (command === undefined) {
    return { flags };
  }

  return { command, flags };
}

function printDoctorReport(
  report: ReturnType<typeof diagnoseEnv>,
  configPath?: string
): void {
  console.log("Coreify Envx Doctor");

  if (configPath) {
    console.log(`Config: ${configPath}`);
  } else {
    console.log("Config: not found");
  }

  console.log(`Schema: ${report.schemaKind}`);
  console.log(`Loaded env files: ${report.envFiles.files.length}`);

  for (const file of report.envFiles.files) {
    console.log(`- ${file.path}`);
  }

  if (report.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of report.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (report.issues.length > 0) {
    console.log("Issues:");
    for (const issue of report.issues) {
      console.log(`- ${issue}`);
    }
    return;
  }

  console.log("No issues detected.");
}

function printHelp(): void {
  console.log(`coreenvx

Commands:
  check
  example:generate
  example:sync
  doctor

Flags:
  --config <path>
  --cwd <path>
  --file <path>
  --mode <name>
  --prefix <value>
  --ci
  --no-env-file
  --loose
  --dry-run`);
}

const entry = process.argv[1];

if (entry && import.meta.url === pathToFileURL(entry).href) {
  runCli().then((code) => {
    process.exit(code);
  });
}

function buildLoadConfigOptions(flags: CliFlags, optional: boolean): {
  configPath?: string;
  cwd?: string;
  optional: boolean;
} {
  const options: {
    configPath?: string;
    cwd?: string;
    optional: boolean;
  } = { optional };

  if (flags.config !== undefined) {
    options.configPath = flags.config;
  }

  if (flags.cwd !== undefined) {
    options.cwd = flags.cwd;
  }

  return options;
}

function buildCliRuntimeOptions(
  baseOptions: Pick<
    CreateEnvOptions,
    | "ci"
    | "cwd"
    | "envFile"
    | "file"
    | "mode"
    | "prefix"
    | "runtimeEnv"
    | "strict"
    | "validateExample"
  > = {},
  flags: CliFlags
): Pick<
  CreateEnvOptions,
  | "ci"
  | "cwd"
  | "envFile"
  | "file"
  | "mode"
  | "prefix"
  | "runtimeEnv"
  | "strict"
  | "validateExample"
> {
  const options: Pick<
    CreateEnvOptions,
    | "ci"
    | "cwd"
    | "envFile"
    | "file"
    | "mode"
    | "prefix"
    | "runtimeEnv"
    | "strict"
    | "validateExample"
  > = {};

  assignIfDefined(options, "ci", flags.ci ?? baseOptions.ci);
  assignIfDefined(options, "cwd", flags.cwd ?? baseOptions.cwd);
  assignIfDefined(options, "envFile", flags.envFile ?? baseOptions.envFile);
  assignIfDefined(options, "file", flags.file ?? baseOptions.file);
  assignIfDefined(options, "mode", flags.mode ?? baseOptions.mode);
  assignIfDefined(options, "prefix", flags.prefix ?? baseOptions.prefix);
  assignIfDefined(options, "runtimeEnv", baseOptions.runtimeEnv);
  assignIfDefined(options, "strict", flags.strict ?? baseOptions.strict);
  assignIfDefined(options, "validateExample", baseOptions.validateExample);

  return options;
}

function buildExampleMutationOptions(
  cwd?: string,
  file?: string
): {
  cwd?: string;
  file?: string;
} {
  const options: {
    cwd?: string;
    file?: string;
  } = {};

  if (cwd !== undefined) {
    options.cwd = cwd;
  }

  if (file !== undefined) {
    options.file = file;
  }

  return options;
}

function assignIfDefined<
  TObject extends Record<
    string,
    boolean | string | EnvFileLoadOptions | Record<string, string | undefined>
  >,
  TKey extends keyof TObject
>(target: TObject, key: TKey, value: TObject[TKey] | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
