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
    this.currentScope = this.initCurrentScope();
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

  private initCurrentScope(): string | null {
    return this.source.NODE_ENV || null;
  }

  private getPrefixedName(name: string): string {
    if (this.enableScopes && this.currentScope) {
      const scope = this.currentScope;
      const prefix = `${this.scopes[scope]}_` || "";
      return `${prefix}${name}`;
    }
    return name;
  }

  private parseEnv(): ParsedEnv<T> {
    const parsedEnv = {} as ParsedEnv<T>;

    for (const key in this.schema) {
      const declaration = this.schema[key];
      const isRequired = declaration.required ?? true;
      const rawName = this.getPrefixedName(key);
      const rawValue = this.source[rawName];

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
          if (declaration.validator) {
            const result = declaration.validator(parsedValue);
            const message = `[Env Manager] - Environment variable ${rawName} failed custom validation. ${
              typeof result === "string" ? maskValue(result) : ""
            }`;
            if (result !== true) {
              throw new Error(message);
            }
          }
          break;
        case "number":
          parsedValue = Number(rawValue);
          if (isNaN(parsedValue)) {
            throw new Error(
              `[Env Manager] - Environment variable ${rawName} is not a valid number.`
            );
          }
          if (declaration.validator) {
            const result = declaration.validator(parsedValue);
            const message = `[Env Manager] - Environment variable ${rawName} failed custom validation. ${
              typeof result === "string" ? maskValue(result) : ""
            }`;
            if (result !== true) {
              throw new Error(message);
            }
          }
          break;
        case "boolean":
          if (
            rawValue !== "true" &&
            rawValue !== "false" &&
            rawValue !== "1" &&
            rawValue !== "0"
          ) {
            throw new Error(
              `[Env Manager] - Environment variable ${rawName} is not a valid boolean. Use "true", "false", "1", or "0".`
            );
          }
          parsedValue = rawValue === "true" || rawValue === "1";
          if (declaration.validator) {
            const result = declaration.validator(parsedValue);
            const message = `[Env Manager] - Environment variable ${rawName} failed custom validation. ${
              typeof result === "string" ? maskValue(result) : ""
            }`;
            if (result !== true) {
              throw new Error(message);
            }
          }
          break;
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
