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

  it("handles empty schema", () => {
    const manager = EnvManager.create({}, baseSource);
    expect(manager.data()).toEqual({});
  });
});
