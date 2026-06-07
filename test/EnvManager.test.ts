import EnvManager from "../src/EnvManager";
import { EnvValidationError } from "../src/errors";
import { EnvManagerConfig } from "../src/types";
import { defineEnvSchema } from "../src/helpers";

describe("EnvManager", () => {
  const baseSchema = defineEnvSchema({
    STRING_VAR: { type: "string", required: true },
    NUMBER_VAR: { type: "number", required: true },
    BOOL_VAR: { type: "boolean", required: true },
    OPTIONAL_VAR: { type: "string", required: false },
  });

  const baseSource = {
    STRING_VAR: "hello",
    NUMBER_VAR: "42",
    BOOL_VAR: "true",
    OPTIONAL_VAR: undefined,
    NODE_ENV: "development",
    DEV_STRING_VAR: "dev-hello",
    PROD_STRING_VAR: "prod-hello",
    TEST_STRING_VAR: "test-hello",
    STAGE_STRING_VAR: "stage-hello",
  };

  it("parses all types correctly", () => {
    const manager = EnvManager.create(baseSchema, baseSource);
    const env = manager.data();
    expect(typeof env.STRING_VAR).toBe("string");
    expect(typeof env.NUMBER_VAR).toBe("number");
    expect(typeof env.BOOL_VAR).toBe("boolean");
    expect(typeof env.OPTIONAL_VAR).toBe("undefined");
    expect(env.STRING_VAR).toBe("hello");
    expect(env.NUMBER_VAR).toBe(42);
    expect(env.BOOL_VAR).toBe(true);
    expect(env.OPTIONAL_VAR).toBeUndefined();
  });

  it("throws EnvValidationError on missing required variable", () => {
    const badSource: Partial<typeof baseSource> = { ...baseSource };
    delete badSource.STRING_VAR;
    expect(() => EnvManager.create(baseSchema, badSource)).toThrow(
      EnvValidationError
    );
    try {
      EnvManager.create(baseSchema, badSource);
    } catch (e) {
      expect((e as EnvValidationError).errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Missing required environment variable/),
        ])
      );
    }
  });

  it("throws on invalid number", () => {
    const badSource = { ...baseSource, NUMBER_VAR: "not-a-number" };
    expect(() => EnvManager.create(baseSchema, badSource)).toThrow(
      /not a valid number/
    );
  });

  it("throws on invalid boolean", () => {
    const badSource = { ...baseSource, BOOL_VAR: "not-a-bool" };
    expect(() => EnvManager.create(baseSchema, badSource)).toThrow(
      /not a valid boolean/
    );
  });

  it("supports optional variables", () => {
    const schema = defineEnvSchema({
      OPTIONAL_VAR: { type: "string", required: false },
    });
    const manager = EnvManager.create(schema, {});
    expect(manager.data().OPTIONAL_VAR).toBeUndefined();
  });

  it("defaults required to true", () => {
    const schema = defineEnvSchema({
      STRING_VAR: { type: "string" },
    });
    const manager = EnvManager.create(schema, { STRING_VAR: "abc" });
    expect(manager.data().STRING_VAR).toBe("abc");
  });

  describe("Scopes", () => {
    it("uses scope prefix when enabled", () => {
      const schema = defineEnvSchema({
        STRING_VAR: { type: "string", required: true },
      });
      const source = { DEV_STRING_VAR: "dev-hello", NODE_ENV: "development" };
      const config: EnvManagerConfig = { enableScopes: true };
      const manager = EnvManager.create(schema, source, config);
      expect(manager.data().STRING_VAR).toBe("dev-hello");
    });

    it("throws if scope enabled but NODE_ENV missing", () => {
      const schema = defineEnvSchema({
        STRING_VAR: { type: "string", required: true },
      });
      const config: EnvManagerConfig = { enableScopes: true };
      expect(() => EnvManager.create(schema, { STRING_VAR: "abc" }, config)).toThrow(
        /Scopes enabled but current scope could not be determined/
      );
    });

    it("supports custom scopes", () => {
      const schema = defineEnvSchema({
        STRING_VAR: { type: "string", required: true },
      });
      const source = { CUSTOM_STRING_VAR: "custom-hello", NODE_ENV: "custom" };
      const config: EnvManagerConfig = {
        enableScopes: true,
        scopes: { custom: "CUSTOM" },
      };
      const manager = EnvManager.create(schema, source, config);
      expect(manager.data().STRING_VAR).toBe("custom-hello");
    });

    it("falls back to un-prefixed variable if scoped one is missing", () => {
      const schema = defineEnvSchema({
        STRING_VAR: { type: "string", required: true },
      });
      const source = { STRING_VAR: "fallback-hello", NODE_ENV: "development" };
      const config: EnvManagerConfig = { enableScopes: true };
      const manager = EnvManager.create(schema, source, config);
      expect(manager.data().STRING_VAR).toBe("fallback-hello");
    });

    it("uses custom resolveScope function", () => {
      const schema = defineEnvSchema({
        STRING_VAR: { type: "string", required: true },
      });
      const source = {
        STAGE_STRING_VAR: "stage-hello",
        MY_ENV_VAR: "staging",
      };
      const config: EnvManagerConfig = {
        enableScopes: true,
        resolveScope: (src) => src.MY_ENV_VAR || null,
      };
      const manager = EnvManager.create(schema, source, config);
      expect(manager.data().STRING_VAR).toBe("stage-hello");
    });

    it("strips trailing underscores from custom scopes", () => {
      const schema = defineEnvSchema({
        STRING_VAR: { type: "string", required: true },
      });
      const source = { CUSTOM_STRING_VAR: "custom-hello", NODE_ENV: "custom" };
      const config: EnvManagerConfig = {
        enableScopes: true,
        scopes: { custom: "CUSTOM_" },
      };
      const manager = EnvManager.create(schema, source, config);
      expect(manager.data().STRING_VAR).toBe("custom-hello");
    });
  });

  it("supports boolean false and 0", () => {
    const schema = defineEnvSchema({
      BOOL_VAR: { type: "boolean", required: true },
    });
    expect(EnvManager.create(schema, { BOOL_VAR: "true" }).data().BOOL_VAR).toBe(true);
    expect(EnvManager.create(schema, { BOOL_VAR: "1" }).data().BOOL_VAR).toBe(true);
    expect(EnvManager.create(schema, { BOOL_VAR: "false" }).data().BOOL_VAR).toBe(false);
    expect(EnvManager.create(schema, { BOOL_VAR: "0" }).data().BOOL_VAR).toBe(false);
  });

  it("handles empty schema", () => {
    const manager = EnvManager.create({}, baseSource);
    expect(manager.data()).toEqual({});
  });

  describe("Defaults and extended types", () => {
    it("supports default values", () => {
      const schema = defineEnvSchema({
        DEF_VAR: { type: "string", default: "default-val" },
        DEF_FN_VAR: { type: "string", default: () => "default-fn-val" },
      });
      const manager = EnvManager.create(schema, {});
      expect(manager.data().DEF_VAR).toBe("default-val");
      expect(manager.data().DEF_FN_VAR).toBe("default-fn-val");
    });

    it("validates default values through constraints", () => {
      const schema = defineEnvSchema({
        PORT: { type: "integer", default: 99999, min: 1, max: 65535 },
      });
      expect(() => EnvManager.create(schema, {})).toThrow(/must be at most 65535/);
    });

    it("aggregates errors", () => {
      const schema = defineEnvSchema({
        VAR_A: { type: "number" },
        VAR_B: { type: "boolean" },
        VAR_C: { type: "string" },
      });
      const source = {
        VAR_A: "not-a-number",
        VAR_B: "not-a-bool",
      };

      let error: EnvValidationError | undefined;
      try {
        EnvManager.create(schema, source);
      } catch (e) {
        error = e as EnvValidationError;
      }

      expect(error).toBeInstanceOf(EnvValidationError);
      expect(error!.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/VAR_A is not a valid number/),
          expect.stringMatching(/VAR_B is not a valid boolean/),
          expect.stringMatching(/Missing required environment variable: VAR_C/),
        ])
      );
    });

    it("supports array, json, enum, and integer types", () => {
      const schema = defineEnvSchema({
        ARR_VAR: { type: "array" },
        JSON_VAR: { type: "json" },
        ENUM_VAR: { type: "enum", values: ["dev", "prod", "test"] as const },
        INT_VAR: { type: "integer" },
      });

      const manager = EnvManager.create(schema, {
        ARR_VAR: "a, b, , c",
        JSON_VAR: '{"key": "value"}',
        ENUM_VAR: "prod",
        INT_VAR: "42",
      });

      const env = manager.data();
      expect(env.ARR_VAR).toEqual(["a", "b", "c"]);
      expect(env.JSON_VAR).toEqual({ key: "value" });
      expect(env.ENUM_VAR).toBe("prod");
      expect(env.INT_VAR).toBe(42);
    });

    it("throws correctly for invalid extended type inputs", () => {
      const schema = defineEnvSchema({
        JSON_VAR: { type: "json" },
        ENUM_VAR: { type: "enum", values: ["dev", "prod"] as const },
        INT_VAR: { type: "integer" },
      });

      const source = {
        JSON_VAR: '{"key": "value"',
        ENUM_VAR: "staging",
        INT_VAR: "42.5",
      };

      expect(() => EnvManager.create(schema, source)).toThrow(/is not valid JSON/);
      expect(() => EnvManager.create(schema, source)).toThrow(/must be one of: dev, prod/);
      expect(() => EnvManager.create(schema, source)).toThrow(/is not a valid integer/);
    });

    it("supports transform functions", () => {
      const schema = defineEnvSchema({
        STR_VAR: {
          type: "string",
          transform: (val: string) => val.toUpperCase(),
        },
      });
      const manager = EnvManager.create(schema, { STR_VAR: "hello" });
      expect(manager.data().STR_VAR).toBe("HELLO");
    });
  });

  describe("API ergonomics", () => {
    it("supports individual variable access via get()", () => {
      const manager = EnvManager.create(baseSchema, baseSource);
      expect(manager.get("STRING_VAR")).toBe("hello");
      expect(manager.get("NUMBER_VAR")).toBe(42);
      expect(manager.get("OPTIONAL_VAR")).toBeUndefined();
    });

    it("has a separate validate() method that returns results", () => {
      const validResult = EnvManager.validate(baseSchema, baseSource);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.data.STRING_VAR).toBe("hello");
        expect(validResult.defaultsUsed.size).toBe(0);
      }

      const invalidSource: Partial<typeof baseSource> = {
        ...baseSource,
        NUMBER_VAR: "not-a-number",
      };
      delete invalidSource.STRING_VAR;
      const invalidResult = EnvManager.validate(baseSchema, invalidSource);
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.errors.length).toBe(2);
      }
    });

    it("merges multiple sources with priority", () => {
      const source1 = { STRING_VAR: "first", NUMBER_VAR: "10", BOOL_VAR: "false" };
      const source2 = { STRING_VAR: "second", BOOL_VAR: "true" };
      const manager = EnvManager.create(baseSchema, [source1, source2]);
      expect(manager.get("STRING_VAR")).toBe("second");
      expect(manager.get("NUMBER_VAR")).toBe(10);
      expect(manager.get("BOOL_VAR")).toBe(true);
    });

    it("supports safe() to redact sensitive variables", () => {
      const schema = defineEnvSchema({
        PUBLIC_VAR: { type: "string" },
        SECRET_VAR: { type: "string", sensitive: true },
        OPTIONAL_SECRET: { type: "string", sensitive: true, required: false },
      });
      const manager = EnvManager.create(schema, {
        PUBLIC_VAR: "hello",
        SECRET_VAR: "world",
      });
      expect(manager.safe()).toEqual({
        PUBLIC_VAR: "hello",
        SECRET_VAR: "***",
        OPTIONAL_SECRET: undefined,
      });
    });
  });

  describe("Constraints", () => {
    it("string length constraints", () => {
      const schema = defineEnvSchema({
        SHORT: { type: "string", minLength: 2 },
        LONG: { type: "string", maxLength: 5 },
      });
      expect(() => EnvManager.create(schema, { SHORT: "a", LONG: "123" })).toThrow(
        /must be at least 2 characters/
      );
      expect(() => EnvManager.create(schema, { SHORT: "ab", LONG: "123456" })).toThrow(
        /must be at most 5 characters/
      );
      expect(EnvManager.create(schema, { SHORT: "ab", LONG: "12345" }).data().SHORT).toBe("ab");
    });

    it("string pattern constraint", () => {
      const schema = defineEnvSchema({
        PATTERN: { type: "string", pattern: /^[A-Z]+$/ },
      });
      expect(() => EnvManager.create(schema, { PATTERN: "abc" })).toThrow(
        /does not match the required pattern/
      );
      expect(EnvManager.create(schema, { PATTERN: "ABC" }).data().PATTERN).toBe("ABC");
    });

    it("trims string values by default", () => {
      const schema = defineEnvSchema({
        TRIMMED: { type: "string" },
      });
      expect(EnvManager.create(schema, { TRIMMED: "  hello  " }).data().TRIMMED).toBe(
        "hello"
      );
    });

    it("can disable trimming", () => {
      const schema = defineEnvSchema({
        UNTRIMMED: { type: "string", trim: false },
      });
      expect(EnvManager.create(schema, { UNTRIMMED: "  hello  " }).data().UNTRIMMED).toBe(
        "  hello  "
      );
    });

    it("treats empty strings as missing by default", () => {
      const schema = defineEnvSchema({
        OPTIONAL: { type: "string", required: false },
        REQUIRED: { type: "string" },
      });
      expect(
        EnvManager.create(schema, { OPTIONAL: "", REQUIRED: "ok" }).data().OPTIONAL
      ).toBeUndefined();
      expect(() => EnvManager.create(schema, { REQUIRED: "" })).toThrow(
        /Missing required environment variable/
      );
    });

    it("allows empty strings when allowEmpty is set", () => {
      const schema = defineEnvSchema({
        EMPTY_OK: { type: "string", allowEmpty: true },
      });
      expect(EnvManager.create(schema, { EMPTY_OK: "" }).data().EMPTY_OK).toBe("");
    });

    it("number min/max constraints", () => {
      const schema = defineEnvSchema({
        NUM: { type: "number", min: 10, max: 20 },
      });
      expect(() => EnvManager.create(schema, { NUM: "9" })).toThrow(/must be at least 10/);
      expect(() => EnvManager.create(schema, { NUM: "21" })).toThrow(/must be at most 20/);
      expect(EnvManager.create(schema, { NUM: "15" }).data().NUM).toBe(15);
    });

    it("integer type and constraints", () => {
      const schema = defineEnvSchema({
        INT: { type: "integer", min: 0, max: 5 },
      });
      expect(() => EnvManager.create(schema, { INT: "1.5" })).toThrow(/not a valid integer/);
      expect(() => EnvManager.create(schema, { INT: "-1" })).toThrow(/must be at least 0/);
      expect(() => EnvManager.create(schema, { INT: "6" })).toThrow(/must be at most 5/);
      expect(EnvManager.create(schema, { INT: "3" }).data().INT).toBe(3);
    });

    it("boolean coercion with strict mode", () => {
      const schema = defineEnvSchema({
        STRICT_BOOL: { type: "boolean", strict: true },
        LOOSE_BOOL: { type: "boolean", strict: false },
      });

      expect(() =>
        EnvManager.create(schema, { STRICT_BOOL: "yes", LOOSE_BOOL: "no" })
      ).toThrow(/not a valid boolean. Use "true", "false", "1", or "0"/);

      expect(
        EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "yes" }).data().LOOSE_BOOL
      ).toBe(true);
      expect(
        EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "no" }).data().LOOSE_BOOL
      ).toBe(false);
      expect(
        EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "ON" }).data().LOOSE_BOOL
      ).toBe(true);
      expect(
        EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "off" }).data().LOOSE_BOOL
      ).toBe(false);
      expect(
        EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "TRUE" }).data().LOOSE_BOOL
      ).toBe(true);

      expect(() =>
        EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "invalid" })
      ).toThrow(/Use "true", "false", "yes", "no", "1", "0", "on", or "off"/);
    });

    it("validator returning false produces a validation error", () => {
      const schema = defineEnvSchema({
        VAR: {
          type: "string",
          validator: (val) => val.length > 3,
        },
      });
      expect(() => EnvManager.create(schema, { VAR: "ab" })).toThrow(
        /failed custom validation/
      );
    });
  });

  describe("Security", () => {
    it("safe() returns redacted values for sensitive variables", () => {
      const schema = defineEnvSchema({
        SECRET: { type: "string", sensitive: true },
        PUBLIC: { type: "string", sensitive: false },
      });
      const manager = EnvManager.create(schema, {
        SECRET: "my-secret",
        PUBLIC: "my-public",
      });

      const safe = manager.safe();
      expect(safe.SECRET).toBe("***");
      expect(safe.PUBLIC).toBe("my-public");
      expect(manager.data().SECRET).toBe("my-secret");
    });

    it("summarize() returns correct metadata", () => {
      const schema = defineEnvSchema({
        SECRET: { type: "string", sensitive: true },
        PUBLIC: { type: "string" },
        WITH_DEFAULT: { type: "string", default: "fallback" },
        MISSING_OPTIONAL: { type: "string", required: false },
        EMPTY_ALLOWED: { type: "string", allowEmpty: true },
      });
      const manager = EnvManager.create(schema, {
        SECRET: "my-secret",
        PUBLIC: "my-public",
        EMPTY_ALLOWED: "",
      });

      const summary = manager.summarize();
      expect(summary.SECRET).toEqual({
        found: true,
        isDefault: false,
        sensitive: true,
        value: "***",
      });
      expect(summary.PUBLIC).toEqual({
        found: true,
        isDefault: false,
        sensitive: false,
        value: "my-public",
      });
      expect(summary.WITH_DEFAULT).toEqual({
        found: false,
        isDefault: true,
        sensitive: false,
        value: "fallback",
      });
      expect(summary.MISSING_OPTIONAL).toEqual({
        found: false,
        isDefault: false,
        sensitive: false,
        value: undefined,
      });
      expect(summary.EMPTY_ALLOWED).toEqual({
        found: true,
        isDefault: false,
        sensitive: false,
        value: "",
      });
    });

    it("redacts sensitive values from validation error messages", () => {
      const schema = defineEnvSchema({
        SECRET: {
          type: "string",
          sensitive: true,
          validator: (val) => val === "valid" || `Invalid value provided: ${val}`,
        },
      });

      expect(() => EnvManager.create(schema, { SECRET: "super-secret" })).toThrow(
        /Invalid value provided: \*\*\*/
      );

      try {
        EnvManager.create(schema, { SECRET: "super-secret" });
      } catch (e) {
        expect((e as Error).message).not.toContain("super-secret");
      }
    });
  });

  describe("Developer tooling", () => {
    it("can generate a mock instance", () => {
      const mockManager = EnvManager.mock(baseSchema, {
        STRING_VAR: "override-string",
        NUMBER_VAR: 99,
      });
      const env = mockManager.data();
      expect(env.STRING_VAR).toBe("override-string");
      expect(env.NUMBER_VAR).toBe(99);
      expect(env.BOOL_VAR).toBe(true);
      expect(env.OPTIONAL_VAR).toBeUndefined();
    });
  });

  describe("Ecosystem adapters", () => {
    it("fromVite normalizes VITE_ prefixes", () => {
      const normalized = EnvManager.fromVite({
        VITE_API_URL: "https://api.example.com",
        NODE_ENV: "development",
      });
      expect(normalized).toEqual({
        API_URL: "https://api.example.com",
        VITE_API_URL: "https://api.example.com",
        NODE_ENV: "development",
      });
    });

    it("zodAdapter works with Zod-like schemas", () => {
      const mockZod = {
        safeParse: (val: unknown) => {
          if (typeof val === "string" && val.length >= 3) {
            return { success: true as const, data: val };
          }
          return {
            success: false as const,
            error: { errors: [{ message: "Too short" }] },
          };
        },
      };

      const schema = defineEnvSchema({
        MY_VAR: {
          type: "string",
          required: true,
          validator: EnvManager.zodAdapter(mockZod),
        },
      });

      expect(EnvManager.create(schema, { MY_VAR: "hello" }).data().MY_VAR).toBe("hello");
      expect(() => EnvManager.create(schema, { MY_VAR: "hi" })).toThrow(/Too short/);
    });
  });

  describe("Type inference", () => {
    it("supports default values without required flag", () => {
      const schema = defineEnvSchema({
        WITH_DEFAULT: { type: "string", default: "fallback" },
        NUM_DEFAULT: { type: "number", default: 42 },
        BOOL_DEFAULT: { type: "boolean", default: false },
      });
      const manager = EnvManager.create(schema, {});
      expect(manager.data().WITH_DEFAULT).toBe("fallback");
      expect(manager.data().NUM_DEFAULT).toBe(42);
      expect(manager.data().BOOL_DEFAULT).toBe(false);
    });

    it("prioritizes source value over default value", () => {
      const schema = defineEnvSchema({
        WITH_DEFAULT: { type: "string", default: "fallback" },
      });
      const manager = EnvManager.create(schema, { WITH_DEFAULT: "provided" });
      expect(manager.data().WITH_DEFAULT).toBe("provided");
    });

    it("supports enum type with validation", () => {
      const schema = defineEnvSchema({
        NODE_ENV: {
          type: "enum",
          values: ["development", "production", "test"] as const,
        },
      });
      expect(
        EnvManager.create(schema, { NODE_ENV: "production" }).data().NODE_ENV
      ).toBe("production");
    });

    it("throws on invalid enum value", () => {
      const schema = defineEnvSchema({
        NODE_ENV: {
          type: "enum",
          values: ["development", "production", "test"] as const,
        },
      });
      expect(() => EnvManager.create(schema, { NODE_ENV: "staging" })).toThrow(
        /must be one of: development, production, test/
      );
    });
  });
});
