export type EnvManagerConfig = {
  /** Set to true to enable scoped environments */
  enableScopes?: boolean;
  /**
   * A mapping of scopes to their respective prefixes.
   * Merged with defaults — passing custom scopes does not remove defaults.
   */
  scopes?: Record<string, string>;
  resolveScope?: (source: RawEnvSource) => string | null;
};

export type EnvVariableType =
  | "string"
  | "number"
  | "boolean"
  | "integer"
  | "array"
  | "json"
  | "enum";

type BaseFields<T> = {
  required?: boolean;
  default?: T | (() => T);
  transform?: (value: T) => T;
  validator?: (value: T) => boolean | string;
  description?: string;
  sensitive?: boolean;
};

export type StringEnvDeclaration = BaseFields<string> & {
  type: "string";
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  /** Trim leading/trailing whitespace before parsing. Default: true */
  trim?: boolean;
  /**
   * Treat an empty string (e.g. `KEY=` in a .env file) as a valid value.
   * By default, empty strings are treated as missing.
   */
  allowEmpty?: boolean;
};

export type NumberEnvDeclaration = BaseFields<number> & {
  type: "number";
  min?: number;
  max?: number;
};

export type IntegerEnvDeclaration = BaseFields<number> & {
  type: "integer";
  min?: number;
  max?: number;
};

export type BooleanEnvDeclaration = BaseFields<boolean> & {
  type: "boolean";
  strict?: boolean;
};

export type ArrayEnvDeclaration = BaseFields<string[]> & {
  type: "array";
  separator?: string;
};

export type JsonEnvDeclaration<T = unknown> = BaseFields<T> & {
  type: "json";
};

export type EnumEnvDeclaration<
  V extends readonly string[] = readonly string[]
> = BaseFields<V[number]> & {
  type: "enum";
  values: V;
};

export type EnvDeclaration =
  | StringEnvDeclaration
  | NumberEnvDeclaration
  | IntegerEnvDeclaration
  | BooleanEnvDeclaration
  | ArrayEnvDeclaration
  | JsonEnvDeclaration
  | EnumEnvDeclaration;

export type EnvSchema = {
  [key: string]: EnvDeclaration;
};

export type InferType<D extends EnvDeclaration> = D extends StringEnvDeclaration
  ? string
  : D extends NumberEnvDeclaration
  ? number
  : D extends IntegerEnvDeclaration
  ? number
  : D extends BooleanEnvDeclaration
  ? boolean
  : D extends ArrayEnvDeclaration
  ? string[]
  : D extends JsonEnvDeclaration<infer J>
  ? J
  : D extends EnumEnvDeclaration<infer V>
  ? V[number]
  : never;

export type ParsedEnv<T extends EnvSchema> = {
  [K in keyof T]: T[K] extends { default: unknown }
    ? InferType<T[K]>
    : T[K] extends { required: false }
    ? InferType<T[K]> | undefined
    : InferType<T[K]>;
};

export type RawEnvSource = {
  [key: string]: string | undefined;
};

export type EnvSourceInput = RawEnvSource | RawEnvSource[];

export type ValidationResult<T extends EnvSchema> =
  | { success: true; data: ParsedEnv<T>; defaultsUsed: Set<string> }
  | { success: false; errors: string[] };

export type InferEnvSchema<T extends { data(): ParsedEnv<EnvSchema> }> =
  T extends { data(): ParsedEnv<infer S> } ? S : never;
export type InferParsedEnv<T extends EnvSchema> = ParsedEnv<T>;

export type ZodSchemaLike = {
  safeParse: (
    data: unknown
  ) =>
    | { success: true; data: unknown }
    | { success: false; error: { errors: { message: string }[] } };
};

export type EnvSummaryEntry = {
  found: boolean;
  isDefault: boolean;
  sensitive: boolean;
  value: unknown;
};
