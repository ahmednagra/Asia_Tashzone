/**
 * Writes dist/bundle/behaviour_manifest.json: engine_build_hash + behaviour digest per profile.
 * The match server admits only clients whose Hello matches (C-23); FastAPI serves the same values in app-config.
 * Run after `pnpm build` and `node scripts/bundle.mjs`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PROFILES, behaviourDigest } from "../dist/index.js";

const dir = new URL("../dist/bundle/", import.meta.url);
let build;
try { build = readFileSync(new URL("engine_build_hash.txt", dir), "utf8").trim(); }
catch { throw new Error("run `node scripts/bundle.mjs` first"); }
const behaviour_digests = {};
for (const id of Object.keys(PROFILES).sort()) behaviour_digests[id] = behaviourDigest(id, build);
const manifest = { engine_build_hash: build, behaviour_digests };
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("behaviour_manifest.json", dir), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
