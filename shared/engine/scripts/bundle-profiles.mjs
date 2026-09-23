// C-22: write Profile Bundles for FastAPI validation (backend/api/app/Schemas/contracts/profile_bundles/*.json).
import { mkdirSync, writeFileSync } from "node:fs";
import { PROFILES, profileBundle } from "../dist/index.js";

const out = new URL("../../../backend/api/app/Schemas/contracts/profile_bundles/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const id of Object.keys(PROFILES).sort()) {
  const b = profileBundle(PROFILES[id]);
  writeFileSync(new URL(`${id}.json`, out), JSON.stringify(b, null, 2) + "\n");
  console.log("bundle", id, b.profile_hash.slice(0, 12));
}
