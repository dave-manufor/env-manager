export type EnvManagerConfig = {
  /** Set to true to enable  scoped environments */
  enableScopes?: boolean;
  /** A mapping of scopes to their respective prefixes */
  scopes?: Record<string, string>;
  resolveScope?: (source: RawEnvSource) => string | null;
};

export type EnvVariableType = "string" | "number" | "boolean" | "integer";

export type PrimitiveMap<T extends EnvVariableType> = T extends "string"
  ? string
  : T extends "number" | "integer"
  ? number
  : T extends "boolean"
  ? boolean
  : never;

export type BaseEnvDeclaration<K extends EnvVariableType> = {
  type: K;
  validator?: (value: PrimitiveMap<K>) => boolean | string;
  required?: boolean;
  sensitive?: boolean;
};

export type StringEnvDeclaration = BaseEnvDeclaration<"string"> & {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
};

export type NumberEnvDeclaration = BaseEnvDeclaration<"number"> & {
  min?: number;
  max?: number;
};

export type IntegerEnvDeclaration = BaseEnvDeclaration<"integer"> & {
  min?: number;
  max?: number;
};

export type BooleanEnvDeclaration = BaseEnvDeclaration<"boolean"> & {
  strict?: boolean;
};

export type EnvDeclaration =
  | StringEnvDeclaration
  | NumberEnvDeclaration
  | IntegerEnvDeclaration
  | BooleanEnvDeclaration;

export type EnvSchema = {
  [key: string]: EnvDeclaration;
};

export type ParsedEnv<T extends EnvSchema> = {
  [K in keyof T]: T[K]["required"] extends false
    ? PrimitiveMap<T[K]["type"]> | undefined
    : PrimitiveMap<T[K]["type"]>;
};

// The type for the raw, unparsed source
export type RawEnvSource = {
  [key: string]: string | undefined;
};
