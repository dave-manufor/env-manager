import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs", "esm"],
  entry: ["index.ts"],
  dts: true,
  shims: true,
  clean: true,
  outDir: "build",
  skipNodeModulesBundle: true,
});
