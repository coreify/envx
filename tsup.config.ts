import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts"
  },
  format: [...(["esm", "cjs"] as const)],
  dts: {
    compilerOptions: {
      ignoreDeprecations: "6.0",
    },
  },
  sourcemap: false,
  splitting: false,
  target: "es2020",
  treeshake: true,
  clean: true,
  minify: "terser" as const,
});
