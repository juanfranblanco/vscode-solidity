import { defineConfig, type Options } from "tsup";
import { baseOptions } from "./tsup.config";

export const extensionOptions = (options: Options): Options => ({
  ...baseOptions(options),
  entry: ["src/extension.ts", "src/server.ts"],
  outDir: "dist/extension",
  noExternal: [/^(?!vscode$).*$/],
  external: ["vscode"],
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      BROWSER: '"vscode"', // https://github.com/solidity-parser/parser/issues/89
    };
  },
});

export default defineConfig(extensionOptions);
