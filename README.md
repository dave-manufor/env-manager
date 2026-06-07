# EnvManager

A robust, type-safe environment variable manager for Node.js and TypeScript. EnvManager validates configuration at startup, infers types from your schema, supports scoped prefixes, and ships with zero runtime dependencies.

## Features

- Type-safe parsing with full TypeScript inference
- Schema-based validation with aggregated error reporting
- Primitive types: `string`, `number`, `integer`, `boolean`, `array`, `json`, `enum`
- Built-in constraints: length, pattern, min/max, boolean coercion modes
- Default values with type narrowing
- Custom validators and transforms
- Scoped environments with custom resolvers
- Sensitive value redaction for logging
- Source merging, `.env` file loading, and test mocking utilities
- Vite and Zod adapter helpers

## Installation

```bash
npm install @davemanufor/env-manager
```

Requires Node.js 18 or later.

## Quick Start

```typescript
import { EnvManager, defineEnvSchema } from "@davemanufor/env-manager";

const schema = defineEnvSchema({
  API_URL: { type: "string" },
  PORT: { type: "number", required: true },
  DEBUG: { type: "boolean", required: false },
});

const env = EnvManager.create(schema, process.env).data();

console.log(env.API_URL); // string
console.log(env.PORT); // number
console.log(env.DEBUG); // boolean | undefined
```

## Schema Definition

Use `defineEnvSchema` for ergonomic schema definition and type inference:

```typescript
const schema = defineEnvSchema({
  DB_HOST: { type: "string", required: true },
  DB_PORT: { type: "integer", required: true, min: 1, max: 65535 },
  USE_SSL: { type: "boolean", required: false },
  ALLOWED_ORIGINS: { type: "array", separator: "," },
  FEATURE_FLAGS: { type: "json", default: { beta: false } },
  LOG_LEVEL: {
    type: "enum",
    values: ["debug", "info", "warn", "error"] as const,
  },
});
```

### Field options

| Option | Applies to | Description |
|--------|-----------|-------------|
| `required` | All | Whether the variable must be set. Defaults to `true`. |
| `default` | All | Default value or `() => value` factory. Narrows the output type. |
| `description` | All | Human-readable description for docs and `generateExample()`. |
| `sensitive` | All | Redact in `safe()`, `summarize()`, and error messages. |
| `transform` | All | Transform parsed value before validation. |
| `validator` | All | Custom validation. Return `true`, `false`, or an error string. |
| `min` / `max` | `number`, `integer` | Numeric bounds. |
| `minLength` / `maxLength` | `string` | String length bounds. |
| `pattern` | `string` | RegExp the value must match. |
| `trim` | `string` | Trim whitespace before parsing. Default: `true`. |
| `allowEmpty` | `string` | Treat `KEY=` as a valid empty string. Default: `false`. |
| `strict` | `boolean` | Strict coercion (`true`/`false`/`1`/`0` only). Default: `true`. |
| `separator` | `array` | Delimiter for array values. Default: `","`. |
| `values` | `enum` | Allowed string literals. Infers a union type. |

### Empty string behavior

By default, an empty string (e.g. `MY_VAR=` in a `.env` file) is treated as **missing**. This differs from raw dotenv behavior but prevents accidental empty values for required config.

To accept empty strings, set `allowEmpty: true`:

```typescript
ALLOW_BLANK: { type: "string", allowEmpty: true }
```

### Custom validation

```typescript
const schema = defineEnvSchema({
  DB_PORT: {
    type: "number",
    validator: (port) => port > 0 && port < 65536,
  },
  ADMIN_EMAIL: {
    type: "string",
    validator: (email) =>
      /^[^@]+@[^@]+\.[^@]+$/.test(email)
        ? true
        : "ADMIN_EMAIL must be a valid email",
  },
});
```

Use `EnvManager.zodAdapter(zodSchema)` to bridge existing Zod schemas into a `validator`.

## Creating and validating

### `EnvManager.create(schema, source, config?)`

Parses and validates. Throws `EnvValidationError` on failure.

```typescript
const manager = EnvManager.create(schema, process.env);
const env = manager.data(); // frozen, type-safe object
const port = manager.get("PORT"); // per-key access
```

### `EnvManager.validate(schema, source, config?)`

Non-throwing validation for CLIs, health checks, or custom error handling:

```typescript
const result = EnvManager.validate(schema, process.env);

if (!result.success) {
  console.error(result.errors);
} else {
  console.log(result.data);
  console.log(result.defaultsUsed); // Set of keys that used defaults
}
```

### `EnvValidationError`

```typescript
import { EnvValidationError } from "@davemanufor/env-manager";

try {
  EnvManager.create(schema, process.env);
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(err.errors); // string[]
  }
}
```

