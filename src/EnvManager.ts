import { EnvValidationError } from "./errors";
import { mergeSchemas } from "./helpers";
import {
  EnvDeclaration,
  EnvManagerConfig,
  EnvSchema,
  EnvSourceInput,
  EnvSummaryEntry,
  ParsedEnv,
  RawEnvSource,
  ValidationResult,
  ZodSchemaLike,
} from "./types";

type ParseContext = {
  schema: EnvSchema;
  source: RawEnvSource;
  enableScopes: boolean;
  currentScope: string | null;
  scopes: Record<string, string>;
};

type ParseResult<T extends EnvSchema> = {
  data: ParsedEnv<T>;
  errors: string[];
  defaultsUsed: Set<string>;
};

const DEFAULT_SCOPES: Record<string, string> = {
  development: "DEV",
  production: "PROD",
  test: "TEST",
  staging: "STAGE",
};

function sanitizeScopes(
  scopes: Record<string, string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(scopes)) {
    sanitized[key] = value.replace(/_$/, "");
  }
  return sanitized;
}

function resolvePrefixedName(
  name: string,
  enableScopes: boolean,
  currentScope: string | null,
  scopes: Record<string, string>
): string {
  if (enableScopes && currentScope) {
    const scopePrefix = scopes[currentScope];
    const prefix = scopePrefix ? `${scopePrefix}_` : "";
    return `${prefix}${name}`;
  }
  return name;
}

function isValueMissing(
  rawValue: string | undefined | null,
  declaration: EnvDeclaration
): boolean {
  if (rawValue === undefined || rawValue === null) return true;
  if (rawValue === "") {
    return !(declaration.type === "string" && declaration.allowEmpty);
  }
  return false;
}

class EnvManager<T extends EnvSchema> {
  private source: RawEnvSource;
  private _env: ParsedEnv<T>;
  private schema: T;
  private enableScopes = false;
  private currentScope: string | null = null;
  private scopes: Record<string, string> = { ...DEFAULT_SCOPES };
  private defaultsUsed = new Set<string>();

  static mergeSources(sources: RawEnvSource[]): RawEnvSource {
    const merged: RawEnvSource = {};
    for (const source of sources) {
      for (const key of Object.keys(source)) {
        const value = source[key];
        if (value !== undefined) {
          merged[key] = value;
        }
      }
    }
    return merged;
  }

  /** @deprecated Use `mergeSchemas()` from the package root instead. */
  static extend<A extends EnvSchema, B extends EnvSchema>(
    schemaA: A,
    schemaB: B
  ): A & B {
    return mergeSchemas(schemaA, schemaB);
  }

  static fromVite(viteEnv: Record<string, unknown>): RawEnvSource {
    const normalized: RawEnvSource = {};
    for (const [key, value] of Object.entries(viteEnv)) {
      const strValue = String(value);
      if (key.startsWith("VITE_")) {
        normalized[key.replace(/^VITE_/, "")] = strValue;
      }
      normalized[key] = strValue;
    }
    return normalized;
  }

  static zodAdapter(schema: ZodSchemaLike): (value: unknown) => boolean | string {
    return (value: unknown) => {
      const result = schema.safeParse(value);
      if (result.success) return true;
      return result.error.errors.map((e) => e.message).join(", ");
    };
  }

  static validate<U extends EnvSchema>(
    schema: U,
    sourceInput: EnvSourceInput,
    config?: EnvManagerConfig
  ): ValidationResult<U> {
    const source = Array.isArray(sourceInput)
      ? this.mergeSources(sourceInput)
      : sourceInput;

    if (!source) {
      return {
        success: false,
        errors: ["[Env Manager] - Env source is undefined."],
      };
    }

    const context = this.buildParseContext(schema, source, config);
    const scopeError = this.validateScope(context);
    if (scopeError) {
      return { success: false, errors: [scopeError] };
    }

    const result = this.parseSchema(schema, context);
    if (result.errors.length > 0) {
      return { success: false, errors: result.errors };
    }

    return {
      success: true,
      data: result.data,
      defaultsUsed: result.defaultsUsed,
    };
  }

