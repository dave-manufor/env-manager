import * as fs from "fs";
import * as path from "path";
import { EnvManagerConfig, EnvDeclaration, EnvSchema, RawEnvSource } from "./types";

export function defineEnvSchema<T extends EnvSchema>(schema: T): T {
  return schema;
}

export function defineEnvConfig<T extends EnvManagerConfig>(config: T): T {
  return config;
}

export function mergeSchemas<A extends EnvSchema, B extends EnvSchema>(
  schemaA: A,
  schemaB: B
): A & B {
  return { ...schemaA, ...schemaB };
}

/**
 * Lightweight .env file parser. Handles comments, quoted values, `export`
 * prefixes, and inline comments. Does not support multiline values, variable
 * interpolation, or escaped quotes within values. For full dotenv compatibility,
 * use the `dotenv` package and pass the parsed result to EnvManager.
 */
export function fromFile(filePath: string): RawEnvSource {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`[Env Manager] - File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf-8");
  const source: RawEnvSource = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("export ")) {
      trimmed = trimmed.slice("export ".length).trim();
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const inlineComment = value.indexOf(" #");
      if (inlineComment !== -1) {
        value = value.slice(0, inlineComment).trim();
      }
    }

    source[key] = value;
  }
  return source;
}

export type GenerateExampleOptions = {
  includeDescriptions?: boolean;
};

function exampleValueFor(declaration: EnvDeclaration): string {
  switch (declaration.type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return "0";
    case "boolean":
      return "false";
    case "array":
      return "";
    case "json":
      return "{}";
    case "enum":
      return declaration.values[0] ?? "";
    default:
      return "";
  }
}

export function generateExample<T extends EnvSchema>(
  schema: T,
  options?: GenerateExampleOptions
): string {
  const includeDescriptions = options?.includeDescriptions ?? true;
  let result = "";

  for (const key in schema) {
    const declaration = schema[key];
    const isRequired = declaration.required ?? true;

    if (includeDescriptions && declaration.description) {
      result += `# ${declaration.description}\n`;
    }
    result += `# Type: ${declaration.type}${
      isRequired ? " (Required)" : " (Optional)"
    }\n`;
    result += `${key}=${exampleValueFor(declaration)}\n\n`;
  }

  return result.trim() + "\n";
}
