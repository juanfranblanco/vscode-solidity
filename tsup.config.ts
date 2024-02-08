import { defineConfig, type Options } from "tsup";

export const baseOptions = (options: Options) => ({
  splitting: true,
  clean: true,
  bundle: !options.watch,
  minify: !options.watch,
  sourcemap: true,
})

export default defineConfig(baseOptions);
