export type EnvManagerConfig = {
  /** Set to true to enable  scoped environments */
  enableScopes?: boolean;
  /** A mapping of scopes to their respective prefixes */
  scopes?: Record<string, string>;
};

export type EnvVariableType = "string" | "number" | "boolean";

export type PrimitiveMap<T extends EnvVariableType> = T extends "string"
  ? string
  : T extends "number"
  ? number
  : T extends "boolean"
  ? boolean
  : never;

export type EnvDeclaration = {
  [K in EnvVariableType]: {
    type: K;
    validator?: (value: PrimitiveMap<K>) => boolean | string;
    required?: boolean;
  };
}[EnvVariableType];

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
