import * as fs from "fs";
import * as path from "path";
import {
  fromFile,
  generateExample,
  defineEnvSchema,
  mergeSchemas,
} from "../src/helpers";

describe("Helpers", () => {
  describe("generateExample", () => {
    it("generates a valid .env.example string", () => {
      const schema = defineEnvSchema({
        API_KEY: {
          type: "string",
          required: true,
          description: "Stripe API key",
        },
        PORT: { type: "number", required: true },
        DEBUG: { type: "boolean", required: false },
        MODE: { type: "enum", values: ["dev", "prod"] as const },
      });

      const example = generateExample(schema);
      expect(example).toContain("# Stripe API key");
      expect(example).toContain("# Type: string (Required)");
      expect(example).toContain("API_KEY=");
      expect(example).toContain("# Type: number (Required)");
      expect(example).toContain("PORT=0");
      expect(example).toContain("# Type: boolean (Optional)");
      expect(example).toContain("DEBUG=false");
      expect(example).toContain("MODE=dev");
    });
  });

  describe("mergeSchemas", () => {
    it("merges two schemas", () => {
      const a = defineEnvSchema({ A: { type: "string" } });
      const b = defineEnvSchema({ B: { type: "number" } });
      const merged = mergeSchemas(a, b);
      expect(merged).toHaveProperty("A");
      expect(merged).toHaveProperty("B");
    });
  });

  describe("fromFile", () => {
    const testEnvPath = path.join(process.cwd(), ".env.test");

    beforeAll(() => {
      fs.writeFileSync(
        testEnvPath,
        `
# This is a comment
export API_KEY=secret_key
PORT=8080
DEBUG=true
EMPTY=
QUOTED="some value"
INLINE=value # inline comment
      `.trim()
      );
    });

    afterAll(() => {
      if (fs.existsSync(testEnvPath)) {
        fs.unlinkSync(testEnvPath);
      }
    });

    it("parses .env file correctly", () => {
      const source = fromFile(".env.test");
      expect(source["API_KEY"]).toBe("secret_key");
      expect(source["PORT"]).toBe("8080");
      expect(source["DEBUG"]).toBe("true");
      expect(source["EMPTY"]).toBe("");
      expect(source["QUOTED"]).toBe("some value");
      expect(source["INLINE"]).toBe("value");
    });

    it("throws if file not found", () => {
      expect(() => fromFile(".env.nonexistent")).toThrow(/File not found/);
    });
  });
});
