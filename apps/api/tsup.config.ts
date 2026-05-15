import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  clean: true,
  outDir: "dist",
  target: "node18",
  sourcemap: true,
});