## Multiple sources

Later sources override earlier ones:

```typescript
import { fromFile } from "@davemanufor/env-manager";

const env = EnvManager.create(schema, [
  fromFile(".env.defaults"),
  fromFile(".env"),
  process.env,
]);
```

## Scopes and prefixes

Enable scoped environments to read prefixed variables based on the current environment:

```typescript
import { defineEnvConfig } from "@davemanufor/env-manager";

const manager = EnvManager.create(
  schema,
  source,
  defineEnvConfig({
    enableScopes: true,
    scopes: {
      custom: "CUSTOM",
      production: "LIVE", // overrides default PROD prefix
    },
    resolveScope: (src) => src.APP_ENV ?? src.NODE_ENV ?? null,
  })
);
```

Default scope prefixes (merged with any custom `scopes`):

| `NODE_ENV` | Prefix |
|-----------|--------|
| `development` | `DEV_` |
| `production` | `PROD_` |
| `test` | `TEST_` |
| `staging` | `STAGE_` |

When scopes are enabled and `NODE_ENV` is `production`, `API_KEY` is read from `PROD_API_KEY`. If the scoped key is missing, EnvManager falls back to the unprefixed name.

Trailing underscores in scope prefixes are stripped automatically (`"STAGE_"` → `"STAGE"`).

## Security and logging

Mark secrets with `sensitive: true`:

```typescript
const schema = defineEnvSchema({
  API_KEY: { type: "string", sensitive: true },
  PORT: { type: "number" },
});
```

Log safely at startup:

```typescript
console.log(manager.safe());
// { API_KEY: "***", PORT: 3000 }

console.log(manager.summarize());
// { API_KEY: { found: true, isDefault: false, sensitive: true, value: "***" }, ... }
```

Never log `manager.data()` or raw `process.env` in production.

## Schema composition

Combine schemas from different modules:

```typescript
import { mergeSchemas } from "@davemanufor/env-manager";

const dbSchema = defineEnvSchema({ DB_HOST: { type: "string" } });
const authSchema = defineEnvSchema({ JWT_SECRET: { type: "string", sensitive: true } });
const schema = mergeSchemas(dbSchema, authSchema);
```

## Developer tooling

### Mock for tests

```typescript
const manager = EnvManager.mock(schema, {
  PORT: 3000,
  API_KEY: "test-key",
});
```

### Generate `.env.example`

```typescript
import { generateExample } from "@davemanufor/env-manager";

const content = generateExample(schema);
// # Stripe API key
// # Type: string (Required)
// API_KEY=
```

### Load `.env` files

```typescript
import { fromFile } from "@davemanufor/env-manager";

const source = fromFile(".env");
```

`fromFile` handles comments, `export` prefixes, quoted values, and inline comments. It does not support multiline values, variable interpolation, or escaped quotes. For full dotenv compatibility, use the `dotenv` package and pass the result to EnvManager.

### Vite adapter

```typescript
const source = EnvManager.fromVite(import.meta.env);
const manager = EnvManager.create(schema, source);
```

## Type utilities

```typescript
import type { InferParsedEnv } from "@davemanufor/env-manager";

type Env = InferParsedEnv<typeof schema>;
```

## API Reference

### Helpers

| Function | Description |
|----------|-------------|
| `defineEnvSchema(schema)` | Define a schema with type inference |
| `defineEnvConfig(config)` | Define manager config with type inference |
| `mergeSchemas(a, b)` | Merge two schemas |
| `fromFile(path)` | Parse a `.env` file into a source object |
| `generateExample(schema, options?)` | Generate `.env.example` content |

### `EnvManager` static methods

| Method | Description |
|--------|-------------|
| `create(schema, source, config?)` | Parse, validate, and return a manager instance |
| `validate(schema, source, config?)` | Validate without throwing |
| `mock(schema, overrides?)` | Create a manager with test values |
| `mergeSources(sources)` | Merge multiple source objects |
| `fromVite(viteEnv)` | Normalize Vite env objects |
| `zodAdapter(schema)` | Create a validator from a Zod-like schema |
| `extend(a, b)` | **Deprecated.** Use `mergeSchemas()` |

### Instance methods

| Method | Description |
|--------|-------------|
| `data()` | Frozen, parsed environment object |
| `get(key)` | Access a single variable |
| `safe()` | Redacted copy for logging |
| `summarize()` | Structured startup metadata |

## Error handling

EnvManager throws `EnvValidationError` with an `.errors` array for:

- Missing required variables
- Invalid type coercion
- Constraint violations (min/max, pattern, etc.)
- Custom validator failures
- Missing scope when scopes are enabled

All errors are aggregated and reported together.

## License

MIT
