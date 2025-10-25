# EnvManager

A robust, type-safe environment variable manager for Node.js and TypeScript projects. EnvManager provides schema-based validation,type parsing and inference, scoped environments, and ergonomic developer experience for managing environment variables in modern applications.

## Features

- **Type-safe environment parsing**
- **Schema-based validation**
- **Optional and required variables**
- **Boolean, number, and string support**
- **Custom variable validation**
- **Custom scopes (e.g., development, production, test)**
- **Ergonomic API with full type inference**
- **Zero runtime dependencies**

## Installation

```bash
npm install @davemanufor/env-manager
```

## Quick Start

```typescript
import { EnvManager, defineEnvSchema } from "@davemanufor/env-manager";

const envSchema = defineEnvSchema({
  API_URL: { type: "string" }, // required by default
  PORT: { type: "number", required: true },
  DEBUG: { type: "boolean", required: false },
});

const envSource = process.env; // or import.meta.env
const envManager = EnvManager.create(envSchema, envSource);
const env = envManager.data();

console.log(env.API_URL); // string
console.log(env.PORT); // number
console.log(env.DEBUG); // boolean | undefined
```

## Schema Definition

Define your environment schema using `defineEnvSchema`. This enables full type parsing, inference and code completion:

```typescript
const schema = defineEnvSchema({
  DB_HOST: { type: "string", required: true },
  DB_PORT: { type: "number", required: true },
  USE_SSL: { type: "boolean", required: false },
});
```

### Custom Validation

You can provide a `validator` function for any variable in your schema. The validator receives the parsed value and should return `true` if valid, or `false` otherwise. Validators can also return an error message for invalid values. If validation fails, EnvManager will throw an error at startup.

**Example:**

```typescript
const schema = defineEnvSchema({
  DB_HOST: { type: "string", required: true },
  DB_PORT: {
    type: "number",
    required: true,
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

const envManager = EnvManager.create(schema, process.env);
const env = envManager.data();
```

If `DB_PORT` is not a valid port number, or `ADMIN_EMAIL` is not a valid email, an error will be thrown.

## Scopes & Prefixes

EnvManager supports scoped environments, allowing you to use different prefixes for environment variables based on the current scope (such as development, production, test, or custom scopes). The scope is determined by the value of `NODE_ENV` in your environment source.

### Default Scopes

By default, EnvManager provides the following scopes:

- `development`: Prefix is `DEV`
- `production`: Prefix is `PROD`
- `test`: Prefix is `TEST`
- `staging`: Prefix is `STAGE`

When scopes are enabled, the manager will look for variables with the corresponding prefix based on the current `NODE_ENV` value. For example, if `NODE_ENV` is `production`, `API_KEY` will be read from `PROD_API_KEY`.

### Custom Scopes

You can add custom scopes or override the prefix for any default scope by including it in the `scopes` config. The key in the `scopes` object should match the expected `NODE_ENV` value, and the value is the corresponding prefix (without the trailing underscore, which is added automatically).

**Adding a custom scope does not remove the default scopes.** You can override a default scope's prefix by specifying it in your custom scopes config.

#### Example: Using and Overriding Scopes

```typescript
const schema = defineEnvSchema({
  API_KEY: { type: "string", required: true },
});

const source = {
  DEV_API_KEY: "dev-key",
  PROD_API_KEY: "prod-key",
  CUSTOM_API_KEY: "custom-key",
  NODE_ENV: "custom",
};

const envManager = EnvManager.create(schema, source, {
  enableScopes: true,
  scopes: {
    custom: "CUSTOM", // Adds a custom scope for NODE_ENV="custom"
    production: "LIVE", // Overrides the default prefix for NODE_ENV="production" to "LIVE_"
  },
});

// If NODE_ENV is "custom", API_KEY is read from CUSTOM_API_KEY
// If NODE_ENV is "production", API_KEY is read from LIVE_API_KEY
// If NODE_ENV is "development", API_KEY is read from DEV_API_KEY
```

```typescript
const schema = defineEnvSchema({
  API_KEY: { type: "string", required: true },
});

const source = {
  DEV_API_KEY: "dev-key",
  PROD_API_KEY: "prod-key",
  NODE_ENV: "development",
};

const envManager = EnvManager.create(schema, source, { enableScopes: true });
console.log(envManager.data().API_KEY); // "dev-key"
```

## Type Safety & Code Completion

All parsed environment variables are fully type-safe and provide code completion in your IDE:

```typescript
const env = envManager.data();
// env.DB_HOST is string
// env.DB_PORT is number
// env.USE_SSL is boolean | undefined
```

## Error Handling

EnvManager throws descriptive errors for:

- Missing required variables
- Invalid number or boolean values
- Missing scope when enabled

## Use Cases

- **Node.js API servers**: Validate and type environment variables at startup.
- **Frontend build tools**: Parse and validate build-time environment variables.
- **Monorepos**: Use custom scopes for multiple environments.
- **Testing**: Easily mock environment sources for unit tests.

## API Reference

### `defineEnvSchema<T>(schema: T): T`

Helper for ergonomic schema definition and type inference.

### `EnvManager<T>(schema: T, source: RawEnvSource, config?: EnvManagerConfig)`

Main class for environment management.

#### Methods

- `data(): ParsedEnv<T>` — Returns the parsed, type-safe environment object.

#### Config Options

- `enableScopes?: boolean` — Enable scope-based variable prefixes.
- `scopes?: Record<string, string>` — Custom scope prefix mapping.

## Example: Full Usage

```typescript
import { EnvManager, defineEnvSchema } from "@davemanufor/env-manager";

const schema = defineEnvSchema({
  API_URL: { type: "string", required: true },
  PORT: { type: "number", required: true },
  DEBUG: { type: "boolean", required: false },
});

const envManager = EnvManager.create(schema, process.env, {
  enableScopes: true,
  scopes: { staging: "STAGE_" },
});

const env = envManager.data();
console.log(env.API_URL, env.PORT, env.DEBUG);
```

## License

MIT
