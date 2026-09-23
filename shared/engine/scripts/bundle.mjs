// C-02: single-file ES-module engine bundle with no imports; its SHA-256 is engine_build_hash.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("dist/bundle", { recursive: true });
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2020",
  outfile: "dist/bundle/engine.mjs",
  legalComments: "none",
  minify: false,
  treeShaking: true,
});
const code = readFileSync("dist/bundle/engine.mjs", "utf8");
if (/^\s*import\s/m.test(code) || /\brequire\(/.test(code)) throw new Error("engine bundle must have zero imports");
const hash = createHash("sha256").update(code).digest("hex");
writeFileSync("dist/bundle/engine_build_hash.txt", hash + "\n");
console.log("engine_build_hash", hash);
