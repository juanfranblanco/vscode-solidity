import { defineConfig } from "tsup";

export default defineConfig((options)=>({
  entry: ["src/server.ts"],
  outDir: "dist",
  name: "vscode-solidity-server",
  splitting: false,
  clean: true,
  bundle: !options.watch,
  minify: !options.watch,
}));
