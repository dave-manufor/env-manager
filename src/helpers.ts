import { EnvManagerConfig, EnvSchema } from "./types";

export function defineEnvSchema<T extends EnvSchema>(schema: T): T {
  return schema;
}

export function defineEnvConfig<T extends EnvManagerConfig>(config: T): T {
  return config;
}
