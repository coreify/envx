# @coreify/env

Type-safe, minimal, and developer-first environment management for modern Node apps and CLIs.

## Installation

```bash
npm install @coreify/env
```

## Quick Start

```ts
import { boolean, createEnv, enumType, number, string } from "@coreify/env";

export const env = createEnv({
  PORT: number().default(3000),
  DATABASE_URL: string().url(),
  NODE_ENV: enumType(["development", "production", "test"]),
  DEBUG: boolean().optional()
});
```

```ts
env.PORT;
env.DATABASE_URL;
env.NODE_ENV;
env.DEBUG;
```

## Schema API

```ts
string();
number();
boolean();
enumType(["development", "production", "test"]);
```

```ts
string().optional();
string().default("value");
number().min(1).max(65535);
string().regex(/^app_/u);
string().url();
```

## Server / Client Split

```ts
import { createEnv, defineConfig, string } from "@coreify/env";

export const env = createEnv({
  server: {
    DATABASE_URL: string()
  },
  client: {
    PUBLIC_API_URL: string().url()
  }
});

env.server.DATABASE_URL;
env.client.PUBLIC_API_URL;
```

Client keys must use the configured public prefix. The default prefix is `PUBLIC_`.

## Supported Env Files

`@coreify/env` loads these files automatically, in order:

1. `.env`
2. `.env.{mode}`
3. `.env.local`

Pass `mode` to target files like `.env.development` or `.env.production`.

Set `ci: true` to skip `.env.local` in CI pipelines.

## `.env.example` Validation

If `.env.example` exists, required keys are validated automatically. You can control that behavior:

```ts
createEnv(schema, {
  validateExample: "off"
});

createEnv(schema, {
  validateExample: "required"
});
```

You can also validate manually:

```ts
import { validateExampleFile } from "@coreify/env";

validateExampleFile(schema, {
  cwd: process.cwd()
});
```

Generate or sync example files directly:

```ts
import { generateExampleFile, syncExampleFile } from "@coreify/env";

generateExampleFile(schema, {
  cwd: process.cwd()
});

syncExampleFile(schema, {
  cwd: process.cwd()
});
```

`generateExampleFile()` creates a schema-driven example file. `syncExampleFile()` rewrites the example file from the current schema while preserving existing values for matching keys, and removes keys that are no longer present in the schema.

## Error Output

```txt
❌ Invalid environment variables:

- DATABASE_URL is missing
- PORT must be a number (received: "abc")
- NODE_ENV must be one of: development | production | test

💡 Fix your .env file or environment variables.
```

## Advanced Options

```ts
createEnv(schema, {
  envFile: true,
  strict: true,
  prefix: "PUBLIC_",
  runtimeEnv: process.env
});
```

Supported options:

- `envFile`: `true`, `false`, or env-file options like `cwd`, `mode`, `files`, `ci`
- `file`: custom `.env.example` path for validation, generation, sync, and CLI flows
- `runtimeEnv`: custom runtime source, useful for tests and adapters
- `strict`: enables public-prefix checks and unknown public-key detection for split schemas
- `prefix`: public client prefix, defaults to `PUBLIC_`
- `validateExample`: `"off" | "if-present" | "required"`

## CLI

The built-in CLI is Node-based and loads config files via local module import.

Create a config file:

```ts
// coreenv.config.mjs
import { defineConfig, number, string } from "@coreify/env";

export default defineConfig({
  schema: {
    PORT: number().default(3000),
    DATABASE_URL: string()
  }
});
```

Then run:

```bash
coreenv check
coreenv example:generate
coreenv example:sync
coreenv doctor
```

Useful flags:

- `--config <path>`
- `--cwd <path>`
- `--file <path>`
- `--mode <name>`
- `--prefix <value>`
- `--ci`
- `--no-env-file`
- `--loose`
- `--dry-run`
