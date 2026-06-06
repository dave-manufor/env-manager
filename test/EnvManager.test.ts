import EnvManager from "../src/EnvManager";
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

  it("throws on missing required variable", () => {
    const badSource: Partial<typeof baseSource> = { ...baseSource };
    delete badSource.STRING_VAR;
    expect(() => EnvManager.create(baseSchema, badSource)).toThrow(
      /Missing required environment variable/
    );
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
    const source = { OPTIONAL_VAR: undefined };
    const manager = EnvManager.create(schema, source);
    expect(manager.data().OPTIONAL_VAR).toBeUndefined();
  });

  it("defaults required to true", () => {
    const schema = defineEnvSchema({
      STRING_VAR: { type: "string" },
    });
    const source = { STRING_VAR: "abc" };
    const manager = EnvManager.create(schema, source);
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
      const source = { STRING_VAR: "abc" };
      const config: EnvManagerConfig = { enableScopes: true };
      expect(() => EnvManager.create(schema, source, config)).toThrow(
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
      // DEV_STRING_VAR is not present, should fallback to STRING_VAR
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
  });

  it("supports boolean false and 0", () => {
    const schema = defineEnvSchema({
      BOOL_VAR: { type: "boolean", required: true },
    });
    const sourceTrue = { BOOL_VAR: "true" };
    const sourceFalse = { BOOL_VAR: "false" };
    const sourceOne = { BOOL_VAR: "1" };
    const sourceZero = { BOOL_VAR: "0" };
    expect(EnvManager.create(schema, sourceTrue).data().BOOL_VAR).toBe(true);
    expect(EnvManager.create(schema, sourceOne).data().BOOL_VAR).toBe(true);
    expect(EnvManager.create(schema, sourceFalse).data().BOOL_VAR).toBe(false);
    expect(EnvManager.create(schema, sourceZero).data().BOOL_VAR).toBe(false);
  });

  describe("Constraints", () => {
    it("string length constraints", () => {
      const schema = defineEnvSchema({
        SHORT: { type: "string", minLength: 2 },
        LONG: { type: "string", maxLength: 5 },
      });
      expect(() => EnvManager.create(schema, { SHORT: "a", LONG: "123" })).toThrow(/must be at least 2 characters/);
      expect(() => EnvManager.create(schema, { SHORT: "ab", LONG: "123456" })).toThrow(/must be at most 5 characters/);
      expect(EnvManager.create(schema, { SHORT: "ab", LONG: "12345" }).data().SHORT).toBe("ab");
    });

    it("string pattern constraint", () => {
      const schema = defineEnvSchema({
        PATTERN: { type: "string", pattern: /^[A-Z]+$/ },
      });
      expect(() => EnvManager.create(schema, { PATTERN: "abc" })).toThrow(/does not match the required pattern/);
      expect(EnvManager.create(schema, { PATTERN: "ABC" }).data().PATTERN).toBe("ABC");
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
      
      expect(() => EnvManager.create(schema, { STRICT_BOOL: "yes", LOOSE_BOOL: "no" })).toThrow(/not a valid boolean. Use "true", "false", "1", or "0"/);
      
      const looseManager = EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "yes" });
      expect(looseManager.data().LOOSE_BOOL).toBe(true);

      expect(EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "no" }).data().LOOSE_BOOL).toBe(false);
      expect(EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "ON" }).data().LOOSE_BOOL).toBe(true);
      expect(EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "off" }).data().LOOSE_BOOL).toBe(false);
      expect(EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "TRUE" }).data().LOOSE_BOOL).toBe(true);
      expect(EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "1" }).data().LOOSE_BOOL).toBe(true);
      expect(EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "0" }).data().LOOSE_BOOL).toBe(false);

      expect(() => EnvManager.create(schema, { STRICT_BOOL: "true", LOOSE_BOOL: "invalid" })).toThrow(/Use "true", "false", "yes", "no", "1", "0", "on", or "off"/);
    });
  });

  it("handles empty schema", () => {
    const manager = EnvManager.create({}, baseSource);
    expect(manager.data()).toEqual({});
  });
  describe("Security features", () => {
    it("mask() returns redacted values for sensitive variables", () => {
      const schema = defineEnvSchema({
        SECRET: { type: "string", sensitive: true },
        PUBLIC: { type: "string", sensitive: false },
      });
      const source = { SECRET: "my-secret", PUBLIC: "my-public" };
      const manager = EnvManager.create(schema, source);
      
      const masked = manager.mask();
      expect(masked.SECRET).toBe("***");
      expect(masked.PUBLIC).toBe("my-public");
      
      // Original data should remain untouched
      expect(manager.data().SECRET).toBe("my-secret");
    });

    it("summarize() returns correct metadata", () => {
      const schema = defineEnvSchema({
        SECRET: { type: "string", sensitive: true },
        PUBLIC: { type: "string" },
        MISSING_OPTIONAL: { type: "string", required: false },
      });
      const source = { SECRET: "my-secret", PUBLIC: "my-public" };
      const manager = EnvManager.create(schema, source);
      
      const summary = manager.summarize();
      expect(summary.SECRET).toEqual({ found: true, isDefault: false, sensitive: true, value: "***" });
      expect(summary.PUBLIC).toEqual({ found: true, isDefault: false, sensitive: false, value: "my-public" });
      expect(summary.MISSING_OPTIONAL).toEqual({ found: false, isDefault: false, sensitive: false, value: undefined });
    });

    it("redacts sensitive values from validation error messages", () => {
      const schema = defineEnvSchema({
        SECRET: {
          type: "string",
          sensitive: true,
          validator: (val) => val === "valid" || `Invalid value provided: ${val}`,
        },
      });
      const source = { SECRET: "super-secret" };
      
      expect(() => EnvManager.create(schema, source)).toThrow(
        /Invalid value provided: \*\*\*/
      );
      
      // And ensure it does NOT contain the secret
      try {
        EnvManager.create(schema, source);
      } catch (e: any) {
        expect(e.message).not.toContain("super-secret");
      }
    });
  });
});
