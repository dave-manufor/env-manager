import { EnvManagerConfig, EnvSchema, ParsedEnv, RawEnvSource } from "./types";

class EnvManager<T extends EnvSchema> {
  private source: RawEnvSource;
  private _env: ParsedEnv<T>;
  private schema: T;
  private enableScopes: boolean = false;
  private currentScope: string | null = null;
  private scopes: Record<string, string> = {
    development: "DEV",
    production: "PROD",
    test: "TEST",
    staging: "STAGE",
  };

  static create<T extends EnvSchema>(
    schema: T,
    source: RawEnvSource,
    config?: EnvManagerConfig
  ): EnvManager<T> {
    return new EnvManager(schema, source, config);
  }

  private constructor(
    schema: T,
    source: RawEnvSource,
    config?: EnvManagerConfig
  ) {
    // Initialize properties
    if (!source) {
      throw new Error("[Env Manager] - Env source is undefined.");
    }
    this.source = source;
    this.currentScope = this.initCurrentScope(config);
    this.schema = schema;
    if (config) {
      if (config.scopes) {
        this.scopes = { ...this.scopes, ...config.scopes };
      }
      if (config.enableScopes !== undefined) {
        this.enableScopes = config.enableScopes;
        if (this.enableScopes && !this.currentScope) {
          throw new Error(
            `[Env Manager] - Scopes enabled but current scope could not be determined from source. Ensure NODE_ENV is set (${Object.keys(
              this.scopes
            ).join(" | ")}).`
          );
        }
      }
    }
    this._env = this.parseEnv();
  }

  private initCurrentScope(config?: EnvManagerConfig): string | null {
    if (config?.resolveScope) {
      return config.resolveScope(this.source);
    }
    return this.source.NODE_ENV || null;
  }

  private getPrefixedName(name: string): string {
    if (this.enableScopes && this.currentScope) {
      const scope = this.currentScope;
      const prefix = this.scopes[scope] ? `${this.scopes[scope]}_` : "";
      return `${prefix}${name}`;
    }
    return name;
  }

  private parseEnv(): ParsedEnv<T> {
    const parsedEnv = {} as ParsedEnv<T>;

    for (const key in this.schema) {
      const declaration = this.schema[key];
      const isRequired = declaration.required ?? true;
      let rawName = this.getPrefixedName(key);
      let rawValue = this.source[rawName];

      if (rawValue === undefined || rawValue === null) {
        if (this.enableScopes && this.currentScope && rawName !== key) {
          rawValue = this.source[key];
          if (rawValue !== undefined && rawValue !== null) {
            rawName = key;
          }
        }
      }

      if (rawValue === undefined || rawValue === null) {
        if (isRequired) {
          throw new Error(
            `[Env Manager] - Missing required environment variable: ${rawName}`
          );
        } else {
          (parsedEnv as any)[key] = undefined;
          continue;
        }
      }

      const maskValue = (msg: string) => {
        if (declaration.sensitive && rawValue) {
          return msg.split(rawValue).join("***");
        }
        return msg;
      };

      let parsedValue: any;
      switch (declaration.type) {
        case "string":
          parsedValue = String(rawValue);
          if (declaration.minLength !== undefined && parsedValue.length < declaration.minLength) {
            throw new Error(`[Env Manager] - Environment variable ${rawName} must be at least ${declaration.minLength} characters.`);
          }
          if (declaration.maxLength !== undefined && parsedValue.length > declaration.maxLength) {
            throw new Error(`[Env Manager] - Environment variable ${rawName} must be at most ${declaration.maxLength} characters.`);
          }
          if (declaration.pattern && !declaration.pattern.test(parsedValue)) {
            throw new Error(`[Env Manager] - Environment variable ${rawName} does not match the required pattern.`);
          }
          break;
        case "number":
        case "integer":
          parsedValue = Number(rawValue);
          if (isNaN(parsedValue)) {
            throw new Error(
              `[Env Manager] - Environment variable ${rawName} is not a valid number.`
            );
          }
          if (declaration.type === "integer" && !Number.isInteger(parsedValue)) {
            throw new Error(`[Env Manager] - Environment variable ${rawName} is not a valid integer.`);
          }
          if (declaration.min !== undefined && parsedValue < declaration.min) {
            throw new Error(`[Env Manager] - Environment variable ${rawName} must be at least ${declaration.min}.`);
          }
          if (declaration.max !== undefined && parsedValue > declaration.max) {
            throw new Error(`[Env Manager] - Environment variable ${rawName} must be at most ${declaration.max}.`);
          }
          break;
        case "boolean":
          const strict = declaration.strict ?? true;
          const lowerRaw = String(rawValue).toLowerCase();
          if (strict) {
            if (
              lowerRaw !== "true" &&
              lowerRaw !== "false" &&
              lowerRaw !== "1" &&
              lowerRaw !== "0"
            ) {
              throw new Error(
                `[Env Manager] - Environment variable ${rawName} is not a valid boolean. Use "true", "false", "1", or "0".`
              );
            }
            parsedValue = lowerRaw === "true" || lowerRaw === "1";
          } else {
            if (["true", "1", "yes", "on"].includes(lowerRaw)) {
              parsedValue = true;
            } else if (["false", "0", "no", "off"].includes(lowerRaw)) {
              parsedValue = false;
            } else {
              throw new Error(
                `[Env Manager] - Environment variable ${rawName} is not a valid boolean. Use "true", "false", "yes", "no", "1", "0", "on", or "off".`
              );
            }
          }
          break;
      }

      if (declaration.validator) {
        const result = (declaration.validator as any)(parsedValue);
        const message = `[Env Manager] - Environment variable ${rawName} failed custom validation. ${
          typeof result === "string" ? maskValue(result) : ""
        }`;
        if (result !== true) {
          throw new Error(message);
        }
      }

      (parsedEnv as any)[key] = parsedValue;
    }

    // Freeze the parsed environment to prevent modifications
    return Object.freeze(parsedEnv);
  }

  data(): ParsedEnv<T> {
    return this._env;
  }

  mask(): Record<string, any> {
    const masked: Record<string, any> = {};
    for (const key in this.schema) {
      const val = (this._env as any)[key];
      if (val !== undefined) {
        masked[key] = this.schema[key].sensitive ? "***" : val;
      }
    }
    return masked;
  }

  summarize(): Record<string, { found: boolean; isDefault: boolean; sensitive: boolean; value: any }> {
    const summary: Record<string, { found: boolean; isDefault: boolean; sensitive: boolean; value: any }> = {};
    for (const key in this.schema) {
      const rawName = this.getPrefixedName(key);
      const rawValue = this.source[rawName];
      const declaration = this.schema[key];
      const found = rawValue !== undefined && rawValue !== null;
      const isDefault = false; // To be implemented when defaults are added
      const sensitive = declaration.sensitive ?? false;
      const val = (this._env as any)[key];

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