  static create<U extends EnvSchema>(
    schema: U,
    sourceInput: EnvSourceInput,
    config?: EnvManagerConfig
  ): EnvManager<U> {
    const result = this.validate(schema, sourceInput, config);
    if (!result.success) {
      throw new EnvValidationError(result.errors);
    }

    const source = Array.isArray(sourceInput)
      ? this.mergeSources(sourceInput)
      : sourceInput;

    return new EnvManager(
      schema,
      source,
      config,
      result.data,
      result.defaultsUsed
    );
  }

  static mock<U extends EnvSchema>(
    schema: U,
    overrides: Partial<ParsedEnv<U>> = {}
  ): EnvManager<U> {
    const source: RawEnvSource = {};

    for (const key in schema) {
      if (key in overrides) {
        if (overrides[key] !== undefined) {
          const value = overrides[key];
          source[key] =
            typeof value === "object" && value !== null
              ? JSON.stringify(value)
              : String(value);
        }
        continue;
      }

      const declaration = schema[key];
      const isRequired = declaration.required ?? true;
      if (!isRequired) continue;

      switch (declaration.type) {
        case "string":
          source[key] = "mock_string";
          break;
        case "number":
        case "integer":
          source[key] = "1";
          break;
        case "boolean":
          source[key] = "true";
          break;
        case "array":
          source[key] = "a,b,c";
          break;
        case "json":
          source[key] = "{}";
          break;
        case "enum":
          source[key] = declaration.values[0] ?? "mock";
          break;
      }
    }

    return this.create(schema, source);
  }

  private constructor(
    schema: T,
    source: RawEnvSource,
    config: EnvManagerConfig | undefined,
    parsedData: ParsedEnv<T>,
    defaultsUsed: Set<string>
  ) {
    this.source = source;
    this.schema = schema;
    this._env = parsedData;
    this.defaultsUsed = defaultsUsed;

    if (config?.scopes) {
      this.scopes = { ...this.scopes, ...sanitizeScopes(config.scopes) };
    }
    if (config?.enableScopes !== undefined) {
      this.enableScopes = config.enableScopes;
    }
    this.currentScope = this.initCurrentScope(config);
  }

  private static buildParseContext(
    schema: EnvSchema,
    source: RawEnvSource,
    config?: EnvManagerConfig
  ): ParseContext & { defaultsUsed: Set<string> } {
    let scopes = { ...DEFAULT_SCOPES };
    let enableScopes = false;
    let currentScope: string | null = null;

    if (config?.scopes) {
      scopes = { ...scopes, ...sanitizeScopes(config.scopes) };
    }

    if (config?.enableScopes) {
      enableScopes = true;
      currentScope = config.resolveScope
        ? config.resolveScope(source)
        : source.NODE_ENV || null;
    }

    return {
      schema,
      source,
      enableScopes,
      currentScope,
      scopes,
      defaultsUsed: new Set<string>(),
    };
  }

  private static validateScope(context: ParseContext): string | null {
    if (!context.enableScopes || context.currentScope) return null;
    return `[Env Manager] - Scopes enabled but current scope could not be determined from source. Ensure NODE_ENV is set (${Object.keys(
      context.scopes
    ).join(" | ")}).`;
  }

  private static resolveRawValue(
    key: string,
    context: ParseContext
  ): { rawName: string; rawValue: string | undefined | null } {
    let rawName = resolvePrefixedName(
      key,
      context.enableScopes,
      context.currentScope,
      context.scopes
    );
    let rawValue = context.source[rawName];

    if (rawValue === undefined || rawValue === null) {
      if (
        context.enableScopes &&
        context.currentScope &&
        rawName !== key
      ) {
        rawValue = context.source[key];
        if (rawValue !== undefined && rawValue !== null) {
          rawName = key;
        }
      }
    }

    return { rawName, rawValue };
  }

  private static maskInMessage(
    message: string,
    declaration: EnvDeclaration,
    rawValue: string | undefined | null
  ): string {
    if (declaration.sensitive && rawValue) {
      return message.split(rawValue).join("***");
    }
    return message;
  }

