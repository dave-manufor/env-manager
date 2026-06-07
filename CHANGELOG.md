# Changelog

All notable changes to this project are documented in this file.

## [2.0.0] - 2026-06-07

### Added

- **Default values** — schema `default` and `default: () => value` with TypeScript narrowing
- **Error aggregation** — all validation errors reported in a single throw
- **Extended types** — `array`, `json`, `integer`, and `enum` with literal union inference
- **Built-in constraints** — `min`/`max`, `minLength`/`maxLength`, `pattern`, boolean `strict` mode
- **String options** — `trim` (default `true`) and `allowEmpty` for empty-string semantics
- **`EnvValidationError`** — structured error class with `.errors` array
- **`validate()`** — non-throwing validation returning `{ success, data | errors }`
- **`get()`** — per-key access on manager instances
- **`safe()`** — redacted view for logging sensitive values
- **`summarize()`** — startup metadata (found, default, sensitive)
- **`mock()`** — test helper for generating valid managers
- **`mergeSchemas()`** — compose schemas from multiple modules
- **`fromFile()`** — lightweight `.env` file parser
- **`generateExample()`** — generate `.env.example` content from a schema
- **`fromVite()`** — normalize Vite `import.meta.env` objects
- **`zodAdapter()`** — bridge Zod-like validators into schema `validator` fields
- **Scope improvements** — `resolveScope`, unprefixed fallback, trailing-underscore sanitization
- **Source merging** — `EnvManager.create(schema, [source1, source2])` with later-wins priority
- **Type utilities** — `InferParsedEnv`, `InferEnvSchema`
- **Type tests** — compile-time assertions via `tsd`

### Changed

- Parsed environment objects are frozen
- Default values are validated through the same constraint and validator pipeline as source values
- Empty strings are treated as missing unless `allowEmpty: true` is set on a string field
- `engines.node` raised to `>=18`
- Build target set to ES2022
- `package.json` now includes `exports` map for modern bundlers
- `prepublishOnly` replaces `prepare` for builds (avoids slow git installs)

### Deprecated

- `EnvManager.extend()` — use `mergeSchemas()` instead

### Removed

- `mask()` — use `safe()` instead

## [1.x]

Initial release with string, number, and boolean parsing, custom validators, and scoped environment prefixes.
