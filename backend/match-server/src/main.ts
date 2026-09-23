/** Entrypoint: env config, PostgreSQL or in-memory stores, SIGTERM drain (C-14). */
import { readFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import { MatchServer } from "./server.js";
import { JsonIncidentLog, MemoryDirectory, MemoryJournal } from "./stores.js";
import { PgDirectory, PgJournal, makePool } from "./pg.js";
import { httpResultsSink, httpStartedNotifier } from "./results.js";

const cfg = loadConfig();
const manifestPath = process.env.ENGINE_MANIFEST ?? new URL("../../../shared/engine/dist/bundle/behaviour_manifest.json", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { engine_build_hash: string; behaviour_digests: Record<string, string> };

const incidents = new JsonIncidentLog();
let journal; let directory;
if (cfg.databaseUrl) {
  const pool = makePool(cfg.databaseUrl);
  directory = new PgDirectory(pool);
  journal = new PgJournal(pool);
} else {
  directory = new MemoryDirectory();
  const d = directory;
  journal = new MemoryJournal((room) => d.claims.get(room)?.epoch ?? null);
}

const server = new MatchServer({
  journal, directory, incidents,
  results: httpResultsSink(cfg.apiInternalUrl, cfg.internalApiToken),
  started: httpStartedNotifier(cfg.apiInternalUrl, cfg.internalApiToken),
  seedKey: cfg.seedEncryptionKey,
  engineBuildHash: manifest.engine_build_hash,
  behaviourDigests: manifest.behaviour_digests,
  joinTokenSecret: cfg.joinTokenSecret,
  instanceId: cfg.instanceId,
  instanceUrl: cfg.instanceUrl,
  version: { tag: process.env.RELEASE_TAG ?? "dev", commit: process.env.RELEASE_COMMIT ?? "unknown" },
  timing: {
    seedWaitMs: cfg.seedWaitMs, botDelayMs: cfg.botDelayMs, interHandMs: cfg.interHandMs,
    leaseMs: cfg.leaseMs, renewMs: cfg.renewMs, marginMs: cfg.marginMs,
    turnMsOverride: cfg.turnMsOverride, windowMsOverride: cfg.windowMsOverride,
  },
});

const port = await server.listen(cfg.port);
process.stdout.write(JSON.stringify({ msg: "match-server listening", port, engine_build_hash: manifest.engine_build_hash }) + "\n");
process.on("SIGTERM", () => {
  server.drain(cfg.drainDeadlineMs);
  // stop_grace_period = drain deadline + HAND_STOP_BUDGET_MS + 30 s (C-14); exit when rooms have ended
  const t = setInterval(() => {
    const live = [...server.rooms.values()].filter((r) => r.status === "playing" || r.status === "lobby").length;
    if (live === 0) { clearInterval(t); void server.close().then(() => process.exit(0)); }
  }, 1000);
});