  private static resolveDefaultValue(declaration: EnvDeclaration): unknown {
    let defaultValue: unknown = declaration.default;
    if (typeof defaultValue === "function") {
      defaultValue = (defaultValue as () => unknown)();
    }
    return defaultValue;
  }

  private static finalizeValue(
    declaration: EnvDeclaration,
    value: unknown,
    rawName: string,
    errors: string[],
    rawValue?: string | null
  ): unknown | undefined {
    if (!this.checkTypedConstraints(declaration, value, rawName, errors)) {
      return undefined;
    }

    let finalValue = value;
    if (declaration.transform) {
      finalValue = (declaration.transform as (v: unknown) => unknown)(finalValue);
    }

    if (!this.checkTypedConstraints(declaration, finalValue, rawName, errors)) {
      return undefined;
    }

    if (declaration.validator) {
      const result = declaration.validator(finalValue as never);
      if (result !== true) {
        const detail = typeof result === "string" ? result : "";
        const message = this.maskInMessage(
          `[Env Manager] - Environment variable ${rawName} failed custom validation.${detail ? ` ${detail}` : ""}`,
          declaration,
          rawValue ?? null
        );
        errors.push(message);
        return undefined;
      }
    }

    return finalValue;
  }

  private static checkTypedConstraints(
    declaration: EnvDeclaration,
    value: unknown,
    rawName: string,
    errors: string[]
  ): boolean {
    switch (declaration.type) {
      case "string": {
        const parsedValue = String(value);
        if (
          declaration.minLength !== undefined &&
          parsedValue.length < declaration.minLength
        ) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} must be at least ${declaration.minLength} characters.`
          );
          return false;
        }
        if (
          declaration.maxLength !== undefined &&
          parsedValue.length > declaration.maxLength
        ) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} must be at most ${declaration.maxLength} characters.`
          );
          return false;
        }
        if (declaration.pattern && !declaration.pattern.test(parsedValue)) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} does not match the required pattern.`
          );
          return false;
        }
        return true;
      }
      case "number":
      case "integer": {
        const parsedValue = Number(value);
        if (isNaN(parsedValue)) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} is not a valid number.`
          );
          return false;
        }
        if (declaration.type === "integer" && !Number.isInteger(parsedValue)) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} is not a valid integer.`
          );
          return false;
        }
        if (declaration.min !== undefined && parsedValue < declaration.min) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} must be at least ${declaration.min}.`
          );
          return false;
        }
        if (declaration.max !== undefined && parsedValue > declaration.max) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} must be at most ${declaration.max}.`
          );
          return false;
        }
        return true;
      }
      case "enum": {
        const parsedValue = String(value);
        if (!declaration.values.includes(parsedValue)) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} must be one of: ${declaration.values.join(", ")}.`
          );
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }

  private static parseSchema<U extends EnvSchema>(
    schema: U,
    context: ParseContext & { defaultsUsed?: Set<string> }
  ): ParseResult<U> {
    const parsedEnv = {} as ParsedEnv<U>;
    const errors: string[] = [];
    const defaultsUsed = context.defaultsUsed ?? new Set<string>();

    for (const key in schema) {
      const declaration = schema[key];
      const isRequired = declaration.required ?? true;
      const { rawName, rawValue } = this.resolveRawValue(key, context);

      if (isValueMissing(rawValue, declaration)) {
        if (declaration.default !== undefined) {
          const defaultValue = this.resolveDefaultValue(declaration);
          const finalized = this.finalizeValue(
            declaration,
            defaultValue,
            rawName,
            errors
          );
          if (finalized === undefined) continue;
          (parsedEnv as Record<string, unknown>)[key] = finalized;
          defaultsUsed.add(key);
          continue;
        }

        if (isRequired) {
          errors.push(
            `[Env Manager] - Missing required environment variable: ${rawName}`
          );
          continue;
        }

        (parsedEnv as Record<string, unknown>)[key] = undefined;
        continue;
      }

      try {
        const parsedValue = this.parseValue(
          declaration,
          rawValue as string,
          rawName,
          errors
        );
        if (parsedValue === undefined) continue;

        const finalized = this.finalizeValue(
          declaration,
          parsedValue,
          rawName,
          errors,
          rawValue
        );
        if (finalized === undefined) continue;

        (parsedEnv as Record<string, unknown>)[key] = finalized;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        errors.push(
          this.maskInMessage(message, declaration, rawValue)
        );
      }
    }

    return {
      data: Object.freeze(parsedEnv),
      errors,
      defaultsUsed,
    };
  }

  private static parseValue(
    declaration: EnvDeclaration,
    rawValue: string,
    rawName: string,
    errors: string[]
  ): unknown | undefined {
    switch (declaration.type) {
      case "string": {
        let parsedValue = String(rawValue);
        if (declaration.trim !== false) {
          parsedValue = parsedValue.trim();
        }
        return parsedValue;
      }
      case "number":
      case "integer": {
        const parsedValue = Number(rawValue);
        if (isNaN(parsedValue)) {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} is not a valid number.`
          );
          return undefined;
        }
        return parsedValue;
      }
      case "boolean": {
        const strict = declaration.strict ?? true;
        const lowerRaw = String(rawValue).toLowerCase();
        if (strict) {
          if (
            lowerRaw !== "true" &&
            lowerRaw !== "false" &&
            lowerRaw !== "1" &&
            lowerRaw !== "0"
          ) {
            errors.push(
              `[Env Manager] - Environment variable ${rawName} is not a valid boolean. Use "true", "false", "1", or "0".`
            );
            return undefined;
          }
          return lowerRaw === "true" || lowerRaw === "1";
        }
        if (["true", "1", "yes", "on"].includes(lowerRaw)) return true;
        if (["false", "0", "no", "off"].includes(lowerRaw)) return false;
        errors.push(
          `[Env Manager] - Environment variable ${rawName} is not a valid boolean. Use "true", "false", "yes", "no", "1", "0", "on", or "off".`
        );
        return undefined;
      }
      case "array": {
        const separator = declaration.separator ?? ",";
        return String(rawValue)
          .split(separator)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      case "json": {
        try {
          return JSON.parse(String(rawValue));
        } catch {
          errors.push(
            `[Env Manager] - Environment variable ${rawName} is not valid JSON.`
          );
          return undefined;
        }
      }
      case "enum": {
        return String(rawValue);
      }
      default:
        return rawValue;
    }
  }

  private initCurrentScope(config?: EnvManagerConfig): string | null {
    if (!this.enableScopes) return null;
    if (config?.resolveScope) {
      return config.resolveScope(this.source);
    }
    return this.source.NODE_ENV || null;
  }

  get<K extends keyof T>(key: K): ParsedEnv<T>[K] {
    return this._env[key];
  }

  data(): ParsedEnv<T> {
    return this._env;
  }

  safe(): Record<keyof T, unknown> {
    const masked = {} as Record<keyof T, unknown>;
    for (const key in this.schema) {
      const val = this._env[key];
      const declaration = this.schema[key];
      if (val === undefined) {
        masked[key] = undefined;
      } else if (declaration.sensitive) {
        masked[key] = "***";
      } else {
        masked[key] = val;
      }
    }
    return masked;
  }

  summarize(): Record<keyof T, EnvSummaryEntry> {
    const summary = {} as Record<keyof T, EnvSummaryEntry>;
    for (const key in this.schema) {
      const rawName = resolvePrefixedName(
        String(key),
        this.enableScopes,
        this.currentScope,
        this.scopes
      );
      let rawValue = this.source[rawName];

      if (rawValue === undefined || rawValue === null) {
        if (
          this.enableScopes &&
          this.currentScope &&
          rawName !== String(key)
        ) {
          rawValue = this.source[String(key)];
        }
      }

      const declaration = this.schema[key];
      const found =
        rawValue !== undefined &&
        rawValue !== null &&
        !isValueMissing(rawValue, declaration);
      const isDefault = this.defaultsUsed.has(String(key));
      const sensitive = declaration.sensitive ?? false;
      const val = this._env[key];

      summary[key] = {
        found,
        isDefault,
        sensitive,
        value: sensitive && val !== undefined ? "***" : val,
      };
    }
    return summary;
  }
}

export default EnvManager;
