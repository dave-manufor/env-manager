import { expectType } from "tsd";
import EnvManager from "../src/EnvManager";
import { defineEnvSchema } from "../src/helpers";
import type { InferParsedEnv, ParsedEnv } from "../src/types";

const schema = defineEnvSchema({
  REQUIRED: { type: "string" },
  OPTIONAL: { type: "string", required: false },
  WITH_DEFAULT: { type: "string", default: "fallback" },
  PORT: { type: "integer" },
  MODE: { type: "enum", values: ["dev", "prod"] as const },
  FLAGS: { type: "json", default: { enabled: true } as { enabled: boolean } },
});

type Inferred = InferParsedEnv<typeof schema>;

expectType<string>({} as Inferred["REQUIRED"]);
expectType<string | undefined>({} as Inferred["OPTIONAL"]);
expectType<string>({} as Inferred["WITH_DEFAULT"]);
expectType<number>({} as Inferred["PORT"]);
expectType<"dev" | "prod">({} as Inferred["MODE"]);
expectType<{ enabled: boolean }>({} as Inferred["FLAGS"]);

const manager = EnvManager.create(schema, {
  REQUIRED: "ok",
  PORT: "3000",
  MODE: "dev",
});

expectType<string>(manager.get("REQUIRED"));
expectType<string | undefined>(manager.get("OPTIONAL"));
expectType<string>(manager.get("WITH_DEFAULT"));
expectType<"dev" | "prod">(manager.get("MODE"));
expectType<ParsedEnv<typeof schema>>(manager.data());
